import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_TIMEOUT_MS = 20_000;

const TRT_ENDPOINTS: Record<string, { endpoint: string; nome: string }> = {
  "1": { endpoint: "api_publica_trt1", nome: "TRT1" },
  "2": { endpoint: "api_publica_trt2", nome: "TRT2" },
  "3": { endpoint: "api_publica_trt3", nome: "TRT3" },
  "4": { endpoint: "api_publica_trt4", nome: "TRT4" },
  "5": { endpoint: "api_publica_trt5", nome: "TRT5" },
  "6": { endpoint: "api_publica_trt6", nome: "TRT6" },
  "7": { endpoint: "api_publica_trt7", nome: "TRT7" },
  "8": { endpoint: "api_publica_trt8", nome: "TRT8" },
  "9": { endpoint: "api_publica_trt9", nome: "TRT9" },
  "10": { endpoint: "api_publica_trt10", nome: "TRT10" },
  "11": { endpoint: "api_publica_trt11", nome: "TRT11" },
  "12": { endpoint: "api_publica_trt12", nome: "TRT12" },
  "13": { endpoint: "api_publica_trt13", nome: "TRT13" },
  "14": { endpoint: "api_publica_trt14", nome: "TRT14" },
  "15": { endpoint: "api_publica_trt15", nome: "TRT15" },
  "16": { endpoint: "api_publica_trt16", nome: "TRT16" },
  "17": { endpoint: "api_publica_trt17", nome: "TRT17" },
  "18": { endpoint: "api_publica_trt18", nome: "TRT18" },
  "19": { endpoint: "api_publica_trt19", nome: "TRT19" },
  "20": { endpoint: "api_publica_trt20", nome: "TRT20" },
  "21": { endpoint: "api_publica_trt21", nome: "TRT21" },
  "22": { endpoint: "api_publica_trt22", nome: "TRT22" },
  "23": { endpoint: "api_publica_trt23", nome: "TRT23" },
  "24": { endpoint: "api_publica_trt24", nome: "TRT24" },
};

function limparNumero(num: string): string {
  return num.replace(/[^0-9]/g, "");
}

function getTRTFromProcesso(digits: string): string | null {
  if (digits.length >= 16) {
    const trt = parseInt(digits.substring(14, 16), 10).toString();
    if (TRT_ENDPOINTS[trt]) return trt;
  }
  return null;
}

function getEndpoints(numero: string): { endpoint: string; nome: string }[] {
  const endpoints: { endpoint: string; nome: string }[] = [];
  const digits = limparNumero(numero);
  const trt = getTRTFromProcesso(digits);
  if (trt && TRT_ENDPOINTS[trt]) {
    endpoints.push(TRT_ENDPOINTS[trt]);
  }
  endpoints.push({ endpoint: "api_publica_tst", nome: "TST" });
  return endpoints;
}

interface ResultadoProcesso {
  numero: string;
  situacao: string;
  data_transito: string | null;
  grau: string | null;
  erro: string | null;
}

interface TransitoResult {
  found: boolean;
  date: string | null;
  hasMovimentacaoPosterior: boolean;
}

interface FunctionResponse {
  ok: boolean;
  resultados: ResultadoProcesso[];
  error?: string;
  fallback?: boolean;
}

function respond(payload: FunctionResponse) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Códigos de movimentação que NÃO invalidam o trânsito em julgado
// (são meros atos administrativos pós-trânsito)
const CODIGOS_IGNORAR_POS_TRANSITO = new Set([
  123,  // Remessa (devolução dos autos ao tribunal de origem)
  132,  // Remessa ao tribunal de origem
  22,   // Baixa definitiva
  246,  // Arquivamento definitivo
  268,  // Desentranhamento
  1037, // Certidão de trânsito em julgado
  11009, // Expedição de certidão
  11010, // Juntada de certidão
  60,   // Expedição de documento
  581,  // Recebimento
  12,   // Juntada de documento
  36,   // Distribuição
  51,   // Publicação
  85,   // Conclusão
  848,  // Próprio trânsito em julgado (duplicado)
  26,   // Juntada de petição
  67,   // Vista ao Ministério Público
  11,   // Juntada
  981,  // Ato ordinatório
  10044, // Recebimento de petição
  10045, // Recebimento de documento
  61,   // Expedição de mandado
  14,   // Despacho
  193,  // Intimação
  194,  // Notificação
  3,    // Encerramento
  4,    // Reabertura (pode ser administrativa)
  10001, // Vista
  10003, // Recebimento
  10004, // Devolução
  10005, // Conclusão ao juiz
  10006, // Conclusão ao relator
  852,  // Levantamento de sigilo
  192,  // Citação
  50,   // Publicação no DJE
]);

// Palavras-chave administrativas que não invalidam trânsito
const NOMES_IGNORAR_POS_TRANSITO = [
  "remessa", "baixa", "arquiv", "certid", "distribui",
  "juntada", "conclus", "publica", "expedi", "recebimento",
  "vista", "intima", "notifica", "despacho", "ato ordinat",
  "trânsito em julgado", "transito em julgado",
  "autos eletrônicos", "autuação", "desentranhamento",
  "petição", "mandado", "levantamento", "desarchiv",
  "numeração", "redistribui", "anotação", "cancelamento",
  "retificação", "complementação", "cumprimento",
  "encaminhamento", "devolução", "protocolo",
];

function checkTransitoInMovimentos(movimentos: any[]): TransitoResult {
  const sorted = [...movimentos].sort((a, b) => {
    const dateA = new Date(a?.dataHora || a?.data || "1900-01-01").getTime();
    const dateB = new Date(b?.dataHora || b?.data || "1900-01-01").getTime();
    return dateA - dateB;
  });

  let transitoDate: string | null = null;
  let transitoFound = false;
  let transitoIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const mov = sorted[i];
    const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
    if (codigo === 848) {
      transitoFound = true;
      transitoDate = mov?.dataHora || mov?.data || null;
      transitoIndex = i;
      break;
    }

    const complementos = mov?.complementosTabelados || [];
    for (const comp of complementos) {
      if (Number(comp?.codigo) === 848) {
        transitoFound = true;
        transitoDate = mov?.dataHora || mov?.data || null;
        transitoIndex = i;
        break;
      }
    }
    if (transitoFound) break;
  }

  if (!transitoFound) {
    for (let i = 0; i < sorted.length; i++) {
      const mov = sorted[i];
      const nome = (mov?.nome || mov?.descricao || "").toLowerCase();
      if (nome.includes("trânsito em julgado") || nome.includes("transito em julgado")) {
        transitoFound = true;
        transitoDate = mov?.dataHora || mov?.data || null;
        transitoIndex = i;
        break;
      }
    }
  }

  if (!transitoFound) return { found: false, date: null, hasMovimentacaoPosterior: false };

  let hasMovimentacaoPosterior = false;
  if (transitoDate) {
    const transitoTs = new Date(transitoDate).getTime();
    for (let i = transitoIndex + 1; i < sorted.length; i++) {
      const mov = sorted[i];
      const movDate = mov?.dataHora || mov?.data || "";
      const movTs = new Date(movDate).getTime();
      if (movTs > transitoTs) {
        const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
        const nome = (mov?.nome || mov?.descricao || "").toLowerCase();

        // Ignorar movimentações administrativas pós-trânsito
        if (CODIGOS_IGNORAR_POS_TRANSITO.has(codigo)) {
          console.log(`  Movimentação pós-trânsito IGNORADA (administrativa): código ${codigo}, nome "${nome}", data ${movDate.substring(0, 10)}`);
          continue;
        }

        // Ignorar movimentações que são claramente administrativas pelo nome
        if (nome.includes("remessa") || nome.includes("baixa") || nome.includes("arquiv") || nome.includes("certidão") || nome.includes("certidao")) {
          console.log(`  Movimentação pós-trânsito IGNORADA (nome administrativo): código ${codigo}, nome "${nome}", data ${movDate.substring(0, 10)}`);
          continue;
        }

        console.log(`  Movimentação posterior ao trânsito RELEVANTE: código ${codigo}, nome "${nome}", data ${movDate.substring(0, 10)}`);
        hasMovimentacaoPosterior = true;
        break;
      }
    }
  }

  return { found: true, date: transitoDate, hasMovimentacaoPosterior };
}

async function queryEndpoint(endpoint: string, digits: string): Promise<{ hits: any[]; error?: string }> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: digits } },
        size: 10,
        _source: ["numeroProcesso", "movimentos", "classe", "grau"],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Erro API ${endpoint}:`, response.status, text);
      return { hits: [], error: `API retornou ${response.status}` };
    }

    const data = await response.json();
    return { hits: data?.hits?.hits || [] };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { hits: [], error: "Timeout na API" };
    }
    return { hits: [], error: err.message || "Erro desconhecido" };
  }
}

async function verificarProcesso(numero: string): Promise<ResultadoProcesso> {
  const digits = limparNumero(numero);
  if (digits.length < 10) {
    return { numero, situacao: "Erro", data_transito: null, grau: null, erro: "Número inválido" };
  }

  const endpoints = getEndpoints(numero);
  let allHits: { hit: any; source: string }[] = [];
  let lastError: string | null = null;

  for (const ep of endpoints) {
    const result = await queryEndpoint(ep.endpoint, digits);
    if (result.hits.length > 0) {
      for (const hit of result.hits) {
        allHits.push({ hit, source: ep.nome });
      }
    }
    if (result.error) lastError = result.error;
  }

  if (allHits.length === 0) {
    return {
      numero,
      situacao: lastError ? "Erro" : "Não encontrado",
      data_transito: null,
      grau: null,
      erro: lastError,
    };
  }

  console.log(`Processo ${numero}: ${allHits.length} instância(s) encontrada(s) em ${endpoints.map((e) => e.nome).join(", ")}`);

  let bestTransito: { date: string | null; grau: string; classe: string; source: string; hasMovPosterior: boolean } | null = null;

  for (const { hit, source } of allHits) {
    const hitSource = hit._source;
    const movimentos = hitSource?.movimentos || [];
    const grau = hitSource?.grau || "?";
    const classe = hitSource?.classe?.nome || "";

    const result = checkTransitoInMovimentos(movimentos);

    if (result.found) {
      const dateStr = result.date ? result.date.substring(0, 10) : null;
      if (result.hasMovimentacaoPosterior) {
        console.log(`  Trânsito em ${source} ${grau} (${classe}): ${dateStr} - MAS há movimentação posterior`);
      } else {
        console.log(`  Trânsito em ${source} ${grau} (${classe}): ${dateStr} - SEM movimentação posterior ✓`);
      }

      if (!bestTransito || (!result.hasMovimentacaoPosterior && bestTransito.hasMovPosterior)) {
        bestTransito = { date: dateStr, grau, classe, source, hasMovPosterior: result.hasMovimentacaoPosterior };
      }
    }
  }

  if (bestTransito && !bestTransito.hasMovPosterior) {
    return {
      numero,
      situacao: "Trânsito em Julgado",
      data_transito: bestTransito.date,
      grau: `${bestTransito.source} - ${bestTransito.grau} - ${bestTransito.classe}`,
      erro: null,
    };
  }

  if (bestTransito && bestTransito.hasMovPosterior) {
    return {
      numero,
      situacao: "Ativo",
      data_transito: null,
      grau: `${bestTransito.source} - ${bestTransito.grau} - ${bestTransito.classe} (trânsito invalidado por movimentação posterior)`,
      erro: null,
    };
  }

  const graus = allHits.map((h) => `${h.source}:${h.hit._source?.grau || "?"} (${h.hit._source?.classe?.nome || ""})`).join(", ");
  console.log(`  Nenhum trânsito encontrado. Graus: ${graus}`);

  return { numero, situacao: "Ativo", data_transito: null, grau: graus, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let processos: string[] = [];

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ ok: false, resultados: [], error: "Não autorizado" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return respond({ ok: false, resultados: [], error: "Não autorizado" });
    }

    const body = await req.json();
    processos = body?.processos || [];
    const ids_benner: string[] = body?.ids_benner || [];

    if (!processos.length) {
      return respond({ ok: false, resultados: [], error: "Nenhum processo informado" });
    }

    const BATCH_SIZE = 2;
    const resultados: ResultadoProcesso[] = [];

    for (let i = 0; i < processos.length; i += BATCH_SIZE) {
      const batch = processos.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((p) => verificarProcesso(p)));
      resultados.push(...batchResults);

      if (i + BATCH_SIZE < processos.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (ids_benner.length > 0) {
      for (let i = 0; i < ids_benner.length; i++) {
        const id = ids_benner[i];
        const resultado = resultados[i];
        if (resultado && resultado.situacao !== "Erro" && resultado.situacao !== "Não encontrado") {
          const situacaoTexto = resultado.data_transito
            ? `${resultado.situacao} (${resultado.data_transito})`
            : resultado.situacao;
          await supabase.from("dados_benner").update({ situacao_processo: situacaoTexto } as any).eq("id", id);
        }
      }
    }

    return respond({ ok: true, resultados });
  } catch (err: any) {
    console.error("Erro:", err);
    return respond({
      ok: false,
      fallback: true,
      error: err.message || "Erro interno",
      resultados: processos.map((numero) => ({
        numero,
        situacao: "Erro",
        data_transito: null,
        grau: null,
        erro: err.message || "Erro interno",
      })),
    });
  }
});
