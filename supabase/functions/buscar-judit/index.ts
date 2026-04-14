import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JUDIT_API_KEY = Deno.env.get("JUDIT_API_KEY");
    if (!JUDIT_API_KEY) {
      return new Response(JSON.stringify({ error: "JUDIT_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { numero_processo } = await req.json();
    if (!numero_processo) {
      return new Response(JSON.stringify({ error: "Número do processo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnj = numero_processo.trim();
    console.log(`Buscando processo na Judit: ${cnj}`);

    const response = await fetch(
      `https://lawsuits.production.judit.io/lawsuits/${encodeURIComponent(cnj)}`,
      {
        method: "GET",
        headers: {
          "api-key": JUDIT_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Judit API erro ${response.status}: ${errorText}`);
      
      if (response.status === 404) {
        return new Response(JSON.stringify({ error: "Processo não encontrado na base da Judit" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "API Key da Judit inválida ou sem permissão" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Erro na API Judit: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Judit response keys:", Object.keys(data));

    const rd = data.response_data || data;

    // === CLASSIFICAÇÃO / TIPO DE RECURSO ===
    const rawClassification = rd.classification;
    let classificacao: string | null = null;
    if (typeof rawClassification === 'string') {
      classificacao = rawClassification;
    } else if (rawClassification?.name) {
      classificacao = rawClassification.name;
    } else if (rd.classifications && rd.classifications.length > 0) {
      const first = rd.classifications[0];
      classificacao = typeof first === 'string' ? first : first?.name || null;
    }

    // === DATA DE DISTRIBUIÇÃO ===
    const dataDistribuicao = rd.distribution_date
      ? rd.distribution_date.substring(0, 10)
      : null;

    // === RELATOR / JUIZ ===
    // Tentar extrair de cover/judge, judge, ou steps com "relator"
    let relator = rd.judge || null;
    if (!relator && rd.cover?.judge) {
      relator = rd.cover.judge;
    }

    // === TURMA ===
    let turma: string | null = null;
    const courts = rd.courts || [];
    if (Array.isArray(courts)) {
      for (const court of courts) {
        const name = (court.name || court).toString();
        if (/turma|sdi|subse|seção|câmara|órgão especial/i.test(name)) {
          turma = name;
          break;
        }
      }
    } else if (typeof courts === 'string' && /turma|sdi|subse|seção|câmara/i.test(courts)) {
      turma = courts;
    }

    // === TRIBUNAL ===
    const tribunalAcronimo = rd.tribunal_acronym || null;
    let tribunal = null;
    if (tribunalAcronimo) {
      const upper = tribunalAcronimo.toUpperCase();
      if (upper.includes("TST")) tribunal = "TST";
      else if (upper.includes("STF")) tribunal = "STF";
      else if (upper.includes("STJ")) tribunal = "STJ";
      else tribunal = upper;
    }

    // === PARTES ===
    const parties = data.parties || rd.parties || [];
    const poloAtivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "ACTIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");
    const poloPassivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "PASSIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");

    // === SITUAÇÃO ===
    const situacao = rd.status || rd.situation || null;
    let situacaoProcesso = null;
    if (situacao) {
      const sit = situacao.toUpperCase();
      if (sit.includes("ATIVO") || sit === "ATIVA") situacaoProcesso = "Ativo";
      else if (sit.includes("FINALIZADO") || sit.includes("ARQUIVADO")) situacaoProcesso = "Arquivado";
      else if (sit.includes("BAIXADO")) situacaoProcesso = "Baixado";
      else if (sit.includes("SUSPENSO")) situacaoProcesso = "Suspenso";
    }

    // === MOVIMENTAÇÕES (steps) - Análise profunda ===
    const steps = rd.steps || data.steps || [];
    console.log(`Total de steps encontrados: ${steps.length}`);

    // Padrões regex para detectar eventos nos steps
    const PAUTA_REGEX = /pauta|sess[aã]o de julgamento|inclu[ií]d[oa] em pauta|designad[oa].*julgamento|julgamento.*designad/i;
    const RESULTADO_TRANSCENDENCIA_REGEX = /sem transcend[eê]ncia|transcend[eê]ncia n[aã]o reconhecida/i;
    const RESULTADO_NAO_CONHECIDO_REGEX = /n[aã]o conhec|recurso.*n[aã]o.*conhecid/i;
    const RESULTADO_CONHECIDO_PROVIDO_REGEX = /conhecid[oa].*provid[oa]|dar provimento|recurso.*provid/i;
    const RESULTADO_CONHECIDO_NAO_PROVIDO_REGEX = /conhecid[oa].*n[aã]o.*provid|negar provimento|desprovid|improvid/i;
    const BAIXA_REGEX = /baixa definitiva|remetidos os autos [àa] origem|baixados? os autos|autos.*devolvidos|certid[aã]o de tr[aâ]nsito|tr[aâ]nsito em julgado/i;
    const JULGAMENTO_TIPO_REGEX = /julgamento virtual|sess[aã]o virtual|julgamento telepresencial|sess[aã]o telepresencial|julgamento presencial/i;

    let dataJulgamento: string | null = null;
    let horarioJulgamento: string | null = null;
    let tipoJulgamento: string | null = null;
    let temDataJulgamento: string | null = null;
    let resultadoSemTranscendencia = false;
    let resultadoNaoConhecido = false;
    let resultadoConhecidoProvido = false;
    let resultadoConhecidoNaoProvido = false;
    let resultadoOutra: string | null = null;
    let processoBaixado: string | null = null;

    // Processar cada step buscando informações
    for (const step of steps) {
      const content = (step.content || step.title || step.description || "").toString();
      const stepDate = step.step_date || step.date || null;
      const contentLower = content.toLowerCase();

      // --- Pauta / Data de Julgamento ---
      if (PAUTA_REGEX.test(content) && stepDate && !dataJulgamento) {
        // Extrair data do conteúdo ou usar step_date
        const dateMatch = content.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          const parts = dateMatch[1].split('/');
          dataJulgamento = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (stepDate) {
          dataJulgamento = stepDate.substring(0, 10);
        }
        temDataJulgamento = "S";

        // Extrair horário
        const timeMatch = content.match(/(\d{1,2})[h:](\d{2})/);
        if (timeMatch) {
          horarioJulgamento = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }

        // Tipo de julgamento
        if (/virtual/i.test(content)) tipoJulgamento = "Virtual";
        else if (/telepresencial/i.test(content)) tipoJulgamento = "Telepresencial";
        else if (/h[ií]brid/i.test(content)) tipoJulgamento = "Híbrido";
        else if (/presencial/i.test(content)) tipoJulgamento = "Presencial";
      }

      // --- Resultado do julgamento ---
      if (RESULTADO_TRANSCENDENCIA_REGEX.test(content)) {
        resultadoSemTranscendencia = true;
      }
      // Ordem importa: testar "não provido" antes de "provido"
      if (RESULTADO_CONHECIDO_NAO_PROVIDO_REGEX.test(content)) {
        resultadoConhecidoNaoProvido = true;
      } else if (RESULTADO_CONHECIDO_PROVIDO_REGEX.test(content)) {
        resultadoConhecidoProvido = true;
      }
      if (RESULTADO_NAO_CONHECIDO_REGEX.test(content) && !resultadoConhecidoProvido && !resultadoConhecidoNaoProvido) {
        resultadoNaoConhecido = true;
      }

      // --- Baixa definitiva ---
      if (BAIXA_REGEX.test(content)) {
        processoBaixado = "S";
      }
    }

    // Se não encontrou pauta
    if (!temDataJulgamento) temDataJulgamento = "N";
    // Se não encontrou baixa
    if (!processoBaixado) processoBaixado = "N";

    // === SITUAÇÃO DO PROCESSO (derivada das movimentações) ===
    // Prioridade: movimentações > status bruto do PJE
    if (processoBaixado === "S") {
      // Se detectou trânsito em julgado ou baixa nas movimentações
      const TRANSITO_REGEX = /tr[aâ]nsito em julgado|certid[aã]o de tr[aâ]nsito/i;
      const hasTransito = steps.some((s: any) => TRANSITO_REGEX.test((s.content || s.title || "").toString()));
      if (hasTransito) {
        situacaoProcesso = "Trânsito em Julgado";
      } else {
        situacaoProcesso = "Baixado";
      }
    }
    // Se tem resultado (julgamento ocorreu) mas não baixou, manter status do PJE ou marcar como ativo
    // O status bruto do PJE já foi processado acima

    // Comarca/Vara
    const comarca = rd.county || null;
    const vara = rd.courts || null;

    // Último andamento
    const lastStep = data.last_step || rd.last_step || null;

    const result = {
      tipo_recurso: classificacao,
      data_distribuicao: dataDistribuicao,
      relator: relator,
      turma: turma,
      tribunal: tribunal,
      tribunal_acronimo: tribunalAcronimo,
      recorrente: poloAtivo || null,
      polo_passivo: poloPassivo || null,
      situacao_processo: situacaoProcesso,
      comarca: comarca,
      vara: vara,
      // Novos campos extraídos das movimentações
      tem_data_julgamento: temDataJulgamento,
      data_julgamento: dataJulgamento,
      horario_julgamento: horarioJulgamento,
      tipo_julgamento: tipoJulgamento,
      resultado_sem_transcendencia: resultadoSemTranscendencia,
      resultado_nao_conhecido: resultadoNaoConhecido,
      resultado_conhecido_provido: resultadoConhecidoProvido,
      resultado_conhecido_nao_provido: resultadoConhecidoNaoProvido,
      resultado_outra: resultadoOutra,
      processo_baixado: processoBaixado,
      ultimo_andamento: lastStep ? {
        data: lastStep.step_date,
        conteudo: lastStep.content,
      } : null,
      raw_status: situacao,
      raw_classification: classificacao,
      raw_courts: courts,
      total_steps: steps.length,
    };

    console.log("Resultado mapeado:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro buscar-judit:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
