import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { dedupePublicacoesDjen } from "@/utils/djenDedup";
import { conteudoContemFraseExata } from "@/utils/djenTermoMatch";
import { addDays } from "date-fns";

/** Parse seguro de advogados_json/partes_json: evita throw e preserva objetos da Kurier. */
function parseJsonArraySafe(value: unknown): any[] | null {
  if (value == null) return null;
  let arr: any[];
  if (Array.isArray(value)) {
    arr = value.filter((x) => x != null && (typeof x !== "string" || x.trim()));
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      arr = parsed.filter((x: unknown) => x != null && (typeof x !== "string" || x.trim()));
    } catch {
      return null;
    }
  } else {
    return null;
  }
  return arr.length ? arr : null;
}

// Helper para converter data local (YYYY-MM-DD) para range UTC considerando BRT (UTC-3)
// Se usuário seleciona 30/01, deve buscar:
// - Início: 30/01 00:00 BRT = 30/01 03:00 UTC
// - Fim: 30/01 23:59:59 BRT = 31/01 02:59:59 UTC
const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  // Parse a data como componentes locais para evitar interpretação UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  
  if (isEnd) {
    // Fim do dia em BRT (23:59:59) = próximo dia às 02:59:59 UTC
    // Usar Date para calcular corretamente a virada de mês/ano
    const nextDay = addDays(new Date(year, month - 1, day), 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T02:59:59.999Z`;
  } else {
    // Início do dia em BRT (00:00) = mesmo dia às 03:00 UTC
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00Z`;
  }
};

const getHojeBrtISO = (): string => {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const aplicarFiltroDataCapturaBrt = <T extends any>(query: T, inicioUtc: string | null, fimUtc: string | null): T => {
  let q: any = query;
  if (inicioUtc) q = q.gte('created_at', inicioUtc);
  if (fimUtc) q = q.lte('created_at', fimUtc);
  return q as T;
};

function normalizarTermo(valor: string | null | undefined): string {
  return String(valor || "").trim();
}

function formatarCnjPorDigitos(digits: string): string | null {
  if (digits.length !== 20) return null;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

function parseTermosOr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizarTermo(String(v))).filter(Boolean);
}

function identificarTermoCorrespondente(
  conteudo: string | null,
  termoPrincipal: string | null,
  termosOr: string[]
): string | null {
  if (!conteudo) return null;

  const candidatos = [...termosOr, termoPrincipal]
    .map((t) => normalizarTermo(t))
    .filter(Boolean);

  for (const candidato of candidatos) {
    if (conteudoContemFraseExata(conteudo, candidato)) {
      return candidato;
    }
  }

  return null;
}

async function enriquecerPublicacoesComMonitoramento(
  publicacoes: PublicacaoUnificada[]
): Promise<PublicacaoUnificada[]> {
  const monitoramentoIds = [...new Set(
    publicacoes
      .filter((p) => (p.tipo_origem === 'termo' || p.tipo_origem === 'descartada') && !!p.monitoramento_id)
      .map((p) => p.monitoramento_id as string)
  )];

  if (monitoramentoIds.length === 0) return publicacoes;

  const { data: monitoramentos, error } = await supabase
    .from('monitoramentos_djen')
    .select('id, termo_busca, descricao, termos_or')
    .in('id', monitoramentoIds);

  if (error || !monitoramentos) {
    console.warn('[DJEN] Falha ao enriquecer monitoramentos para exibição:', error);
    return publicacoes;
  }

  const monitoramentoMap = new Map<string, {
    termo_busca: string | null;
    descricao: string | null;
    termos_or: string[];
  }>();

  monitoramentos.forEach((m: any) => {
    monitoramentoMap.set(m.id, {
      termo_busca: normalizarTermo(m.termo_busca) || null,
      descricao: normalizarTermo(m.descricao) || null,
      termos_or: parseTermosOr(m.termos_or),
    });
  });

  return publicacoes.map((pub) => {
    if (!pub.monitoramento_id || (pub.tipo_origem !== 'termo' && pub.tipo_origem !== 'descartada')) {
      return pub;
    }

    const monitoramento = monitoramentoMap.get(pub.monitoramento_id);
    const termoPrincipal = pub.monitoramento_termo || monitoramento?.termo_busca || null;
    const descricao = pub.monitoramento_descricao || monitoramento?.descricao || null;
    const termosOr = monitoramento?.termos_or || [];
    const termoMatch = identificarTermoCorrespondente(pub.conteudo, termoPrincipal, termosOr);

    return {
      ...pub,
      monitoramento_termo: termoMatch || termoPrincipal,
      monitoramento_descricao: descricao,
    };
  });
}

type MonitoramentoDjenInfo = {
  id: string;
  tipo: string | null;
  termo_busca: string | null;
  descricao: string | null;
  oab: string | null;
  uf: string | null;
  coordenacao_id: string | null;
  coordenacao?: { id: string; nome: string } | null;
};

async function carregarMonitoramentosDjen(
  monitoramentoIds: Array<string | null | undefined>,
  signal?: AbortSignal
): Promise<Map<string, MonitoramentoDjenInfo>> {
  const ids = [...new Set(monitoramentoIds.filter(Boolean) as string[])];
  if (ids.length === 0) return new Map();

  let query = (supabase.from('monitoramentos_djen') as any)
    .select('id, tipo, termo_busca, descricao, oab, uf, coordenacao_id, coordenacao:coordenacoes(id, nome)')
    .in('id', ids);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) {
    console.warn('[DJEN Servidor] Falha ao carregar monitoramentos:', error);
    return new Map();
  }

  return new Map((data || []).map((m: MonitoramentoDjenInfo) => [m.id, m]));
}

export interface LeituraUsuario {
  nome: string;
  lida_em: string;
}

export interface PublicacaoUnificada {
  id: string;
  id_djen?: string | null;
  tipo_origem: 'termo' | 'processo' | 'descartada' | 'datajud';
  processo_id: string | null;
  processo_numero: string | null;
  conteudo: string | null;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  fonte: string | null;
  lida: boolean;
  created_at: string;
  // Dados do monitoramento (para tipo termo)
  monitoramento_id: string | null;
  monitoramento_termo: string | null;
  monitoramento_descricao: string | null;
  
  monitoramento_tipo: string | null;
  monitoramento_oab: string | null;
  monitoramento_uf: string | null;
  // Dados da coordenação
  coordenacao_id: string | null;
  coordenacao_nome: string | null;
  // Dados do processo (para tipo processo)
  polo_ativo: string | null;
  polo_passivo: string | null;
  tribunal: string | null;
  // Campos estruturados da API
  orgao?: string | null;
  tipo_comunicacao?: string | null;
  meio?: string | null;
  advogados_json?: any[] | null;
  partes_json?: any[] | null;
  // Dados de descarte (para tipo descartada)
  motivo_descarte?: string | null;
  descartado_por?: string | null;
  descartado_por_nome?: string | null;
  // Per-user read tracking
  lido_por?: LeituraUsuario[];
}

export type FiltroLeituraDjen = 'lidas' | 'nao_lidas' | 'todas';

export interface FiltrosUnificados {
  coordenacaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  dataDisponibilizacao?: string;
  termoBusca?: string;
  monitoramentoId?: string;
  apenasNaoLidas?: boolean;
  readStatus?: FiltroLeituraDjen;
  apenasHoje?: boolean;
  // `tipoOrigem` é o filtro do UI "Tipo de Origem":
  // - termo: publicações vindas de monitoramentos (palavra-chave / advogado / parte)
  // - parte: subconjunto de "termo" onde monitoramento_tipo === 'parte'
  // - processo: publicações vindas de processos cadastrados
  // - descartada: auditoria
  // - todos: (legado) mantido por compatibilidade
  tipoOrigem?: 'termo' | 'parte' | 'processo' | 'descartada' | 'djet-pautas' | 'kurier' | 'todos';
  incluirDescartadas?: boolean;
  /** Página atual (1-based). Default: 1. */
  page?: number;
  /** Tamanho de página. Default: 500. */
  pageSize?: number;
  /** Desliga a busca DJEN quando a tela está exibindo outra fonte (ex.: DataJud). */
  desabilitarLista?: boolean;
  /** Desliga contadores exatos pesados quando a prioridade é listar rápido. */
  desabilitarStats?: boolean;
  /** Filtro por tribunal (sigla, ex.: 'TRT2', 'TST'). Aplicado no servidor. */
  tribunal?: string;
  /**
   * Quando true, a deduplicação usa somente coordenacao_id + id_djen.
   * Conteúdo/processo/data não são critério de deduplicação DJEN.
   */
  dedupServidor?: boolean;
}

export interface EstatisticasCoordenacao {
  coordenacao_id: string;
  coordenacao_nome: string;
  total: number;
  nao_lidas: number;
  por_tipo: {
    termo: number;
    processo: number;
    descartada: number;
  };
}

/** Merges per-user read status from publicacoes_djen_leituras into publication results */
async function mergeWithLeituras(
  userId: string,
  results: PublicacaoUnificada[],
  readStatus: FiltroLeituraDjen = 'todas'
): Promise<PublicacaoUnificada[]> {
  if (results.length === 0) return results;

  const pubIds = results.map(p => p.id);

  // Use RPC to avoid URL length limits with large arrays
  const { data: leituras } = await (supabase as any).rpc('get_leituras_publicacoes', { p_ids: pubIds });

  const userReadSet = new Set<string>();
  // Dedup por usuário — UNIQUE é (publicacao_id, tabela_origem, usuario_id),
  // então o mesmo usuário pode aparecer até 3× por publicação.
  const lidoPorMap = new Map<string, Map<string, LeituraUsuario>>();

  (leituras || []).forEach((l: any) => {
    if (l.usuario_id === userId) userReadSet.add(l.publicacao_id);
    if (!lidoPorMap.has(l.publicacao_id)) lidoPorMap.set(l.publicacao_id, new Map());
    const bucket = lidoPorMap.get(l.publicacao_id)!;
    const chave = String(l.usuario_id ?? l.usuario_nome ?? '');
    const existente = bucket.get(chave);
    const nova: LeituraUsuario = { nome: l.usuario_nome || 'Desconhecido', lida_em: l.lida_em };
    if (!existente || String(existente.lida_em) < String(nova.lida_em)) bucket.set(chave, nova);
  });

  let merged = results.map(pub => ({
    ...pub,
    lida: userReadSet.has(pub.id),
    lido_por: Array.from(lidoPorMap.get(pub.id)?.values() ?? []),
  }));

  if (readStatus === 'nao_lidas') {
    merged = merged.filter(pub => !pub.lida);
  } else if (readStatus === 'lidas') {
    merged = merged.filter(pub => pub.lida);
  }

  return merged;
}

export function usePublicacoesDjenServidorUnificadas(filtros: FiltrosUnificados = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const readStatus: FiltroLeituraDjen = filtros.readStatus ?? (filtros.apenasNaoLidas ? 'nao_lidas' : 'todas');

  // Query separada para contar descartadas NO MESMO CONTEXTO DE FILTROS (evita mostrar número incoerente)
  const { data: totalDescartadasHoje = 0 } = useQuery({
    queryKey: [
      'descartadas-count',
      user?.id,
      {
        coordenacaoId: filtros.coordenacaoId ?? null,
        monitoramentoId: filtros.monitoramentoId ?? null,
        apenasHoje: filtros.apenasHoje ?? null,
        dataInicio: filtros.dataInicio ?? null,
        dataFim: filtros.dataFim ?? null,
        dataDisponibilizacao: filtros.dataDisponibilizacao ?? null,
        readStatus,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!user?.id) return 0;

      const hojeBrt = getHojeBrtISO();
      const dataInicioFiltro = filtros.apenasHoje
        ? dateLocalToUTCRange(hojeBrt, false)
        : filtros.dataInicio
          ? dateLocalToUTCRange(filtros.dataInicio, false)
          : null;

      const dataFimFiltro = filtros.apenasHoje
        ? dateLocalToUTCRange(hojeBrt, true)
        : filtros.dataFim
          ? dateLocalToUTCRange(filtros.dataFim, true)
          : null;
      const dataDisponibilizacaoInicio = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T00:00:00Z`
        : null;
      const dataDisponibilizacaoFim = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T23:59:59.999Z`
        : null;

      try {
        // Quando o termo for um número de processo (>=11 dígitos),
        // ignorar filtros de data e buscar em toda a base.
        const termoDigitsCount = (filtros.termoBusca || '').replace(/\D/g, '');
        const buscaPorProcessoCount = termoDigitsCount.length >= 11;

        // Conta todas as descartadas (inclui as de origem "processo" cujo
        // monitoramento_id é NULL). Filtra coordenação pela própria coluna
        // da tabela descartadas — não usa inner join com monitoramentos,
        // que excluiria registros sem monitoramento_id.
        let q = (supabase
          .from('publicacoes_djen_descartadas') as any)
          .select('id', { count: 'exact', head: true });

        // Não contar descartes por "termo não encontrado" — apenas critérios
        // de exclusão (excluido: ...) e condição concomitante interessam.
        q = q.neq('motivo_descarte', 'termo_nao_encontrado');

        if (!buscaPorProcessoCount) {
          q = aplicarFiltroDataCapturaBrt(q, dataInicioFiltro, dataFimFiltro);
          if (dataDisponibilizacaoInicio) q = q.gte('data_disponibilizacao', dataDisponibilizacaoInicio);
          if (dataDisponibilizacaoFim) q = q.lte('data_disponibilizacao', dataDisponibilizacaoFim);
        } else {
          q = q.ilike('processo_numero', `%${termoDigitsCount}%`);
        }
        // Per-user tracking: lida filter handled client-side
        if (filtros.monitoramentoId) q = q.eq('monitoramento_id', filtros.monitoramentoId);

        // Respeita o filtro de coordenação usando a coluna direta.
        if (filtros.coordenacaoId) {
          q = q.eq('coordenacao_id', filtros.coordenacaoId);
        }

        const { count, error } = await q.abortSignal(signal);
        if (error) {
          console.warn('Erro ao contar descartadas:', error);
          return 0;
        }
        return count || 0;
      } catch (e) {
        console.warn('Erro ao contar descartadas:', e);
        return 0;
      }
    },
    // Sempre habilitado para que o card "Descartadas" mostre o total mesmo quando
    // a aba atual não é "descartada". Usa COUNT exato com head:true (leve).
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const shouldLoadExactStats = !!user?.id
    && !filtros.desabilitarStats;

  // Query separada para contar TOTAL e NÃO LIDAS independente do filtro apenasNaoLidas
  const { data: statsIndependentes, isLoading: isLoadingStats } = useQuery({
    queryKey: [
      'publicacoes-unificadas-stats-header',
      user?.id,
      {
        coordenacaoId: filtros.coordenacaoId ?? null,
        apenasHoje: filtros.apenasHoje ?? null,
        dataInicio: filtros.dataInicio ?? null,
        dataFim: filtros.dataFim ?? null,
        dataDisponibilizacao: filtros.dataDisponibilizacao ?? null,
        tipoOrigem: filtros.tipoOrigem ?? null,
        termoBusca: filtros.termoBusca ?? null,
        monitoramentoId: filtros.monitoramentoId ?? null,
        tribunal: filtros.tribunal ?? null,
        dedupServidor: filtros.dedupServidor === true,
        readStatus,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!user?.id) return { total: 0, naoLidas: 0, totalTermos: 0, totalProcessos: 0, totalUnicas: 0, naoLidasUnicas: 0 };

      const hojeBrt = getHojeBrtISO();
      const di = filtros.apenasHoje
        ? dateLocalToUTCRange(hojeBrt, false)
        : filtros.dataInicio
          ? dateLocalToUTCRange(filtros.dataInicio, false)
          : null;
      const df = filtros.apenasHoje
        ? dateLocalToUTCRange(hojeBrt, true)
        : filtros.dataFim
          ? dateLocalToUTCRange(filtros.dataFim, true)
          : null;
      const dataDisponibilizacaoInicio = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T00:00:00Z`
        : null;
      const dataDisponibilizacaoFim = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T23:59:59.999Z`
        : null;

      const { data, error } = await (supabase.rpc as any)('get_djen_stats_servidor_per_user', {
        p_coordenacao_id: filtros.coordenacaoId ?? null,
        p_inicio: di,
        p_fim: df,
        p_tipo_origem: filtros.tipoOrigem && filtros.tipoOrigem !== 'descartada' && filtros.tipoOrigem !== 'todos'
          ? filtros.tipoOrigem
          : null,
        p_search_query: filtros.termoBusca || null,
        p_monitoramento_id: filtros.monitoramentoId || null,
        p_data_disponibilizacao_inicio: dataDisponibilizacaoInicio,
        p_data_disponibilizacao_fim: dataDisponibilizacaoFim,
        p_tribunal: filtros.tribunal || null,
        p_dedup: filtros.dedupServidor === true,
        p_apenas_hoje: filtros.apenasHoje === true,
      }).abortSignal(signal);
      if (error) {
        console.error('[stats-header] get_djen_stats_servidor_per_user error', error);
        return { total: 0, naoLidas: 0, totalTermos: 0, totalProcessos: 0, totalUnicas: 0, naoLidasUnicas: 0 };
      }
      const row = Array.isArray(data) ? data[0] : data;
      const tT = Number(row?.total_termos ?? 0);
      const tP = Number(row?.total_processos ?? 0);
      const nT = Number(row?.nao_lidas_termos ?? 0);
      const nP = Number(row?.nao_lidas_processos ?? 0);
      const totalUnicas = Number(row?.total_unicas ?? 0);
      const naoLidasUnicas = Number(row?.nao_lidas_unicas ?? 0);
      const totalBruto = Number(row?.total_bruto ?? (tT + tP));
      const total = filtros.dedupServidor === true ? totalUnicas : totalBruto;
      const naoLidas = filtros.dedupServidor === true ? naoLidasUnicas : nT + nP;
      const lT = Math.max(0, tT - nT);
      const lP = Math.max(0, tP - nP);
      if (readStatus === 'nao_lidas') {
        return {
          total: naoLidas,
          naoLidas,
          totalTermos: filtros.dedupServidor === true ? naoLidasUnicas : nT,
          totalProcessos: filtros.dedupServidor === true ? 0 : nP,
          totalUnicas: naoLidasUnicas,
          naoLidasUnicas,
        };
      }
      if (readStatus === 'lidas') {
        const lidasUnicas = Math.max(0, totalUnicas - naoLidasUnicas);
        return {
          total: filtros.dedupServidor === true ? lidasUnicas : lT + lP,
          naoLidas: 0,
          totalTermos: filtros.dedupServidor === true ? lidasUnicas : lT,
          totalProcessos: filtros.dedupServidor === true ? 0 : lP,
          totalUnicas: lidasUnicas,
          naoLidasUnicas: 0,
        };
      }
      return {
        total,
        naoLidas,
        totalTermos: filtros.dedupServidor === true ? totalUnicas : tT,
        totalProcessos: filtros.dedupServidor === true ? 0 : tP,
        totalUnicas,
        naoLidasUnicas,
      };
    },
    enabled: shouldLoadExactStats,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  // Buscar publicações unificadas
  const page = Math.max(1, filtros.page ?? 1);
  const pageSize = Math.max(1, filtros.pageSize ?? 500);
  const offsetGlobal = (page - 1) * pageSize;

  const { data: queryResult, isLoading, isFetching } = useQuery<{ rows: PublicacaoUnificada[]; lastChunkSize: number }>({
    queryKey: ['publicacoes-unificadas-servidor', user?.id, filtros],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      if (!user?.id) return { rows: [] as PublicacaoUnificada[], lastChunkSize: 0 };
      
      const hojeBrt = getHojeBrtISO();
      const dataInicioFiltro = filtros.apenasHoje 
        ? dateLocalToUTCRange(hojeBrt, false)
        : filtros.dataInicio 
          ? dateLocalToUTCRange(filtros.dataInicio, false)
          : null;
      
      const dataFimFiltro = filtros.apenasHoje
        ? dateLocalToUTCRange(hojeBrt, true)
        : filtros.dataFim
          ? dateLocalToUTCRange(filtros.dataFim, true)
          : null;
      const dataDisponibilizacaoInicio = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T00:00:00Z`
        : null;
      const dataDisponibilizacaoFim = filtros.dataDisponibilizacao
        ? `${filtros.dataDisponibilizacao}T23:59:59.999Z`
        : null;

      const resultados: PublicacaoUnificada[] = [];
      const numerosProcessosTermo: string[] = [];

      // ===== FAST PATH (RPC DO SERVIDOR) =====
      // Lê exclusivamente `publicacoes_djen_servidor` e aplica leitura/dedup/filtros
      // antes do LIMIT. Isso evita carregar 500 linhas já lidas e depois zerar a
      // lista no client enquanto os totalizadores mostram itens pendentes.
      const canUseRpc = filtros.tipoOrigem !== 'descartada'
        && filtros.tipoOrigem !== 'djet-pautas';
      if (canUseRpc) {
        try {
        console.debug(`[DJEN Servidor] RPC paginada — page=${page} pageSize=${pageSize} offset=${offsetGlobal}`);

        // PAGINAÇÃO REAL no servidor: filtros de tipo/leitura são aplicados ANTES
        // do LIMIT/OFFSET. Assim, se há 2.390 filtradas, as páginas serão
        // 500 + 500 + 500 + 500 + 390 — sem encolher depois no client.
        const { data: pageRows, error: pageError } = await (supabase as any)
          .rpc('get_djen_publicacoes_servidor_unificadas', {
            p_coordenacao_id: filtros.coordenacaoId ?? null,
            p_inicio: dataInicioFiltro ?? null,
            p_fim: dataFimFiltro ?? null,
            p_search_query: filtros.termoBusca ?? null,
            p_limit: pageSize,
            p_offset: offsetGlobal,
            p_monitoramento_id: filtros.monitoramentoId ?? null,
            p_tipo_origem: filtros.tipoOrigem ?? null,
            p_read_status: readStatus,
            p_data_disponibilizacao_inicio: dataDisponibilizacaoInicio,
            p_data_disponibilizacao_fim: dataDisponibilizacaoFim,
            p_tribunal: filtros.tribunal || null,
            p_dedup: filtros.dedupServidor === true,
            p_apenas_hoje: filtros.apenasHoje === true,
          })
          .abortSignal(signal);

        if (pageError) {
          throw new Error(`RPC servidor get error: ${pageError.message || JSON.stringify(pageError)}`);
        }

        const rawRows: any[] = (pageRows || []) as any[];
        const lastChunkSize = rawRows.length;

        // mapear para o tipo do app
        const mapped: PublicacaoUnificada[] = rawRows.map((r) => ({
          id: r.id,
          id_djen: r.id_djen ?? null,
          tipo_origem: r.tipo_origem,
          processo_id: r.processo_id,
          processo_numero: r.processo_numero,
          conteudo: r.conteudo,
          data_publicacao: r.data_publicacao,
          data_disponibilizacao: r.data_disponibilizacao,
          fonte: r.fonte,
          lida: !!r.lida,
          created_at: r.created_at,
          monitoramento_id: r.monitoramento_id,
          monitoramento_termo: r.monitoramento_termo,
          monitoramento_descricao: r.monitoramento_descricao,
          monitoramento_tipo: r.monitoramento_tipo,
          monitoramento_oab: r.monitoramento_oab,
          monitoramento_uf: r.monitoramento_uf,
          coordenacao_id: r.coordenacao_id,
          coordenacao_nome: r.coordenacao_nome,
          polo_ativo: r.polo_ativo,
          polo_passivo: r.polo_passivo,
          tribunal: r.tribunal,
          orgao: r.orgao || null,
          tipo_comunicacao: r.tipo_comunicacao || null,
          meio: r.meio || null,
          advogados_json: parseJsonArraySafe(r.advogados_json),
          partes_json: parseJsonArraySafe(r.partes_json),
          // `lida` e `lido_por` agora vêm direto da RPC (per-user), eliminando
          // o round-trip extra que era feito por mergeWithLeituras().
          lido_por: Array.isArray(r.lido_por)
            ? (() => {
                const uniq = new Map<string, LeituraUsuario>();
                for (const x of r.lido_por as any[]) {
                  const chave = String(x?.usuario_id ?? x?.nome ?? '');
                  const nova: LeituraUsuario = {
                    nome: String(x?.nome ?? 'Desconhecido'),
                    lida_em: String(x?.lida_em ?? ''),
                  };
                  const ex = uniq.get(chave);
                  if (!ex || ex.lida_em < nova.lida_em) uniq.set(chave, nova);
                }
                return Array.from(uniq.values());
              })()
            : [],
        }));

        let filteredByType = filtros.tipoOrigem === 'termo'
          ? mapped.filter((p) => p.tipo_origem === 'termo')
          : filtros.tipoOrigem === 'parte'
            ? mapped.filter((p) => p.tipo_origem === 'termo' && (p.monitoramento_tipo || '').toLowerCase() === 'parte')
            : filtros.tipoOrigem === 'processo'
              ? mapped.filter((p) => p.tipo_origem === 'processo')
              : mapped;
        // Em todas as views que NÃO sejam DJET Pautas, remover publicações
        // capturadas via DEJT (fonte 'dejt-pdf') para não misturar pautas
        // com intimações/processos do DJEN.
        if (filtros.tipoOrigem !== 'djet-pautas') {
          filteredByType = filteredByType.filter((p) => (p.fonte || '').toLowerCase() !== 'dejt-pdf');
        }
        if (filtros.monitoramentoId) {
          filteredByType = filteredByType.filter((p) => p.monitoramento_id === filtros.monitoramentoId);
        }

        // ===== PARALELIZAÇÃO =====
        // As 3 operações abaixo (resolver processo_id, enriquecer monitoramentos,
        // buscar leituras per-user) são independentes entre si — só dependem das
        // linhas já retornadas pela RPC. Rodar em paralelo reduz a latência
        // percebida na lista (que era 3 round-trips sequenciais).
        const termoSemId = filteredByType.filter(
          (p) => p.tipo_origem === 'termo' && !p.processo_id && !!p.processo_numero
        );

        const resolveProcessoIdsPromise: Promise<void> = (async () => {
          if (termoSemId.length === 0) return;
          const toDigits = (n: string) => n.replace(/\D/g, '');
          const candidateNumeros = [...new Set(
            termoSemId.flatMap((p) => {
              const raw = p.processo_numero || '';
              const digits = toDigits(raw);
              const formatted = formatarCnjPorDigitos(digits);
              return [raw, digits, formatted].filter(Boolean) as string[];
            })
          )];
          if (candidateNumeros.length === 0) return;
          let qProcessos = supabase.from('processos').select('id, numero');
          if (filtros.coordenacaoId) {
            qProcessos = qProcessos.eq('coordenacao_id', filtros.coordenacaoId);
          }
          const { data: processosExistentes } = await qProcessos.in('numero', candidateNumeros).abortSignal(signal);
          const processosDigitsMap: Record<string, string> = {};
          (processosExistentes || []).forEach((p: any) => {
            processosDigitsMap[toDigits(p.numero)] = p.id;
          });
          filteredByType.forEach((p) => {
            if (p.tipo_origem === 'termo' && !p.processo_id && p.processo_numero) {
              const digits = toDigits(p.processo_numero);
              p.processo_id = processosDigitsMap[digits] || null;
            }
          });
        })();

        // incluir descartadas, se solicitado (em paralelo com as demais)
        const descartadasPromise: Promise<any[]> = (async () => {
          if (!filtros.incluirDescartadas) return [];
          // Quando o termo for um número de processo (>=11 dígitos),
          // ignorar filtros de data e buscar em toda a base de descartadas.
          const termoDigitsList = (filtros.termoBusca || '').replace(/\D/g, '');
          const buscaPorProcessoList = termoDigitsList.length >= 11;

          let queryDescartadas = (supabase
            .from('publicacoes_djen_descartadas') as any)
            .select(`
              id,
              monitoramento_id,
              processo_numero,
              conteudo,
              data_publicacao,
              data_disponibilizacao,
              tribunal,
              motivo_descarte,
              lida,
              created_at,
              orgao,
              tipo_comunicacao,
              meio,
              partes_json,
              advogados_json,
              monitoramento:monitoramentos_djen!inner(
                id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
                coordenacao:coordenacoes(id, nome)
              )
            `)
            .order('created_at', { ascending: false });

          if (!buscaPorProcessoList) {
            queryDescartadas = aplicarFiltroDataCapturaBrt(queryDescartadas, dataInicioFiltro, dataFimFiltro);
          } else {
            queryDescartadas = queryDescartadas.ilike('processo_numero', `%${termoDigitsList}%`);
          }
          // Per-user tracking: lida filter handled client-side via mergeWithLeituras
          queryDescartadas = queryDescartadas.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
          if (filtros.monitoramentoId) queryDescartadas = queryDescartadas.eq('monitoramento_id', filtros.monitoramentoId);
          if (!buscaPorProcessoList) {
            if (dataDisponibilizacaoInicio) queryDescartadas = queryDescartadas.gte('data_disponibilizacao', dataDisponibilizacaoInicio);
            if (dataDisponibilizacaoFim) queryDescartadas = queryDescartadas.lte('data_disponibilizacao', dataDisponibilizacaoFim);
          }
          // Ocultar descartes por termo não encontrado da listagem
          queryDescartadas = queryDescartadas.neq('motivo_descarte', 'termo_nao_encontrado');

          const { data: descartadasData } = await queryDescartadas.limit(200).abortSignal(signal);
          return (descartadasData || []).map((pub: any) => ({
              id: pub.id,
              tipo_origem: 'descartada' as const,
              processo_id: null,
              processo_numero: pub.processo_numero,
              conteudo: pub.conteudo,
              data_publicacao: pub.data_publicacao,
              data_disponibilizacao: pub.data_disponibilizacao,
              fonte: null,
              lida: pub.lida ?? false,
              created_at: pub.created_at,
              monitoramento_id: pub.monitoramento_id,
              monitoramento_termo: pub.monitoramento?.termo_busca,
              monitoramento_descricao: pub.monitoramento?.descricao,
              monitoramento_tipo: pub.monitoramento?.tipo,
              monitoramento_oab: pub.monitoramento?.oab,
              monitoramento_uf: pub.monitoramento?.uf,
              coordenacao_id: pub.monitoramento?.coordenacao_id,
              coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
              polo_ativo: null,
              polo_passivo: null,
              tribunal: pub.tribunal,
              orgao: pub.orgao || null,
              tipo_comunicacao: pub.tipo_comunicacao || null,
              meio: pub.meio || null,
              advogados_json: pub.advogados_json ? (typeof pub.advogados_json === 'string' ? JSON.parse(pub.advogados_json) : pub.advogados_json) : null,
              partes_json: pub.partes_json ? (typeof pub.partes_json === 'string' ? JSON.parse(pub.partes_json) : pub.partes_json) : null,
              motivo_descarte: pub.motivo_descarte,
            }));
        })();

        // Aguardar paralelamente: resolução de processo_id, descartadas
        const [, descartadasMapped] = await Promise.all([
          resolveProcessoIdsPromise,
          descartadasPromise,
        ]);
        if (descartadasMapped.length > 0) {
          resultados.push(...descartadasMapped);
        }

        // NÃO revalidar termo no client: a captura oficial já valida termo principal + termos_or.
        const merged = [...filteredByType, ...resultados];
        const sorted = merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        // Para descartadas (que não vieram da RPC), ainda precisamos buscar leituras —
        // mas só dessas, não da lista inteira. Para o restante, `lida` e `lido_por`
        // já vêm embutidos na RPC.
        let finalRows: PublicacaoUnificada[];
        if (descartadasMapped.length > 0) {
          const [enriquecidos, leiturasDescartadas] = await Promise.all([
            enriquecerPublicacoesComMonitoramento(sorted),
            mergeWithLeituras(user!.id, descartadasMapped as PublicacaoUnificada[], 'todas'),
          ]);
          const lidoMap = new Map(leiturasDescartadas.map((p) => [p.id, { lida: p.lida, lido_por: p.lido_por }]));
          finalRows = enriquecidos.map((p) => {
            const l = lidoMap.get(p.id);
            return l ? { ...p, lida: l.lida, lido_por: l.lido_por } : p;
          });
        } else {
          finalRows = await enriquecerPublicacoesComMonitoramento(sorted);
        }
        return { rows: finalRows, lastChunkSize };

        } catch (rpcError) {
          console.warn('[DJEN] RPC falhou, usando fallback com queries diretas:', rpcError);
          // Cai no código abaixo (queries diretas)
        }
      }

      // FALLBACK: queries diretas (usado quando RPC falha ou não há coordenação selecionada)

      // Buscar publicações de TERMOS (monitoramentos_djen)
      // Obs: quando filtrando EXCLUSIVAMENTE por 'descartada', não deve trazer termos/processos.
      if (filtros.tipoOrigem !== 'processo' && filtros.tipoOrigem !== 'descartada') {
        let queryTermos = supabase
          .from('publicacoes_djen_servidor')
          .select(`
            id,
            id_djen,
            monitoramento_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            fonte,
            tribunal,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            advogados_json,
            partes_json,
            polo_ativo,
            polo_passivo,
            tipo_publicacao,
            coordenacao_id
          `)
          .order('created_at', { ascending: false });

        if (filtros.tipoOrigem !== 'djet-pautas') {
          queryTermos = aplicarFiltroDataCapturaBrt(queryTermos, dataInicioFiltro, dataFimFiltro);
        }
        // Para DJET Pautas, o "dia da pauta" é a data legal de publicação do DEJT.
        // Ex.: caderno disponibilizado em 03/07/2026 (sexta) tem publicação em 06/07/2026.
        if (filtros.tipoOrigem === 'djet-pautas' && (filtros.dataDisponibilizacao || filtros.apenasHoje)) {
          const diaPauta = filtros.dataDisponibilizacao || hojeBrt;
          queryTermos = queryTermos
            .gte('data_publicacao', `${diaPauta}T00:00:00Z`)
            .lte('data_publicacao', `${diaPauta}T23:59:59.999Z`);
        } else {
          if (dataDisponibilizacaoInicio) queryTermos = queryTermos.gte('data_disponibilizacao', dataDisponibilizacaoInicio);
          if (dataDisponibilizacaoFim) queryTermos = queryTermos.lte('data_disponibilizacao', dataDisponibilizacaoFim);
        }
        // Per-user tracking: lida filter handled client-side via mergeWithLeituras
        
        // Filtrar por coordenação NO BANCO para performance
        if (filtros.coordenacaoId) {
          queryTermos = queryTermos.eq('coordenacao_id', filtros.coordenacaoId);
        }
        if (filtros.monitoramentoId) {
          queryTermos = queryTermos.eq('monitoramento_id', filtros.monitoramentoId);
        }

        // Filtro "DJET Pautas": só publicações do caderno judiciário (DEJT)
        if (filtros.tipoOrigem === 'djet-pautas') {
          queryTermos = (queryTermos as any).eq('tipo_publicacao', 'pauta');
        } else {
          // Demais filtros: oculta as pautas DJET para não misturar com intimações
          queryTermos = (queryTermos as any).or('tipo_publicacao.is.null,tipo_publicacao.neq.pauta');
        }

        // Paginação real no fallback: usa range para a página solicitada.
        const { data: termosData, error: termosError } = await queryTermos
          .range(offsetGlobal, offsetGlobal + pageSize - 1)
          .abortSignal(signal);
        if (termosError) {
          console.error('[DJEN Servidor] Erro ao buscar publicacoes_djen_servidor:', termosError);
          throw termosError;
        }

        const monitoramentoMap = await carregarMonitoramentosDjen((termosData || []).map((pub: any) => pub.monitoramento_id), signal);

        // Coletar números de processos para buscar IDs
        (termosData || []).forEach((pub: any) => {
          if (pub.processo_numero) {
            numerosProcessosTermo.push(pub.processo_numero);
          }
        });

        // Buscar IDs dos processos que já existem no banco
        let processosExistentesMap: Record<string, string> = {};
        if (numerosProcessosTermo.length > 0) {
          const uniqueNumeros = [...new Set(numerosProcessosTermo)];
          const { data: processosExistentes } = await supabase
            .from('processos')
            .select('id, numero')
            .in('numero', uniqueNumeros)
            .abortSignal(signal);
          
          (processosExistentes || []).forEach((p: any) => {
            processosExistentesMap[p.numero] = p.id;
          });
        }

          (termosData || []).forEach((pub: any) => {
          const monitoramento = monitoramentoMap.get(pub.monitoramento_id);
          if (filtros.tipoOrigem === 'parte' && (monitoramento?.tipo || '').toLowerCase() !== 'parte') return;

          // Filtrar por termo de busca: FRASE EXATA no conteúdo (evita "Super" casar com "SUPERIOR")
          if (filtros.termoBusca) {
            const termoLower = filtros.termoBusca.toLowerCase();
            const termoDigits = termoLower.replace(/\D/g, '');
            const matchConteudo = conteudoContemFraseExata(pub.conteudo, filtros.termoBusca);
            const matchProcesso = pub.processo_numero?.toLowerCase().includes(termoLower);
            const matchTermoMonitor = monitoramento?.termo_busca?.toLowerCase().includes(termoLower);
            // Busca normalizada por dígitos do processo
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            if (!matchConteudo && !matchProcesso && !matchTermoMonitor && !matchProcessoDigits) return;
          }

          // Verificar se o processo já existe no banco
          const processoId = pub.processo_numero ? processosExistentesMap[pub.processo_numero] || null : null;

          resultados.push({
            id: pub.id,
            id_djen: pub.id_djen ?? null,
            tipo_origem: 'termo',
            processo_id: processoId,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: pub.fonte,
            lida: false,
            created_at: pub.created_at,
            monitoramento_id: pub.monitoramento_id,
            monitoramento_termo: monitoramento?.termo_busca ?? null,
            monitoramento_descricao: monitoramento?.descricao ?? null,
            monitoramento_tipo: monitoramento?.tipo ?? null,
            monitoramento_oab: monitoramento?.oab ?? null,
            monitoramento_uf: monitoramento?.uf ?? null,
            coordenacao_id: pub.coordenacao_id ?? monitoramento?.coordenacao_id ?? null,
            coordenacao_nome: monitoramento?.coordenacao?.nome ?? null,
            polo_ativo: pub.polo_ativo || null,
            polo_passivo: pub.polo_passivo || null,
            tribunal: pub.tribunal ?? null,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: parseJsonArraySafe(pub.advogados_json),
            partes_json: parseJsonArraySafe(pub.partes_json),
          });
        });
      }

      // Buscar publicações de PROCESSOS (publicacoes_djen_processos)
      // DESATIVADO nesta variante (Análise DJEN Servidor): a tabela
      // `publicacoes_djen_processos` é alimentada pelo DJEN browser. Esta tela
      // mostra somente publicações achadas pelo servidor.
      if (false &&
        filtros.tipoOrigem !== 'termo' &&
        filtros.tipoOrigem !== 'parte' &&
        filtros.tipoOrigem !== 'descartada' &&
        filtros.tipoOrigem !== 'djet-pautas'
      ) {
        // IMPORTANTE: usar !inner para garantir que filtros por campos do relacionamento
        // (ex: processo.coordenacao_id) sejam aplicados no banco.
        let queryProcessos = supabase
          .from('publicacoes_djen_processos')
          .select(`
            id,
            processo_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            fonte,
            lida,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            advogados_json,
            partes_json,
            tribunal,
            processo:processos!inner(
              id, numero, polo_ativo, polo_passivo, tribunal,
              coordenacao_id, coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        if (dataInicioFiltro) queryProcessos = queryProcessos.gte('created_at', dataInicioFiltro);
        if (dataFimFiltro) queryProcessos = queryProcessos.lte('created_at', dataFimFiltro);
        if (dataDisponibilizacaoInicio) queryProcessos = queryProcessos.gte('data_disponibilizacao', dataDisponibilizacaoInicio);
        if (dataDisponibilizacaoFim) queryProcessos = queryProcessos.lte('data_disponibilizacao', dataDisponibilizacaoFim);
        // Per-user tracking: lida filter handled client-side via mergeWithLeituras
        
        // Filtrar por coordenação NO BANCO para performance
        if (filtros.coordenacaoId) {
          queryProcessos = queryProcessos.eq('processo.coordenacao_id', filtros.coordenacaoId);
        }

        // Paginação real no fallback: usa range para a página solicitada.
        const { data: processosData } = await queryProcessos
          .range(offsetGlobal, offsetGlobal + pageSize - 1)
          .abortSignal(signal);

        (processosData || []).forEach((pub: any) => {
          // Com !inner + filtro no banco, essa checagem vira redundante; manter apenas como guarda.
          if (filtros.coordenacaoId && pub.processo?.coordenacao_id !== filtros.coordenacaoId) return;

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const termoDigits = termo.replace(/\D/g, '');
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.processo?.polo_ativo?.toLowerCase().includes(termo) ||
              pub.processo?.polo_passivo?.toLowerCase().includes(termo) ||
              matchProcessoDigits;
            if (!match) return;
          }

          resultados.push({
            id: pub.id,
            tipo_origem: 'processo',
            processo_id: pub.processo_id,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: pub.fonte,
            lida: pub.lida,
            created_at: pub.created_at,
            monitoramento_id: null,
            monitoramento_termo: null,
            monitoramento_descricao: null,
            monitoramento_tipo: null,
            monitoramento_oab: null,
            monitoramento_uf: null,
            coordenacao_id: pub.processo?.coordenacao_id,
            coordenacao_nome: pub.processo?.coordenacao?.nome,
            polo_ativo: pub.processo?.polo_ativo,
            polo_passivo: pub.processo?.polo_passivo,
            tribunal: pub.tribunal ?? pub.processo?.tribunal,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: parseJsonArraySafe(pub.advogados_json),
            partes_json: parseJsonArraySafe(pub.partes_json),
          });
        });
      }

      // Buscar publicações DESCARTADAS
      if (filtros.incluirDescartadas || filtros.tipoOrigem === 'descartada') {
        let queryDescartadas = (supabase
          .from('publicacoes_djen_descartadas') as any)
          .select(`
            id,
            monitoramento_id,
            processo_numero,
            conteudo,
            data_publicacao,
            data_disponibilizacao,
            tribunal,
            motivo_descarte,
            lida,
            created_at,
            orgao,
            tipo_comunicacao,
            meio,
            partes_json,
            advogados_json,
            monitoramento:monitoramentos_djen!inner(
              id, tipo, termo_busca, descricao, oab, uf, coordenacao_id,
              coordenacao:coordenacoes(id, nome)
            )
          `)
          .order('created_at', { ascending: false });

        queryDescartadas = aplicarFiltroDataCapturaBrt(queryDescartadas, dataInicioFiltro, dataFimFiltro);
        if (dataDisponibilizacaoInicio) queryDescartadas = queryDescartadas.gte('data_disponibilizacao', dataDisponibilizacaoInicio);
        if (dataDisponibilizacaoFim) queryDescartadas = queryDescartadas.lte('data_disponibilizacao', dataDisponibilizacaoFim);
        if (filtros.coordenacaoId) queryDescartadas = queryDescartadas.eq('monitoramento.coordenacao_id', filtros.coordenacaoId);
        if (filtros.monitoramentoId) queryDescartadas = queryDescartadas.eq('monitoramento_id', filtros.monitoramentoId);
        // Ocultar descartes por termo não encontrado
        queryDescartadas = queryDescartadas.neq('motivo_descarte', 'termo_nao_encontrado');

        const { data: descartadasData } = await queryDescartadas
          .range(offsetGlobal, offsetGlobal + pageSize - 1)
          .abortSignal(signal);

        (descartadasData || []).forEach((pub: any) => {
          // Filtrar por coordenação se especificado
          if (filtros.coordenacaoId && pub.monitoramento?.coordenacao_id !== filtros.coordenacaoId) {
            return;
          }

          // Filtrar por termo de busca
          if (filtros.termoBusca) {
            const termo = filtros.termoBusca.toLowerCase();
            const termoDigits = termo.replace(/\D/g, '');
            const matchProcessoDigits = termoDigits.length >= 5 && pub.processo_numero
              ? (() => { const d = pub.processo_numero.replace(/\D/g, ''); return d.includes(termoDigits) || termoDigits.includes(d); })()
              : false;
            const match = 
              pub.conteudo?.toLowerCase().includes(termo) ||
              pub.processo_numero?.toLowerCase().includes(termo) ||
              pub.monitoramento?.termo_busca?.toLowerCase().includes(termo) ||
              pub.motivo_descarte?.toLowerCase().includes(termo) ||
              matchProcessoDigits;
            if (!match) return;
          }

          resultados.push({
            id: pub.id,
            tipo_origem: 'descartada',
            processo_id: null,
            processo_numero: pub.processo_numero,
            conteudo: pub.conteudo,
            data_publicacao: pub.data_publicacao,
            data_disponibilizacao: pub.data_disponibilizacao,
            fonte: null,
            lida: pub.lida ?? false,
            created_at: pub.created_at,
            monitoramento_id: pub.monitoramento_id,
            monitoramento_termo: pub.monitoramento?.termo_busca,
            monitoramento_descricao: pub.monitoramento?.descricao,
            monitoramento_tipo: pub.monitoramento?.tipo,
            monitoramento_oab: pub.monitoramento?.oab,
            monitoramento_uf: pub.monitoramento?.uf,
            coordenacao_id: pub.monitoramento?.coordenacao_id,
            coordenacao_nome: pub.monitoramento?.coordenacao?.nome,
            polo_ativo: null,
            polo_passivo: null,
            tribunal: pub.tribunal,
            orgao: pub.orgao || null,
            tipo_comunicacao: pub.tipo_comunicacao || null,
            meio: pub.meio || null,
            advogados_json: pub.advogados_json ? (typeof pub.advogados_json === 'string' ? JSON.parse(pub.advogados_json) : pub.advogados_json) : null,
            partes_json: pub.partes_json ? (typeof pub.partes_json === 'string' ? JSON.parse(pub.partes_json) : pub.partes_json) : null,
            motivo_descarte: pub.motivo_descarte,
          });
        });
      }

      // NÃO revalidar termo no client: a captura oficial já valida termo principal + termos_or.
      const resultadosFiltrados = await enriquecerPublicacoesComMonitoramento(resultados);

      // Não deduplicar sempre aqui: o controle "Mostrar somente únicas" é
      // opcional e vem por `dedupServidor`. Quando a tela foca uma execução
      // específica ("Ver N"), ela passa `dedupServidor=false` e precisa receber
      // todas as linhas reais para o total visível bater com o card.
      let deduped = filtros.dedupServidor === true
        ? dedupePublicacoesDjen(resultadosFiltrados)
        : resultadosFiltrados;

      // Se estamos filtrando apenas descartadas, garantir que só venham descartadas
      if (filtros.tipoOrigem === 'descartada') {
        // Auditoria de descartadas: cada linha é um registro próprio (com seu
        // motivo_descarte), não deve sofrer dedup visual — caso contrário a
        // paginação de 500 colapsa para poucas dezenas.
        deduped = resultadosFiltrados.filter(p => p.tipo_origem === 'descartada');
      }

      // Se estamos filtrando apenas "parte", garantir que só venham termos do tipo 'parte'
      if (filtros.tipoOrigem === 'parte') {
        deduped = deduped.filter(
          (p) => p.tipo_origem === 'termo' && (p.monitoramento_tipo || '').toLowerCase() === 'parte'
        );
      }

      // Ordenar por data de criação (mais recentes primeiro) + merge per-user leituras
      const sorted = deduped.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const finalRowsFallback = await mergeWithLeituras(user!.id, sorted, readStatus);
      // lastChunkSize: tamanho do maior bloco bruto carregado (heurística para hasNextPage)
      const lastChunkSize = Math.max(
        0,
        Math.min(pageSize, resultados.length),
      );
      return { rows: finalRowsFallback, lastChunkSize };
    },
    enabled: !!user?.id && !filtros.desabilitarLista,
    placeholderData: (previousData) => previousData,
  });

  const publicacoes: PublicacaoUnificada[] = queryResult?.rows ?? [];
  const lastChunkSize = queryResult?.lastChunkSize ?? 0;
  const totalForPagination = filtros.tipoOrigem === 'descartada' || filtros.incluirDescartadas
    ? totalDescartadasHoje
    : statsIndependentes?.total ?? 0;
  const hasNextPage = totalForPagination > 0
    ? page * pageSize < totalForPagination
    : lastChunkSize >= pageSize;

  // Estatísticas devem refletir EXATAMENTE a listagem (incluindo filtros como: Não Lidas, Termo de busca,
  // Todas (inclui descartadas), Descartadas, etc.).
  const estatisticas: EstatisticasCoordenacao[] = (() => {
    const statsMap = new Map<string, EstatisticasCoordenacao>();

    publicacoes.forEach((pub) => {
      const coordId = pub.coordenacao_id || 'sem-coordenacao';
      const coordNome = pub.coordenacao_nome || 'Sem Coordenação';

    if (!statsMap.has(coordId)) {
        statsMap.set(coordId, {
          coordenacao_id: coordId,
          coordenacao_nome: coordNome,
          total: 0,
          nao_lidas: 0,
          por_tipo: { termo: 0, processo: 0, descartada: 0 },
        });
      }

      const stats = statsMap.get(coordId)!;
      stats.total++;
      if (!pub.lida) stats.nao_lidas++;
      if (pub.tipo_origem === 'termo') stats.por_tipo.termo++;
      if (pub.tipo_origem === 'processo') stats.por_tipo.processo++;
      if (pub.tipo_origem === 'descartada') stats.por_tipo.descartada++;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.total - a.total);
  })();

  // Marcar como lida - per-user tracking + legacy global flag via RPC
  const marcarComoLida = useMutation({
    mutationFn: async (items: { id: string; tipo_origem: 'termo' | 'processo' | 'descartada' | 'datajud'; somenteEsta?: boolean }[]) => {
      const somenteEsta = items.length > 0 && items.every(i => i.somenteEsta);

      // ============================================================
      // EXPANSÃO POR DEDUP (server-side):
      // A tela exibe publicações DEDUPLICADAS por coordenação + processo +
      // data + cabeçalho do conteúdo. Quando o usuário marca "1 linha"
      // como lida, precisamos marcar TODAS as irmãs no banco; caso
      // contrário o próximo dedup pode escolher uma irmã ainda não-lida
      // e a publicação reaparece. A expansão acontece dentro da RPC
      // get_publicacoes_relacionadas_por_dedup, usando os índices de
      // dedup já existentes — bem mais rápido que vários SELECT no client.
      // ============================================================
      const seedTermos = items.filter(i => i.tipo_origem === 'termo').map(i => i.id);
      const seedProcessos = items.filter(i => i.tipo_origem === 'processo').map(i => i.id);
      const seedDescartadas = items.filter(i => i.tipo_origem === 'descartada').map(i => i.id);
      const datajudIds = items.filter(i => i.tipo_origem === 'datajud').map(i => i.id);

      const totalSelecionado = items.filter(i => i.tipo_origem !== 'datajud').length;

      // Expansão por dedup via RPC. Best-effort: se falhar, marcamos só
      // o que o usuário selecionou (ainda persistido per-user logo abaixo).
      const expandedMap = new Map<string, 'termo' | 'processo' | 'descartada'>();
      items.forEach(i => {
        if (i.tipo_origem !== 'datajud') {
          expandedMap.set(i.id, i.tipo_origem);
        }
      });

      // Helper local: chunk genérico
      const chunkArr = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      // Expansão de irmãs em CHUNKS — evita timeout quando o usuário marca centenas de uma vez.
      const SEED_CHUNK = 100;
      const expandSeeds = async (
        t: string[] | null,
        p: string[] | null,
        d: string[] | null,
      ) => {
        try {
          const { data: relacionadas, error: relErr } = await (supabase as any).rpc(
            'get_publicacoes_relacionadas_por_dedup',
            { p_ids_termos: t, p_ids_processos: p, p_ids_descartadas: d }
          );
          if (relErr) {
            console.warn('[DJEN] Falha ao expandir irmãs via RPC (best-effort):', relErr.message);
            return;
          }
          if (Array.isArray(relacionadas)) {
            relacionadas.forEach((r: any) => {
              if (r?.publicacao_id && (r.tabela_origem === 'termo' || r.tabela_origem === 'processo' || r.tabela_origem === 'descartada')) {
                expandedMap.set(r.publicacao_id as string, r.tabela_origem);
              }
            });
          }
        } catch (e: any) {
          console.warn('[DJEN] Exceção ao expandir irmãs via RPC (best-effort):', e?.message || e);
        }
      };
      if (!somenteEsta) {
        for (const c of chunkArr(seedTermos, SEED_CHUNK)) await expandSeeds(c, null, null);
        for (const c of chunkArr(seedProcessos, SEED_CHUNK)) await expandSeeds(null, c, null);
        for (const c of chunkArr(seedDescartadas, SEED_CHUNK)) await expandSeeds(null, null, c);
      }


      const expanded = Array.from(expandedMap.entries()).map(([id, tipo_origem]) => ({ id, tipo_origem }));
      const totalExpandido = expanded.length;
      console.log(`[DJEN] Marcação: ${totalSelecionado} selecionada(s) → ${totalExpandido} com irmãs (dedup)`);

      const termos = expanded.filter(i => i.tipo_origem === 'termo').map(i => i.id);
      const processos = expanded.filter(i => i.tipo_origem === 'processo').map(i => i.id);
      const descartadas = expanded.filter(i => i.tipo_origem === 'descartada').map(i => i.id);

      // Helper: divide um array em chunks de tamanho fixo (evita timeout em lotes grandes)
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      // Mark DataJud items directly (em chunks)
      if (datajudIds.length > 0) {
        for (const c of chunk(datajudIds, 200)) {
          await supabase.from('movimentacoes_datajud').update({ lida: true }).in('id', c);
        }
      }

      // Legacy: marca global flag via RPC (backwards compat) — agora em CHUNKS e best-effort.
      // A flag global `lida` na tabela é redundante com `publicacoes_djen_leituras` (per-user),
      // então se a RPC falhar (timeout em lotes muito grandes) seguimos em frente — a UI usa
      // a leitura per-user para mostrar status correto.
      const RPC_CHUNK = 100;
      const rpcAggregate = { termos_atualizados: 0, processos_atualizados: 0, descartadas_atualizados: 0 };
      const callRpc = async (
        t: string[] | null,
        p: string[] | null,
        d: string[] | null,
      ) => {
        try {
          const { data, error } = await (supabase as any).rpc('marcar_publicacoes_lidas_por_dedup', {
            p_ids_termos: t,
            p_ids_processos: p,
            p_ids_descartadas: d,
          });
          if (error) {
            console.warn('[DJEN] RPC marcar lidas falhou (best-effort, ignorado):', error.message);
            return;
          }
          rpcAggregate.termos_atualizados += data?.termos_atualizados || 0;
          rpcAggregate.processos_atualizados += data?.processos_atualizados || 0;
          rpcAggregate.descartadas_atualizados += data?.descartadas_atualizados || 0;
        } catch (e: any) {
          console.warn('[DJEN] RPC marcar lidas exceção (best-effort, ignorado):', e?.message || e);
        }
      };

      // Processa cada origem em chunks separados
      for (const c of chunk(termos, RPC_CHUNK)) await callRpc(c, null, null);
      for (const c of chunk(processos, RPC_CHUNK)) await callRpc(null, c, null);
      for (const c of chunk(descartadas, RPC_CHUNK)) await callRpc(null, null, c);

      // Per-user tracking: insert into leituras table
      // Get user's name from profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user!.id)
        .maybeSingle();
      const userName = profileData?.nome || user?.email || 'Desconhecido';

      const leiturasToInsert = expanded
        .map(i => ({
          publicacao_id: i.id,
          tabela_origem: i.tipo_origem,
          usuario_id: user!.id,
          usuario_nome: userName,
        }));

      if (leiturasToInsert.length > 0) {
        // Upsert per-user em chunks menores (200) — payloads grandes causam timeout
        // e deixam algumas marcações pendentes. Em caso de falha de um chunk,
        // tentamos novamente uma vez antes de propagar o erro.
        let firstError: string | null = null;
        for (const c of chunk(leiturasToInsert, 200)) {
          let attempts = 0;
          let lastErr: string | null = null;
          while (attempts < 2) {
            const { error: upErr } = await (supabase as any)
              .from('publicacoes_djen_leituras')
              .upsert(c, { onConflict: 'publicacao_id,tabela_origem,usuario_id' });
            if (!upErr) { lastErr = null; break; }
            lastErr = upErr.message;
            attempts++;
            await new Promise(r => setTimeout(r, 300));
          }
          if (lastErr) {
            console.error('[DJEN] Chunk falhou após retry:', lastErr);
            if (!firstError) firstError = lastErr;
          }
        }
        if (firstError) throw new Error(firstError);
      }

      console.log('[DJEN] Publicações marcadas (RPC agregado):', rpcAggregate);
      return {
        rpcResult: rpcAggregate,
        itemIds: expanded.map(i => i.id),
        totalSelecionado,
        totalExpandido,
      };
    },
    // Optimistic update: marca imediatamente na UI antes do servidor responder
    onMutate: async (items) => {
      // Cancelar queries em andamento para evitar sobrescrever o optimistic update
      await queryClient.cancelQueries({ queryKey: ['publicacoes-unificadas-servidor'] });

      // Snapshot do estado atual (formato novo: { rows, lastChunkSize })
      type CachedShape = { rows: PublicacaoUnificada[]; lastChunkSize: number };
      const previousData = queryClient.getQueriesData<CachedShape>({ queryKey: ['publicacoes-unificadas-servidor'] });

      // Atualizar otimisticamente todas as queries de publicações
      const idsToMark = new Set(items.map(i => i.id));
      queryClient.setQueriesData<CachedShape>(
        { queryKey: ['publicacoes-unificadas-servidor'] },
        (old) => {
          if (!old || !old.rows) return old;
          return {
            ...old,
            rows: old.rows.map(pub => idsToMark.has(pub.id) ? {
              ...pub,
              lida: true,
              lido_por: [...(pub.lido_por || []), { nome: 'Você', lida_em: new Date().toISOString() }],
            } : pub),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (result) => {
      // Optimistic update em onMutate já refletiu na UI; apenas marcamos stale
      // sem refetch imediato para evitar a sensação de "recarregar a página".
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-servidor'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['descartadas-count'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });

      // Mensagem baseada no que o USUÁRIO pediu para marcar (linhas da tela),
      // não no agregado da RPC legacy (que pode falhar/parcial).
      const sel = result.totalSelecionado || 0;
      const exp = result.totalExpandido || sel;
      if (exp > sel) {
        toast.success(`${sel} publicação(ões) marcada(s) como lida(s) (${exp} registros incluindo duplicatas)`);
      } else {
        toast.success(`${sel} publicação(ões) marcada(s) como lida(s)`);
      }
    },
    onError: (error, _variables, context) => {
      // Reverter ao estado anterior em caso de erro
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-servidor'] });
      toast.error(`Erro ao marcar publicações: ${error.message}`);
    },
  });

  // Descartar manualmente: move uma publicação ativa para descartadas
  // com motivo "descartado_manualmente" (chama RPC SECURITY DEFINER).
  const descartarManualmente = useMutation({
    mutationFn: async ({ id, tipo_origem }: { id: string; tipo_origem: 'termo' | 'processo'; silent?: boolean }) => {
      const { data, error } = await (supabase as any).rpc('descartar_publicacao_manualmente', {
        p_id: id,
        p_tipo_origem: tipo_origem,
        p_motivo: 'descartado_manualmente',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      if (variables?.silent) return;
      await queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-servidor'] });
      await queryClient.invalidateQueries({ queryKey: ['descartadas-count'] });
      await queryClient.invalidateQueries({ queryKey: ['descartadas-dedup'] });
      toast.success('Publicação descartada');
    },
    onError: (error: any, variables: any) => {
      if (variables?.silent) return;
      toast.error(`Erro ao descartar: ${error?.message || error}`);
    },
  });

  return {
    publicacoes,
    estatisticas,
    isLoading,
    isFetching,
    loadingStats: isLoadingStats,
    marcarComoLida,
    descartarManualmente,
    // Totais GLOBAIS (independem da paginação) — vêm das count queries do servidor.
    // Fallback para a contagem da página atual enquanto a query não carrega.
    totalHoje: statsIndependentes?.total ?? publicacoes.length,
    naoLidasHoje: statsIndependentes?.naoLidas ?? publicacoes.filter(p => !p.lida).length,
    totalTermosHoje: statsIndependentes?.totalTermos ?? publicacoes.filter(p => p.tipo_origem === 'termo').length,
    totalProcessosHoje: statsIndependentes?.totalProcessos ?? publicacoes.filter(p => p.tipo_origem === 'processo').length,
    totalUnicasHoje: statsIndependentes?.totalUnicas ?? publicacoes.length,
    naoLidasUnicasHoje: statsIndependentes?.naoLidasUnicas ?? publicacoes.filter(p => !p.lida).length,
    totalDescartadasHoje,
    page,
    pageSize,
    hasNextPage,
  };
}
