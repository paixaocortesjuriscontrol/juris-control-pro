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

const SYSTEM_PROMPT = `Você é um analista jurídico especializado em recursos no TST.
Sua tarefa: ler trechos de PEÇAS PROCESSUAIS (decisões, acórdãos, intimações, despachos, certidões, recursos)
e extrair informações para preencher campos do formulário "Distribuição TST" e "Dados Benner" do escritório.

Regras:
- Só preencha um campo se houver evidência CLARA no texto. Não invente.
- Para listas (matérias), use termos curtos separados por vírgula.
- Para favorabilidade, use "POSITIVA"/"NEGATIVA" (turma) ou "POSITIVO"/"NEGATIVO" (relator).
- Para chance de êxito use uma das: "PROVÁVEL", "POSSÍVEL", "REMOTA".
- Para aparelhamento use "BEM APARELHADO" ou "MAL APARELHADO".
- Para tema/honra use frase curta (até 200 chars).
- Para datas, use ISO YYYY-MM-DD.
- Devolva APENAS via tool call (preencher_formulario). Campos sem evidência devem ser omitidos do JSON.`;

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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

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

    // Carrega texto indexado dos anexos selecionados (ou todos do processo)
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
                materias_recurso_reclamante: { type: "string" },
                materias_recurso_banco: { type: "string" },
                aparelhamento_reclamante: { type: "string", enum: ["BEM APARELHADO", "MAL APARELHADO"] },
                aparelhamento_banco: { type: "string", enum: ["BEM APARELHADO", "MAL APARELHADO"] },
                chance_exito_reclamante: { type: "string", enum: ["PROVÁVEL", "POSSÍVEL", "REMOTA"] },
                chance_exito_banco: { type: "string", enum: ["PROVÁVEL", "POSSÍVEL", "REMOTA"] },
                honra: { type: "string" },
                tema: { type: "string" },
                execucao: { type: "string" },
                midia_negativa: { type: "string" },
                decisao_quarteirizado: { type: "string" },
                recurso_terceiros: { type: "string" },
                transito_julgado: { type: "boolean" },
                situacao_processo: { type: "string" },
                observacao_advogado: { type: "string" },
              },
            },
            dados_benner: {
              type: "object",
              additionalProperties: false,
              properties: {
                relator: { type: "string" },
                turma: { type: "string" },
                tipo_recurso: { type: "string" },
                recorrente: { type: "string" },
                materia_honra: { type: "string" },
                analise_quarteirizado: { type: "string" },
                risco_midia: { type: "string" },
                risco_descricao: { type: "string" },
                provas_digitais: { type: "string" },
                tem_data_julgamento: { type: "string" },
                data_julgamento: { type: "string" },
                horario_julgamento: { type: "string" },
                tipo_julgamento: { type: "string" },
                situacao_processo: { type: "string" },
                processo_baixado: { type: "string", enum: ["S", "N"] },
                transito_julgado: { type: "boolean" },
                data_transito_julgado: { type: "string" },
                notas: { type: "string" },
                observacoes: { type: "string" },
              },
            },
          },
          required: ["distribuicao_tst", "dados_benner"],
        },
      },
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Processo: ${processoNumero}\n\nTrechos das peças:\n\n${fullText}\n\nUse a função preencher_formulario para devolver SOMENTE os campos com evidência clara.`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "preencher_formulario" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `OpenAI ${aiRes.status}: ${t.substring(0, 300)}` }, 500);
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

    const dist = parsed?.distribuicao_tst || {};
    const benner = parsed?.dados_benner || {};

    // Limpeza: remove campos vazios
    const clean = (obj: any) => {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        out[k] = typeof v === "string" ? v.trim() : v;
      }
      return out;
    };

    return json({
      processo_id: pid,
      distribuicao_tst: clean(dist),
      dados_benner: clean(benner),
      docs_analisados: docIds.length,
      paginas_analisadas: paginas.length,
      tokens: aiJson?.usage || null,
    });
  } catch (e: any) {
    console.error("preencher-form-ia-anexos erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});