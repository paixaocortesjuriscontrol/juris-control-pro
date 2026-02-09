// Busca de comunicações no PJE Comunica.
// Estratégia: browser-only.
// IMPORTANTE: evitamos fallback para Edge Function `buscar-djen` porque ela pode estourar
// WORKER_LIMIT (546) sob carga/termos com alto volume.

export type PjeSearchType = "advogado" | "palavra-chave" | "processo" | "parte";

export interface PjeComunicaSearchParams {
  tipo: PjeSearchType;
  oab?: string;
  uf?: string;
  /** Nome do advogado (quando a busca por OAB não retorna resultados). */
  nomeAdvogado?: string;
  /** Nome da parte (polo ativo/passivo) - usado quando tipo='parte' */
  nomeParte?: string;
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

// Backoff global para evitar tempestade de 429 entre chamadas concorrentes
let globalCooldownUntil = 0;
const jitterMs = (base: number) => {
  const factor = 0.8 + Math.random() * 0.5; // 0.8x..1.3x
  return Math.round(base * factor);
};
const parseRetryAfterMs = (resp: Response): number | null => {
  const ra = resp.headers.get("retry-after");
  if (!ra) return null;
  const seconds = Number(ra);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }
  const date = Date.parse(ra);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
};
const setGlobalCooldown = (ms: number) => {
  const until = Date.now() + ms;
  globalCooldownUntil = Math.max(globalCooldownUntil, until);
};
const awaitGlobalCooldown = async () => {
  const wait = globalCooldownUntil - Date.now();
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
};
function optimizeItem(item: any) {
  // IMPORTANTE:
  // - Mantemos o objeto original (spread) para não perder metadados (advogados/partes/destinatários etc.)
  //   que alguns tribunais usam para a busca, mesmo quando o corpo (conteudo/texto/teor) vem “magro”.
  // - Ainda assim, limitamos os campos de texto para evitar explosão de memória.
  const conteudo = typeof item?.conteudo === "string" ? item.conteudo.slice(0, MAX_TEXT_LENGTH) : undefined;
  const texto = typeof item?.texto === "string" ? item.texto.slice(0, MAX_TEXT_LENGTH) : undefined;
  const teor = typeof item?.teor === "string" ? item.teor.slice(0, MAX_TEXT_LENGTH) : undefined;

  return {
    ...item,
    id: item?.id,

    // A API pode retornar campos em snake_case (ex: data_disponibilizacao)
    // ou em outras variações; normalizamos aqui para o pipeline do DJEN.
    dataDisponibilizacao:
      item?.dataDisponibilizacao ??
      item?.data_disponibilizacao ??
      item?.datadisponibilizacao,
    dataPublicacao:
      item?.dataPublicacao ??
      item?.data_publicacao ??
      item?.datapublicacao,
    tipoComunicacao: item?.tipoComunicacao,
    siglaTribunal:
      item?.siglaTribunal ??
      item?.sigla_tribunal ??
      item?.siglaTribunalId ??
      item?.sigla_tribunal_id ??
      item?.tribunalSigla ??
      item?.tribunal_sigla ??
      item?.tribunal ??
      item?.sigla ??
      item?.sigla_orgao ??
      item?.siglaOrgao ??
      null,
    numeroProcesso:
      item?.numeroProcesso ??
      item?.numero_processo ??
      item?.processo_numero ??
      item?.processoNumero ??
      null,

    nomeOrgao:
      item?.nomeOrgao ??
      item?.nome_orgao ??
      item?.orgao ??
      item?.nomeOrgaoJulgador ??
      item?.nome_orgao_julgador ??
      null,
    destinatarioNome:
      item?.destinatarioNome ??
      item?.destinatario_nome ??
      item?.nomeDestinatario ??
      item?.nome_destinatario ??
      null,

    // CRÍTICO: A API pode retornar o corpo da publicação como 'conteudo', 'texto' ou 'teor'.
    // Precisamos capturar TODOS para não perder publicações.
    conteudo,
    texto,
    teor,
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

function buildTextoParam(params: PjeComunicaSearchParams): string | null {
  // Tipo 'parte': não usa texto, usa nomeParte separadamente
  if (params.tipo === "parte") {
    return null;
  }
  if (params.tipo === "palavra-chave") {
    const termo = (params.palavraChave || "").trim();
    // Se termo é '*' ou vazio, significa busca geral (só por tribunal/data)
    // Retornar null para não enviar parâmetro texto
    if (!termo || termo === '*') return null;
    // Usar versão sem acentos para melhor cobertura
    // A API do PJE Comunica às vezes armazena sem acentos
    return normalizeAccents(termo);
  }
  if (params.tipo === "processo") return (params.numeroProcesso || "").trim();
  // advogado
  const oab = String(params.oab || "").replace(/\D/g, "").trim();
  const uf = String(params.uf || "").trim().toUpperCase();
  // Se não há OAB, não inventar "OAB " (isso gera buscas inválidas e resultados ruins).
  if (!oab) {
    const nome = (params.nomeAdvogado || "").trim();
    return nome ? normalizeAccents(nome) : null;
  }
  return uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
}

// NOTE: Edge Function fallback REMOVIDO para evitar erro 546 (WORKER_LIMIT).
// A estratégia é browser-only conforme memória do projeto.
// Se browser falhar (CORS), retornamos resultado vazio e logamos o motivo.

export async function buscarPjeComunicaNoBrowser(
  params: PjeComunicaSearchParams,
  options?: { signal?: AbortSignal }
): Promise<PjeComunicaResponse> {
  // DEBUG: Log params for troubleshooting
  console.log('[PJE Comunica] 🚀 buscarPjeComunicaNoBrowser params:', {
    tipo: params.tipo,
    nomeParte: params.nomeParte,
    nomeAdvogado: params.nomeAdvogado,
    siglaTribunal: params.siglaTribunal,
    dataInicio: params.dataInicio,
  });
  
  const texto = buildTextoParam(params);
  const nomeAdvogado = String(params.nomeAdvogado || "").trim();
  
  // Se não tem texto E também não tem tribunal/data, é inválido
  const hasTribunal = !!params.siglaTribunal;
  const hasData = !!(params.dataInicio || params.dataFim);
  if (!texto && !hasTribunal && !hasData) {
    throw new Error("Parâmetro de busca inválido (precisa de termo, tribunal ou data)");
  }

  const page = Math.max(params.page ?? 0, 0);
  // Para busca geral por tribunal, permitir pageSize maior (50)
  // Para buscas específicas, manter 10 para evitar sobrecarga
  const maxPageSize = (hasTribunal && !texto) ? 50 : 10;
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), maxPageSize);

  const qp = new URLSearchParams();

  // 1) Query principal por texto (se disponível)
  // IMPORTANTE: para busca por ADVOGADO/OAB, alguns tribunais retornam 0 quando `texto` vem junto
  // com `numeroOab/ufOab` (isso é exatamente o que o diagnóstico compara).
  // Estratégia: primeiro tentar SEM `texto` (só numeroOab/ufOab). Se vier vazio, tentamos COM `texto`.
  const shouldSendTextoFirst = params.tipo !== "advogado" && texto !== null;
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
    const ufRaw = params.uf ?? "";
    const uf = String(ufRaw).trim().toUpperCase();
    const ufValida = uf && uf !== "TODAS" && uf !== "UNDEFINED";

    if (ufValida && oab) {
      // UF específica: busca por OAB/UF (mais precisa)
      qp.set("numeroOab", oab);
      qp.set("ufOab", uf);
    } else if (nomeAdvogado) {
      // UF "TODAS" ou sem UF: busca por nome do advogado
      // A API PJE Comunica IGNORA numeroOab quando ufOab está ausente,
      // então a única forma de buscar cross-UF é pelo nome.
      qp.set("nomeAdvogado", normalizeAccents(nomeAdvogado));
      console.log(`[PJE Comunica] UF=${uf || 'vazio'} → buscando por nomeAdvogado: ${nomeAdvogado}`);
    } else if (oab) {
      // Tem OAB mas sem UF e sem nome: enviar OAB sem UF como última tentativa
      qp.set("numeroOab", oab);
    }
  }

  // 2a) Busca por nome de parte (polo ativo/passivo)
  if (params.tipo === "parte") {
    const nomeParte = (params.nomeParte || "").trim();
    console.log('[PJE Comunica] ✅ Tipo PARTE detectado. nomeParte:', nomeParte);
    if (nomeParte) {
      qp.set("nomeParte", normalizeAccents(nomeParte));
      console.log('[PJE Comunica] ✅ Parâmetro nomeParte adicionado à query:', normalizeAccents(nomeParte));
    }
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

  // Timeout de 90s por requisição para APIs lentas/instáveis
  const REQUEST_TIMEOUT_MS = 90000;

  const doRequest = async (queryParams: URLSearchParams): Promise<PjeComunicaResponse> => {
    await awaitGlobalCooldown();
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
        if (resp.status === 429) {
          const retryAfterMs = parseRetryAfterMs(resp);
          const baseWait = retryAfterMs ?? 10000;
          setGlobalCooldown(jitterMs(baseWait));
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

    // 2) Fallback específico p/ advogado quando retornar vazio (sem erro HTTP).
    //    IMPORTANTE: nunca remover os parâmetros de OAB - eles são o filtro principal!
    //    Se removemos, a API pode retornar qualquer publicação.
    if (params.tipo === 'advogado' && first.items.length === 0) {
      const oab = String(params.oab || "").replace(/\D/g, "").trim();
      const ufRaw = params.uf ?? "";
      const uf = String(ufRaw).trim().toUpperCase();
      const ufValida = uf && uf !== "TODAS" && uf !== "UNDEFINED";
      const nome = nomeAdvogado;

      // 2a) Tentar adicionar `nomeAdvogado` junto com OAB (portal oficial usa isso)
      if (nome && (oab || ufValida)) {
        const qp2 = new URLSearchParams(qp);
        qp2.set('nomeAdvogado', normalizeAccents(nome));
        const second = await doRequest(qp2);
        if (second.items.length > 0) return second;
      }

      // 2b) Tentar adicionar `texto` junto com OAB (alguns tribunais aceitam melhor assim)
      if (texto && (oab || ufValida)) {
        const qp3 = new URLSearchParams(qp);
        qp3.set('texto', texto);
        const third = await doRequest(qp3);
        if (third.items.length > 0) return third;
      }

      // 2c) ÚLTIMO RECURSO: buscar só pelo nome do advogado.
      //     Permitido quando: não tem OAB OU UF é "TODAS" (cross-UF).
      //     A validação de conteúdo (OAB no texto) garante que não capture lixo.
      if (nome && (!oab || !ufValida)) {
        const qp4 = new URLSearchParams();
        if (params.siglaTribunal) qp4.set('siglaTribunal', params.siglaTribunal);
        if (params.dataInicio) qp4.set('dataDisponibilizacaoInicio', params.dataInicio);
        if (params.dataFim) qp4.set('dataDisponibilizacaoFim', params.dataFim);
        qp4.set('pagina', String(page));
        qp4.set('tamanhoPagina', String(pageSize));
        qp4.set('page', String(page));
        qp4.set('size', String(pageSize));
        qp4.set('nomeAdvogado', normalizeAccents(nome));
        console.log(`[PJE Comunica] Fallback: buscando por nomeAdvogado sem OAB (UF=${uf})`);
        return await doRequest(qp4);
      }
    }

    // Para tipo 'parte': não alterar o termo (sem sufixos/fallbacks), pois isso pode gerar capturas indevidas.

    return first;

    return first;
  } catch (e: any) {
    lastErr = e;
    // Detectar erro de CORS/bloqueio de rede
    if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
      corsBlocked = true;
    }
  }

// ESTRATÉGIA HÍBRIDA: Se CORS bloqueou, usar Edge Function como proxy
  // Com a estratégia v6 (grupos OR), temos ~200-400 requisições ao invés de 13.000+
  // Isso torna o risco de WORKER_LIMIT (546) baixo e aceitável
  if (corsBlocked) {
    console.log('[PJE Comunica] CORS blocked, usando Edge Function como proxy...');
    
    try {
      // Import dinâmico para evitar dependência circular
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Chamar Edge Function diretamente (bypass do shim do client.ts)
      const originalInvoke = (supabase.functions as any).__originalInvoke || supabase.functions.invoke.bind(supabase.functions);
      
      const { data, error } = await originalInvoke('buscar-djen', {
        body: {
          tipo: params.tipo,
          palavraChave: params.palavraChave,
          nomeParte: params.nomeParte,
          oab: params.oab,
          uf: params.uf,
          nomeAdvogado: nomeAdvogado || undefined,
          numeroProcesso: params.numeroProcesso,
          siglaTribunal: params.siglaTribunal,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
          page: params.page ?? 0,
          pageSize: params.pageSize ?? 50,
        },
      });
      
      if (error) {
        console.error('[PJE Comunica] Edge Function error:', error);
        throw error;
      }
      
      // Detectar erro de bloqueio na resposta (mesmo com success: true)
      if (data?.success === false) {
        console.error('[PJE Comunica] Proxy returned success: false:', data?.error || data?.message);
        throw new Error(data?.error || data?.message || 'API bloqueada');
      }
      
      // Detectar "Blocked (HTML)" no campo error
      if (data?.error && String(data.error).toLowerCase().includes('blocked')) {
        console.error('[PJE Comunica] Proxy retornou bloqueio:', data.error);
        throw new Error(`API bloqueada: ${data.error}`);
      }
      
      // Mapear items corretamente (pode vir como comunicacoes/publicacoes)
      const rawItems = data?.items ?? data?.comunicacoes ?? data?.publicacoes ?? [];
      const items = rawItems.map(optimizeItem);
      
      return {
        success: true,
        items,
        comunicacoes: items,
        count: data?.totalElements ?? items.length,
        totalElements: data?.totalElements ?? items.length,
        page: data?.page ?? page,
        pageSize: data?.pageSize ?? pageSize,
        hasMore: data?.hasMore ?? false,
      };
    } catch (proxyError: any) {
      console.error('[PJE Comunica] Proxy fallback failed:', proxyError?.message);
      // Se o proxy também falhar, propagar o erro original
      throw lastErr || proxyError;
    }
  }

  throw lastErr || new Error("Falha ao buscar no PJE Comunica");
}

// Versão paginada (essencial para o monitoramento), com limite de páginas por segurança.
// PARÂMETROS CONSERVADORES v1.1.0: baseado em execuções bem-sucedidas (~5-6min para 118 termos)
export async function buscarPjeComunicaPaginado(
  params: PjeComunicaSearchParams,
  options?: {
    signal?: AbortSignal;
    maxPages?: number;
    delayMs?: number;
    maxRetries?: number;
    retryBaseDelay?: number;
    onRateLimit?: (waitMs: number, attempt: number, page: number) => void;
  }
): Promise<PjeComunicaPaginatedResponse> {
  const maxPages = Math.max(options?.maxPages ?? 10, 1);
  // Delay entre páginas: 1500ms (restaurado do 26/01 - balanceado velocidade/estabilidade)
  const delayMs = Math.max(options?.delayMs ?? 1500, 0);
  // Retry com backoff exponencial
  const maxRetries = options?.maxRetries ?? 5;
  const retryBaseDelay = options?.retryBaseDelay ?? 10000;  // 10s base para retry

  const startPage = Math.max(params.page ?? 0, 0);
  // PageSize 50: menos páginas = menos delays = ~2-3x mais rápido (restaurado do 26/01)
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 50);

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
          const msg = String(e?.message ?? '');
          const is429 = msg.includes('HTTP 429') || msg.includes('Too Many');
          // 429 precisa de backoff maior para evitar “loop de bloqueio”.
          const baseDelay = is429 ? Math.max(retryBaseDelay, 8000) : retryBaseDelay;
          const waitTime = jitterMs(baseDelay * Math.pow(2, attempt));
          if (is429) {
            setGlobalCooldown(waitTime);
            options?.onRateLimit?.(waitTime, attempt + 1, page);
          }
          console.log(
            `[PJE Comunica] ${is429 ? 'Rate limit (429)' : 'Erro'} na página ${page}. ` +
              `Aguardando ${waitTime}ms antes de retry ${attempt + 1}/${maxRetries}`
          );
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

// ============================================================================
// BUSCA PARALELA INDIVIDUAL - Estratégia: OR do lado da aplicação
// ============================================================================

/**
 * Verifica se o número do processo está no formato CNJ válido (15+ dígitos).
 * Processos legados como "NDFC. 20.209.805-2" serão processados individualmente.
 */
export function isCnjFormat(numero: string): boolean {
  const digits = numero.replace(/\D/g, '');
  return digits.length >= 15;
}

/**
 * Resultado de uma busca paralela com mapeamento por processo.
 */
export interface BuscaParalelaResultado {
  /** Publicações agrupadas por número do processo */
  porProcesso: Map<string, any[]>;
  /** Total de publicações encontradas */
  totalItems: number;
  /** Processos que retornaram resultados */
  processosComResultados: string[];
  /** Processos que falharam (CORS, timeout, etc) */
  processosFalharam: string[];
}

/**
 * Busca publicações para múltiplos processos em PARALELO.
 * 
 * ESTRATÉGIA: OR do lado da aplicação (não da API)
 * - A API PJE Comunica NÃO suporta sintaxe OR no parâmetro texto/palavraChave
 * - Executamos N buscas individuais simultaneamente via Promise.allSettled
 * 
 * @param processos Lista de processos com id e numero
 * @param params Datas de filtro
 * @param options Opções de controle (parallelism, signal, delays)
 */
export async function buscarProcessosEmParalelo(
  processos: { id: string; numero: string }[],
  params: { dataInicio: string; dataFim: string },
  options?: { 
    signal?: AbortSignal;
    /** Máximo de requisições simultâneas (default: 5) */
    parallelism?: number;
    /** Delay entre ciclos de requisições paralelas (default: 200ms) */
    delayBetweenCycles?: number;
    /** Callback de progresso */
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<BuscaParalelaResultado> {
  const parallelism = options?.parallelism ?? 5;
  const delayBetweenCycles = options?.delayBetweenCycles ?? 200;
  
  const resultado: BuscaParalelaResultado = {
    porProcesso: new Map(),
    totalItems: 0,
    processosComResultados: [],
    processosFalharam: [],
  };
  
  if (!processos.length) return resultado;

  // Inicializar mapa com arrays vazios
  for (const proc of processos) {
    resultado.porProcesso.set(proc.numero, []);
  }

  let processedCount = 0;
  
  // Processa em ciclos de N requisições paralelas
  for (let i = 0; i < processos.length; i += parallelism) {
    // Verificar cancelamento
    if (options?.signal?.aborted) break;
    
    const lote = processos.slice(i, i + parallelism);
    
    const promises = lote.map(async (proc) => {
      try {
        const resp = await buscarPjeComunicaNoBrowser({
          tipo: 'processo',
          numeroProcesso: proc.numero,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
        }, { signal: options?.signal });
        
        return { 
          numero: proc.numero, 
          items: resp.items,
          success: true,
        };
      } catch (e: any) {
        // Se foi cancelamento, propagar
        if (e?.name === 'AbortError') throw e;
        
        console.warn(`[Paralelo] Falha ${proc.numero}:`, e?.message?.slice(0, 80));
        return { 
          numero: proc.numero, 
          items: [] as any[],
          success: false,
        };
      }
    });
    
    const resultadosLote = await Promise.allSettled(promises);
    
    for (const r of resultadosLote) {
      if (r.status === 'fulfilled') {
        const { numero, items, success } = r.value;
        resultado.porProcesso.set(numero, items);
        resultado.totalItems += items.length;
        
        if (items.length > 0) {
          resultado.processosComResultados.push(numero);
        }
        if (!success) {
          resultado.processosFalharam.push(numero);
        }
      }
    }
    
    processedCount += lote.length;
    options?.onProgress?.(processedCount, processos.length);
    
    // Delay entre ciclos para evitar sobrecarregar a API
    if (i + parallelism < processos.length && delayBetweenCycles > 0) {
      await new Promise(r => setTimeout(r, delayBetweenCycles));
    }
  }

  console.log(
    `[Paralelo] Concluído: ${resultado.totalItems} publicações em ` +
    `${resultado.processosComResultados.length}/${processos.length} processos ` +
    `(${resultado.processosFalharam.length} falhas)`
  );

  return resultado;
}

/**
 * Configuração para busca paralela.
 */
export const BUSCA_PARALELA_CONFIG = {
  /** Requisições paralelas simultâneas */
  parallelism: 5,
  /** Delay entre ciclos de requisições paralelas (ms) */
  delayBetweenCycles: 200,
  /** Processos por super-lote (checkpoint) - reduzido para checkpoints mais frequentes */
  superBatchSize: 100,
  /** Delay entre super-lotes (ms) */
  delayBetweenSuperBatches: 500,
};
