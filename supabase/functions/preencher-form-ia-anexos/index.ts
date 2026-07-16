import { createClient } from "npm:@supabase/supabase-js@2";
import { validarEHidratar, type DadosJudit } from "./validar.ts";
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

const SYSTEM_PROMPT = `Você é um analista de Direito do Trabalho especializado em recursos no TST.
Sua tarefa: ler trechos de PEÇAS PROCESSUAIS (acórdãos, decisões monocráticas, intimações,
pautas, despachos, certidões) e devolver dados estruturados para preencher o formulário
unificado "Distribuição TST" do escritório (a aba "Dados Benner" foi consolidada nele).

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
  - materias_recurso_reclamante / materias_recurso_banco / materias_recurso_terceiro:
    LISTA EXAUSTIVA de matérias (termos curtos separados por vírgula), uma por matéria
    suscitada no recurso DAQUELE lado. Exemplos: "horas extras, intervalo intrajornada,
    adicional de insalubridade, multa do art. 467 CLT".
    REGRAS OBRIGATÓRIAS:
      • Leia PREFERENCIALMENTE a petição de RECURSO DE REVISTA (ou de Embargos/Agravo) de
        cada lado, NÃO só o acórdão. O acórdão pode mencionar matérias decididas que NÃO
        foram objeto do recurso, e vice-versa. Quando houver "RAZÕES DE RECURSO" ou
        "TÓPICOS DO RECURSO" ou "DA PRELIMINAR" / "DO MÉRITO" identifique cada tópico
        como uma matéria.
      • Separe explicitamente o que é do RECLAMANTE, do BANCO (reclamada principal —
        normalmente o Banco Santander/Bradesco/etc. do escritório) e o que é de
        OUTRO RECLAMADO OU TERCEIRO (ex.: empresa terceirizada, prestadora de serviço,
        litisconsorte passivo que não é o banco, terceiro interessado, MPT, sindicato).
        Se mais de um lado recorrer, preencha TODOS os campos correspondentes.
      • IMPORTANTE — "Recurso de outro Reclamado ou de terceiro":
        Quando o documento mencionar recurso interposto por parte do polo passivo que
        NÃO é o banco principal do escritório (ex.: empresa terceirizada quando o banco
        é o segundo réu, ou litisconsorte como SERVIBANCA, ATENTO, ALGAR, etc.),
        preencha em \`tipo_recurso_terceiro\`, \`materias_recurso_terceiro\` e — se houver
        evidência — \`aparelhamento_terceiro\`/\`chance_exito_terceiro\`.
        NÃO confunda com o recurso do BANCO. Use o nome do recorrente literal da peça
        para decidir e cite-o em "_evidencias.tipo_recurso_terceiro".
      • Inclua o fundamento legal quando o documento citar (ex: "Suspensão da prescrição
        (Lei 14.010/2020)", "Limitação aos valores da inicial (Art. 840, §1º CLT)").
      • NÃO confunda matérias do recurso com matérias da reclamação original. Só vale
        o que foi efetivamente DEVOLVIDO ao TST/TRT no recurso.
      • Se o PDF do recurso não estiver disponível e só houver o acórdão, extraia as
        matérias dos TÓPICOS DECIDIDOS do acórdão e adicione em "_alertas":
        "matérias extraídas do acórdão por ausência do recurso — revisar".
      • Se identificar uma matéria mas não tiver certeza de qual lado a suscitou,
        adicione em "_alertas" "matéria X com lado indeterminado" e OMITA do campo.
  - tipo_recurso_reclamante / tipo_recurso_banco / tipo_recurso_terceiro:
    literal Judit/peça; omita se não tiver certeza. \`tipo_recurso_terceiro\` é o tipo de
    recurso interposto por outro reclamado/terceiro (NÃO o banco principal).
  - honra: frase curta sobre matéria de honra (≤200 chars), só se houver "destaque", "matéria de honra",
    "destacado pelo relator" no documento.
  - tema: tema central do recurso em até 200 chars.
  - execucao: descrição em fase de execução, se houver.
  - midia_negativa: "S" ou "N" — só preencha se houver evidência (ex: notícia anexada).
  - decisao_quarteirizado: descrição da decisão/análise sobre quarteirização, só se houver
    (campo único — substitui o antigo "analise_quarteirizado").
  - recurso_terceiros: idem.
  - transito_julgado: true se houver certidão de baixa / trânsito explícito.
    NUNCA preencher se a Judit indicar processo Ativo — ver regra crítica acima.
  - situacao_processo: descrição curta do estado atual.
  - observacao_advogado: resumo factual de até 2 frases, sem juízo de valor.
  - risco_descricao: descrição curta do risco identificado, só se houver evidência.
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

▸ Em "dados_benner": (BLOCO RESERVADO — atualmente vazio; tudo foi consolidado em
  "distribuicao_tst". NÃO devolva campos aqui; o sistema ignora.)

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

    if (!(Deno.env.get("GEMINI_API_KEY_DJEN") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY"))) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

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
      .limit(5000);
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

    // Prioriza peças substantivas (acórdão, RR, sentença, etc.) antes de cortar/dividir.
    const SUBSTANTIVE = /(ac[oó]rd[aã]o|recurso\s+de\s+revista|\brr\b|airr|senten[cç]a|decis[aã]o\s+monocr[aá]tica|embargos|contesta[cç][aã]o|certid[aã]o\s+de\s+baixa|intima[cç][aã]o\s+de\s+pauta|pauta)/i;
    const docEntries = Object.entries(grouped).map(([docId, pages]) => {
      const nome = docNames[docId] || "Documento";
      const block = `=== ${nome} ===\n${pages.join("\n")}`;
      return { docId, nome, block, substantive: SUBSTANTIVE.test(nome) };
    });
    docEntries.sort((a, b) => (a.substantive === b.substantive ? 0 : a.substantive ? -1 : 1));

    // Divide em chunks respeitando limite de chars (≈150k tokens cada).
    const maxChars = 600_000;
    const chunks: string[] = [];
    let buf: string[] = [];
    let bufChars = 0;
    for (const { block } of docEntries) {
      if (block.length > maxChars) {
        // documento gigante vira chunk próprio (truncado)
        if (buf.length) { chunks.push(buf.join("\n\n")); buf = []; bufChars = 0; }
        chunks.push(block.substring(0, maxChars) + "\n[...truncado]");
        continue;
      }
      if (bufChars + block.length > maxChars && buf.length) {
        chunks.push(buf.join("\n\n"));
        buf = [];
        bufChars = 0;
      }
      buf.push(block);
      bufChars += block.length + 2;
    }
    if (buf.length) chunks.push(buf.join("\n\n"));

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
                observacao_advogado: { type: "string" },
                risco_descricao: { type: "string" },
                provas_digitais: { type: "string", enum: ["S", "N"] },
                tem_data_julgamento: { type: "string", enum: ["S", "N"] },
                data_julgamento: { type: "string", description: "DD/MM/AAAA" },
                horario_julgamento: { type: "string", description: "HH:MM 24h" },
                tipo_julgamento: { type: "string", enum: ["Virtual", "Telepresencial", "Híbrido", "Presencial"] },
                processo_baixado: { type: "string", enum: ["S", "N"] },
                data_transito_julgado: { type: "string", description: "DD/MM/AAAA" },
              },
            },
            dados_benner: {
              type: "object",
              additionalProperties: false,
              description: "Bloco legado mantido por compatibilidade. NÃO preencher.",
              properties: {},
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

    // Dispara N chamadas em paralelo (uma por chunk) e mescla as respostas.
    const judiBlock = dadosJudit
      ? `\nDADOS DA JUDIT (já confirmados, NÃO reextrair, serão sobrescritos pelo sistema):\n${JSON.stringify(dadosJudit, null, 2)}`
      : `\n(Sem dados da Judit disponíveis para este processo.)`;

    const callChunk = async (chunkText: string, idx: number) => {
      const res = await geminiChatCompletionsFetch({
        model: "gemini-2.5-flash",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Processo: ${processoNumero}`,
              chunks.length > 1
                ? `\n[PARTE ${idx + 1} de ${chunks.length}] — Você está vendo apenas um subconjunto das peças. Extraia o que estiver evidente AQUI; campos sem evidência neste lote serão preenchidos por outras partes. NÃO invente para "completar".`
                : "",
              judiBlock,
              `\nTrechos das peças (ordenados por documento):\n\n${chunkText}`,
              `\nUse a função preencher_formulario para devolver SOMENTE campos com evidência citável em "_evidencias".`,
            ].filter(Boolean).join("\n"),
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "preencher_formulario" } },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Gemini ${res.status} no chunk ${idx + 1}: ${t.substring(0, 200)}`);
      }
      const j = await res.json();
      const tc = j?.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) throw new Error(`IA não retornou tool call no chunk ${idx + 1}`);
      const p = JSON.parse(tc.function.arguments);
      return { parsed: p, usage: j?.usage || null };
    };

    const settled = await Promise.allSettled(chunks.map((c, i) => callChunk(c, i)));
    const okResults: Array<{ parsed: any; usage: any }> = [];
    const chunkErrors: string[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") okResults.push(s.value);
      else chunkErrors.push(`chunk ${i + 1}: ${s.reason?.message || String(s.reason)}`);
    });
    if (okResults.length === 0) {
      return json({ error: `Todas as chamadas falharam. ${chunkErrors.join(" | ")}` }, 500);
    }

    // ----- Merge das respostas -----
    const confRank: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
    const LIST_FIELDS = new Set([
      "materias_recurso_reclamante",
      "materias_recurso_banco",
      "materias_recurso_terceiro",
    ]);
    const dist: Record<string, any> = {};
    const distConf: Record<string, string> = {};
    const evid: Record<string, any> = {};
    const conf: Record<string, string> = {};
    const alertas: string[] = [];
    const pendentes: string[] = [];
    const conflicts: Record<string, Set<string>> = {};

    for (const { parsed: p } of okResults) {
      const d = p?.distribuicao_tst || {};
      const cMap = p?._confianca || {};
      const eMap = p?._evidencias || {};
      for (const [k, v] of Object.entries(d)) {
        if (v === undefined || v === null || v === "") continue;
        if (LIST_FIELDS.has(k) && typeof v === "string") {
          const existing = typeof dist[k] === "string" ? dist[k] : "";
          const merged = new Set(
            [...existing.split(","), ...v.split(",")]
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean),
          );
          // mantém capitalização da última ocorrência
          const all = [...existing.split(","), ...v.split(",")].map((s) => s.trim()).filter(Boolean);
          const seen = new Set<string>();
          const out: string[] = [];
          for (const item of all) {
            const key = item.toLowerCase();
            if (merged.has(key) && !seen.has(key)) { seen.add(key); out.push(item); }
          }
          dist[k] = out.join(", ");
          if (eMap[k]) evid[k] = eMap[k];
          continue;
        }
        const newConf = cMap[k] || "media";
        const curConf = distConf[k];
        if (!(k in dist)) {
          dist[k] = v;
          distConf[k] = newConf;
          if (eMap[k]) evid[k] = eMap[k];
          if (cMap[k]) conf[k] = cMap[k];
        } else {
          // conflito: registra se valores diferentes
          if (JSON.stringify(dist[k]) !== JSON.stringify(v)) {
            (conflicts[k] ||= new Set()).add(String(dist[k]));
            conflicts[k].add(String(v));
          }
          if ((confRank[newConf] || 0) > (confRank[curConf] || 0)) {
            dist[k] = v;
            distConf[k] = newConf;
            if (eMap[k]) evid[k] = eMap[k];
            if (cMap[k]) conf[k] = cMap[k];
          }
        }
      }
      for (const a of (p?._alertas || [])) if (typeof a === "string") alertas.push(a);
      for (const a of (p?._campos_pendentes_revisao_humana || [])) if (typeof a === "string") pendentes.push(a);
    }
    for (const [k, set] of Object.entries(conflicts)) {
      if (set.size > 1) alertas.push(`Valores divergentes entre chunks para "${k}": ${[...set].join(" | ")} — mantido o de maior confiança.`);
    }
    for (const e of chunkErrors) alertas.push(`Falha parcial: ${e}`);

    const mergedParsed = {
      distribuicao_tst: dist,
      dados_benner: {},
      _evidencias: evid,
      _confianca: conf,
      _alertas: [...new Set(alertas)],
      _campos_pendentes_revisao_humana: [...new Set(pendentes)],
    };

    // Camada 4 — validação programática + hidratação Judit determinística.
    const validado = validarEHidratar(mergedParsed, dadosJudit);

    const totalUsage = okResults.reduce((acc, r) => {
      if (!r.usage) return acc;
      acc.prompt_tokens += r.usage.prompt_tokens || 0;
      acc.completion_tokens += r.usage.completion_tokens || 0;
      acc.total_tokens += r.usage.total_tokens || 0;
      return acc;
    }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });

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
      chunks_executados: okResults.length,
      chunks_totais: chunks.length,
      chars_enviados: chunks.reduce((a, c) => a + c.length, 0),
      tokens: totalUsage,
    });
  } catch (e: any) {
    console.error("preencher-form-ia-anexos erro:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});