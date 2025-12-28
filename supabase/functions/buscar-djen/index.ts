import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============ In-memory cache (5 min TTL) ============
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 100;

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(params: SearchParams): string {
  return JSON.stringify({
    tipo: params.tipo,
    oab: params.oab?.toLowerCase(),
    uf: params.uf?.toUpperCase(),
    palavraChave: params.palavraChave?.toLowerCase().trim(),
    numeroProcesso: params.numeroProcesso?.replace(/\D/g, ''),
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  });
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============ CORS ============
const ALLOWED_ORIGINS = [
  "https://bfxahrrvoqxcdmfsvnrk.supabase.co",
  "https://lovable.dev",
  "https://juriscontrol.adv.br",
  "https://www.juriscontrol.adv.br",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.startsWith("http://localhost:")) return true;
  if (origin.endsWith(".lovable.app")) return true;
  if (origin.endsWith(".lovableproject.com")) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// PJE Comunica API - the backend API for comunica.pje.jus.br
const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";

// Jina Reader proxy (fallback when API is blocked)
const JINA_READER_URL = "https://r.jina.ai";

// Types of searches available
type SearchType = "advogado" | "palavra-chave" | "processo";

interface SearchParams {
  tipo: SearchType;
  oab?: string;
  uf?: string;
  palavraChave?: string;
  numeroProcesso?: string;
  dataInicio?: string;
  dataFim?: string;
}

// Browser-like headers to avoid blocking
const browserHeaders = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://comunica.pje.jus.br",
  Referer: "https://comunica.pje.jus.br/",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 1500): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = baseDelay * Math.pow(2, attempt);
      console.log(`Fetch error. Waiting ${waitTime}ms before retry:`, error);
      await delay(waitTime);
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

async function fetchJsonViaJina(url: string, jinaApiKey: string): Promise<any | null> {
  // Important: keep a short timeout so the caller doesn't hang
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6_000);

  try {
    const jinaUrl = `${JINA_READER_URL}/${url}`;

    const resp = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jinaApiKey}`,
        Accept: "application/json, text/plain, */*",
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.log(`Jina proxy error ${resp.status}:`, t.slice(0, 200));
      return null;
    }

    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      console.log("Jina proxy returned non-JSON");
      return null;
    }
  } catch (e) {
    console.log("Jina proxy fetch failed:", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchPJEComunica(params: SearchParams, jinaApiKey?: string): Promise<any> {
  const { tipo, oab, uf, palavraChave, numeroProcesso, dataInicio, dataFim } = params;

  const queryParams = new URLSearchParams();

  if (tipo === "palavra-chave" && palavraChave) {
    queryParams.append("texto", palavraChave);
  } else if (tipo === "advogado" && oab) {
    const oabQuery = uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
    queryParams.append("texto", oabQuery);
  } else if (tipo === "processo" && numeroProcesso) {
    queryParams.append("texto", numeroProcesso);
  }

  if (dataInicio) queryParams.append("dataDisponibilizacaoInicio", dataInicio);
  if (dataFim) queryParams.append("dataDisponibilizacaoFim", dataFim);
  
  // Request maximum results - no pagination limit
  queryParams.append("size", "10000");
  queryParams.append("pagina", "0");
  queryParams.append("tamanhoPagina", "10000");

  // Prefer the endpoints that actually return JSON fast.
  // The other endpoints frequently respond with HTML/422 or 404 and add seconds of latency.
  const endpoints = [
    `${PJE_COMUNICA_API}/comunicacao`,
    `${PJE_COMUNICA_API}/comunicacoes`,
  ];

  const fullQueryString = queryParams.toString();
  console.log("Query params:", fullQueryString);

  let lastError: any = null;

  for (const endpoint of endpoints) {
    const fullUrl = `${endpoint}?${fullQueryString}`;
    console.log("Trying endpoint:", fullUrl);

    try {
      const response = await fetchWithRetry(fullUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      const contentType = response.headers.get("content-type") || "";
      console.log("Response status:", response.status, "Content-Type:", contentType);

      // If blocked (HTML), try proxy via Jina to fetch the same API URL
      if (contentType.includes("text/html") && jinaApiKey) {
        console.log("Got HTML response (blocked). Trying Jina proxy...");
        const data = await fetchJsonViaJina(fullUrl, jinaApiKey);
        if (data) {
          console.log("Success via Jina proxy");
          return data;
        }
        console.log("Jina proxy did not return JSON, trying next endpoint...");
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        console.log("Success! Got JSON response");
        return data;
      }

      if (response.status === 422) {
        const errorText = await response.text();
        console.log("422 response:", errorText);
        return {
          publicacoes: [],
          comunicacoes: [],
          totalElements: 0,
          message: "Nenhuma comunicação encontrada",
        };
      }

      lastError = `Status ${response.status}`;
    } catch (err) {
      console.error("Error with endpoint", endpoint, err);
      lastError = err;
    }
  }

  if (tipo === "processo" && numeroProcesso) {
    console.log("All PJE endpoints failed, trying DataJud fallback...");
    return await searchDataJudPublicacoes(numeroProcesso);
  }

  console.log("All endpoints failed, returning empty results");
  return {
    publicacoes: [],
    comunicacoes: [],
    totalElements: 0,
    message:
      "Não foi possível conectar à API do PJE Comunica. A busca por palavra-chave pode estar indisponível. Tente buscar por número de processo.",
    error: lastError?.toString(),
  };
}

// Fallback to DataJud API for process publications
async function searchDataJudPublicacoes(numeroProcesso: string): Promise<any> {
  const DATAJUD_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
  const cleanedNumber = numeroProcesso.replace(/\D/g, "").padStart(20, "0");

  console.log("Searching DataJud for process:", cleanedNumber);

  const segmento = cleanedNumber.substring(13, 14);
  const tribunal = cleanedNumber.substring(14, 16);

  let apiEndpoint = "api_publica_tjsp";
  if (segmento === "5") {
    apiEndpoint = `api_publica_trt${tribunal}`;
  } else if (segmento === "8") {
    const tjMap: Record<string, string> = {
      "01": "tjac",
      "02": "tjal",
      "03": "tjap",
      "04": "tjam",
      "05": "tjba",
      "06": "tjce",
      "07": "tjdf",
      "08": "tjes",
      "09": "tjgo",
      "10": "tjma",
      "11": "tjmt",
      "12": "tjms",
      "13": "tjmg",
      "14": "tjpa",
      "15": "tjpb",
      "16": "tjpr",
      "17": "tjpe",
      "18": "tjpi",
      "19": "tjrj",
      "20": "tjrn",
      "21": "tjrs",
      "22": "tjro",
      "23": "tjrr",
      "24": "tjsc",
      "25": "tjse",
      "26": "tjsp",
      "27": "tjto",
    };
    apiEndpoint = `api_publica_${tjMap[tribunal] || "tjsp"}`;
  }

  const url = `https://api-publica.datajud.cnj.jus.br/${apiEndpoint}/_search`;
  console.log("DataJud URL:", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: cleanedNumber } },
        size: 1,
      }),
    });

    if (!response.ok) {
      console.error("DataJud error:", response.status);
      return { publicacoes: [], total: 0, message: "Erro ao consultar DataJud" };
    }

    const data = await response.json();
    const hits = data.hits?.hits || [];

    if (hits.length === 0) {
      return { publicacoes: [], total: 0, message: "Processo não encontrado no DataJud" };
    }

    const processo = hits[0]._source;

    const publicacoes = (processo.movimentos || [])
      .filter(
        (m: any) =>
          m.nome?.toLowerCase().includes("publicação") ||
          m.nome?.toLowerCase().includes("diário") ||
          m.complementosTabelados?.some(
            (c: any) =>
              c.nome?.toLowerCase().includes("dje") || c.descricao?.toLowerCase().includes("diário")
          )
      )
      .map((m: any) => ({
        data: m.dataHora,
        tipo: m.nome || "Publicação",
        conteudo:
          m.complementosTabelados?.map((c: any) => c.descricao || c.nome).join(" - ") || m.nome,
        processo: processo.numeroProcesso,
        tribunal: processo.siglaTribunal,
      }));

    return {
      publicacoes,
      total: publicacoes.length,
      fonte: "DataJud",
      processoInfo: {
        numero: processo.numeroProcesso,
        tribunal: processo.siglaTribunal,
        classe: processo.classe?.nome,
        assuntos: processo.assuntos?.map((a: any) => a.nome).join(", "),
      },
    };
  } catch (err) {
    console.error("DataJud fetch error:", err);
    return { publicacoes: [], total: 0, message: "Erro ao consultar DataJud" };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const jinaApiKey = Deno.env.get("JINA_API_KEY") || undefined;

    const body = await req.json();
    const { tipo = "palavra-chave", oab, uf, palavraChave, numeroProcesso, dataInicio, dataFim } = body;

    console.log("DJEN Search request:", JSON.stringify(body));

    // Validate params
    if (tipo === "advogado") {
      if (!oab) {
        return new Response(JSON.stringify({ error: "OAB é obrigatório para busca por advogado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (tipo === "palavra-chave") {
      if (!palavraChave || palavraChave.length < 3) {
        return new Response(JSON.stringify({ error: "Palavra-chave deve ter pelo menos 3 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (tipo === "processo") {
      if (!numeroProcesso) {
        return new Response(JSON.stringify({ error: "Número do processo é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const searchParams: SearchParams = { tipo, oab, uf, palavraChave, numeroProcesso, dataInicio, dataFim };
    const cacheKey = getCacheKey(searchParams);

    // Check cache first
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log("Cache HIT for:", cacheKey);
      return new Response(JSON.stringify({ success: true, cached: true, ...cachedResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Cache MISS, fetching from API...");
    const result = await searchPJEComunica(searchParams, jinaApiKey);

    // Store in cache
    setCache(cacheKey, result);

    return new Response(JSON.stringify({ success: true, cached: false, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DJEN function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
