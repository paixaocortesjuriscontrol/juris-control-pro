import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============ In-memory cache (5 min TTL) ============
// NOTE: Keep this cache small. Edge functions have tight memory limits.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 20;

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
    numeroProcesso: params.numeroProcesso?.replace(/\D/g, ""),
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    page: params.page ?? 0,
    pageSize: params.pageSize ?? 100,
    fetchAll: !!params.fetchAll,
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
  page?: number;
  pageSize?: number;
  // When true, the function will fetch multiple pages (use with caution).
  fetchAll?: boolean;
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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2, // Reduzido para 2 retries (menos agressivo)
  baseDelay = 2000 // Aumentado para 2s base delay
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(
          `Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`
        );
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
  const tryParseJson = (rawText: string): any | null => {
    const text = rawText.trim();
    if (!text) return null;

    // 1) Standard JSON
    try {
      return JSON.parse(text);
    } catch {
      // continue
    }

    // 2) Strip markdown fences (```json ... ```)
    const fenced = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    if (fenced !== text) {
      try {
        return JSON.parse(fenced);
      } catch {
        // continue
      }
    }

    // 3) Some proxies prepend junk; try extracting the first JSON object/array.
    const firstObj = fenced.indexOf("{");
    const firstArr = fenced.indexOf("[");
    const start =
      firstObj === -1
        ? firstArr
        : firstArr === -1
          ? firstObj
          : Math.min(firstObj, firstArr);

    if (start >= 0) {
      const tail = fenced.slice(start);
      const lastObj = tail.lastIndexOf("}");
      const lastArr = tail.lastIndexOf("]");
      const end =
        lastObj === -1
          ? lastArr
          : lastArr === -1
            ? lastObj
            : Math.max(lastObj, lastArr);

      if (end >= 0) {
        const candidate = tail.slice(0, end + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }

    return null;
  };

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
    const parsed = tryParseJson(text);
    if (parsed) return parsed;

    console.log("Jina proxy returned non-JSON (sample):", text.trim().slice(0, 200));
    return null;
  } catch (e) {
    console.log("Jina proxy fetch failed:", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchPJEComunica(params: SearchParams, jinaApiKey?: string): Promise<any> {
  const { tipo, oab, uf, palavraChave, numeroProcesso, dataInicio, dataFim } = params;

  const baseParams = new URLSearchParams();

  if (tipo === "palavra-chave" && palavraChave) {
    baseParams.append("texto", palavraChave);
  } else if (tipo === "advogado" && oab) {
    const oabQuery = uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
    baseParams.append("texto", oabQuery);
  } else if (tipo === "processo" && numeroProcesso) {
    baseParams.append("texto", numeroProcesso);
  }

  if (dataInicio) baseParams.append("dataDisponibilizacaoInicio", dataInicio);
  if (dataFim) baseParams.append("dataDisponibilizacaoFim", dataFim);

  const page = Math.max(params.page ?? 0, 0);
  const pageSize = Math.min(Math.max(params.pageSize ?? 100, 1), 100);

  const extractItems = (data: any): any[] => {
    const items = data?.items ?? data?.content ?? data?.comunicacoes ?? data?.publicacoes ?? [];
    return Array.isArray(items) ? items : [];
  };

  const getTotalCount = (data: any): number | null => {
    const raw = data?.count ?? data?.totalElements ?? data?.total ?? data?.totalCount;
    const n = typeof raw === "string" ? Number(raw) : raw;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  // Optimize items to reduce memory - only keep essential fields
  const optimizeItem = (item: any) => ({
    id: item.id,
    dataDisponibilizacao: item.dataDisponibilizacao,
    dataPublicacao: item.dataPublicacao,
    tipoComunicacao: item.tipoComunicacao,
    siglaTribunal: item.siglaTribunal,
    numeroProcesso: item.numeroProcesso,

    // Keep compatibility aliases used by the frontend
    nomeOrgao: item.nomeOrgao,
    orgao: item.nomeOrgao,
    destinatarioNome: item.destinatarioNome,
    destinatario: item.destinatarioNome,

    // Keep full content
    texto: typeof item.texto === "string" ? item.texto : undefined,
    teor: typeof item.teor === "string" ? item.teor : undefined,
  });

  const endpoints = [`${PJE_COMUNICA_API}/comunicacao`, `${PJE_COMUNICA_API}/comunicacoes`];

  console.log(
    "Base query params:",
    baseParams.toString(),
    "page:",
    page,
    "pageSize:",
    pageSize,
    "fetchAll:",
    !!params.fetchAll,
    "useJina:",
    !!jinaApiKey
  );

  let lastError: any = null;

  // ESTRATÉGIA: Jina primeiro (distribui IPs), API direta como fallback
  const fetchPage = async (endpoint: string, pageNumber: number) => {
    const qp = new URLSearchParams(baseParams);
    qp.set("pagina", String(pageNumber));
    qp.set("tamanhoPagina", String(pageSize));
    qp.set("page", String(pageNumber));
    qp.set("size", String(pageSize));

    const fullUrl = `${endpoint}?${qp.toString()}`;
    console.log(`Trying endpoint (page ${pageNumber}):`, fullUrl);

    // PRIORIDADE 1: Usar Jina como proxy (evita rate limit do IP do Supabase)
    if (jinaApiKey) {
      console.log("Using Jina proxy for distributed requests...");
      const jinaData = await fetchJsonViaJina(fullUrl, jinaApiKey);
      if (jinaData) {
        console.log("Jina proxy success!");
        return { data: jinaData, ok: true };
      }
      console.log("Jina proxy failed, falling back to direct API...");
    }

    // FALLBACK: Requisição direta (pode sofrer rate limit)
    const response = await fetchWithRetry(fullUrl, {
      method: "GET",
      headers: browserHeaders,
    });

    const contentType = response.headers.get("content-type") || "";
    console.log("Response status:", response.status, "Content-Type:", contentType);

    let data: any | null = null;

    if (contentType.includes("text/html")) {
      console.log("Got HTML response (blocked)");
      throw new Error("Blocked (HTML)");
    } else if (response.ok) {
      data = await response.json();
    } else if (response.status === 422) {
      const errorText = await response.text();
      console.log("422 response:", errorText);
      return {
        data: {
          publicacoes: [],
          comunicacoes: [],
          totalElements: 0,
          message: "Nenhuma comunicação encontrada",
        },
        ok: true,
      };
    } else {
      const t = await response.text().catch(() => "");
      throw new Error(`Status ${response.status} ${t.slice(0, 120)}`);
    }

    return { data, ok: true };
  };

  // Default: fetch ONE page only (prevents WORKER_LIMIT memory issues)
  if (!params.fetchAll) {
    for (const endpoint of endpoints) {
      try {
        const { data } = await fetchPage(endpoint, page);
        const totalExpected = getTotalCount(data);
        const pageItems = extractItems(data).map(optimizeItem);

        // ALWAYS compute totalElements - use API value or estimate based on page size
        const totalElements = typeof totalExpected === "number" && totalExpected >= 0
          ? totalExpected
          : pageItems.length === pageSize
            ? (page + 1) * pageSize + 1 // Estimate: at least one more page
            : (page * pageSize) + pageItems.length; // This is the last page

        // ALWAYS compute hasMore reliably
        const hasMore = typeof totalExpected === "number" && totalExpected >= 0
          ? (page + 1) * pageSize < totalExpected
          : pageItems.length === pageSize;

        console.log(`Returning: totalElements=${totalElements}, hasMore=${hasMore}, items=${pageItems.length}, page=${page}`);

        return {
          items: pageItems,
          count: totalElements,
          totalElements,
          page,
          pageSize,
          hasMore,
        };
      } catch (err) {
        console.error("Error with endpoint", endpoint, err);
        lastError = err;
      }
    }
  }

  // Legacy mode: fetch multiple pages (used by internal backfill jobs).
  // Keep strict limits to avoid worker OOM.
  if (params.fetchAll) {
    const MAX_PAGES = 15; // 15 * 100 = 1500 items max
    const MAX_ITEMS = 1500;

    for (const endpoint of endpoints) {
      let totalExpected: number | null = null;
      const allItems: any[] = [];

      try {
        for (let p = 0; p < MAX_PAGES; p++) {
          if (allItems.length >= MAX_ITEMS) break;

          const { data } = await fetchPage(endpoint, p);

          if (totalExpected === null) {
            totalExpected = getTotalCount(data);
            console.log("First page totalExpected:", totalExpected);
          }

          const rawItems = extractItems(data);
          const optimized = rawItems.map(optimizeItem);
          allItems.push(...optimized);

          console.log(
            `Page ${p}: got ${rawItems.length} items (total so far ${allItems.length}${
              totalExpected ? `/${totalExpected}` : ""
            })`
          );

          if (rawItems.length === 0) break;
          if (rawItems.length < pageSize) break;
          if (totalExpected !== null && allItems.length >= totalExpected) break;

          await delay(150);
        }

        const count = totalExpected ?? allItems.length;
        const truncated = typeof totalExpected === "number" ? allItems.length < totalExpected : false;

        return {
          items: allItems,
          count,
          totalElements: count,
          truncated,
          message: truncated
            ? `Exibindo ${allItems.length} de ${totalExpected} resultados. Use filtros de data para refinar.`
            : undefined,
        };
      } catch (err) {
        console.error("Error with endpoint", endpoint, err);
        lastError = err;
      }
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
    const {
      tipo = "palavra-chave",
      oab,
      uf,
      palavraChave,
      numeroProcesso,
      dataInicio,
      dataFim,
      page,
      pageSize,
      fetchAll,
    } = body;

    // Compat: alguns registros/flows antigos usam `tipo: "parte"`.
    // A API interna trabalha com os 3 tipos oficiais (advogado, palavra-chave, processo),
    // então normalizamos cedo para não cair na validação de tipo.
    const tipoNormalizado = (tipo === "parte" ? "palavra-chave" : tipo);

    console.log("DJEN Search request:", JSON.stringify(body));

    // Input validation
    const validationErrors: string[] = [];

    // Validate tipo
    const validTipos = ["advogado", "palavra-chave", "processo"];
    if (!validTipos.includes(tipoNormalizado)) {
      validationErrors.push(`Tipo de busca inválido. Use: ${validTipos.join(", ")}`);
    }

    // Validate uf format (2 uppercase letters)
    if (uf && (typeof uf !== 'string' || !/^[A-Za-z]{2}$/.test(uf))) {
      validationErrors.push("UF deve ter exatamente 2 letras");
    }

    // Validate oab format (up to 10 digits)
    if (oab && (typeof oab !== 'string' || oab.length > 20)) {
      validationErrors.push("OAB deve ter no máximo 20 caracteres");
    }

    // Validate date formats (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dataInicio && (typeof dataInicio !== 'string' || !datePattern.test(dataInicio))) {
      validationErrors.push("Data início deve estar no formato YYYY-MM-DD");
    }
    if (dataFim && (typeof dataFim !== 'string' || !datePattern.test(dataFim))) {
      validationErrors.push("Data fim deve estar no formato YYYY-MM-DD");
    }

    // Validate palavraChave length
    if (palavraChave && (typeof palavraChave !== 'string' || palavraChave.length > 200)) {
      validationErrors.push("Palavra-chave deve ter no máximo 200 caracteres");
    }

    // Validate numeroProcesso
    if (numeroProcesso) {
      const cleaned = String(numeroProcesso).replace(/\D/g, '');
      if (cleaned.length > 0 && cleaned.length > 25) {
        validationErrors.push("Número do processo muito longo");
      }
    }

    // Return validation errors
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Dados de entrada inválidos",
          details: validationErrors,
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate type-specific requirements
    if (tipoNormalizado === "advogado") {
      if (!oab) {
        return new Response(JSON.stringify({ error: "OAB é obrigatório para busca por advogado", success: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (tipoNormalizado === "palavra-chave") {
      if (!palavraChave || palavraChave.length < 3) {
        return new Response(
          JSON.stringify({ error: "Palavra-chave deve ter pelo menos 3 caracteres", success: false }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (tipoNormalizado === "processo") {
      if (!numeroProcesso) {
        return new Response(JSON.stringify({ error: "Número do processo é obrigatório", success: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const searchParams: SearchParams = {
      tipo: tipoNormalizado as SearchType,
      oab,
      uf,
      palavraChave,
      numeroProcesso,
      dataInicio,
      dataFim,
      page: typeof page === "number" ? page : 0,
      pageSize: typeof pageSize === "number" ? pageSize : 100,
      fetchAll: !!fetchAll,
    };

    // For fetchAll we skip cache to avoid keeping large results in memory.
    const cacheKey = getCacheKey(searchParams);

    if (!searchParams.fetchAll) {
      const cachedResult = getFromCache(cacheKey);
      if (cachedResult) {
        console.log("Cache HIT for:", cacheKey);
        return new Response(JSON.stringify({ success: true, cached: true, ...cachedResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Cache MISS, fetching from API...");
    const result = await searchPJEComunica(searchParams, jinaApiKey);

    if (!searchParams.fetchAll) {
      setCache(cacheKey, result);
    }

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
