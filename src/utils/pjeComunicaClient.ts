// Busca de comunicações no PJE Comunica.
// Estratégia: browser-first com fallback para Edge Function (proxy) quando CORS bloquear.

import { supabase } from "@/integrations/supabase/client";

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

// Fallback via Edge Function quando browser falhar (CORS blocked)
async function buscarViaEdgeFunction(
  params: PjeComunicaSearchParams,
  options?: { signal?: AbortSignal }
): Promise<PjeComunicaResponse> {
  const page = Math.max(params.page ?? 0, 0);
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

  const { data, error } = await supabase.functions.invoke('buscar-djen', {
    body: {
      tipo: params.tipo,
      oab: params.oab,
      uf: params.uf,
      palavraChave: params.palavraChave,
      numeroProcesso: params.numeroProcesso,
      siglaTribunal: params.siglaTribunal,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      page,
      pageSize,
    },
  });

  if (error) {
    throw new Error(`Edge Function error: ${error.message}`);
  }

  const items = data?.items ?? [];
  const totalElements = data?.totalElements ?? data?.count ?? items.length;
  const hasMore = data?.hasMore ?? false;

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
}

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

  // 1) Query principal por texto (compatível com endpoints antigos)
  qp.set("texto", texto);

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

  for (const endpoint of ENDPOINTS) {
    try {
      const url = `${endpoint}?${qp.toString()}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
        signal: options?.signal,
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
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
        // count aqui representa o total esperado (não somente o que retornou nesta página)
        // para manter compatibilidade com o uso atual.
        count: totalElements,
        totalElements,
        page,
        pageSize,
        hasMore,
      };
    } catch (e: any) {
      lastErr = e;
      // Detectar erro de CORS/bloqueio de rede
      if (e?.message?.includes('Failed to fetch') || e?.name === 'TypeError') {
        corsBlocked = true;
      }
    }
  }

  // FALLBACK: Se CORS bloqueou, usar Edge Function como proxy
  if (corsBlocked) {
    console.log('[PJE Comunica] CORS blocked, falling back to Edge Function proxy...');
    try {
      return await buscarViaEdgeFunction(params, options);
    } catch (proxyErr: any) {
      console.warn('[PJE Comunica] Edge Function fallback failed:', proxyErr?.message);
      throw proxyErr;
    }
  }

  throw lastErr || new Error("Falha ao buscar no PJE Comunica");
}

// Versão paginada (essencial para o monitoramento), com limite de páginas por segurança.
export async function buscarPjeComunicaPaginado(
  params: PjeComunicaSearchParams,
  options?: {
    signal?: AbortSignal;
    maxPages?: number;
    delayMs?: number;
  }
): Promise<PjeComunicaPaginatedResponse> {
  const maxPages = Math.max(options?.maxPages ?? 10, 1);
  const delayMs = Math.max(options?.delayMs ?? 150, 0);

  const startPage = Math.max(params.page ?? 0, 0);
  // Keep payload small (consistent with buscar-djen hard cap)
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

  const all: any[] = [];
  const seen = new Set<string>();

  let last: PjeComunicaResponse | null = null;
  let pagesFetched = 0;
  let truncated = false;

  for (let p = startPage; p < startPage + maxPages; p++) {
    const resp = await buscarPjeComunicaNoBrowser(
      { ...params, page: p, pageSize },
      { signal: options?.signal }
    );
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
