import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extrairOrgaoJulgador, derivarTurmaDoRelator, derivarRelatorDaTurma } from "../_shared/extrair-relator.ts";

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

    // ========== MOVIMENTAÇÕES (steps) - EXTRAIR PRIMEIRO ==========
    const steps = rd.steps || data.steps || [];
    console.log(`Total de steps encontrados: ${steps.length}`);

    // Log de amostra dos primeiros steps para debug
    if (steps.length > 0) {
      console.log("Amostra steps (primeiros 3):", JSON.stringify(steps.slice(0, 3).map((s: any) => ({
        date: s.step_date || s.date,
        content: (s.content || s.title || "").toString().substring(0, 200),
        code: s.code || s.movement_code,
      }))));
    }

    // ========== DOSSIÊ ==========
    // Tentar múltiplas fontes para o dossiê
    let dossie: string | null = rd.dossie || rd.dossier || rd.folder || rd.case_number || null;
    // Tentar extrair do campo cover
    if (!dossie && rd.cover?.dossie) dossie = rd.cover.dossie;
    if (!dossie && rd.cover?.folder) dossie = rd.cover.folder;
    if (!dossie && rd.cover?.case_number) dossie = rd.cover.case_number;
    // Tentar extrair do campo extra_data / metadata
    if (!dossie && rd.extra_data?.dossie) dossie = rd.extra_data.dossie;
    if (!dossie && rd.metadata?.dossie) dossie = rd.metadata.dossie;
    console.log(`Dossiê extraído: ${dossie}`);

    // ========== CLASSIFICAÇÃO / TIPO DE RECURSO ==========
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
    // Fallback: type ou lawsuit_type
    if (!classificacao && rd.type) classificacao = typeof rd.type === 'string' ? rd.type : rd.type?.name || null;
    if (!classificacao && rd.lawsuit_type) classificacao = typeof rd.lawsuit_type === 'string' ? rd.lawsuit_type : rd.lawsuit_type?.name || null;
    console.log(`Tipo de recurso/classificação: ${classificacao}`);

    // ========== DATA DE DISTRIBUIÇÃO ==========
    let dataDistribuicao = rd.distribution_date
      ? rd.distribution_date.substring(0, 10)
      : null;
    console.log(`Data distribuição (payload raiz): ${dataDistribuicao}`);

    // ========== TRIBUNAL ==========
    const tribunalAcronimo = rd.tribunal_acronym || rd.court_acronym || null;
    let tribunal: string | null = null;
    if (tribunalAcronimo) {
      const upper = tribunalAcronimo.toUpperCase();
      if (upper.includes("TST")) tribunal = "TST";
      else if (upper.includes("STF")) tribunal = "STF";
      else if (upper.includes("STJ")) tribunal = "STJ";
      else tribunal = upper;
    }
    console.log(`Tribunal: ${tribunal} (acronimo: ${tribunalAcronimo})`);

    // ========== RELATOR / JUIZ (múltiplas fontes) ==========
    let relator: string | null = null;
    
    // Fonte 1: campos diretos no payload
    if (rd.judge) relator = rd.judge;
    if (!relator && rd.relator) relator = rd.relator;
    if (!relator && rd.cover?.judge) relator = rd.cover.judge;
    if (!relator && rd.orgaoJulgador?.magistrado) relator = rd.orgaoJulgador.magistrado;
    
    // Fonte 2: parties com tipo magistrado/relator
    if (!relator && Array.isArray(rd.parties)) {
      const magistrado = rd.parties.find((p: any) => {
        const tipo = (p.person_type || "").toUpperCase();
        return ["MAGISTRADO", "JUIZ", "RELATOR", "DESEMBARGADOR", "MINISTRO"].includes(tipo);
      });
      if (magistrado) relator = magistrado.name;
    }
    
    // Fonte 3: county (ex: "1ª TURMA - MIN. FULANO")
    if (!relator && rd.county) {
      const relMatch = rd.county.match(/(?:MIN\.|MINISTRO|DES\.|DESEMBARGADOR|RELATOR)[:\s]*([A-ZÁÀÃÉÊÍÓÔÚÇ\s]+)/i);
      if (relMatch) relator = relMatch[1].trim();
    }
    console.log(`Relator (antes dos steps): ${relator}`);

    // ========== TURMA (múltiplas fontes) ==========
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
    }
    if (!turma && rd.county) {
      const turmaMatch = rd.county.match(/(\d+[ªºa]?\s*turma|sdi[- ]?\d*|subse[çc][aã]o|câmara|órgão especial)/i);
      if (turmaMatch) turma = turmaMatch[1].trim();
    }
    if (!turma && rd.orgaoJulgador?.nome) {
      turma = rd.orgaoJulgador.nome;
    }
    if (typeof courts === 'string' && !turma && /turma|sdi|subse|seção|câmara/i.test(courts)) {
      turma = courts;
    }
    console.log(`Turma (antes dos steps): ${turma}`);

    // ========== FALLBACK: EXTRAIR DOS MOVIMENTOS (steps) ==========
    // Mesma lógica usada na importação de planilhas (Carga Benner / Planilha TST)
    if (!relator || !turma || !dataDistribuicao) {
      const orgaoJulgador = extrairOrgaoJulgador(steps);
      console.log("Órgão julgador extraído dos movimentos:", JSON.stringify(orgaoJulgador));
      if (!relator && orgaoJulgador.relator) relator = orgaoJulgador.relator;
      if (!turma && orgaoJulgador.turma) turma = orgaoJulgador.turma;
      if (!dataDistribuicao && orgaoJulgador.data_distribuicao) dataDistribuicao = orgaoJulgador.data_distribuicao;
    }

    // Fallback final: relator → turma via mapeamento TST
    if (relator && !turma) {
      turma = derivarTurmaDoRelator(relator);
      if (turma) console.log(`Turma derivada do relator via mapeamento: ${turma}`);
    }
    // Fallback: turma → relator (só se 1:1)
    if (turma && !relator) {
      const rel = derivarRelatorDaTurma(turma);
      if (rel) {
        relator = rel;
        console.log(`Relator derivado da turma via mapeamento reverso: ${relator}`);
      }
    }

    console.log(`RESULTADO FINAL - Relator: ${relator}, Turma: ${turma}, Distribuição: ${dataDistribuicao}`);

    // ========== PARTES ==========
    const parties = data.parties || rd.parties || [];
    const poloAtivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "ACTIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");
    const poloPassivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "PASSIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");

    // ========== SITUAÇÃO ==========
    const situacao = rd.status || rd.situation || null;
    let situacaoProcesso: string | null = null;
    if (situacao) {
      const sit = situacao.toUpperCase();
      if (sit.includes("ATIVO") || sit === "ATIVA") situacaoProcesso = "Ativo";
      else if (sit.includes("FINALIZADO") || sit.includes("ARQUIVADO")) situacaoProcesso = "Arquivado";
      else if (sit.includes("BAIXADO")) situacaoProcesso = "Baixado";
      else if (sit.includes("SUSPENSO")) situacaoProcesso = "Suspenso";
    }

    // ========== ANÁLISE DOS STEPS ==========
    const PAUTA_REGEX = /pauta|sess[aã]o de julgamento|inclu[ií]d[oa] em pauta|designad[oa].*julgamento|julgamento.*designad/i;
    const RESULTADO_TRANSCENDENCIA_REGEX = /sem transcend[eê]ncia|transcend[eê]ncia n[aã]o reconhecida/i;
    const RESULTADO_NAO_CONHECIDO_REGEX = /n[aã]o conhec|recurso.*n[aã]o.*conhecid/i;
    const RESULTADO_CONHECIDO_PROVIDO_REGEX = /conhecid[oa].*provid[oa]|dar provimento|recurso.*provid/i;
    const RESULTADO_CONHECIDO_NAO_PROVIDO_REGEX = /conhecid[oa].*n[aã]o.*provid|negar provimento|desprovid|improvid/i;
    const BAIXA_REGEX = /baixa definitiva|remetidos os autos [àa] origem|baixados? os autos|autos.*devolvidos|certid[aã]o de tr[aâ]nsito|tr[aâ]nsito em julgado/i;

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

    for (const step of steps) {
      const content = (step.content || step.title || step.description || "").toString();
      const stepDate = step.step_date || step.date || null;

      if (PAUTA_REGEX.test(content) && stepDate && !dataJulgamento) {
        const dateMatch = content.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          const parts = dateMatch[1].split('/');
          dataJulgamento = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (stepDate) {
          dataJulgamento = stepDate.substring(0, 10);
        }
        temDataJulgamento = "S";
        const timeMatch = content.match(/(\d{1,2})[h:](\d{2})/);
        if (timeMatch) {
          horarioJulgamento = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }
        if (/virtual/i.test(content)) tipoJulgamento = "Virtual";
        else if (/telepresencial/i.test(content)) tipoJulgamento = "Telepresencial";
        else if (/h[ií]brid/i.test(content)) tipoJulgamento = "Híbrido";
        else if (/presencial/i.test(content)) tipoJulgamento = "Presencial";
      }

      if (RESULTADO_TRANSCENDENCIA_REGEX.test(content)) resultadoSemTranscendencia = true;
      if (RESULTADO_CONHECIDO_NAO_PROVIDO_REGEX.test(content)) resultadoConhecidoNaoProvido = true;
      else if (RESULTADO_CONHECIDO_PROVIDO_REGEX.test(content)) resultadoConhecidoProvido = true;
      if (RESULTADO_NAO_CONHECIDO_REGEX.test(content) && !resultadoConhecidoProvido && !resultadoConhecidoNaoProvido) {
        resultadoNaoConhecido = true;
      }
      if (BAIXA_REGEX.test(content)) processoBaixado = "S";
    }

    if (!temDataJulgamento) temDataJulgamento = "N";
    if (!processoBaixado) processoBaixado = "N";

    if (processoBaixado === "S") {
      const TRANSITO_REGEX = /tr[aâ]nsito em julgado|certid[aã]o de tr[aâ]nsito/i;
      const hasTransito = steps.some((s: any) => TRANSITO_REGEX.test((s.content || s.title || "").toString()));
      situacaoProcesso = hasTransito ? "Trânsito em Julgado" : "Baixado";
    }

    const comarca = rd.county || null;
    const vara = rd.courts || null;
    const lastStep = data.last_step || rd.last_step || null;

    const result = {
      dossie: dossie,
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
