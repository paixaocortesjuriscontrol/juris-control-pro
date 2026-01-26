import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, addDays } from "date-fns";

// Evita erro TS2589 (instantiation excessively deep) ao usar PostgrestFilterBuilder fortemente tipado.
// Mantemos a tipagem só no retorno público do hook.
const sb = supabase as any;

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
  coordenacaoId?: string; // "todas" | uuid
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string; // "todas" | "pendente" | "concluido" | "atrasado" ...
  prioridadeFilter?: string; // "todas" | "baixa" | "media" | "alta" | "urgente"
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

async function fetchMonitoramentoIdsForCoord(
  table: "monitoramentos_djen" | "monitoramentos_distribuicao",
  coordenacaoId?: string
) {
  if (!coordenacaoId) return [] as string[];
  const { data, error } = await sb
    .from(table)
    .select("id")
    .eq("coordenacao_id", coordenacaoId);
  if (error) throw error;
  return (data || []).map((r: any) => r.id as string);
}

async function countMovimentacoesByCoord(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  searchQuery?: string;
  onlyRedistribuicoes: boolean;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fimMaisUm = toFimMaisUmStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();

  // Com coordenação: precisa INNER para filtrar processos.coordenacao_id
  let base = sb
    .from("movimentacoes")
    .select("id, processos!inner(id, numero, coordenacao_id)", { count: "exact", head: true });

  base = params.onlyRedistribuicoes ? base.eq("tipo", "Redistribuição") : base.neq("tipo", "Redistribuição");

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
}

async function countAudienciasByCoord(params: {
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

  let base = sb
    .from("audiencias_detectadas")
    .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true });

  if (coordId) base = base.eq("processos.coordenacao_id", coordId);
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
}

async function countIntimacoesByCoord(params: {
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

  let base = sb
    .from("intimacoes_detectadas")
    .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true });

  if (coordId) base = base.eq("processos.coordenacao_id", coordId);
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

async function countAlertas360ByCoord(params: {
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

  // Mantém compatível com o comportamento atual: se não for "todas", considera pendente.
  const status = params.statusFilter && params.statusFilter !== "todas" ? mapStatusForTratado(params.statusFilter) : undefined;

  let base = sb
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
}

async function countDistribuicoesByCoord(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}) {
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const q = (params.searchQuery || "").trim();

  const status = params.statusFilter && params.statusFilter !== "todas" ? "pendente" : undefined;

  let monitoramentoIds: string[] | undefined;
  if (coordId) {
    monitoramentoIds = await fetchMonitoramentoIdsForCoord("monitoramentos_distribuicao", coordId);
    if (!monitoramentoIds.length) return 0;
  }

  let base = sb
    .from("distribuicoes_encontradas")
    .select("id", { count: "exact", head: true });

  if (monitoramentoIds) base = base.in("monitoramento_id", monitoramentoIds);
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
}

async function countDjenByCoord(params: {
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

  let monitoramentoIds: string[] | undefined;
  if (coordId) {
    monitoramentoIds = await fetchMonitoramentoIdsForCoord("monitoramentos_djen", coordId);
    if (!monitoramentoIds.length) return 0;
  }

  let base = sb
    .from("publicacoes_djen")
    .select("id", { count: "exact", head: true });

  if (monitoramentoIds) base = base.in("monitoramento_id", monitoramentoIds);
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
}

async function countTarefasByCoord(params: {
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

  const applyCommon = (query: any) => {
    if (coordId) query = query.eq("processos.coordenacao_id", coordId);
    if (status) query = query.eq("status", status);
    if (prioridade) query = query.eq("prioridade", prioridade);

    // Periodo em data_vencimento com NULL passando (mesmo comportamento do front)
    if (inicio && fim) {
      query = query.or(`data_vencimento.is.null,and(data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`);
    } else if (inicio) {
      query = query.or(`data_vencimento.is.null,data_vencimento.gte.${inicio}`);
    } else if (fim) {
      query = query.or(`data_vencimento.is.null,data_vencimento.lte.${fim}`);
    }
    return query;
  };

  if (!q) {
    let base = sb
      .from("tarefas")
      .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true });
    base = applyCommon(base);
    const { count, error } = await base;
    if (error) throw error;
    return Number(count || 0);
  }

  const like = `%${q}%`;

  // A) titulo
  let byTitle = sb
    .from("tarefas")
    .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
    .ilike("titulo", like);
  byTitle = applyCommon(byTitle);

  // B) processo.numero (inner)
  let byProc = sb
    .from("tarefas")
    .select("id, processos!inner(id, coordenacao_id, numero)", { count: "exact", head: true })
    .ilike("processos.numero", like);
  byProc = applyCommon(byProc);

  // AB) ambos (para não duplicar)
  let byBoth = sb
    .from("tarefas")
    .select("id, processos!inner(id, coordenacao_id, numero)", { count: "exact", head: true })
    .ilike("titulo", like)
    .ilike("processos.numero", like);
  byBoth = applyCommon(byBoth);

  const [a, b, ab] = await Promise.all([byTitle, byProc, byBoth]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  if (ab.error) throw ab.error;

  const total = Number(a.count || 0) + Number(b.count || 0) - Number(ab.count || 0);
  return Math.max(total, 0);
}

async function countPrazosByCoord(params: {
  coordenacaoId?: string;
  periodoInicio?: Date;
  periodoFim?: Date;
}) {
  // Prazos = tarefas pendentes com data_vencimento até hoje+3 (inclui vencidas)
  const coordId = normalizeCoordenacaoId(params.coordenacaoId);

  const hoje = startOfDay(new Date());
  const limite = addDays(hoje, 3);
  const hojeStr = format(hoje, "yyyy-MM-dd");
  const limiteStr = format(limite, "yyyy-MM-dd");

  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);

  let base = sb
    .from("tarefas")
    .select("id, processos!inner(id, coordenacao_id)", { count: "exact", head: true })
    .eq("status", "pendente")
    .not("data_vencimento", "is", null)
    .lte("data_vencimento", limiteStr);

  // Se usuário definiu período, respeitar também
  if (inicio) base = base.gte("data_vencimento", inicio);
  if (fim) base = base.lte("data_vencimento", fim);
  // Se não definiu período, ainda assim garante que pega vencidas/até 3 dias
  if (!inicio) base = base.gte("data_vencimento", "1900-01-01");
  // coord
  if (coordId) base = base.eq("processos.coordenacao_id", coordId);

  // Mantém coerência com "inclui vencidas": não precisamos filtrar >=hoje
  void hojeStr; // apenas para clareza

  const { count, error } = await base;
  if (error) throw error;
  return Number(count || 0);
}

async function fetchCounts(params: UseNotificacoesCountsParams): Promise<NotificacoesCounts> {
  const coordenacaoId = params.coordenacaoId;

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
    countDjenByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      searchQuery: params.searchQuery,
    }),
    countDistribuicoesByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      searchQuery: params.searchQuery,
    }),
    countAlertas360ByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      searchQuery: params.searchQuery,
    }),
    countMovimentacoesByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      searchQuery: params.searchQuery,
      onlyRedistribuicoes: true,
    }),
    countMovimentacoesByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      searchQuery: params.searchQuery,
      onlyRedistribuicoes: false,
    }),
    countTarefasByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      prioridadeFilter: params.prioridadeFilter,
      searchQuery: params.searchQuery,
    }),
    countAudienciasByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      searchQuery: params.searchQuery,
    }),
    countIntimacoesByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
      statusFilter: params.statusFilter,
      searchQuery: params.searchQuery,
    }),
    countPrazosByCoord({
      coordenacaoId,
      periodoInicio: params.periodoInicio,
      periodoFim: params.periodoFim,
    }),
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

export function useNotificacoesCounts(params: UseNotificacoesCountsParams) {
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const coord = params.coordenacaoId || "todas";
  const status = params.statusFilter || "pendente";
  const prioridade = params.prioridadeFilter || "todas";
  const q = (params.searchQuery || "").trim();

  return useQuery({
    queryKey: ["notificacoes-counts", coord, inicio ?? null, fim ?? null, status, prioridade, q],
    queryFn: () => fetchCounts(params),
  });
}

export function useNotificacoesCountsByCoordenacao(params: UseNotificacoesCountsByCoordenacaoParams) {
  const inicio = toDateStr(params.periodoInicio);
  const fim = toDateStr(params.periodoFim);
  const status = params.statusFilter || "pendente";
  const q = (params.searchQuery || "").trim();
  const idsKey = params.coordenacaoIds.slice().sort().join(",");

  return useQuery({
    queryKey: ["notificacoes-counts-by-coordenacao", idsKey, inicio ?? null, fim ?? null, status, q],
    enabled: params.coordenacaoIds.length > 0,
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
