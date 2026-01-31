// Busca de comunicações no PJE Comunica.
// Estratégia: browser-only.
// IMPORTANTE: evitamos fallback para Edge Function `buscar-djen` porque ela pode estourar
// WORKER_LIMIT (546) sob carga/termos com alto volume.

export type PjeSearchType = "advogado" | "palavra-chave" | "processo";

export interface PjeComunicaSearchParams {
  tipo: PjeSearchType;
  oab?: string;
  uf?: string;
  palavraChave?: string;
  numeroProcesso?: string;
  /** Filtro opcional (ex: TJRJ, TJSP, TRF2...) */
  siglaTribunal?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export interface PjeComunicaResponse {
  success: true;
  items: any[];
  comunicacoes: any[];
  count: number;
  totalElements: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PjeComunicaPaginatedResponse extends PjeComunicaResponse {
  pagesFetched: number;
  truncated: boolean;
}

const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1";
const ENDPOINTS = [`${PJE_COMUNICA_API}/comunicacao`, `${PJE_COMUNICA_API}/comunicacoes`];

function safeNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function extractItems(data: any): any[] {
  const items = data?.items ?? data?.content ?? data?.comunicacoes ?? data?.publicacoes ?? [];
  return Array.isArray(items) ? items : [];
}

function getTotal(data: any): number | null {
  return (
    safeNumber(data?.totalElements) ??
    safeNumber(data?.count) ??
    safeNumber(data?.total) ??
    safeNumber(data?.totalCount)
  );
}

// Texto completo é essencial para análise jurídica - NÃO truncar
// O limite anterior de 4000 chars cortava publicações importantes
const MAX_TEXT_LENGTH = 100000;

// Headers seguros no browser.
// IMPORTANTE: User-Agent / Origin / Referer / Accept-Language são headers proibidos no fetch do browser
// e podem fazer a requisição falhar antes de sair da máquina do usuário.
const requestHeaders: HeadersInit = {
  Accept: "application/json, text/plain, */*",
};
function optimizeItem(item: any) {
  return {
    id: item?.id,
    dataDisponibilizacao: item?.dataDisponibilizacao,
    dataPublicacao: item?.dataPublicacao,
    tipoComunicacao: item?.tipoComunicacao,
    siglaTribunal: item?.siglaTribunal,
    numeroProcesso: item?.numeroProcesso,

    nomeOrgao: item?.nomeOrgao,
    destinatarioNome: item?.destinatarioNome,

    texto: typeof item?.texto === "string" ? item.texto.slice(0, MAX_TEXT_LENGTH) : undefined,
    teor: typeof item?.teor === "string" ? item.teor.slice(0, MAX_TEXT_LENGTH) : undefined,
  };
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

function buildTextoParam(params: PjeComunicaSearchParams): string {
  if (params.tipo === "palavra-chave") {
    const termo = (params.palavraChave || "").trim();
    // Usar versão sem acentos para melhor cobertura
    // A API do PJE Comunica às vezes armazena sem acentos
    return normalizeAccents(termo);
  }
  if (params.tipo === "processo") return (params.numeroProcesso || "").trim();
  // advogado
  const oab = String(params.oab || "").replace(/\D/g, "").trim();
  const uf = String(params.uf || "").trim().toUpperCase();
  return uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
}

// NOTE: Edge Function fallback REMOVIDO para evitar erro 546 (WORKER_LIMIT).
// A estratégia é browser-only conforme memória do projeto.
// Se browser falhar (CORS), retornamos resultado vazio e logamos o motivo.

export async function buscarPjeComunicaNoBrowser(
  params: PjeComunicaSearchParams,
  options?: { signal?: AbortSignal }
): Promise<PjeComunicaResponse> {
  const texto = buildTextoParam(params);
  if (!texto) throw new Error("Parâmetro de busca inválido");

  const page = Math.max(params.page ?? 0, 0);
  // Keep payload small (consistent with buscar-djen hard cap)
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

  const qp = new URLSearchParams();

  // 1) Query principal por texto
  // IMPORTANTE: para busca por ADVOGADO/OAB, alguns tribunais retornam 0 quando `texto` vem junto
  // com `numeroOab/ufOab` (isso é exatamente o que o diagnóstico compara).
  // Estratégia: primeiro tentar SEM `texto` (só numeroOab/ufOab). Se vier vazio, tentamos COM `texto`.
  const shouldSendTextoFirst = params.tipo !== "advogado";
  if (shouldSendTextoFirst) {
    qp.set("texto", texto);
  }

  // 2) Melhorias para cobertura/precisão:
  //    - Para advogado, preferir parâmetros nativos (numeroOab/ufOab), pois alguns tribunais
  //      respondem melhor assim do que via texto "OAB 123 UF".
  if (params.tipo === "advogado") {
    // Normalização para evitar falhas silenciosas na API:
    // - OAB pode vir com máscara/pontuação
    // - UF pode vir minúscula ou com espaços
    const oab = String(params.oab || "").replace(/\D/g, "").trim();
    const uf = String(params.uf || "").trim().toUpperCase();
    if (oab) qp.set("numeroOab", oab);
    if (uf) qp.set("ufOab", uf);
  }

  // 3) Filtro por tribunal (quando disponível)
  if (params.siglaTribunal) qp.set("siglaTribunal", params.siglaTribunal);

  if (params.dataInicio) qp.set("dataDisponibilizacaoInicio", params.dataInicio);
  if (params.dataFim) qp.set("dataDisponibilizacaoFim", params.dataFim);

  // API usa variações de paginação; mandamos todas as mais comuns.
  qp.set("pagina", String(page));
  qp.set("tamanhoPagina", String(pageSize));
  qp.set("page", String(page));
  qp.set("size", String(pageSize));
  qp.set("itensPorPagina", String(pageSize));

  let lastErr: any = null;
  let corsBlocked = false;

  // ESTRATÉGIA: Tentar apenas o primeiro endpoint (/comunicacao) que é mais confiável
  // O endpoint /comunicacoes (plural) retorna 404 para vários tribunais
  const endpoint = ENDPOINTS[0]; // /comunicacao (singular)

  // Timeout de 30s por requisição para evitar travamentos
  const REQUEST_TIMEOUT_MS = 30000;

  const doRequest = async (queryParams: URLSearchParams): Promise<PjeComunicaResponse> => {
    const url = `${endpoint}?${queryParams.toString()}`;
    
    // Criar AbortController com timeout automático
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    
    // Combinar sinais: timeout próprio + sinal externo (cancelamento)
    const combinedSignal = options?.signal 
      ? AbortSignal.any([timeoutController.signal, options.signal])
      : timeoutController.signal;
    
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: requestHeaders,
        signal: combinedSignal,
      });
      clearTimeout(timeoutId);

      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        // Se é 404, provavelmente não há dados para esse filtro - não é erro fatal
        if (resp.status === 404) {
          return {
            success: true,
            items: [],
            comunicacoes: [],
            count: 0,
            totalElements: 0,
            page,
            pageSize,
            hasMore: false,
          };
        }
        throw new Error(`HTTP ${resp.status} ${t.slice(0, 120)}`);
      }

      if (!contentType.includes("application/json")) {
        const t = await resp.text().catch(() => "");
        throw new Error(`Resposta não-JSON: ${t.slice(0, 120)}`);
      }

      const data = await resp.json();
      const rawItems = extractItems(data);
      const items = rawItems.map(optimizeItem);
      const totalExpected = getTotal(data);

      const totalElements =
        typeof totalExpected === "number" && totalExpected >= 0
          ? totalExpected
          : items.length === pageSize
            ? (page + 1) * pageSize + 1
            : page * pageSize + items.length;

      const hasMore =
        typeof totalExpected === "number" && totalExpected >= 0
          ? (page + 1) * pageSize < totalExpected
          : items.length === pageSize;

      return {
        success: true,
        items,
        comunicacoes: items,
        count: totalElements,
        totalElements,
        page,
        pageSize,
        hasMore,
      };
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  };

  try {
    // 1) Primeira tentativa
    const first = await doRequest(qp);

    // 2) Fallback específico p/ advogado: tentar com `texto` caso a API tenha retornado vazio
    // (sem erro HTTP) — mantém o comportamento do diagnóstico.
    if (params.tipo === 'advogado' && first.items.length === 0) {
      const qp2 = new URLSearchParams(qp);
      qp2.set('texto', texto);
      return await doRequest(qp2);
    }

    return first;
  } catch (e: any) {
    lastErr = e;
    // Detectar erro de CORS/bloqueio de rede
    if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
      corsBlocked = true;
    }
  }

  // ESTRATÉGIA BROWSER-ONLY: Se CORS bloqueou, retornar vazio em vez de chamar Edge Function
  // Isso evita o erro 546 (WORKER_LIMIT) que ocorre quando a Edge Function esgota memória
  if (corsBlocked) {
    console.warn('[PJE Comunica] CORS blocked - retornando resultado vazio (browser-only strategy)');
    return {
      success: true,
      items: [],
      comunicacoes: [],
      count: 0,
      totalElements: 0,
      page,
      pageSize,
      hasMore: false,
    };
  }

  throw lastErr || new Error("Falha ao buscar no PJE Comunica");
}

// Versão paginada (essencial para o monitoramento), com limite de páginas por segurança.
// PARÂMETROS CONSERVADORES: alinhados com DJEN Processos para evitar 429
export async function buscarPjeComunicaPaginado(
  params: PjeComunicaSearchParams,
  options?: {
    signal?: AbortSignal;
    maxPages?: number;
    delayMs?: number;
    maxRetries?: number;
    retryBaseDelay?: number;
  }
): Promise<PjeComunicaPaginatedResponse> {
  const maxPages = Math.max(options?.maxPages ?? 10, 1);
  // Delay otimizado entre páginas: 150ms (velocidade máxima com resiliência)
  const delayMs = Math.max(options?.delayMs ?? 150, 0);
  // Retry com backoff exponencial
  const maxRetries = options?.maxRetries ?? 3;
  const retryBaseDelay = options?.retryBaseDelay ?? 2000;  // Reduzido de 3000ms

  const startPage = Math.max(params.page ?? 0, 0);
  // Keep payload small (consistent with buscar-djen hard cap)
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

  const all: any[] = [];
  const seen = new Set<string>();

  let last: PjeComunicaResponse | null = null;
  let pagesFetched = 0;
  let truncated = false;

  // Helper para fetch com retry e backoff exponencial
  const fetchWithRetry = async (page: number): Promise<PjeComunicaResponse> => {
    let lastErr: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp = await buscarPjeComunicaNoBrowser(
          { ...params, page, pageSize },
          { signal: options?.signal }
        );
        return resp;
      } catch (e: any) {
        lastErr = e;
        
        // Se foi cancelado, não tentar novamente
        if (e?.name === 'AbortError') throw e;
        
        // Rate limited ou erro de rede - aguardar com backoff exponencial
        if (attempt < maxRetries - 1) {
          const waitTime = retryBaseDelay * Math.pow(2, attempt); // 5s, 10s, 20s
          console.log(`[PJE Comunica] Erro na página ${page}. Aguardando ${waitTime}ms antes de retry ${attempt + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }
    
    throw lastErr || new Error(`Falha após ${maxRetries} tentativas`);
  };

  for (let p = startPage; p < startPage + maxPages; p++) {
    try {
      const resp = await fetchWithRetry(p);
      last = resp;
      pagesFetched += 1;

      for (const item of resp.items) {
        const id = String(item?.id ?? "");
        const key = id || JSON.stringify(item).slice(0, 400);
        if (!seen.has(key)) {
          seen.add(key);
          all.push(item);
        }
      }

      if (!resp.hasMore || resp.items.length === 0) break;

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (e: any) {
      // Se foi cancelado, parar imediatamente
      if (e?.name === 'AbortError') throw e;
      // Para outros erros, logar e continuar para próxima página
      console.warn(`[PJE Comunica] Falha na página ${p} após retries:`, e?.message);
      break;
    }
  }

  if (last?.hasMore) truncated = true;

  // Se por algum motivo não tivemos página alguma, ainda assim garantimos formato.
  const safeLast: PjeComunicaResponse =
    last ??
    ({
      success: true,
      items: [],
      comunicacoes: [],
      count: 0,
      totalElements: 0,
      page: startPage,
      pageSize,
      hasMore: false,
    } satisfies PjeComunicaResponse);

  return {
    ...safeLast,
    items: all,
    comunicacoes: all,
    // No paginado, count representa o total retornado para consumo imediato.
    count: all.length,
    page: startPage,
    pageSize,
    hasMore: truncated ? true : false,
    pagesFetched,
    truncated,
  };
}
