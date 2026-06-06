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

const SYSTEM_PROMPT = `Você é um analista jurídico que lê PEÇAS PROCESSUAIS (petições, decisões,
despachos, certidões, sentenças, acórdãos, contestações) e devolve dados estruturados para
preencher o FORMULÁRIO DE PROCESSO (cadastro do processo no escritório).

REGRA DE OURO
• NUNCA invente. Se a informação não está EXPLÍCITA no documento, OMITA o campo do retorno.
• Não tente preencher campos da Distribuição TST nem de Dados Benner — esta extração é
  exclusivamente para o cadastro/visão geral do PROCESSO.

CAMPOS PERMITIDOS (sempre OMITA quando não houver evidência clara):
  • assunto: assunto principal do processo (string curta).
  • classe: classe processual literal (ex: "Reclamação Trabalhista", "Ação Civil Pública").
  • materia: matéria/área temática (string curta).
  • natureza: natureza da ação (string curta).
  • pedidos: lista textual de pedidos, separada por ";" — extrair da petição inicial / razões de recurso.
  • polo_ativo / polo_passivo: nomes literais separados por " / ".
  • terceiro_envolvido: nomes literais separados por " / ".
  • reclamante / reclamados: idem polos (use o mesmo conteúdo quando aplicável).
  • tribunal: sigla do tribunal (ex: "TST", "TRT-2", "TJSP").
  • justica: "trabalhista" | "comum" | "federal" | "eleitoral" | "militar".
  • esfera: "federal" | "estadual" | "municipal".
  • instancia: "1" | "2" | "superior" | "tribunal_superior".
  • orgao_julgador / vara / comarca / uf.
  • data_distribuicao / data_citacao / data_recebimento: formato AAAA-MM-DD.
  • valor_causa: número decimal (sem R$).
  • valor_condenacao: número decimal, só se houver condenação líquida no documento.
  • fase: descrição curta da fase atual (≤120 chars).
  • status: "ativo" | "suspenso" | "arquivado_definitivamente" | "encerrado".
  • descricao: resumo do processo em até 3 frases factuais (sem juízo de valor).
  • observacoes_processo: observação factual adicional (até 400 chars).
  • andamento_atual: último andamento relevante (até 200 chars).
  • funcao: função/cargo do reclamante quando explícita.
  • periodo_laborado: período laborado quando explícito (ex: "01/2018 a 06/2022").
  • cpf_cnpj_parte_contraria: documento literal.

EVIDÊNCIA
Em "_evidencias" cite o trecho literal (≤200 chars) que sustenta cada campo extraído.

CONFIANÇA
Em "_confianca" classifique cada campo: "alta" | "media" | "baixa".

ALERTAS
Em "_alertas" reporte conflitos entre documentos ou OCR ruim.

SAÍDA
Devolva EXCLUSIVAMENTE via tool call "preencher_processo". Sem markdown, sem texto extra.
Campos sem evidência: OMITA do JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Token inválido" }, 401);

    if (!Deno.env.get("GEMINI_API_KEY")) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const body = await req.json();
    const processoId: string | null = body?.processo_id || null;
    const processoNumero: string = String(body?.processo_numero || "").trim();
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    if (!processoId && !processoNumero) {
      return json({ error: "processo_id ou processo_numero é obrigatório" }, 400);
    }

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
      (docs || []).map((d: any) => [d.id, d.nome])
    );

    const grouped: Record<string, string[]> = {};
    for (const p of paginas as any[]) {
      (grouped[p.documento_id] ||= []).push(`[Pág ${p.pagina}] ${p.conteudo_texto}`);
    }
    const maxChars = 90000;
    const parts: string[] = [];
    let totalChars = 0;
    for (const [docId, pages] of Object.entries(grouped)) {
      const block = `=== ${docNames[docId] || "Documento"} ===\n${pages.join("\n")}`;
      if (totalChars + block.length > maxChars) {
        parts.push(block.substring(0, Math.max(0, maxChars - totalChars)) + "\n[...truncado]");
        break;
      }
      parts.push(block);
      totalChars += block.length;
    }
    const fullText = parts.join("\n\n");

    const tool = {
      type: "function",
      function: {
        name: "preencher_processo",
        description: "Preenche campos do cadastro do PROCESSO com base nas peças.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            processo: {
              type: "object",
              additionalProperties: false,
              properties: {
                assunto: { type: "string" },
                classe: { type: "string" },
                materia: { type: "string" },
                natureza: { type: "string" },
                pedidos: { type: "string" },
                polo_ativo: { type: "string" },
                polo_passivo: { type: "string" },
                terceiro_envolvido: { type: "string" },
                reclamante: { type: "string" },
                reclamados: { type: "string" },
                tribunal: { type: "string" },
                justica: { type: "string" },
                esfera: { type: "string" },
                instancia: { type: "string" },
                orgao_julgador: { type: "string" },
                vara: { type: "string" },
                comarca: { type: "string" },
                uf: { type: "string" },
                data_distribuicao: { type: "string", description: "AAAA-MM-DD" },
                data_citacao: { type: "string", description: "AAAA-MM-DD" },
                data_recebimento: { type: "string", description: "AAAA-MM-DD" },
                valor_causa: { type: "number" },
                valor_condenacao: { type: "number" },
                fase: { type: "string" },
                status: { type: "string" },
                descricao: { type: "string" },
                observacoes_processo: { type: "string" },
                andamento_atual: { type: "string" },
                funcao: { type: "string" },
                periodo_laborado: { type: "string" },
                cpf_cnpj_parte_contraria: { type: "string" },
              },
            },
            _evidencias: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  documento_id: { type: "string" },
                },
              },
            },
            _confianca: {
              type: "object",
              additionalProperties: { type: "string", enum: ["alta", "media", "baixa"] },
            },
            _alertas: { type: "array", items: { type: "string" } },
          },
          required: ["processo"],
        },
      },
    };

    const aiRes = await geminiChatCompletionsFetch({
      model: "gemini-2.5-pro",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Processo: ${processoNumero}`,
            `\nTrechos das peças (ordenados por documento):\n\n${fullText}`,
            `\nUse a função preencher_processo para devolver SOMENTE campos com evidência citável em "_evidencias".`,
          ].join("\n"),
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "preencher_processo" } },
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Gemini ${aiRes.status}: ${t.substring(0, 300)}` }, 500);
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

    const processoOut: Record<string, any> = parsed?.processo || {};
    // Limpeza básica: remove strings vazias.
    for (const k of Object.keys(processoOut)) {
      const v = processoOut[k];
      if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
        delete processoOut[k];
      }
    }

    return json({
      processo_id: pid,
      processo: processoOut,
      alertas: Array.isArray(parsed?._alertas) ? parsed._alertas : [],
      evidencias: parsed?._evidencias || {},
      confianca: parsed?._confianca || {},
    });
  } catch (e: any) {
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});