import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============ In-memory cache (DISABLED to prevent memory exhaustion) ============
// NOTE: Cache is disabled to prevent WORKER_LIMIT (546) errors.
// Edge functions have tight memory limits (150MB) and caching large API responses
// causes memory to accumulate across invocations in the same isolate.
const CACHE_TTL_MS = 60 * 1000; // 1 minute (reduced)
const MAX_CACHE_ENTRIES = 0; // DISABLED - cache causes memory exhaustion

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
    // Hard cap: reduce payload to avoid Memory limit exceeded (WORKER_LIMIT 546)
    pageSize: params.pageSize ?? 10,
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
  maxRetries = 1, // Fail fast to free resources
  baseDelay = 1000 // 1s base delay (reduced from 1.5s)
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
  const readTextLimited = async (resp: Response, maxChars = 64_000): Promise<string> => {
    try {
      if (!resp.body) {
        const t = await resp.text();
        return t.slice(0, maxChars);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let out = "";

      while (out.length < maxChars) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) out += decoder.decode(value, { stream: true });
      }

      try {
        reader.cancel();
      } catch {
        // ignore
      }

      return out.slice(0, maxChars);
    } catch {
      return "";
    }
  };

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
  // Reduced from 6s to 4s to fail faster and free resources
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_000);

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
      const t = await readTextLimited(resp);
      console.log(`Jina proxy error ${resp.status}:`, t.slice(0, 200));
      return null;
    }

    const text = await readTextLimited(resp);
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

// Normaliza texto removendo acentos para melhor cobertura de busca
function normalizeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
    .replace(/[\/]/g, ' ')             // S/A -> S A
    .replace(/\s+/g, ' ')              // Normaliza espaços
    .trim();
}

async function searchPJEComunica(params: SearchParams, jinaApiKey?: string): Promise<any> {
  const { tipo, oab, uf, palavraChave, numeroProcesso, dataInicio, dataFim } = params;

  const baseParams = new URLSearchParams();

  if (tipo === "palavra-chave" && palavraChave) {
    // Normalizar acentos para melhor cobertura (API armazena às vezes sem acentos)
    const termoNormalizado = normalizeAccents(palavraChave);
    baseParams.append("texto", termoNormalizado);
    console.log(`[buscar-djen] Termo normalizado: "${palavraChave}" -> "${termoNormalizado}"`);
  } else if (tipo === "advogado" && oab) {
    const oabQuery = uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
    baseParams.append("texto", oabQuery);
  } else if (tipo === "processo" && numeroProcesso) {
    baseParams.append("texto", numeroProcesso);
  }

  if (dataInicio) baseParams.append("dataDisponibilizacaoInicio", dataInicio);
  if (dataFim) baseParams.append("dataDisponibilizacaoFim", dataFim);

  const page = Math.max(params.page ?? 0, 0);
  // CRITICAL: cap to 10 to keep response.json() within memory limits
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

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
  // CRITICAL: Truncate large text fields AGGRESSIVELY to avoid memory exhaustion (WORKER_LIMIT 546)
  const MAX_TEXT_LENGTH = 2000; // Reduced from 4000 to 2KB per item max

  // Read only a limited amount of text from a response to avoid memory spikes
  // (e.g., HTML error pages or proxy content)
  const readTextLimited = async (resp: Response, maxChars = 64_000): Promise<string> => {
    try {
      if (!resp.body) {
        const t = await resp.text();
        return t.slice(0, maxChars);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let out = "";

      while (out.length < maxChars) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) out += decoder.decode(value, { stream: true });
      }

      try {
        reader.cancel();
      } catch {
        // ignore
      }

      return out.slice(0, maxChars);
    } catch {
      return "";
    }
  };
  
  const optimizeItem = (item: any) => {
    // Skip null/undefined items
    if (!item) return null;
    
    return {
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

      // Truncate content aggressively to avoid memory issues
      texto: typeof item.texto === "string" ? item.texto.slice(0, MAX_TEXT_LENGTH) : undefined,
      teor: typeof item.teor === "string" ? item.teor.slice(0, MAX_TEXT_LENGTH) : undefined,
    };
  };

  const endpoints = [`${PJE_COMUNICA_API}/comunicacao`, `${PJE_COMUNICA_API}/comunicacoes`];

  console.log(
    "Fetching from API (cache disabled for memory safety)...",
  );

  let lastError: any = null;

  // ESTRATÉGIA: API direta apenas (Jina proxy DESABILITADO para evitar WORKER_LIMIT 546)
  // O Jina proxy consome muita memória ao processar respostas HTML/não-JSON.
  // A estratégia preferencial é usar busca via browser (IP do usuário).
  const fetchPage = async (endpoint: string, pageNumber: number) => {
    const qp = new URLSearchParams(baseParams);
    qp.set("pagina", String(pageNumber));
    qp.set("tamanhoPagina", String(pageSize));
    qp.set("page", String(pageNumber));
    qp.set("size", String(pageSize));

    const fullUrl = `${endpoint}?${qp.toString()}`;
    console.log(`Trying endpoint (page ${pageNumber}):`, fullUrl);

    // JINA PROXY DESABILITADO - causava Memory limit exceeded (546)
    // A busca agora é feita preferencialmente via browser (pjeComunicaClient).
    // Esta Edge Function só é usada como fallback para casos específicos.

    // API direta apenas
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
      const errorText = await readTextLimited(response);
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
      const t = await readTextLimited(response);
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
        const pageItems = extractItems(data).map(optimizeItem).filter(Boolean);

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
  // Keep VERY strict limits to avoid worker OOM (WORKER_LIMIT 546).
  if (params.fetchAll) {
    // With pageSize=10 we can safely fetch more pages while keeping memory bounded.
    // (Roughly similar max items compared to the previous 25*4=100)
    const MAX_PAGES = 10;
    const MAX_ITEMS = 120;

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
          const optimized = rawItems.map(optimizeItem).filter(Boolean);
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
      // Default to 10 to avoid large payloads (WORKER_LIMIT 546)
      pageSize: typeof pageSize === "number" ? pageSize : 10,
      fetchAll: !!fetchAll,
    };

    // Cache is DISABLED to prevent memory exhaustion (WORKER_LIMIT 546)
    // Each request fetches fresh data to avoid memory accumulation
    console.log("Fetching from API (cache disabled for memory safety)...");
    const result = await searchPJEComunica(searchParams, jinaApiKey);

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
