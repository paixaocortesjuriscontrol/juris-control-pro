/**
 * Cliente HTTP para o portal público STF Digital.
 *
 * As chamadas vão pela Edge Function `stf-proxy` (server-side) para
 * resolver o bloqueio CORS do portal `digital.stf.jus.br`.
 */

import { supabase } from '@/integrations/supabase/client';

export interface StfPublicacao {
  id?: string | number;
  processo?: string;
  processoId?: string | number;
  tipo?: string;
  relator?: string;
  divulgacao?: string;
  publicacao?: string;
  texto?: string;
  [k: string]: any;
}

export interface BuscarStfParams {
  termo: string;
  /** YYYY-MM-DD */
  dataInicio: string;
  /** YYYY-MM-DD */
  dataFim: string;
  pagina?: number;
  quantidade?: number;
  /** Tipos de pesquisa STF: PUBLICACAO e/ou DIVULGACAO */
  tipoPesquisa?: ('PUBLICACAO' | 'DIVULGACAO')[];
  signal?: AbortSignal;
}

export interface StfBuscaResponse {
  publicacoes: StfPublicacao[];
  total: number;
  pagina: number;
  quantidade: number;
  hasMore: boolean;
  raw: any;
}

function ymdToEpochMs(ymd: string, endOfDay = false): number {
  // Interpreta a data como horário de Brasília (UTC-3) para alinhar com o portal STF.
  // 00:00 BRT = 03:00 UTC; 23:59:59.999 BRT = 02:59:59.999 UTC do dia seguinte.
  const [y, m, d] = ymd.split('-').map(Number);
  if (endOfDay) {
    return Date.UTC(y, (m - 1), d + 1, 2, 59, 59, 999);
  }
  return Date.UTC(y, (m - 1), d, 3, 0, 0, 0);
}

/** Última data de DJE disponível no portal STF (ms epoch). */
export async function getUltimoDjeStf(signal?: AbortSignal): Promise<number | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stf-proxy', {
      body: { action: 'ultimo-dje' },
    });
    if (error) return null;
    if (typeof data === 'number') return data;
    if (data && typeof data?.data === 'number') return data.data;
    if (data && typeof data?.ultimoDje === 'number') return data.ultimoDje;
    return null;
  } catch {
    return null;
  }
}

/** Busca uma página de publicações no portal STF Digital. */
export async function buscarPublicacoesStf(params: BuscarStfParams): Promise<StfBuscaResponse> {
  const {
    termo,
    dataInicio,
    dataFim,
    pagina = 1,
    quantidade = 50,
    tipoPesquisa = ['PUBLICACAO', 'DIVULGACAO'],
  } = params;

  const payload = {
    termo: String(termo || '').trim(),
    processo: '',
    pagina,
    quantidade,
    data: ymdToEpochMs(dataInicio, false),
    dataFim: ymdToEpochMs(dataFim, true),
    tipoPesquisa,
    filtros: { Tipo: [], Relator: [], 'Sessão': [], Colegiado: [] },
  };

  const { data, error } = await supabase.functions.invoke('stf-proxy', {
    body: { action: 'publicacoes', payload },
  });

  if (error) {
    throw new Error(`STF proxy erro (pág ${pagina}): ${error.message ?? String(error)}`);
  }

  const publicacoes: StfPublicacao[] =
    (Array.isArray(data?.publicacoes) && data.publicacoes) ||
    (Array.isArray(data?.content) && data.content) ||
    (Array.isArray(data) && data) ||
    [];

  const total = Number(data?.total ?? data?.totalElements ?? data?.totalItems ?? publicacoes.length) || publicacoes.length;
  const hasMore = pagina * quantidade < total;

  return {
    publicacoes,
    total,
    pagina,
    quantidade,
    hasMore,
    raw: data,
  };
}

/** Busca todas as páginas até esgotar — uso interno do engine. */
export async function buscarTodasPaginasStf(
  params: Omit<BuscarStfParams, 'pagina'>,
  opts: { delayMs?: number; maxPages?: number; onPage?: (p: number, totalPages: number, items: number) => void } = {},
): Promise<{ publicacoes: StfPublicacao[]; pagesFetched: number; total: number; truncated: boolean }> {
  const delayMs = opts.delayMs ?? 800;
  const maxPages = opts.maxPages ?? 30;

  const acc: StfPublicacao[] = [];
  let pagina = 1;
  let total = 0;
  let truncated = false;

  while (pagina <= maxPages) {
    const resp = await buscarPublicacoesStf({ ...params, pagina });
    total = resp.total;
    acc.push(...resp.publicacoes);
    const totalPages = Math.max(1, Math.ceil(total / (resp.quantidade || 1)));
    if (opts.onPage) opts.onPage(pagina, totalPages, resp.publicacoes.length);

    if (!resp.hasMore || resp.publicacoes.length === 0) break;
    if (pagina >= maxPages) { truncated = true; break; }
    pagina += 1;
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  return { publicacoes: acc, pagesFetched: pagina, total, truncated };
}