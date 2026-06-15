import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletionsFetch } from "../_shared/gemini-openai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Roda IA com PROMPT CUSTOMIZADO cadastrado pelo advogado em "Prompt IA TST".
 * Recebe:
 *  - prompt_id (uuid) — referência à tabela prompts_ia_tst
 *  - processo_id / processo_numero
 *  - documento_ids: anexos já indexados em documentos_texto_indexado
 * Retorna a mesma estrutura de `preencher-form-ia-anexos` para reaproveitar a
 * pintura de campos azuis (iaSugestao) nos formulários da Distribuição TST.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    if (!Deno.env.get("GEMINI_API_KEY")) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const body = await req.json();
    const promptId: string = String(body?.prompt_id || "").trim();
    const processoId: string | null = body?.processo_id || null;
    const processoNumero: string = String(body?.processo_numero || "").trim();
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    if (!promptId) return json({ error: "prompt_id é obrigatório" }, 400);
    if (!processoId && !processoNumero) return json({ error: "processo_id ou processo_numero é obrigatório" }, 400);

    // 1) Carrega prompt (RLS é por coordenação)
    const promptClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: promptRow, error: promptErr } = await promptClient
      .from("prompts_ia_tst")
      .select("id, titulo, prompt, modelo, ativo")
      .eq("id", promptId)
      .maybeSingle();
    if (promptErr || !promptRow) return json({ error: "Prompt não encontrado ou sem acesso" }, 404);
    if (!promptRow.ativo) return json({ error: "Prompt está inativo" }, 400);

    // 2) Resolve processo_id
    let pid = processoId;
    if (!pid) {
      const { data: proc } = await supabase
        .from("processos")
        .select("id")
        .eq("numero", processoNumero)
        .maybeSingle();
      pid = proc?.id || null;
    }
    if (!pid) return json({ error: "Processo não encontrado" }, 404);

    // 3) Carrega texto indexado dos anexos
    let q = supabase
      .from("documentos_texto_indexado")
      .select("documento_id, pagina, conteudo_texto")
      .eq("processo_id", pid)
      .order("documento_id")
      .order("pagina")
      .limit(800);
    if (documentoIds.length > 0) q = q.in("documento_id", documentoIds);
    const { data: paginas, error: pagErr } = await q;
    if (pagErr) return json({ error: "Erro ao carregar texto: " + pagErr.message }, 500);
    if (!paginas || paginas.length === 0) {
      return json({ error: "Nenhum texto indexado para os anexos selecionados." }, 400);
    }

    const docIds = [...new Set(paginas.map((p: any) => p.documento_id))];
    const { data: docs } = await supabase
      .from("documentos")
      .select("id, nome")
      .in("id", docIds);
    const docNames: Record<string, string> = Object.fromEntries(
      (docs || []).map((d: any) => [d.id, d.nome]),
    );

    const grouped: Record<string, string[]> = {};
    for (const p of paginas as any[]) {
      (grouped[p.documento_id] ||= []).push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
    }
    const maxChars = 90000;
    const parts: string[] = [];
    let total = 0;
    for (const [docId, pages] of Object.entries(grouped)) {
      const block = `=== ${docNames[docId] || "Documento"} ===\n${pages.join("\n")}`;
      if (total + block.length > maxChars) {
        parts.push(block.substring(0, Math.max(0, maxChars - total)) + "\n[...truncado]");
        break;
      }
      parts.push(block);
      total += block.length;
    }
    const fullText = parts.join("\n\n");

    // 4) Chama Gemini — tool call livre, devolve sugestões para ambos os formulários
    const tool = {
      type: "function",
      function: {
        name: "preencher_formulario",
        description: "Devolve sugestões dos campos da Distribuição TST e Dados Benner a partir do prompt customizado e dos anexos.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            distribuicao_tst: { type: "object", additionalProperties: true },
            dados_benner: { type: "object", additionalProperties: true },
            resumo: { type: "string", description: "Resumo de 2–4 linhas do que foi extraído." },
            alertas: { type: "array", items: { type: "string" } },
          },
          required: ["distribuicao_tst", "dados_benner"],
        },
      },
    };

    const systemPrompt = `Você é um assistente jurídico que analisa peças do TST.
REGRA DE OURO: NUNCA invente. Se não houver evidência no texto, OMITA o campo.
Devolva EXCLUSIVAMENTE via tool call "preencher_formulario".
Os campos de "distribuicao_tst" e "dados_benner" devem usar os nomes/colunas que o advogado mencionar no prompt customizado abaixo.
Quando o prompt customizado pedir explicitamente que algum campo seja preenchido, use o nome literal do campo.`;

    const userPrompt = [
      `PROMPT CUSTOMIZADO DO ADVOGADO ("${promptRow.titulo}"):`,
      "----------",
      String(promptRow.prompt || "").trim(),
      "----------",
      ``,
      `Processo: ${processoNumero || pid}`,
      ``,
      `Trechos das peças anexadas (ordenados por documento):`,
      ``,
      fullText,
      ``,
      `Devolva via tool call "preencher_formulario" SOMENTE campos com evidência citável no texto.`,
    ].join("\n");

    const modelo = String(promptRow.modelo || "gemini-2.5-flash");
    const aiRes = await geminiChatCompletionsFetch({
      model: modelo,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "preencher_formulario" } },
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Gemini ${aiRes.status}: ${t.substring(0, 400)}` }, 500);
    }
    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "IA não retornou tool call" }, 500);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return json({ error: "Falha ao parsear resposta da IA" }, 500);
    }

    return json({
      processo_id: pid,
      prompt_id: promptId,
      prompt_titulo: promptRow.titulo,
      modelo,
      distribuicao_tst: parsed?.distribuicao_tst || {},
      dados_benner: parsed?.dados_benner || {},
      resumo: parsed?.resumo || null,
      alertas: Array.isArray(parsed?.alertas) ? parsed.alertas : [],
      docs_analisados: docIds.length,
      paginas_analisadas: paginas.length,
      tokens: aiJson?.usage || null,
    });
  } catch (e: any) {
    console.error("analisar-tst-prompt-ia erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});