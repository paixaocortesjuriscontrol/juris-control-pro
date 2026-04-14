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

    // Normaliza o número (remove espaços)
    const cnj = numero_processo.trim();

    console.log(`Buscando processo na Judit: ${cnj}`);

    // Consulta síncrona no Datalake da Judit
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

    // Extrair dados relevantes do response_data
    const rd = data.response_data || data;
    
    // Extrair classificação/tipo de recurso
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

    // Extrair data de distribuição
    const dataDistribuicao = rd.distribution_date 
      ? rd.distribution_date.substring(0, 10) 
      : null;

    // Extrair relator/juiz
    const relator = rd.judge || null;

    // Extrair turma do campo courts
    let turma: string | null = null;
    const courts = rd.courts || [];
    if (Array.isArray(courts)) {
      // Procurar por turma nos courts (ex: "1ª Turma", "2ª Turma", "SDI-1")
      for (const court of courts) {
        const name = (court.name || court).toString();
        if (/turma|sdi|subse|seção|câmara|órgão especial/i.test(name)) {
          turma = name;
          break;
        }
      }
      // Se não achou turma específica, pegar o primeiro court como vara
      if (!turma && courts.length > 0) {
        // Não é turma, é vara/comarca
      }
    } else if (typeof courts === 'string' && /turma|sdi|subse|seção|câmara/i.test(courts)) {
      turma = courts;
    }

    // Extrair tribunal
    const tribunalAcronimo = rd.tribunal_acronym || null;
    let tribunal = null;
    if (tribunalAcronimo) {
      if (tribunalAcronimo.toUpperCase().includes("TST")) tribunal = "TST";
      else if (tribunalAcronimo.toUpperCase().includes("STF")) tribunal = "STF";
      else if (tribunalAcronimo.toUpperCase().includes("STJ")) tribunal = "STJ";
      else tribunal = tribunalAcronimo.toUpperCase();
    }

    // Extrair partes
    const parties = data.parties || rd.parties || [];
    const poloAtivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "ACTIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");
    const poloPassivo = parties
      .filter((p: any) => p.side?.toUpperCase() === "PASSIVE" && p.person_type?.toUpperCase() !== "ADVOGADO")
      .map((p: any) => p.name)
      .join(", ");

    // Situação/status
    const situacao = rd.status || rd.situation || null;
    let situacaoProcesso = null;
    if (situacao) {
      const sit = situacao.toUpperCase();
      if (sit.includes("ATIVO") || sit === "ATIVA") situacaoProcesso = "Ativo";
      else if (sit.includes("FINALIZADO") || sit.includes("ARQUIVADO")) situacaoProcesso = "Arquivado";
      else if (sit.includes("BAIXADO")) situacaoProcesso = "Baixado";
      else if (sit.includes("SUSPENSO")) situacaoProcesso = "Suspenso";
    }

    // Comarca/Vara
    const comarca = rd.county || null;
    const vara = rd.courts || null;

    // Último andamento
    const lastStep = data.last_step || rd.last_step || null;

    const result = {
      tipo_recurso: classificacao,
      data_distribuicao: dataDistribuicao,
      relator: relator,
      tribunal: tribunal,
      tribunal_acronimo: tribunalAcronimo,
      recorrente: poloAtivo || null,
      polo_passivo: poloPassivo || null,
      situacao_processo: situacaoProcesso,
      comarca: comarca,
      vara: vara,
      ultimo_andamento: lastStep ? {
        data: lastStep.step_date,
        conteudo: lastStep.content,
      } : null,
      // Dados brutos para debug
      raw_status: situacao,
      raw_classification: classificacao,
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
