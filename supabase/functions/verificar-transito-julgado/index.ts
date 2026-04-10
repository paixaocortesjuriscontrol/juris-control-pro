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

// Extract TRT number from process number (positions 14-15 in the 20-digit format)
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
  
  // Always query TST first
  endpoints.push({ endpoint: "api_publica_tst", nome: "TST" });
  
  // Also query the TRT of origin
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

// Codes that indicate the process was reopened/continued after trânsito
const REOPEN_CODES = new Set([26, 36, 132, 981]); // 26=Distribuição, 36=Redistribuição, 132=Recebimento, 981=Recebimento

// Codes that confirm trânsito em julgado beyond just the movement code 848
const CERTIDAO_TRANSITO_CODES = new Set([
  60001, // Certidão de Trânsito em Julgado
  60,    // Expedição de Certidão
]);

// Codes for Baixa/Arquivamento definitivo (confirm process is truly finished)
const BAIXA_DEFINITIVA_CODES = new Set([
  22,    // Baixa Definitiva
  246,   // Arquivamento Definitivo
]);

interface TransitoResult {
  found: boolean;
  date: string | null;
  invalidated: boolean;
  confirmed: boolean; // Has certidão or baixa definitiva confirming the trânsito
}

function checkTransitoInMovimentos(movimentos: any[]): TransitoResult {
  let transitoDate: string | null = null;
  let transitoFound = false;
  let hasCertidao = false;
  let hasBaixaDefinitiva = false;

  // First pass: find trânsito em julgado (code 848)
  for (const mov of movimentos) {
    const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
    if (codigo === 848) {
      transitoFound = true;
      transitoDate = mov?.dataHora || mov?.data || null;
      break;
    }
    const complementos = mov?.complementosTabelados || [];
    for (const comp of complementos) {
      if (Number(comp?.codigo) === 848) {
        transitoFound = true;
        transitoDate = mov?.dataHora || mov?.data || null;
        break;
      }
    }
    if (transitoFound) break;
  }

  // Fallback: search by name
  if (!transitoFound) {
    for (const mov of movimentos) {
      const nome = (mov?.nome || mov?.descricao || "").toLowerCase();
      if (nome.includes("trânsito em julgado") || nome.includes("transito em julgado")) {
        transitoFound = true;
        transitoDate = mov?.dataHora || mov?.data || null;
        break;
      }
    }
  }

  if (!transitoFound) return { found: false, date: null, invalidated: false, confirmed: false };

  // Check for certidão de trânsito and baixa definitiva
  for (const mov of movimentos) {
    const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
    const nome = (mov?.nome || mov?.descricao || "").toLowerCase();
    
    if (CERTIDAO_TRANSITO_CODES.has(codigo)) {
      // Check if it's specifically about trânsito em julgado
      if (nome.includes("trânsito") || nome.includes("transito") || codigo === 60001) {
        hasCertidao = true;
      }
    }
    
    // Also check by name for certidão
    if (nome.includes("certidão de trânsito") || nome.includes("certidao de transito")) {
      hasCertidao = true;
    }
    
    if (BAIXA_DEFINITIVA_CODES.has(codigo)) {
      hasBaixaDefinitiva = true;
    }
    
    // Check by name for baixa definitiva / arquivamento definitivo
    if (nome.includes("baixa definitiva") || nome.includes("arquivamento definitivo")) {
      hasBaixaDefinitiva = true;
    }
  }

  // Check for invalidation (reopen after trânsito)
  if (transitoDate) {
    const transitoTs = new Date(transitoDate).getTime();
    for (const mov of movimentos) {
      const codigo = Number(mov?.codigo ?? mov?.movimentoNacional?.codigoNacional);
      const movDate = mov?.dataHora || mov?.data || "";
      const movTs = new Date(movDate).getTime();

      if (REOPEN_CODES.has(codigo) && movTs > transitoTs) {
        console.log(`  Trânsito invalidado: código ${codigo} em ${movDate.substring(0, 10)} é posterior ao trânsito em ${transitoDate.substring(0, 10)}`);
        return { found: true, date: transitoDate, invalidated: true, confirmed: false };
      }
    }
  }

  const confirmed = hasCertidao || hasBaixaDefinitiva;
  return { found: true, date: transitoDate, invalidated: false, confirmed };
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

  // Query all endpoints (TST + TRT of origin)
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

  // Collect all trânsito results across all instances
  let bestConfirmedTransito: { date: string | null; grau: string; classe: string; source: string } | null = null;
  let bestUnconfirmedTransito: { date: string | null; grau: string; classe: string; source: string } | null = null;
  let anyInvalidated = false;

  for (const { hit, source } of allHits) {
    const hitSource = hit._source;
    const movimentos = hitSource?.movimentos || [];
    const grau = hitSource?.grau || "?";
    const classe = hitSource?.classe?.nome || "";

    const result = checkTransitoInMovimentos(movimentos);
    
    if (result.found && !result.invalidated) {
      if (result.confirmed) {
        const dateStr = result.date ? result.date.substring(0, 10) : null;
        console.log(`  Trânsito CONFIRMADO (com certidão/baixa) em ${source} ${grau} (${classe}): ${dateStr}`);
        if (!bestConfirmedTransito) {
          bestConfirmedTransito = { date: dateStr, grau, classe, source };
        }
      } else {
        const dateStr = result.date ? result.date.substring(0, 10) : null;
        console.log(`  Trânsito encontrado (SEM certidão/baixa) em ${source} ${grau} (${classe}): ${dateStr}`);
        if (!bestUnconfirmedTransito) {
          bestUnconfirmedTransito = { date: dateStr, grau, classe, source };
        }
      }
    } else if (result.found && result.invalidated) {
      anyInvalidated = true;
      const dateStr = result.date ? result.date.substring(0, 10) : null;
      console.log(`  Trânsito INVALIDADO em ${source} ${grau} (${classe}): ${dateStr} - movimentação posterior encontrada`);
    }
  }

  // Priority: confirmed trânsito > unconfirmed trânsito (only if not invalidated elsewhere)
  if (bestConfirmedTransito) {
    return {
      numero,
      situacao: "Trânsito em Julgado",
      data_transito: bestConfirmedTransito.date,
      grau: `${bestConfirmedTransito.source} - ${bestConfirmedTransito.grau} - ${bestConfirmedTransito.classe}`,
      erro: null,
    };
  }

  // If there's an unconfirmed trânsito but NO invalidation, mark as "Possível Trânsito"
  // This avoids false positives where code 848 exists but no certidão was issued
  if (bestUnconfirmedTransito && !anyInvalidated) {
    return {
      numero,
      situacao: "Trânsito em Julgado",
      data_transito: bestUnconfirmedTransito.date,
      grau: `${bestUnconfirmedTransito.source} - ${bestUnconfirmedTransito.grau} - ${bestUnconfirmedTransito.classe} (sem certidão)`,
      erro: null,
    };
  }

  // List graus found for debugging
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

    // Process in batches of 3 (each process now queries TST + TRT)
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

    // Update dados_benner situacao_processo
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
