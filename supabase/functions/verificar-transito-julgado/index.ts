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
    const trt = parseInt(digits.substring(13, 15), 10).toString();
    if (TRT_ENDPOINTS[trt]) return trt;
  }
  return null;
}

function getEndpoints(numero: string): { endpoint: string; nome: string }[] {
  const digits = limparNumero(numero);
  const endpoints: { endpoint: string; nome: string }[] = [];
  
  endpoints.push({ endpoint: "api_publica_tst", nome: "TST" });
  
  const trt = getTRTFromProcesso(digits);
  if (trt) {
    endpoints.push(TRT_ENDPOINTS[trt]);
  }
  
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

function checkTransitoInMovimentos(movimentos: any[]): TransitoResult {
  // Sort movements by date (oldest first) to find the 848 and check what comes after
  const sorted = [...movimentos].sort((a, b) => {
    const dateA = new Date(a?.dataHora || a?.data || "1900-01-01").getTime();
    const dateB = new Date(b?.dataHora || b?.data || "1900-01-01").getTime();
    return dateA - dateB;
  });

  let transitoDate: string | null = null;
  let transitoFound = false;
  let transitoIndex = -1;

  // Find code 848
  for (let i = 0; i < sorted.length; i++) {
    const mov = sorted[i];
    const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
    if (codigo === 848) {
      transitoFound = true;
      transitoDate = mov?.dataHora || mov?.data || null;
      transitoIndex = i;
      break;
    }
    // Check complementos
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

  // Fallback: search by name
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

  // Check if there's ANY movement after the trânsito date
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
        console.log(`  Movimentação posterior ao trânsito: código ${codigo}, nome "${nome}", data ${movDate.substring(0, 10)}`);
        hasMovimentacaoPosterior = true;
        break;
      }
    }
  }

  return { found: true, date: transitoDate, hasMovimentacaoPosterior };
}

async function queryEndpoint(
  endpoint: string,
  digits: string
): Promise<{ hits: any[]; error?: string }> {
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

  console.log(`Processo ${numero}: ${allHits.length} instância(s) encontrada(s) em ${endpoints.map(e => e.nome).join(", ")}`);

  // Check all instances - if ANY has trânsito WITHOUT posterior movement, it's transitado
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
      
      // Prefer trânsito without posterior movement
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

  const graus = allHits.map(h => `${h.source}:${h.hit._source?.grau || "?"} (${h.hit._source?.classe?.nome || ""})`).join(", ");
  console.log(`  Nenhum trânsito encontrado. Graus: ${graus}`);

  return { numero, situacao: "Ativo", data_transito: null, grau: graus, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const processos: string[] = body?.processos || [];
    const ids_benner: string[] = body?.ids_benner || [];

    if (!processos.length) {
      return new Response(JSON.stringify({ error: "Nenhum processo informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BATCH_SIZE = 3;
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
          await supabase
            .from("dados_benner")
            .update({ situacao_processo: situacaoTexto } as any)
            .eq("id", id);
        }
      }
    }

    return new Response(JSON.stringify({ resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
