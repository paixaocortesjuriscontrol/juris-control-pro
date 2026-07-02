// Busca de comunicações no PJE Comunica.
// Estratégia: browser-only.
// IMPORTANTE: evitamos fallback para Edge Function `buscar-djen` porque ela pode estourar
// WORKER_LIMIT (546) sob carga/termos com alto volume.
//
// POC: opcionalmente roteia chamadas via pool de VPS (djenProxyPool) para
// mitigar 429 do PJE Comunica. Quando o pool está desabilitado (default),
// o comportamento é idêntico ao histórico — não afeta Pro / Flash / STF Flash.

import { fetchDjenViaPool, readPoolViaFromResponse, type PoolViaInfo } from "./djenProxyPool";

export type { PoolViaInfo };

export type PjeSearchType = "advogado" | "palavra-chave" | "processo" | "parte";

export interface PjeComunicaSearchParams {
  tipo: PjeSearchType;
  oab?: string;
  uf?: string;
  /** Nome do advogado (quando a busca por OAB não retorna resultados). */
  nomeAdvogado?: string;
  /** Suplemento controlado: permite testar numeroOab + ufOab=TODAS quando a rota por nome omite resultados. */
  forcarNumeroOabTodas?: boolean;
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
  rateLimitHits?: number;
  failedPages?: number;
  partial?: boolean;
  lastError?: string | null;
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
const MAX_TEXT_LENGTH = 500000;

// Headers seguros no browser.
// IMPORTANTE: User-Agent / Origin / Referer / Accept-Language são headers proibidos no fetch do browser
// e podem fazer a requisição falhar antes de sair da máquina do usuário.
const requestHeaders: HeadersInit = {
  Accept: "application/json, text/plain, */*",
};

// Backoff PJE Comunica.
// Antes era uma única variável global, o que fazia TODAS as VPS pararem
// quando uma única recebia 429/504. Agora mantemos um mapa por "via"
// (id da VPS ou "__direct__"), e exportamos helpers que aceitam um via
// opcional. Sem via (callers legados Kurier/Flash) usamos a chave
// "__global__" para preservar o comportamento anterior.
const GLOBAL_COOLDOWN_KEY = "__global__";
const cooldownByVia = new Map<string, number>();
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
const setGlobalCooldown = (ms: number, via?: string | null) => {
  const key = via && via.length > 0 ? via : GLOBAL_COOLDOWN_KEY;
  const until = Date.now() + ms;
  const prev = cooldownByVia.get(key) ?? 0;
  cooldownByVia.set(key, Math.max(prev, until));
};

/**
 * Sleep que respeita AbortSignal — interrompe imediatamente quando o signal
 * é abortado (em vez de aguardar o setTimeout completo). Crítico para
 * cancelamento responsivo em motores que sofrem retries longos por 429.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((r) => setTimeout(r, ms));
  if (signal.aborted) {
    const err: any = new Error('Aborted');
    err.name = 'AbortError';
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      const err: any = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const getCooldownUntilFor = (via?: string | null): number => {
  // Sempre considera o cooldown "__global__" (legado Kurier/Flash) como piso.
  const globalUntil = cooldownByVia.get(GLOBAL_COOLDOWN_KEY) ?? 0;
  if (!via) return globalUntil;
  const viaUntil = cooldownByVia.get(via) ?? 0;
  return Math.max(globalUntil, viaUntil);
};
const awaitGlobalCooldown = async (via?: string | null) => {
  const wait = getCooldownUntilFor(via) - Date.now();
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
};
const getGlobalCooldownRemainingMs = (via?: string | null): number => {
  return Math.max(0, getCooldownUntilFor(via) - Date.now());
};

/**
 * Exportado para que engines (DJEN Pro/Flash) possam aguardar o cooldown global
 * ANTES de iniciar um novo termo, evitando cascata de 429 entre termos consecutivos.
 */
export const awaitPjeComunicaGlobalCooldown = (via?: string | null) => awaitGlobalCooldown(via);
export const getPjeComunicaGlobalCooldownRemainingMs = (via?: string | null) => getGlobalCooldownRemainingMs(via);
function optimizeItem(item: any) {
  const obj = item?.comunicacao && typeof item.comunicacao === "object" ? item.comunicacao : item;
  // IMPORTANTE:
  // - Mantemos o objeto original (spread) para não perder metadados (advogados/partes/destinatários etc.)
  //   que alguns tribunais usam para a busca, mesmo quando o corpo (conteudo/texto/teor) vem “magro”.
  // - Ainda assim, limitamos os campos de texto para evitar explosão de memória.
  const conteudo = typeof obj?.conteudo === "string" ? obj.conteudo.slice(0, MAX_TEXT_LENGTH) : (typeof item?.conteudo === "string" ? item.conteudo.slice(0, MAX_TEXT_LENGTH) : undefined);
  const texto = typeof obj?.texto === "string" ? obj.texto.slice(0, MAX_TEXT_LENGTH) : (typeof item?.texto === "string" ? item.texto.slice(0, MAX_TEXT_LENGTH) : undefined);
  const teor = typeof obj?.teor === "string" ? obj.teor.slice(0, MAX_TEXT_LENGTH) : (typeof item?.teor === "string" ? item.teor.slice(0, MAX_TEXT_LENGTH) : undefined);

  const idDjen =
    obj?.id ??
    item?.id ??
    obj?.id_djen ??
    item?.id_djen ??
    obj?.codigoComunicacao ??
    item?.codigoComunicacao ??
    obj?.codigo_comunicacao ??
    item?.codigo_comunicacao ??
    obj?.idComunicacao ??
    item?.idComunicacao ??
    obj?.id_comunicacao ??
    item?.id_comunicacao ??
    obj?.comunicacaoId ??
    item?.comunicacaoId ??
    obj?.comunicacao_id ??
    item?.comunicacao_id ??
    obj?.codigo ??
    item?.codigo ??
    null;

  return {
    ...item,
    ...(obj && obj !== item ? obj : {}),
    id: idDjen,
    id_djen: idDjen != null ? String(idDjen) : item?.id_djen,

    // A API pode retornar campos em snake_case (ex: data_disponibilizacao)
    // ou em outras variações; normalizamos aqui para o pipeline do DJEN.
    dataDisponibilizacao:
      obj?.dataDisponibilizacao ??
      item?.dataDisponibilizacao ??
      obj?.data_disponibilizacao ??
      item?.data_disponibilizacao ??
      obj?.datadisponibilizacao ??
      item?.datadisponibilizacao,
    dataPublicacao:
      obj?.dataPublicacao ??
      item?.dataPublicacao ??
      obj?.data_publicacao ??
      item?.data_publicacao ??
      obj?.datapublicacao ??
      item?.datapublicacao,
    codigoComunicacao: obj?.codigoComunicacao ?? item?.codigoComunicacao ?? obj?.codigo_comunicacao ?? item?.codigo_comunicacao ?? obj?.codigo ?? item?.codigo,
    numeroComunicacao: obj?.numeroComunicacao ?? item?.numeroComunicacao ?? obj?.numero_comunicacao ?? item?.numero_comunicacao,
    tipoComunicacao: obj?.tipoComunicacao ?? item?.tipoComunicacao,
    siglaTribunal:
      obj?.siglaTribunal ??
      item?.siglaTribunal ??
      obj?.sigla_tribunal ??
      item?.sigla_tribunal ??
      obj?.siglaTribunalId ??
      item?.siglaTribunalId ??
      obj?.sigla_tribunal_id ??
      item?.sigla_tribunal_id ??
      obj?.tribunalSigla ??
      item?.tribunalSigla ??
      obj?.tribunal_sigla ??
      item?.tribunal_sigla ??
      obj?.tribunal ??
      item?.tribunal ??
      obj?.sigla ??
      item?.sigla ??
      obj?.sigla_orgao ??
      item?.sigla_orgao ??
      obj?.siglaOrgao ??
      item?.siglaOrgao ??
      null,
    numeroProcesso:
      obj?.numeroProcesso ??
      item?.numeroProcesso ??
      obj?.numero_processo ??
      item?.numero_processo ??
      obj?.processo_numero ??
      item?.processo_numero ??
      obj?.processoNumero ??
      item?.processoNumero ??
      obj?.processo ??
      item?.processo ??
      obj?.Processo ??
      item?.Processo ??
      obj?.numero ??
      item?.numero ??
      null,

    nomeOrgao:
      obj?.nomeOrgao ??
      item?.nomeOrgao ??
      obj?.nome_orgao ??
      item?.nome_orgao ??
      obj?.orgao ??
      item?.orgao ??
      obj?.nomeOrgaoJulgador ??
      item?.nomeOrgaoJulgador ??
      obj?.nome_orgao_julgador ??
      item?.nome_orgao_julgador ??
      null,
    destinatarioNome:
      obj?.destinatarioNome ??
      item?.destinatarioNome ??
      obj?.destinatario_nome ??
      item?.destinatario_nome ??
      obj?.nomeDestinatario ??
      item?.nomeDestinatario ??
      obj?.nome_destinatario ??
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
  // Tipo 'processo': não usa texto, usa numeroProcesso separadamente
  if (params.tipo === "processo") {
    return null;
  }
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
  options?: {
    signal?: AbortSignal;
    onPoolVia?: (via: PoolViaInfo) => void;
    forceVia?: string;
    fallbackToDirect?: boolean;
    fallbackToPool?: boolean;
    disableEdgeFallback?: boolean;
    serverParity404AsError?: boolean;
    disableClientAdvogadoFallbacks?: boolean;
  }
): Promise<PjeComunicaResponse> {
  // ── In-flight dedup: quando N workers disparam a MESMA query (ex.: 6 monitoramentos
  // do mesmo advogado em TST), compartilham UMA única Promise em vez de baterem
  // 6 vezes na API. Reduz drasticamente o tempo de "preparar" workers.
  const dedupKey = JSON.stringify({
    t: params.tipo,
    o: String(params.oab || '').replace(/\D/g, ''),
    u: String(params.uf || '').toUpperCase(),
    na: String(params.nomeAdvogado || '').trim().toUpperCase(),
    np: String(params.nomeParte || '').trim().toUpperCase(),
    nr: String(params.numeroProcesso || '').replace(/\D/g, ''),
    s: String(params.siglaTribunal || '').toUpperCase(),
    di: params.dataInicio || '',
    df: params.dataFim || '',
    p: params.page ?? 1,
    ps: params.pageSize ?? 50,
    fv: options?.forceVia || '',
  });
  if (!options?.signal) {
    const existing = __pjeInflight.get(dedupKey);
    if (existing) {
      console.log('[PJE Comunica] ♻️ dedup in-flight:', dedupKey);
      return existing;
    }
  }
  const exec = _buscarPjeComunicaNoBrowserImpl(params, options);
  if (!options?.signal) {
    __pjeInflight.set(dedupKey, exec);
    exec.finally(() => { __pjeInflight.delete(dedupKey); });
  }
  return exec;
}

const __pjeInflight = new Map<string, Promise<PjeComunicaResponse>>();

async function _buscarPjeComunicaNoBrowserImpl(
  params: PjeComunicaSearchParams,
  options?: {
    signal?: AbortSignal;
    onPoolVia?: (via: PoolViaInfo) => void;
    forceVia?: string;
    fallbackToDirect?: boolean;
    fallbackToPool?: boolean;
    disableEdgeFallback?: boolean;
    serverParity404AsError?: boolean;
    disableClientAdvogadoFallbacks?: boolean;
  }
): Promise<PjeComunicaResponse> {
  // DEBUG: Log ALL params for troubleshooting
  console.log('[PJE Comunica] 🚀 buscarPjeComunicaNoBrowser params:', {
    tipo: params.tipo,
    oab: params.oab,
    uf: params.uf,
    nomeAdvogado: params.nomeAdvogado,
    forcarNumeroOabTodas: params.forcarNumeroOabTodas,
    nomeParte: params.nomeParte,
    siglaTribunal: params.siglaTribunal,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    page: params.page,
    pageSize: params.pageSize,
  });
  
  const texto = buildTextoParam(params);
  const nomeAdvogado = String(params.nomeAdvogado || "").trim();
  
  // Se não tem texto E também não tem tribunal/data/processo, é inválido
  const hasTribunal = !!params.siglaTribunal;
  const hasData = !!(params.dataInicio || params.dataFim);
  const hasProcesso = params.tipo === "processo" && !!(params.numeroProcesso || "").trim();
  if (!texto && !hasTribunal && !hasData && !hasProcesso) {
    throw new Error("Parâmetro de busca inválido (precisa de termo, tribunal ou data)");
  }

  // API PJE Comunica usa paginação 1-based (pagina=1 é a primeira)
  const page = Math.max(params.page ?? 1, 1);
  // Sempre permitir pageSize até 50 - a API suporta e precisamos cobrir todos os resultados
  const maxPageSize = 50;
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), maxPageSize);

  const qp = new URLSearchParams();

  // 1) Query principal por texto (se disponível)
  // IMPORTANTE: para busca por ADVOGADO/OAB, alguns tribunais retornam 0 quando `texto` vem junto
  // com `numeroOab/ufOab` (isso é exatamente o que o diagnóstico compara).
  // Estratégia: primeiro tentar SEM `texto` (só numeroOab/ufOab). Se vier vazio, tentamos COM `texto`.
  const shouldSendTextoFirst = params.tipo !== "advogado" && texto !== null;
  if (shouldSendTextoFirst) {
    qp.set("texto", texto);
  }

  // 2) Advogado: espelhar a consulta oficial do Comunica.
  //    Quando há `nomeAdvogado`, a rota primária deve enviar SOMENTE
  //    `nomeAdvogado` (+ tribunal/data). Misturar `numeroOab/ufOab` na mesma
  //    URL restringe o resultado da API e faz editais coletivos sumirem
  //    (caso Osmar Mendes/TJDFT em 01/07/2026).
  if (params.tipo === "advogado") {
    // Normalização para evitar falhas silenciosas na API:
    // - OAB pode vir com máscara/pontuação
    // - UF pode vir minúscula ou com espaços
    const oab = String(params.oab || "").replace(/\D/g, "").trim();
    const ufRaw = params.uf ?? "";
    const uf = String(ufRaw).trim().toUpperCase();
    // A API do PJE Comunica aceita UMA única UF em `ufOab`.
    // Listas separadas por vírgula (ex: "DF,MT,RO,...") fazem a API ignorar/zerar
    // o filtro. Tratamos esses casos como cross-UF (apenas nomeAdvogado).
    const ufUnica = uf && !uf.includes(",");
    const ufValida = ufUnica && uf !== "TODAS" && uf !== "UNDEFINED";

    if (params.forcarNumeroOabTodas && uf === "TODAS" && oab && nomeAdvogado) {
      // Suplemento explícito: algumas respostas cross-UF por nomeAdvogado omitem
      // publicações que a própria API devolve com numeroOab + ufOab=TODAS.
      // Não usar como rota primária para preservar o comportamento oficial;
      // apenas somar em segunda passada e validar por metadados depois.
      qp.set("numeroOab", oab);
      qp.set("ufOab", "TODAS");
      qp.set("nomeAdvogado", normalizeAccents(nomeAdvogado.trim()));
      console.log(`[PJE Comunica] Suplemento UF=TODAS → numeroOab=${oab}, ufOab=TODAS, nomeAdvogado=${normalizeAccents(nomeAdvogado)}`);
    } else if (nomeAdvogado) {
      // Regra principal para QUALQUER UF: enviar APENAS nomeAdvogado.
      // CRÍTICO: Adicionar numeroOab junto com nomeAdvogado ALTERA os resultados da API,
      // fazendo publicações desaparecerem. A URL que funciona no portal oficial usa
      // APENAS nomeAdvogado (ex: ?siglaTribunal=TJDFT&...&nomeAdvogado=OSMAR...)
      qp.set("nomeAdvogado", normalizeAccents(nomeAdvogado.trim()));
      console.log(`[PJE Comunica] Advogado → buscando APENAS por nomeAdvogado: ${normalizeAccents(nomeAdvogado)} (UF/OAB ignoradas na rota primária para não restringir resultados)`);
    } else if (ufValida && oab) {
      // Sem nome cadastrado: usar OAB/UF como último recurso.
      qp.set("numeroOab", oab);
      qp.set("ufOab", uf);
    } else if (oab) {
      // Tem OAB mas sem UF e sem nome: enviar OAB sem UF como última tentativa.
      qp.set("numeroOab", oab);
    }
  }

  // 2a) Busca por nome de parte (polo ativo/passivo)
  if (params.tipo === "parte") {
    const nomeParte = (params.nomeParte || "").trim();
    console.log('[PJE Comunica] ✅ Tipo PARTE detectado. nomeParte:', nomeParte);
    if (nomeParte) {
      qp.set("nomeParte", nomeParte);
      console.log('[PJE Comunica] ✅ Parâmetro nomeParte adicionado à query:', nomeParte);
    }
    // TRAVA: garantir que nenhum parâmetro de texto/palavra-chave vai junto
    // com a busca por parte. A regra é: parte usa SOMENTE nomeParte.
    if (qp.has('texto')) {
      console.warn('[PJE Comunica] Removendo "texto" indevido em busca tipo=parte');
      qp.delete('texto');
    }
  }

  // 2b) Busca por número de processo (parâmetro nativo da API)
  if (params.tipo === "processo") {
    const numProc = (params.numeroProcesso || "").trim();
    if (numProc) {
      qp.set("numeroProcesso", numProc);
      console.log(`[PJE Comunica] ✅ Tipo PROCESSO: usando parâmetro nativo numeroProcesso=${numProc}`);
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
    // Em modo "forceVia" (Paralela: 1 worker por VPS), aguardamos apenas o
    // cooldown daquela VPS. Sem forceVia (Kurier/Flash etc.), aguardamos o
    // cooldown global (back-compat).
    await awaitGlobalCooldown(options?.forceVia ?? null);
    const url = `${endpoint}?${queryParams.toString()}`;
    console.log(`[PJE Comunica] 🌐 Fetching URL: ${url}`);
    
    // Criar AbortController com timeout automático
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    
    // Combinar sinais: timeout próprio + sinal externo (cancelamento)
    const combinedSignal = options?.signal 
      ? AbortSignal.any([timeoutController.signal, options.signal])
      : timeoutController.signal;
    
    try {
      // Roteamento via pool quando habilitado em Configurações; caso contrário
      // cai direto no fetch padrão (mesmo comportamento de antes).
      const resp = await fetchDjenViaPool(
        url,
        {
          method: "GET",
          headers: requestHeaders,
          signal: combinedSignal,
        },
        options?.forceVia
          ? { forceVia: options.forceVia, fallbackToDirect: options.fallbackToDirect, fallbackToPool: options.fallbackToPool }
          : undefined,
      );
      clearTimeout(timeoutId);

      // Repassa para o chamador qual rota (direto/proxy) atendeu esta página.
      try {
        const via = readPoolViaFromResponse(resp);
        if (via && options?.onPoolVia) options.onPoolVia(via);
      } catch {
        /* noop */
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        // Se é 404, provavelmente não há dados para esse filtro - não é erro fatal
        if (resp.status === 404) {
          if (options?.serverParity404AsError) {
            throw new Error(`HTTP 404 ${t.slice(0, 120)}`);
          }
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
          // Penaliza apenas a VPS que respondeu 429 (lida do header anotado
          // pelo proxy pool). Fallback para forceVia ou global.
          const viaId = (() => {
            try { return readPoolViaFromResponse(resp)?.id ?? null; } catch { return null; }
          })();
          setGlobalCooldown(jitterMs(baseWait), viaId ?? options?.forceVia ?? null);
        }
        // 504 (Cloudflare Gateway Timeout) = origem PJE Comunica lenta. Aplicar
        // cooldown global curto para dar fôlego à API antes do próximo retry,
        // evitando martelar a origem e cascata de timeouts em paralelo.
        if (
          resp.status === 500 ||
          resp.status === 502 ||
          resp.status === 503 ||
          resp.status === 504
        ) {
          const viaId = (() => {
            try { return readPoolViaFromResponse(resp)?.id ?? null; } catch { return null; }
          })();
          // 500 "sistema muito ocupado" = overload da origem. Cooldown maior
          // para dar fôlego antes de martelar novamente.
          const cooldown = resp.status === 500 ? 8000 : 4000;
          setGlobalCooldown(jitterMs(cooldown), viaId ?? options?.forceVia ?? null);
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

      // hasMore: API é 1-based, então page*pageSize já é o offset do fim da página atual
      const hasMore =
        typeof totalExpected === "number" && totalExpected >= 0
          ? page * pageSize < totalExpected
          : items.length === pageSize;

      console.log(
        `[PJE Comunica] 📄 page=${page} items=${items.length}/${pageSize} ` +
        `totalExpected=${totalExpected ?? 'N/A'} hasMore=${hasMore}`
      );

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
    if (params.tipo === 'advogado' && first.items.length === 0 && !options?.disableClientAdvogadoFallbacks) {
      const oab = String(params.oab || "").replace(/\D/g, "").trim();
      const ufRaw = params.uf ?? "";
      const uf = String(ufRaw).trim().toUpperCase();
      const ufUnica = uf && !uf.includes(",");
      const ufValida = ufUnica && uf !== "TODAS" && uf !== "UNDEFINED";
      const nome = nomeAdvogado;

      // Se não há UF específica, não existe fallback OAB/UF seguro.
      if (!ufValida) {
        return first;
      }

      // 2a) Fallback controlado: só se a rota oficial por nome voltou vazia,
      // tentar OAB/UF separadamente. Nunca misturar com nomeAdvogado na mesma URL.
      if (oab) {
        const qp2 = new URLSearchParams();
        qp2.set('numeroOab', oab);
        qp2.set('ufOab', uf);
        if (params.siglaTribunal) qp2.set('siglaTribunal', params.siglaTribunal);
        if (params.dataInicio) qp2.set('dataDisponibilizacaoInicio', params.dataInicio);
        if (params.dataFim) qp2.set('dataDisponibilizacaoFim', params.dataFim);
        qp2.set('pagina', String(page));
        qp2.set('tamanhoPagina', String(pageSize));
        qp2.set('page', String(page));
        qp2.set('size', String(pageSize));
        qp2.set('itensPorPagina', String(pageSize));
        console.log(`[PJE Comunica] Fallback advogado: rota OAB/UF separada numeroOab=${oab}, ufOab=${uf}`);
        const second = await doRequest(qp2);
        if (second.items.length > 0) return second;
      }

      // 2b) Último fallback OAB/UF + texto, separado da rota por nome.
      if (texto && (oab || ufValida)) {
        const qp3 = new URLSearchParams();
        if (oab) qp3.set('numeroOab', oab);
        if (ufValida) qp3.set('ufOab', uf);
        if (params.siglaTribunal) qp3.set('siglaTribunal', params.siglaTribunal);
        if (params.dataInicio) qp3.set('dataDisponibilizacaoInicio', params.dataInicio);
        if (params.dataFim) qp3.set('dataDisponibilizacaoFim', params.dataFim);
        qp3.set('pagina', String(page));
        qp3.set('tamanhoPagina', String(pageSize));
        qp3.set('page', String(page));
        qp3.set('size', String(pageSize));
        qp3.set('itensPorPagina', String(pageSize));
        qp3.set('texto', texto);
        const third = await doRequest(qp3);
        if (third.items.length > 0) return third;
      }

      // 2c) ÚLTIMO RECURSO: buscar só por `texto` com nome do advogado.
      //     Já estamos usando texto na primeira tentativa, mas se falhou,
      //     tentar sem filtros de OAB/nomeAdvogado extras.
      if (nome && !oab) {
        const qp4 = new URLSearchParams();
        if (params.siglaTribunal) qp4.set('siglaTribunal', params.siglaTribunal);
        if (params.dataInicio) qp4.set('dataDisponibilizacaoInicio', params.dataInicio);
        if (params.dataFim) qp4.set('dataDisponibilizacaoFim', params.dataFim);
        qp4.set('pagina', String(page));
        qp4.set('tamanhoPagina', String(pageSize));
        qp4.set('page', String(page));
        qp4.set('size', String(pageSize));
        qp4.set('itensPorPagina', String(pageSize));
        qp4.set('texto', normalizeAccents(nome));
        console.log(`[PJE Comunica] Fallback final: buscando por texto="${nome}" (UF=${uf})`);
        return await doRequest(qp4);
      }
    }

    // Para tipo 'parte': não alterar o termo (sem sufixos/fallbacks), pois isso pode gerar capturas indevidas.

    return first;
  } catch (e: any) {
    lastErr = e;
    // Quando o motor força uma VPS específica, não cair para Edge Function nem
    // qualquer caminho direto. A falha deve voltar para o worker daquela VPS.
    if (options?.forceVia && options?.fallbackToDirect !== true) {
      throw e;
    }
    // Detectar erro de CORS/bloqueio de rede
    if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
      corsBlocked = true;
    }
  }

// ESTRATÉGIA HÍBRIDA: Se CORS bloqueou, usar Edge Function como proxy
  // Com a estratégia v6 (grupos OR), temos ~200-400 requisições ao invés de 13.000+
  // Isso torna o risco de WORKER_LIMIT (546) baixo e aceitável
  if (corsBlocked && !options?.disableEdgeFallback) {
    // REGRA ESTRITA: termos do tipo 'parte' NUNCA podem cair em fallback
    // por Edge Function — esse caminho historicamente traduzia a busca em
    // palavra-chave/texto, gerando capturas erradas, lentidão e 429.
    // Falha em CORS deve voltar como erro para o engine tratar/retentar.
    if (params.tipo === 'parte') {
      console.warn('[PJE Comunica] CORS bloqueou busca por parte — fallback Edge Function DESABILITADO para tipo=parte.');
      throw lastErr || new Error('CORS bloqueado em busca por parte (sem fallback permitido)');
    }
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
          forcarNumeroOabTodas: params.forcarNumeroOabTodas,
          numeroProcesso: params.numeroProcesso,
          siglaTribunal: params.siglaTribunal,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
          // buscar-djen usa paginação 0-based; este client usa 1-based.
          page: Math.max((params.page ?? 1) - 1, 0),
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
    maxPages?: number | null;
    delayMs?: number;
    maxRetries?: number;
    retryBaseDelay?: number;
    continueUntilEmpty?: boolean;
    onRateLimit?: (waitMs: number, attempt: number, page: number) => void;
    onPoolVia?: (via: PoolViaInfo) => void;
    forceVia?: string;
    fallbackToDirect?: boolean;
    fallbackToPool?: boolean;
    disableEdgeFallback?: boolean;
    serverParity404AsError?: boolean;
    disableClientAdvogadoFallbacks?: boolean;
    throwOnConsecutiveFailedPages?: boolean;
  }
): Promise<PjeComunicaPaginatedResponse> {
  const maxPages = options?.maxPages;
  const continueUntilEmpty = options?.continueUntilEmpty ?? false;
  // Delay entre páginas: 800ms (valor original que funcionava na semana passada)
  const delayMs = Math.max(options?.delayMs ?? 800, 0);
  // Retry com backoff exponencial
  const maxRetries = options?.maxRetries ?? 5;
  const retryBaseDelay = options?.retryBaseDelay ?? 5000;  // 5s base para retry

  // API PJE Comunica usa paginação 1-based
  const startPage = Math.max(params.page ?? 1, 1);
  // PageSize 50: menos páginas = menos delays = ~2-3x mais rápido (restaurado do 26/01)
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 50);

  const all: any[] = [];
  const seen = new Set<string>();

  let last: PjeComunicaResponse | null = null;
  let pagesFetched = 0;
  let truncated = false;
  let rateLimitHits = 0;
  let failedPages = 0;
  let lastError: string | null = null;

  // Limiares de "parar só após N ocorrências consecutivas" para tolerar
  // instabilidade da API PJE Comunica (página vazia/duplicada/erro intermitente
  // no meio do stream). Qualquer página com item novo zera os contadores.
  const EMPTY_PAGE_STREAK_LIMIT = 2;
  const NO_NEW_ITEMS_STREAK_LIMIT = 3;
  const CONSECUTIVE_FAILED_PAGES_LIMIT = 3;
  let emptyStreak = 0;
  let noNewStreak = 0;
  let failedStreak = 0;

  // Helper para fetch com retry e backoff exponencial
  const fetchWithRetry = async (page: number): Promise<PjeComunicaResponse> => {
    let lastErr: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Verificação imediata de cancelamento antes de tentar fetch
      if (options?.signal?.aborted) {
        const err: any = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      try {
        const resp = await buscarPjeComunicaNoBrowser(
          { ...params, page, pageSize },
          {
            signal: options?.signal,
            onPoolVia: options?.onPoolVia,
            forceVia: options?.forceVia,
            fallbackToDirect: options?.fallbackToDirect,
            fallbackToPool: options?.fallbackToPool,
            disableEdgeFallback: options?.disableEdgeFallback,
            serverParity404AsError: options?.serverParity404AsError,
            disableClientAdvogadoFallbacks: options?.disableClientAdvogadoFallbacks,
          }
        );
        return resp;
      } catch (e: any) {
        lastErr = e;
        
        // Se foi cancelado, não tentar novamente
        if (e?.name === 'AbortError') throw e;
        const msg = String(e?.message ?? '');
        if (msg.includes('HTTP 404')) throw e;
        
        // Rate limited ou erro de rede - aguardar com backoff exponencial
        if (attempt < maxRetries - 1) {
          const is429 = msg.includes('HTTP 429') || msg.includes('Too Many');
          const isOverload = msg.includes('HTTP 500') || msg.includes('muito ocupado');
          const isGateway = msg.includes('HTTP 504') || msg.includes('HTTP 502') || msg.includes('HTTP 503');
          // 429 e 500 (overload) precisam de backoff maior. 502/503/504
          // (Cloudflare gateway timeout) usa delay curto: origem só lenta.
          const baseDelay = is429
            ? Math.max(retryBaseDelay, 8000)
            : isOverload
              ? Math.max(retryBaseDelay, 6000)
              : isGateway
                ? 3000
                : retryBaseDelay;
          let waitTime = isGateway
            ? jitterMs(baseDelay * (attempt + 1))
            : jitterMs(baseDelay * Math.pow(2, attempt));
          if (is429) {
            // Honrar Retry-After do servidor: se doRequest já leu o header e
            // setou o cooldown global, usar esse valor como PISO mínimo do retry.
            // Lê o cooldown da via que falhou (forceVia em modo paralela),
            // não o global — assim cada VPS conta o próprio backoff.
            const serverHint = getGlobalCooldownRemainingMs(options?.forceVia ?? null);
            if (serverHint > waitTime) {
              waitTime = serverHint;
            }
            rateLimitHits += 1;
            setGlobalCooldown(waitTime, options?.forceVia ?? null);
            options?.onRateLimit?.(waitTime, attempt + 1, page);
          }
          console.log(
            `[PJE Comunica] ${is429 ? 'Rate limit (429)' : isOverload ? 'Overload (500)' : isGateway ? 'Gateway timeout (504)' : 'Erro'} na página ${page}. ` +
              `Aguardando ${waitTime}ms antes de retry ${attempt + 1}/${maxRetries}`
          );
          // Sleep abortável: se o usuário cancelar, interrompe imediatamente
          await abortableSleep(waitTime, options?.signal);
        }
      }
    }
    
    throw lastErr || new Error(`Falha após ${maxRetries} tentativas`);
  };

  for (let p = startPage; ; p++) {
    if (typeof maxPages === 'number' && Number.isFinite(maxPages) && p >= startPage + maxPages) {
      truncated = true;
      break;
    }

    try {
      const resp = await fetchWithRetry(p);
      last = resp;
      pagesFetched += 1;
      let addedOnPage = 0;

      for (const item of resp.items) {
        const id = String(item?.id_djen ?? item?.id ?? "").trim();
        const key = id ? `id_djen:${id}` : JSON.stringify(item).slice(0, 400);
        if (!seen.has(key)) {
          seen.add(key);
          all.push(item);
          addedOnPage += 1;
        }
      }

      // continueUntilEmpty: a API PJE Comunica é conhecida por retornar páginas
      // CURTAS no meio do stream e/ou hasMore=false indevidamente em buscas
      // amplas (ex.: SANTANDER no TST, OSMAR/CARLOS JOSÉ no TRT10). Nesse modo
      // NÃO encerramos em página curta nem em hasMore=false. Para tolerar
      // páginas vazias/repetidas intermitentes, só paramos após N ocorrências
      // CONSECUTIVAS — qualquer página com item novo zera os contadores.
      if (continueUntilEmpty) {
        failedStreak = 0;
        if (resp.items.length === 0) {
          emptyStreak += 1;
          if (emptyStreak >= EMPTY_PAGE_STREAK_LIMIT) {
            console.log(`[PJE Comunica] ${emptyStreak} páginas vazias consecutivas (p=${p}); encerrando.`);
            break;
          }
        } else if (addedOnPage === 0) {
          emptyStreak = 0;
          noNewStreak += 1;
          if (noNewStreak >= NO_NEW_ITEMS_STREAK_LIMIT) {
            console.warn(`[PJE Comunica] ${noNewStreak} páginas consecutivas sem itens novos (p=${p}); encerrando.`);
            break;
          }
        } else {
          emptyStreak = 0;
          noNewStreak = 0;
        }
      } else {
        if (resp.items.length === 0) break;
        // Heurística: API confirma fim quando devolve menos itens que o pageSize.
        if (resp.items.length < pageSize) break;
        if (!resp.hasMore) break;
      }

      if (delayMs > 0) {
        await abortableSleep(delayMs, options?.signal);
      }
    } catch (e: any) {
      // Se foi cancelado, parar imediatamente
      if (e?.name === 'AbortError') throw e;
      // Para outros erros: contar a falha mas tentar próximas páginas. A API
      // PJE Comunica frequentemente erra páginas isoladas e volta a responder.
      // Só encerramos após CONSECUTIVE_FAILED_PAGES_LIMIT falhas seguidas.
      failedPages += 1;
      failedStreak += 1;
      lastError = String(e?.message ?? 'Falha ao buscar página');
      console.warn(`[PJE Comunica] Falha na página ${p} após retries (${failedStreak}/${CONSECUTIVE_FAILED_PAGES_LIMIT}):`, e?.message);
      if (continueUntilEmpty && /HTTP\s*404/.test(lastError) && failedStreak >= CONSECUTIVE_FAILED_PAGES_LIMIT) {
        break;
      }
      if (continueUntilEmpty && failedStreak < CONSECUTIVE_FAILED_PAGES_LIMIT) {
        if (delayMs > 0) {
          await abortableSleep(delayMs, options?.signal);
        }
        continue;
      }
      if (continueUntilEmpty && options?.throwOnConsecutiveFailedPages) {
        throw e;
      }
      truncated = true;
      break;
    }
  }

  if (last?.hasMore) truncated = true;
  const partial = truncated || failedPages > 0;

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
    rateLimitHits,
    failedPages,
    partial,
    lastError,
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

// CERTIDÃO removida — dados de advogados/partes vêm diretamente da API via optimizeItem
