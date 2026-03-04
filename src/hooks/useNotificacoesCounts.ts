import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay } from "date-fns";

export interface NotificacoesCounts {
  djen: number;
  distribuicoes: number;
  alertas360: number;
  redistribuicoes: number;
  andamentos: number;
  prazos: number;
  tarefas: number;
  audiencias: number;
  intimacoes: number;
  proc_nao_cadastrados: number;
  total: number;
}

export interface UseNotificacoesCountsParams {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  prioridadeFilter?: string;
  searchQuery?: string;
}

export interface UseNotificacoesCountsByCoordenacaoParams {
  coordenacaoIds: string[];
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  prioridadeFilter?: string;
  searchQuery?: string;
}

const ZERO: NotificacoesCounts = {
  djen: 0,
  distribuicoes: 0,
  alertas360: 0,
  redistribuicoes: 0,
  andamentos: 0,
  prazos: 0,
  tarefas: 0,
  audiencias: 0,
  intimacoes: 0,
  proc_nao_cadastrados: 0,
  total: 0,
};

function toDateStr(d?: Date): string | null {
  return d ? format(startOfDay(d), "yyyy-MM-dd") : null;
}

// ========== RPC-BASED FETCH ==========

interface RpcRow {
  coordenacao_id: string;
  djen: number;
  distribuicoes: number;
  alertas360: number;
  redistribuicoes: number;
  andamentos: number;
  prazos: number;
  tarefas: number;
  audiencias: number;
  intimacoes: number;
  proc_nao_cadastrados: number;
  total: number;
}

async function fetchCountsViaRPC(
  coordenacaoIds: string[],
  periodoInicio?: Date,
  periodoFim?: Date,
  statusFilter?: string,
  prioridadeFilter?: string,
  searchQuery?: string
): Promise<Record<string, NotificacoesCounts>> {
  if (coordenacaoIds.length === 0) return {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_notificacoes_counts_by_coordenacao", {
    p_coordenacao_ids: coordenacaoIds,
    p_periodo_inicio: toDateStr(periodoInicio),
    p_periodo_fim: toDateStr(periodoFim),
    p_status_filter: statusFilter || null,
    p_prioridade_filter: prioridadeFilter || null,
    p_search_query: searchQuery || null,
  }) as { data: RpcRow[] | null; error: Error | null };

  if (error) {
    console.error("get_notificacoes_counts_by_coordenacao error:", error);
    // Return zeros for all requested coordinations
    const out: Record<string, NotificacoesCounts> = {};
    for (const id of coordenacaoIds) out[id] = { ...ZERO };
    return out;
  }

  const out: Record<string, NotificacoesCounts> = {};
  for (const row of data ?? []) {
    out[row.coordenacao_id] = {
      djen: row.djen ?? 0,
      distribuicoes: row.distribuicoes ?? 0,
      alertas360: row.alertas360 ?? 0,
      redistribuicoes: row.redistribuicoes ?? 0,
      andamentos: row.andamentos ?? 0,
      prazos: row.prazos ?? 0,
      tarefas: row.tarefas ?? 0,
      audiencias: row.audiencias ?? 0,
      intimacoes: row.intimacoes ?? 0,
      proc_nao_cadastrados: row.proc_nao_cadastrados ?? 0,
      total: row.total ?? 0,
    };
  }

  // Fill missing with zeros (in case RPC filtered out due to RBAC)
  for (const id of coordenacaoIds) {
    if (!out[id]) out[id] = { ...ZERO };
  }

  return out;
}

// ========== HOOKS ==========

/**
 * Fetch counts for a single coordination (or all if coordenacaoId === "todas").
 * When "todas", the caller should use useNotificacoesCountsByCoordenacao and sum.
 */
export function useNotificacoesCounts(params: UseNotificacoesCountsParams) {
  const coord = params.coordenacaoId || "todas";
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = params.statusFilter || "pendente";
  const prioridade = params.prioridadeFilter || "todas";
  const q = (params.searchQuery || "").trim();

  return useQuery({
    queryKey: ["notificacoes-counts", coord, inicio ?? "all", fim ?? "all", status, prioridade, q],
    enabled: coord !== "todas",
    queryFn: async () => {
      const map = await fetchCountsViaRPC(
        [coord],
        params.periodoInicio,
        params.periodoFim,
        params.statusFilter,
        params.prioridadeFilter,
        params.searchQuery
      );
      return map[coord] ?? ZERO;
    },
    staleTime: 30_000,
    placeholderData: ZERO,
  });
}

/**
 * Fetch counts for multiple coordinations in a SINGLE RPC call.
 */
export function useNotificacoesCountsByCoordenacao(params: UseNotificacoesCountsByCoordenacaoParams) {
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = params.statusFilter || "pendente";
  const prioridade = params.prioridadeFilter || "todas";
  const q = (params.searchQuery || "").trim();
  const idsKey = params.coordenacaoIds.slice().sort().join(",");

  return useQuery({
    queryKey: ["notificacoes-counts-by-coordenacao", idsKey, inicio ?? "all", fim ?? "all", status, prioridade, q],
    enabled: params.coordenacaoIds.length > 0,
    staleTime: 30_000,
    queryFn: () =>
      fetchCountsViaRPC(
        params.coordenacaoIds,
        params.periodoInicio,
        params.periodoFim,
        params.statusFilter,
        params.prioridadeFilter,
        params.searchQuery
      ),
    placeholderData: () => {
      const out: Record<string, NotificacoesCounts> = {};
      for (const id of params.coordenacaoIds) out[id] = { ...ZERO };
      return out;
    },
  });
}
