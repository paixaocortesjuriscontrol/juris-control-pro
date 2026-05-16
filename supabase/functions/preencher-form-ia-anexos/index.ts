import { createClient } from "npm:@supabase/supabase-js@2";
import { validarEHidratar, type DadosJudit } from "./validar.ts";

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

const SYSTEM_PROMPT = `Você é um analista de Direito do Trabalho especializado em recursos no TST.
Sua tarefa: ler trechos de PEÇAS PROCESSUAIS (acórdãos, decisões monocráticas, intimações,
pautas, despachos, certidões) e devolver dados estruturados para preencher os formulários
"Distribuição TST" e "Dados Benner" do escritório.

REGRA DE OURO
• NUNCA invente. Se a informação não está EXPLÍCITA no documento ou nos dados estruturados
  da Judit, OMITA o campo do retorno. "Não sei" é resposta válida — alucinar não é.
• Inferência razoável é permitida APENAS para os campos derivados por regra (ex: tem_data_julgamento).

CAMPOS DA JUDIT (NÃO REESCREVA)
Os seguintes campos serão sobrescritos pelos dados estruturados da Judit APÓS sua resposta.
Você pode mencioná-los se quiser, mas NÃO se preocupe em extraí-los do PDF nem reformatá-los:
  • dossie, tribunal, tipo_recurso, data_distribuicao, turma, relator, parte_recorrente, recorrente,
    situacao_processo (Ativo / Trânsito em Julgado / etc.).

REGRA CRÍTICA — TRÂNSITO EM JULGADO
• Se "DADOS DA JUDIT" informar situacao_processo = "Ativo" (ou "Em curso", "Em tramitação")
  OU processo_baixado = "N",
  você está PROIBIDO de devolver:
    - distribuicao_tst.transito_julgado = true
    - dados_benner.transito_julgado = true
    - dados_benner.processo_baixado = "S"
    - dados_benner.data_transito_julgado
  Mesmo que algum PDF contenha "trânsito em julgado" ou "certidão de baixa", a Judit é
  fonte de verdade sobre o estado atual do processo. Se houver conflito, registre em
  "_alertas" como "Acórdão menciona trânsito mas Judit indica processo ATIVO" e OMITA
  os campos acima do retorno.
• Só marque trânsito em julgado quando a Judit NÃO contradiga e você tiver certidão
  de baixa explícita citável em "_evidencias".

CAMPOS QUE VOCÊ DEVE EXTRAIR (e SOMENTE quando houver evidência clara):

▸ Em "distribuicao_tst":
  - materias_recurso_reclamante / materias_recurso_banco:
    LISTA EXAUSTIVA de matérias (termos curtos separados por vírgula), uma por matéria
    suscitada no recurso DAQUELE lado. Exemplos: "horas extras, intervalo intrajornada,
    adicional de insalubridade, multa do art. 467 CLT".
    REGRAS OBRIGATÓRIAS:
      • Leia PREFERENCIALMENTE a petição de RECURSO DE REVISTA (ou de Embargos/Agravo) de
        cada lado, NÃO só o acórdão. O acórdão pode mencionar matérias decididas que NÃO
        foram objeto do recurso, e vice-versa. Quando houver "RAZÕES DE RECURSO" ou
        "TÓPICOS DO RECURSO" ou "DA PRELIMINAR" / "DO MÉRITO" identifique cada tópico
        como uma matéria.
      • Separe explicitamente o que é do RECLAMANTE e o que é do BANCO/RECLAMADO.
        Se ambos recorrerem (recurso bilateral) os dois campos devem ser preenchidos.
      • Inclua o fundamento legal quando o documento citar (ex: "Suspensão da prescrição
        (Lei 14.010/2020)", "Limitação aos valores da inicial (Art. 840, §1º CLT)").
      • NÃO confunda matérias do recurso com matérias da reclamação original. Só vale
        o que foi efetivamente DEVOLVIDO ao TST/TRT no recurso.
      • Se o PDF do recurso não estiver disponível e só houver o acórdão, extraia as
        matérias dos TÓPICOS DECIDIDOS do acórdão e adicione em "_alertas":
        "matérias extraídas do acórdão por ausência do recurso — revisar".
      • Se identificar uma matéria mas não tiver certeza de qual lado a suscitou,
        adicione em "_alertas" "matéria X com lado indeterminado" e OMITA do campo.
  - tipo_recurso_reclamante / tipo_recurso_banco: literal Judit; omita se não tiver certeza.
  - honra: frase curta sobre matéria de honra (≤200 chars), só se houver "destaque", "matéria de honra",
    "destacado pelo relator" no documento.
  - tema: tema central do recurso em até 200 chars.
  - execucao: descrição em fase de execução, se houver.
  - midia_negativa: "S" ou "N" — só preencha se houver evidência (ex: notícia anexada).
  - decisao_quarteirizado: descrição da decisão sobre quarteirização, só se houver.
  - recurso_terceiros: idem.
  - transito_julgado: true se houver certidão de baixa / trânsito explícito.
    NUNCA preencher se a Judit indicar processo Ativo — ver regra crítica acima.
  - situacao_processo: descrição curta do estado atual.
  - observacao_advogado: resumo factual de até 2 frases, sem juízo de valor.

▸ Em "dados_benner":
  - materia_honra: "S" ou "N".
  - provas_digitais: "S" se o recurso/acórdão menciona "prova digital", "documento eletrônico",
    "WhatsApp", "e-mail como prova", "gravação", "ata notarial digital", "blockchain"
    como objeto de discussão probatória. "N" se claramente não há.
  - tem_data_julgamento: "S" se há sessão marcada/realizada; "N" caso contrário.
  - data_julgamento: DD/MM/AAAA — pegar a data MAIS RECENTE entre certidão de pauta,
    intimação de julgamento e acórdão. Adiamento vence pauta antiga.
  - horario_julgamento: HH:MM (24h). "às 9h" → "09:00".
  - tipo_julgamento: "Virtual" | "Telepresencial" | "Híbrido" | "Presencial".
    Mapear: "plenário virtual"/"julgamento virtual"→Virtual; "telepresencial"/"videoconferência"→Telepresencial;
    "híbrido"/"misto"→Híbrido; "presencial"/"sessão presencial"→Presencial.
  - processo_baixado: "S" se há "baixa definitiva", "remetidos os autos à origem",
    "trânsito em julgado e baixa". "N" caso contrário.
  - data_transito_julgado: DD/MM/AAAA, só se houver certidão explícita.
  - notas / observacoes: resumo factual de até 2 frases.

EVIDÊNCIA OBRIGATÓRIA
Para CADA campo que você preencher (exceto os derivados por regra), inclua em "_evidencias"
o trecho literal (até 200 chars) que sustenta a extração:
  "_evidencias": { "data_julgamento": { "trecho": "...sessão de 06/06/2025 às 14h..." } }
Se não conseguir citar trecho literal, NÃO preencha o campo.

CONFIANÇA
Para cada campo extraído, classifique em "_confianca":
  "alta"  → trecho literal e inequívoco no documento
  "media" → exigiu interpretação leve (ex: "às 9h" → "09:00")
  "baixa" → houve ambiguidade, datas conflitantes, OCR ruim

ALERTAS
Em "_alertas" (array de strings curtas), reporte: conflito entre documentos, PDF ilegível,
provimento parcial (acórdão deu provimento em parte e negou em parte), recurso bilateral
(ambas as partes recorreram), acórdão posterior à certidão de baixa.

CAMPOS QUE NÃO DEVEM SER PREENCHIDOS POR ESTE PROMPT
Estes exigem juízo do advogado ou base de jurisprudência externa. Sempre OMITA:
  honra (juízo), midia_negativa (juízo), aparelhamento_*, chance_exito_*,
  relator_favorabilidade, turma_favorabilidade, decisao_quarteirizado.
(O sistema marcará automaticamente como pendentes de revisão humana.)

SAÍDA
Devolva EXCLUSIVAMENTE via tool call "preencher_formulario". Sem markdown, sem texto extra.
Campos sem evidência: OMITA do JSON (não devolva null nem string vazia).`;

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
    const dadosJudit: DadosJudit | null = body?.dados_judit && typeof body.dados_judit === "object"
      ? body.dados_judit
      : null;

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
                relator_favorabilidade: { type: "string", enum: ["POSITIVO", "NEGATIVO"] },
                turma_favorabilidade: { type: "string", enum: ["POSITIVA", "NEGATIVA"] },
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
                midia_negativa: { type: "string", enum: ["S", "N"] },
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
                materia_honra: { type: "string", enum: ["S", "N"] },
                analise_quarteirizado: { type: "string" },
                risco_midia: { type: "string", enum: ["S", "N"] },
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
                notas: { type: "string" },
                observacoes: { type: "string" },
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
              description: "Mapa campo→{trecho citado, documento_id}. Obrigatório para cada campo extraído de PDF.",
            },
            _confianca: {
              type: "object",
              additionalProperties: { type: "string", enum: ["alta", "media", "baixa"] },
            },
            _alertas: { type: "array", items: { type: "string" } },
            _campos_pendentes_revisao_humana: { type: "array", items: { type: "string" } },
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
            content: [
              `Processo: ${processoNumero}`,
              dadosJudit
                ? `\nDADOS DA JUDIT (já confirmados, NÃO reextrair, serão sobrescritos pelo sistema):\n${JSON.stringify(dadosJudit, null, 2)}`
                : `\n(Sem dados da Judit disponíveis para este processo.)`,
              `\nTrechos das peças (ordenados por documento):\n\n${fullText}`,
              `\nUse a função preencher_formulario para devolver SOMENTE campos com evidência citável em "_evidencias".`,
            ].join("\n"),
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

    // Camada 4 — validação programática + hidratação Judit determinística.
    const validado = validarEHidratar(
      {
        distribuicao_tst: parsed?.distribuicao_tst || {},
        dados_benner: parsed?.dados_benner || {},
        _evidencias: parsed?._evidencias || {},
        _confianca: parsed?._confianca || {},
        _alertas: parsed?._alertas || [],
        _campos_pendentes_revisao_humana: parsed?._campos_pendentes_revisao_humana || [],
      },
      dadosJudit
    );

    return json({
      processo_id: pid,
      distribuicao_tst: validado.distribuicao_tst,
      dados_benner: validado.dados_benner,
      alertas: validado.alertas,
      pendentes: validado.pendentes,
      evidencias: validado.evidencias,
      judit_aplicado: validado.judit_aplicado,
      docs_analisados: docIds.length,
      paginas_analisadas: paginas.length,
      tokens: aiJson?.usage || null,
    });
  } catch (e: any) {
    console.error("preencher-form-ia-anexos erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});