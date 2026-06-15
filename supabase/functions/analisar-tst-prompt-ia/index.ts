import { createClient } from "npm:@supabase/supabase-js@2";

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

function compactEmptyObjects(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    out[key] = raw;
  }
  return out;
}

async function openAIChatCompletionsFetch(body: any): Promise<Response> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: { message: "OPENAI_API_KEY não configurada" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    return await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: { message: `Falha de rede OpenAI: ${e?.message || e}` } }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
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

    if (!Deno.env.get("OPENAI_API_KEY")) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

    const body = await req.json();
    const promptId: string = String(body?.prompt_id || "").trim();
    const processoId: string | null = body?.processo_id || null;
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    if (!promptId) return json({ error: "prompt_id é obrigatório" }, 400);
    if (!processoId) return json({ error: "processo_id é obrigatório (chave única do processo)" }, 400);

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

    // 2) Confirma o processo_id (chave única)
    const { data: proc } = await supabase
      .from("processos")
      .select("id, numero")
      .eq("id", processoId)
      .maybeSingle();
    if (!proc?.id) return json({ error: "Processo não encontrado pelo id" }, 404);
    const pid = proc.id;
    const processoNumero = proc.numero || "";

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

    // 4) Chama OpenAI direto — tool call livre, devolve sugestões para ambos os formulários
    const tool = {
      type: "function",
      function: {
        name: "preencher_formulario",
        description: "Preenche campos dos formulários Distribuição TST e Dados Benner com base nas peças.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            distribuicao_tst: {
              type: "object",
              additionalProperties: false,
              properties: {
                relator: { type: "string" },
                turma: { type: "string" },
                relator_favorabilidade: { type: "string", enum: ["POSITIVO", "NEGATIVO"] },
                turma_favorabilidade: { type: "string", enum: ["POSITIVA", "NEGATIVA"] },
                parte_recorrente: { type: "string" },
                tipo_recurso_reclamante: { type: "string" },
                tipo_recurso_banco: { type: "string" },
                tipo_recurso_terceiro: { type: "string" },
                materias_recurso_reclamante: { type: "string" },
                materias_recurso_banco: { type: "string" },
                materias_recurso_terceiro: { type: "string" },
                aparelhamento_reclamante: { type: "string", enum: ["BEM APARELHADO", "MAL APARELHADO"] },
                aparelhamento_banco: { type: "string", enum: ["BEM APARELHADO", "MAL APARELHADO"] },
                aparelhamento_terceiro: { type: "string", enum: ["BEM APARELHADO", "MAL APARELHADO"] },
                chance_exito_reclamante: { type: "string", enum: ["PROVÁVEL", "POSSÍVEL", "REMOTA"] },
                chance_exito_banco: { type: "string", enum: ["PROVÁVEL", "POSSÍVEL", "REMOTA"] },
                chance_exito_terceiro: { type: "string", enum: ["PROVÁVEL", "POSSÍVEL", "REMOTA"] },
                honra: { type: "string" },
                tema: { type: "string" },
                execucao: { type: "string" },
                midia_negativa: { type: "string", enum: ["S", "N"] },
                decisao_quarteirizado: { type: "string" },
                recurso_terceiros: { type: "string" },
                transito_julgado: { type: "boolean" },
                situacao_processo: { type: "string" },
                data_transito_julgado: { type: "string", description: "DD/MM/AAAA" },
                observacao_advogado: { type: "string" },
              },
            },
            dados_benner: {
              type: "object",
              additionalProperties: false,
              properties: {
                analise_quarteirizado: { type: "string" },
                risco_descricao: { type: "string" },
                provas_digitais: { type: "string", enum: ["S", "N"] },
                tem_data_julgamento: { type: "string", enum: ["S", "N"] },
                data_julgamento: { type: "string", description: "DD/MM/AAAA" },
                horario_julgamento: { type: "string", description: "HH:MM 24h" },
                tipo_julgamento: { type: "string", enum: ["Virtual", "Telepresencial", "Híbrido", "Presencial"] },
                situacao_processo: { type: "string" },
                processo_baixado: { type: "string", enum: ["S", "N"] },
                transito_julgado: { type: "boolean" },
                data_transito_julgado: { type: "string", description: "DD/MM/AAAA" },
                entrega_memoriais: { type: "string", enum: ["S", "N"] },
                sustentacao_oral: { type: "string", enum: ["S", "N", "Não cabe"] },
                notas: { type: "string" },
                observacoes: { type: "string" },
              },
            },
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
Use APENAS as chaves definidas no schema do tool (campos do formulário Distribuição TST e Dados Benner).
O prompt customizado do advogado abaixo é obrigatório e deve orientar a INTERPRETAÇÃO das peças.
Se o prompt customizado disser para aguardar o comando "Analise", considere que esse comando JÁ FOI DADO nesta chamada.
Mapeie a resposta solicitada pelo prompt para as chaves do schema; não devolva texto livre fora do tool call.`;

    const userPrompt = [
      `PROMPT CUSTOMIZADO DO ADVOGADO ("${promptRow.titulo}"):`,
      "----------",
      String(promptRow.prompt || "").trim(),
      "----------",
      ``,
      `COMANDO: Analise`,
      `Aplique integralmente o prompt customizado acima aos documentos indexados abaixo e preencha os campos compatíveis do formulário.`,
      ``,
      `Processo: ${processoNumero || pid}`,
      ``,
      `Trechos das peças anexadas (ordenados por documento):`,
      ``,
      fullText,
      ``,
      `Devolva via tool call "preencher_formulario" SOMENTE campos com evidência citável no texto.`,
    ].join("\n");

    const modeloSalvo = String(promptRow.modelo || "").trim();
    const modelo = modeloSalvo.startsWith("gpt-") ? modeloSalvo : "gpt-4o-mini";
    const aiRes = await openAIChatCompletionsFetch({
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
      console.error("OpenAI erro analisar-tst-prompt-ia:", aiRes.status, t.substring(0, 1000));
      return json({ error: `OpenAI ${aiRes.status}: ${t.substring(0, 400)}` }, 500);
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

    const distribuicaoTst = compactEmptyObjects(parsed?.distribuicao_tst) || {};
    const dadosBenner = compactEmptyObjects(parsed?.dados_benner) || {};

    return json({
      processo_id: pid,
      prompt_id: promptId,
      prompt_titulo: promptRow.titulo,
      modelo,
      distribuicao_tst: distribuicaoTst,
      dados_benner: dadosBenner,
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