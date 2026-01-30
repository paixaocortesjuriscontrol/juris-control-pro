// Busca de comunicações no PJE Comunica direto do navegador.
// Objetivo: reduzir dependência de Edge Functions (evita 546 WORKER_LIMIT).

export type PjeSearchType = "advogado" | "palavra-chave" | "processo";

export interface PjeComunicaSearchParams {
  tipo: PjeSearchType;
  oab?: string;
  uf?: string;
  palavraChave?: string;
  numeroProcesso?: string;
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

// Para não estourar memória no frontend (e evitar travar a UI), truncamos conteúdo.
const MAX_TEXT_LENGTH = 4000;
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
  const oab = (params.oab || "").trim();
  const uf = (params.uf || "").trim();
  return uf ? `OAB ${oab} ${uf}` : `OAB ${oab}`;
}

export async function buscarPjeComunicaNoBrowser(
  params: PjeComunicaSearchParams,
  options?: { signal?: AbortSignal }
): Promise<PjeComunicaResponse> {
  const texto = buildTextoParam(params);
  if (!texto) throw new Error("Parâmetro de busca inválido");

  const page = Math.max(params.page ?? 0, 0);
  const pageSize = Math.min(Math.max(params.pageSize ?? 100, 1), 100);

  const qp = new URLSearchParams();
  qp.set("texto", texto);
  if (params.dataInicio) qp.set("dataDisponibilizacaoInicio", params.dataInicio);
  if (params.dataFim) qp.set("dataDisponibilizacaoFim", params.dataFim);

  // API usa tanto pagina/tamanhoPagina quanto page/size; mandamos ambos.
  qp.set("pagina", String(page));
  qp.set("tamanhoPagina", String(pageSize));
  qp.set("page", String(page));
  qp.set("size", String(pageSize));

  let lastErr: any = null;

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
        count: totalElements,
        totalElements,
        page,
        pageSize,
        hasMore,
      };
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Falha ao buscar no PJE Comunica");
}
