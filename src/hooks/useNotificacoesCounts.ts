import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, addDays } from "date-fns";

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
  total: 0,
};

function toDateStr(d?: Date) {
  return d ? format(startOfDay(d), "yyyy-MM-dd") : undefined;
}

function toFimMaisUmStr(d?: Date) {
  if (!d) return undefined;
  return format(addDays(startOfDay(d), 1), "yyyy-MM-dd");
}

function normalizeCoordenacaoId(coordenacaoId?: string) {
  if (!coordenacaoId || coordenacaoId === "todas") return undefined;
  return coordenacaoId;
}

function mapStatusForTarefas(statusFilter?: string) {
  if (!statusFilter || statusFilter === "todas") return undefined;
  return statusFilter === "concluido" ? "cumprido" : statusFilter;
}

function mapStatusForTratado(statusFilter?: string) {
  if (!statusFilter || statusFilter === "todas") return undefined;
  return statusFilter === "concluido" ? "tratado" : statusFilter;
}

// ========== COUNT FUNCTIONS ==========

async function countDjen(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fimMaisUm = toFimMaisUmStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();
  const onlyNaoLidas = params.statusFilter && params.statusFilter !== "todas";

  try {
    // monitoramentos_djen TEM coordenacao_id
    let base = supabase
      .from("publicacoes_djen")
      .select("id, monitoramentos_djen!inner(id, coordenacao_id)", { count: "exact", head: true });

    if (coordId) base = base.eq("monitoramentos_djen.coordenacao_id", coordId);
    if (onlyNaoLidas) base = base.eq("lida", false);
    if (inicio) base = base.gte("created_at", inicio);
    if (fimMaisUm) base = base.lt("created_at", fimMaisUm);

    if (q) {
      const like = `%${q}%`;
      base = base.or(`conteudo.ilike.${like},processo_numero.ilike.${like}`);
    }

    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  } catch (e) {
    console.error("countDjen error:", e);
    return 0;
  }
}

async function countDistribuicoes(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  // monitoramentos_distribuicao NÃO tem coordenacao_id - retornamos total global
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();
  const status = params.statusFilter && params.statusFilter !== "todas" ? "pendente" : undefined;

  // Se coordenação foi selecionada, não temos como filtrar por coordenação
  if (coordId) return 0;

  try {
    let base = supabase
      .from("distribuicoes_encontradas")
      .select("id", { count: "exact", head: true });

    if (status) base = base.eq("status", status);
    if (inicio) base = base.gte("data_distribuicao", inicio);
    if (fim) base = base.lte("data_distribuicao", fim);

    if (q) {
      const like = `%${q}%`;
      base = base.or(`numero_processo.ilike.${like},polo_ativo.ilike.${like},polo_passivo.ilike.${like}`);
    }

    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  } catch (e) {
    console.error("countDistribuicoes error:", e);
    return 0;
  }
}

async function countAlertas360(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fimMaisUm = toFimMaisUmStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();
  const status = mapStatusForTratado(params.statusFilter);

  try {
    let base = supabase
      .from("alertas_monitoramento")
      .select("id, processos!inner(id, coordenacao_id, numero)", { count: "exact", head: true });

    if (coordId) base = base.eq("processos.coordenacao_id", coordId);
    if (status) base = base.eq("status", status);
    if (inicio) base = base.gte("created_at", inicio);
    if (fimMaisUm) base = base.lt("created_at", fimMaisUm);

    if (q) {
      const like = `%${q}%`;
      base = base.or(`termo_encontrado.ilike.${like},processos.numero.ilike.${like}`);
    }

    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  } catch (e) {
    console.error("countAlertas360 error:", e);
    return 0;
  }
}

async function countRedistribuicoes(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fimMaisUm = toFimMaisUmStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();

  try {
    let base = supabase
      .from("movimentacoes")
      .select("id, processos!inner(id, numero, coordenacao_id)", { count: "exact", head: true })
      .eq("tipo", "Redistribuição");

    if (coordId) base = base.eq("processos.coordenacao_id", coordId);
    if (inicio) base = base.gte("created_at", inicio);
    if (fimMaisUm) base = base.lt("created_at", fimMaisUm);

    if (q) {
      const like = `%${q}%`;
      base = base.or(`descricao.ilike.${like},tipo.ilike.${like},processos.numero.ilike.${like}`);
    }

    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  } catch (e) {
    console.error("countRedistribuicoes error:", e);
    return 0;
  }
}

async function countAndamentos(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fimMaisUm = toFimMaisUmStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();

  try {
    let base = supabase
      .from("movimentacoes")
      .select("id, processos!inner(id, numero, coordenacao_id)", { count: "exact", head: true })
      .neq("tipo", "Redistribuição");

    if (coordId) base = base.eq("processos.coordenacao_id", coordId);
    if (inicio) base = base.gte("created_at", inicio);
    if (fimMaisUm) base = base.lt("created_at", fimMaisUm);

    if (q) {
      const like = `%${q}%`;
      base = base.or(`descricao.ilike.${like},tipo.ilike.${like},processos.numero.ilike.${like}`);
    }

    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  } catch (e) {
    console.error("countAndamentos error:", e);
    return 0;
  }
}

async function countTarefas(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  prioridadeFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const status = mapStatusForTarefas(params.statusFilter);
  const prioridade = params.prioridadeFilter && params.prioridadeFilter !== "todas" ? params.prioridadeFilter : undefined;
  const q = (params.searchQuery || "").trim();
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);

  try {
    // Se coordenação específica: usar INNER join para filtrar
    // Se "todas": contar tudo (incluindo sem processo)
    if (coordId) {
      let base = supabase
        .from("tarefas")
        .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
        .eq("processos.coordenacao_id", coordId);

      if (status) base = base.eq("status", status as "pendente" | "cumprido" | "atrasado");
      if (prioridade) base = base.eq("prioridade", prioridade as "baixa" | "media" | "alta" | "urgente");

      // Período em data_vencimento (NULL passa)
      if (inicio && fim) {
        base = base.or(`data_vencimento.is.null,and(data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`);
      } else if (inicio) {
        base = base.or(`data_vencimento.is.null,data_vencimento.gte.${inicio}`);
      } else if (fim) {
        base = base.or(`data_vencimento.is.null,data_vencimento.lte.${fim}`);
      }

      if (q) {
        const like = `%${q}%`;
        base = base.or(`titulo.ilike.${like}`);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    } else {
      // Sem coordenação: contar TODAS as tarefas (inclui sem processo)
      let base = supabase
        .from("tarefas")
        .select("id", { count: "exact", head: true });

      if (status) base = base.eq("status", status as "pendente" | "cumprido" | "atrasado");
      if (prioridade) base = base.eq("prioridade", prioridade as "baixa" | "media" | "alta" | "urgente");

      if (inicio && fim) {
        base = base.or(`data_vencimento.is.null,and(data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`);
      } else if (inicio) {
        base = base.or(`data_vencimento.is.null,data_vencimento.gte.${inicio}`);
      } else if (fim) {
        base = base.or(`data_vencimento.is.null,data_vencimento.lte.${fim}`);
      }

      if (q) {
        const like = `%${q}%`;
        base = base.ilike("titulo", like);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    }
  } catch (e) {
    console.error("countTarefas error:", e);
    return 0;
  }
}

async function countPrazos(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);

  const hoje = startOfDay(new Date());
  const limite = addDays(hoje, 3);
  const limiteStr = format(limite, "yyyy-MM-dd");

  try {
    if (coordId) {
      let base = supabase
        .from("tarefas")
        .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
        .eq("status", "pendente")
        .not("data_vencimento", "is", null)
        .lte("data_vencimento", limiteStr)
        .eq("processos.coordenacao_id", coordId);

      if (inicio) base = base.gte("data_vencimento", inicio);
      if (fim) base = base.lte("data_vencimento", fim);

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    } else {
      // Todas: inclui tarefas sem processo
      let base = supabase
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .not("data_vencimento", "is", null)
        .lte("data_vencimento", limiteStr);

      if (inicio) base = base.gte("data_vencimento", inicio);
      if (fim) base = base.lte("data_vencimento", fim);

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    }
  } catch (e) {
    console.error("countPrazos error:", e);
    return 0;
  }
}

async function countAudiencias(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = mapStatusForTratado(params.statusFilter);
  const q = (params.searchQuery || "").trim();

  try {
    if (coordId) {
      // Com coordenação: usar INNER join
      let base = supabase
        .from("audiencias_detectadas")
        .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
        .eq("processos.coordenacao_id", coordId);

      if (status) base = base.eq("status", status);
      if (inicio) base = base.gte("data_audiencia", inicio);
      if (fim) base = base.lte("data_audiencia", fim);

      if (q) {
        const like = `%${q}%`;
        base = base.or(`processo_numero.ilike.${like}`);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    } else {
      // Todas: contar tudo (inclui sem processo_id)
      let base = supabase
        .from("audiencias_detectadas")
        .select("id", { count: "exact", head: true });

      if (status) base = base.eq("status", status);
      if (inicio) base = base.gte("data_audiencia", inicio);
      if (fim) base = base.lte("data_audiencia", fim);

      if (q) {
        const like = `%${q}%`;
        base = base.ilike("processo_numero", like);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    }
  } catch (e) {
    console.error("countAudiencias error:", e);
    return 0;
  }
}

async function countIntimacoes(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = mapStatusForTratado(params.statusFilter);
  const q = (params.searchQuery || "").trim();

  try {
    if (coordId) {
      let base = supabase
        .from("intimacoes_detectadas")
        .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
        .eq("processos.coordenacao_id", coordId);

      if (status) base = base.eq("status", status);
      if (inicio) base = base.gte("data_intimacao", inicio);
      if (fim) base = base.lte("data_intimacao", fim);

      if (q) {
        const like = `%${q}%`;
        base = base.or(`processo_numero.ilike.${like},tipo_intimacao.ilike.${like}`);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    } else {
      let base = supabase
        .from("intimacoes_detectadas")
        .select("id", { count: "exact", head: true });

      if (status) base = base.eq("status", status);
      if (inicio) base = base.gte("data_intimacao", inicio);
      if (fim) base = base.lte("data_intimacao", fim);

      if (q) {
        const like = `%${q}%`;
        base = base.or(`processo_numero.ilike.${like},tipo_intimacao.ilike.${like}`);
      }

      const { count, error } = await base;
      if (error) throw error;
      return Number(count || 0);
    }
  } catch (e) {
    console.error("countIntimacoes error:", e);
    return 0;
  }
}

// ========== FETCH COUNTS ==========

async function fetchCounts(params: UseNotificacoesCountsParams): Promise<NotificacoesCounts> {
  const [
    djen,
    distribuicoes,
    alertas360,
    redistribuicoes,
    andamentos,
    tarefas,
    audiencias,
    intimacoes,
    prazos,
  ] = await Promise.all([
    countDjen(params),
    countDistribuicoes(params),
    countAlertas360(params),
    countRedistribuicoes(params),
    countAndamentos(params),
    countTarefas(params),
    countAudiencias(params),
    countIntimacoes(params),
    countPrazos(params),
  ]);

  const total =
    djen +
    distribuicoes +
    alertas360 +
    redistribuicoes +
    andamentos +
    prazos +
    tarefas +
    audiencias +
    intimacoes;

  return {
    djen,
    distribuicoes,
    alertas360,
    redistribuicoes,
    andamentos,
    prazos,
    tarefas,
    audiencias,
    intimacoes,
    total,
  };
}

// ========== HOOKS ==========

export function useNotificacoesCounts(params: UseNotificacoesCountsParams) {
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const coord = params.coordenacaoId || "todas";
  const status = params.statusFilter || "pendente";
  const prioridade = params.prioridadeFilter || "todas";
  const q = (params.searchQuery || "").trim();

  return useQuery({
    queryKey: ["notificacoes-counts", coord, inicio ?? "all", fim ?? "all", status, prioridade, q],
    queryFn: () => fetchCounts(params),
    staleTime: 30_000,
    placeholderData: ZERO,
  });
}

export function useNotificacoesCountsByCoordenacao(params: UseNotificacoesCountsByCoordenacaoParams) {
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = params.statusFilter || "pendente";
  const q = (params.searchQuery || "").trim();
  const idsKey = params.coordenacaoIds.slice().sort().join(",");

  return useQuery({
    queryKey: ["notificacoes-counts-by-coordenacao", idsKey, inicio ?? "all", fim ?? "all", status, q],
    enabled: params.coordenacaoIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const out: Record<string, NotificacoesCounts> = {};
      await Promise.all(
        params.coordenacaoIds.map(async (coordenacaoId) => {
          out[coordenacaoId] = await fetchCounts({
            coordenacaoId,
            periodoInicio: params.periodoInicio,
            periodoFim: params.periodoFim,
            statusFilter: params.statusFilter,
            searchQuery: params.searchQuery,
          });
        })
      );
      return out;
    },
    placeholderData: () => {
      const out: Record<string, NotificacoesCounts> = {};
      for (const id of params.coordenacaoIds) out[id] = ZERO;
      return out;
    },
  });
}
