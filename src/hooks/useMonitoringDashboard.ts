import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback, useState, useRef } from "react";
import { getExecutionProgress } from "@/utils/executionProgress";

export type MonitoringStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export type ExecuteMonitoringResult = {
  execucaoId: string | null;
  blocked?: boolean;
  paused?: boolean;
  message?: string;
  success?: boolean;
  error?: string;
  [key: string]: any;
};

export type ExecuteMonitoringOptions = {
  retomar?: boolean;
};

export interface MonitoringExecution {
  id: string;
  tipo: string;
  status: string;
  job_name: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  lotes_processados: number;
  total_lotes: number | null;
  registros_processados: number;
  registros_encontrados: number;
  erros: number;
  ultimo_erro: string | null;
  retry_count: number;
  detalhes: Record<string, any> | null;
}

export interface MonitoringConfig {
  id: string;
  tipo: string;
  ativo: boolean;
  frequencia: string;
  ultima_execucao: string | null;
  metadata: Record<string, any> | null;
}

export interface MonitoringStats {
  tipo: string;
  nome: string;
  icon: string;
  config: MonitoringConfig | null;
  currentExecution: MonitoringExecution | null;
  lastCompletedExecution: MonitoringExecution | null;
  todayStats: {
    executions: number;
    successful: number;
    failed: number;
    found: number;
    processed: number;
    novas?: number;
    novas_nao_lidas?: number;
    descartadas?: number;
  };
  status: MonitoringStatus;
  progress: number | null;
  elapsedSeconds: number;
}

// DJEN Termos e DJEN Processos: browser-only para evitar WORKER_LIMIT (546)
const MONITORING_TYPES = [
  { tipo: 'redistribuicoes', nome: 'Redistribuições', icon: 'RefreshCw', funcao: 'monitorar-redistribuicoes' },
  { tipo: 'andamentos', nome: 'Andamentos', icon: 'Activity', funcao: 'monitorar-andamentos' },
  { tipo: 'distribuicoes', nome: 'Distribuições', icon: 'Globe', funcao: 'monitorar-distribuicoes' },
  { tipo: 'djen', nome: 'DJEN Termos', icon: 'Newspaper', funcao: null }, // Browser-only
  { tipo: 'djen_processos', nome: 'DJEN Processos', icon: 'FileSearch', funcao: null }, // Browser-only - evita WORKER_LIMIT
  { tipo: 'termos', nome: 'Monitoração 360', icon: 'Radar', funcao: 'monitorar-termos' },
] as const;

type MonitoringDashboardOptions = {
  coordenacaoId?: string | null;
};

const getHojeBrtYmd = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '1970';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
};

const dateLocalToUTCRange = (dateStr: string, isEnd: boolean): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isEnd) {
    const nextDay = new Date(year, month - 1, day);
    nextDay.setDate(nextDay.getDate() + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T02:59:59.999Z`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00Z`;
};

export function useMonitoringDashboard(options: MonitoringDashboardOptions = {}) {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  // Mantém progresso monotônico por execução para evitar "indo e voltando"
  // quando snapshots do backend chegam fora de ordem (realtime/polling).
  const stableProgressByTipoRef = useRef(
    new Map<
      string,
      { execId: string; progress: number | null; processados: number; total: number }
    >()
  );

  const toNumber = (value: any): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const calcProgress = (current: number, total: number) => {
    if (!(total > 0) || !(current > 0)) return 0;
    return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
  };

  // Configs
  const { data: configs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ['monitoring-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, tipo, ativo, frequencia, ultima_execucao, metadata')
        .is('coordenacao_id', null);
      if (error) throw error;
      return (data || []) as MonitoringConfig[];
    },
    staleTime: 0, // Sempre buscar dados frescos para capturar status concluído
    refetchInterval: 5000, // Polling frequente para detectar finalização
  });

  // Current/recent executions (last 100)
  const { data: executions = [], refetch: refetchExecutions } = useQuery({
    queryKey: ['monitoring-executions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as MonitoringExecution[];
    },
    staleTime: 0, // Sempre buscar dados frescos - evita UI mostrando estado antigo
    refetchInterval: 5000, // Polling mais frequente para capturar finalizações
  });

  // Today's stats from executions
  const { data: todayExecutions = [] } = useQuery({
    queryKey: ['monitoring-today-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('tipo, status, registros_encontrados, registros_processados')
        .gte('created_at', today.toISOString());
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });

  // CONTADORES REAIS DO BANCO (publicações persistidas hoje)
  const { data: realDbStats = {} as Record<string, any> } = useQuery({
    queryKey: ['monitoring-real-db-stats', options.coordenacaoId ?? 'all'],
    queryFn: async () => {
      const hojeBrt = getHojeBrtYmd();
      const inicioDia = dateLocalToUTCRange(hojeBrt, false);
      const fimDia = dateLocalToUTCRange(hojeBrt, true);
      const coordenacaoId = options.coordenacaoId ?? null;

      // DJEN Termos - publicações novas hoje (DEDUPLICADAS para consistência com tela de Análise)
      // OBS: não podemos depender de tipos gerados para RPCs; usar cast para evitar bloqueio de build.
      const { data: djenStats, error: djenRpcError } = coordenacaoId
        ? await (supabase as any).rpc('count_djen_publicacoes_deduplicadas_hoje_por_coordenacao', {
            p_coordenacao_id: coordenacaoId,
          })
        : await (supabase as any).rpc('count_djen_publicacoes_deduplicadas_hoje');

      // DJEN Termos - publicações novas NÃO LIDAS hoje (DEDUPLICADAS)
      const { data: djenNaoLidasStats, error: djenNaoLidasRpcError } = coordenacaoId
        ? await (supabase as any).rpc('count_djen_publicacoes_deduplicadas_hoje_por_coordenacao_nao_lidas', {
            p_coordenacao_id: coordenacaoId,
          })
        : await (supabase as any).rpc('count_djen_publicacoes_deduplicadas_hoje_nao_lidas');

      // Fallback: se RPC falhar, manter o app funcional (mas pode voltar a contar bruto).
      let djenNovas = djenStats?.[0]?.total_unicas ?? 0;
      if (djenRpcError) {
        let q = (supabase
          .from('publicacoes_djen') as any)
          .select('id, monitoramento:monitoramentos_djen!inner(coordenacao_id)', { count: 'exact', head: true })
          .gte('created_at', inicioDia)
          .lte('created_at', fimDia);
        if (coordenacaoId) {
          q = q.eq('monitoramento.coordenacao_id', coordenacaoId);
        }
        const { count } = await q;
        djenNovas = count ?? 0;
      }

      let djenNovasNaoLidas = djenNaoLidasStats?.[0]?.total_unicas ?? 0;
      if (djenNaoLidasRpcError) {
        let q = (supabase
          .from('publicacoes_djen') as any)
          .select('id, monitoramento:monitoramentos_djen!inner(coordenacao_id)', { count: 'exact', head: true })
          .gte('created_at', inicioDia)
          .lte('created_at', fimDia)
          .eq('lida', false);
        if (coordenacaoId) {
          q = q.eq('monitoramento.coordenacao_id', coordenacaoId);
        }
        const { count } = await q;
        djenNovasNaoLidas = count ?? 0;
      }

      // DJEN Termos - descartadas hoje
      let qDescartadas = (supabase
        .from('publicacoes_djen_descartadas') as any)
        .select('id, monitoramento:monitoramentos_djen!inner(coordenacao_id)', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);
      if (coordenacaoId) {
        qDescartadas = qDescartadas.eq('monitoramento.coordenacao_id', coordenacaoId);
      }
      const { count: djenDescartadas } = await qDescartadas;

      // DJEN Processos - publicações novas hoje
      let qProcessos = (supabase
        .from('publicacoes_djen_processos') as any)
        .select('id, processos:processos!inner(coordenacao_id)', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);
      if (coordenacaoId) {
        qProcessos = qProcessos.eq('processos.coordenacao_id', coordenacaoId);
      }
      const { count: djenProcessosNovas } = await qProcessos;

      // Alertas de termos (Monitoração 360) hoje
      const { count: termosAlertas } = await supabase
        .from('alertas_monitoramento')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Distribuições encontradas hoje
      const { count: distribuicoesNovas } = await supabase
        .from('distribuicoes_encontradas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Movimentações (andamentos) hoje - EXCLUIR redistribuições
      const { count: andamentosNovos } = await supabase
        .from('movimentacoes')
        .select('*', { count: 'exact', head: true })
        .neq('tipo', 'Redistribuição')
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Redistribuições: contar movimentações do tipo 'Redistribuição' criadas hoje
      const { count: redistribuicoesNovas } = await supabase
        .from('movimentacoes')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'Redistribuição')
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      return {
        djen: { novas: djenNovas ?? 0, novas_nao_lidas: djenNovasNaoLidas ?? 0, descartadas: djenDescartadas ?? 0 },
        djen_processos: { novas: djenProcessosNovas ?? 0, descartadas: 0 },
        termos: { novas: termosAlertas ?? 0, descartadas: 0 },
        redistribuicoes: { novas: redistribuicoesNovas, descartadas: 0 },
        distribuicoes: { novas: distribuicoesNovas ?? 0, descartadas: 0 },
        andamentos: { novas: andamentosNovos ?? 0, descartadas: 0 },
      };
    },
    staleTime: 30000,
    refetchInterval: 60000, // Atualiza a cada 60s
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('monitoring-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'execucoes_agendadas' },
        () => {
          refetchExecutions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchExecutions]);

  // Real-time subscription for configuracoes_monitoramento.metadata
  // This is the primary progress source for long-running edge functions.
  useEffect(() => {
    const channel = supabase
      .channel('monitoring-configs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'configuracoes_monitoramento',
          filter: 'coordenacao_id=is.null',
        },
        () => {
          // Ensure progress updates are reflected quickly across the dashboard.
          queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
          refetchConfigs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, refetchConfigs]);

  const isStaleExecutionByMeta = useCallback(
    (e: MonitoringExecution, metadata?: Record<string, any> | null) => {
      if (!metadata) return false;
      const total = Number(metadata.total || 0);
      const current = Number(metadata.current || 0);
      const metaCompleted = total > 0 && current >= total;
      const metaStatusDone = metadata.status === 'concluido';
      if (!metaCompleted && !metaStatusDone) return false;

      const execStarted = new Date(e.iniciado_em);
      if (Number.isNaN(execStarted.getTime())) return true;

      const lastComplete = metadata.last_complete_run ? new Date(metadata.last_complete_run) : null;
      if (lastComplete && !Number.isNaN(lastComplete.getTime())) {
        return execStarted <= lastComplete;
      }

      return true;
    },
    []
  );

  // Tick for elapsed time updates
  // CORREÇÃO: Continuar atualizando o tempo enquanto houver execuções não finalizadas
  // (mesmo que o status visual seja 'timeout' após 60 minutos)
  useEffect(() => {
    const hasActiveExecution = executions.some((e) => {
      if (e.status !== 'executando' || e.finalizado_em !== null) return false;
      const cfg = configs.find((c) => c.tipo === e.tipo);
      const metadata = (cfg?.metadata as Record<string, any>) || null;
      return !isStaleExecutionByMeta(e, metadata);
    });
    if (!hasActiveExecution) return;

    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [configs, executions, isStaleExecutionByMeta]);

  // Build unified stats
  const monitoringStats: MonitoringStats[] = MONITORING_TYPES.map(({ tipo, nome, icon }) => {
    const config = configs.find(c => c.tipo === tipo) || null;
    const metadata = config?.metadata as Record<string, any> | null;
    const typeExecutions = executions.filter(e => e.tipo === tipo);
    
    // CORREÇÃO DEFINITIVA: Quando há múltiplas execuções "executando":
    // 1. Filtrar apenas as não finalizadas
    // 2. Priorizar a que TEM progresso real (registros_processados > 0 ou detalhes.progress)
    // 3. Se nenhuma tem progresso, usar a mais recente
    // Isso resolve o conflito quando uma execução órfã sem progresso existe ao lado da real.
    // CORREÇÃO DEFINITIVA: filtrar apenas as não finalizadas.
    // IMPORTANTE: Em modo 100% background a Edge Function pode falhar ao enfileirar o próximo lote,
    // deixando "status=executando" mas com "finalizado_em" preenchido. Isso precisa ser tratado
    // como finalizado (NÃO exibir como running).
    // DJEN (100% background): pode haver janela onde finalizado_em está preenchido por snapshot antigo
    // e depois a execução continua. Tratamos como ativa se houver "heartbeat" recente.
    const DJEN_ACTIVE_WINDOW_MS = 15 * 60 * 1000; // 15 min
    const isDjenFresh = (e: MonitoringExecution) => {
      if (e.finalizado_em == null) return true;
      const ts = new Date(e.finalizado_em).getTime();
      return Number.isFinite(ts) && (Date.now() - ts) < DJEN_ACTIVE_WINDOW_MS;
    };

    const activeExecutions = typeExecutions.filter((e) => {
      if (e.status !== 'executando') return false;
      if (isStaleExecutionByMeta(e, metadata)) return false;
      if (tipo === 'djen') return isDjenFresh(e);
      return e.finalizado_em === null;
    });
    
    const currentExecution = (() => {
      if (activeExecutions.length === 0) return null;
      if (activeExecutions.length === 1) return activeExecutions[0];
      
      // Múltiplas execuções ativas: priorizar a que tem progresso real
      const withProgress = activeExecutions.filter((e) => {
        // DJEN Termos: progresso por termo vem de detalhes.progress (registros_processados pode ser outra métrica)
        if (tipo === 'djen') {
          const cur = Number(e.detalhes?.progress?.current ?? 0);
          const pct = Number(e.detalhes?.progress?.percentage ?? 0);
          return (Number.isFinite(cur) && cur > 0) || (Number.isFinite(pct) && pct > 0);
        }

        const hasProcessed = (e.registros_processados ?? 0) > 0;
        const hasDetailProgress = (e.detalhes?.progress?.current ?? 0) > 0;
        return hasProcessed || hasDetailProgress;
      });
      
      if (withProgress.length > 0) {
        if (tipo === 'djen') {
          // DJEN: escolher SEMPRE o maior progresso (evita % voltar ao alternar entre snapshots/execuções)
          const score = (x: MonitoringExecution) => {
            const cur = Number(x.detalhes?.progress?.current ?? 0);
            const tot = Number(x.detalhes?.progress?.total ?? 0);
            const pct = Number(x.detalhes?.progress?.percentage ?? 0);
            const pctSafe = Number.isFinite(pct) && pct > 0 ? pct : (Number.isFinite(cur) && Number.isFinite(tot) && tot > 0 ? (cur / tot) * 100 : 0);
            const curSafe = Number.isFinite(cur) ? cur : 0;
            return { pct: pctSafe, cur: curSafe };
          };

          return withProgress.reduce((best, cur) => {
            const a = score(best);
            const b = score(cur);
            if (b.pct !== a.pct) return b.pct > a.pct ? cur : best;
            if (b.cur !== a.cur) return b.cur > a.cur ? cur : best;
            // empate: mais recente
            const bestTs = new Date(best.iniciado_em).getTime();
            const curTs = new Date(cur.iniciado_em).getTime();
            return curTs > bestTs ? cur : best;
          });
        }

        // Outros tipos: usar a mais recente entre as que têm progresso
        return withProgress.reduce((best, cur) => {
          const bestTs = new Date(best.iniciado_em).getTime();
          const curTs = new Date(cur.iniciado_em).getTime();
          return curTs > bestTs ? cur : best;
        });
      }
      
      // Nenhuma tem progresso: usar a mais recente
      return activeExecutions.reduce((best, cur) => {
        const bestTs = new Date(best.iniciado_em).getTime();
        const curTs = new Date(cur.iniciado_em).getTime();
        return curTs > bestTs ? cur : best;
      });
    })();
    
    // Considera também 'timeout' como execução finalizada
    const lastCompletedExecution = typeExecutions.find(e => 
      e.status === 'concluido' || e.status === 'falhou' || e.status === 'cancelado' || e.status === 'timeout'
    ) || null;
    
    // Verifica se há uma execução com status 'timeout' explícito no banco
    const timeoutExecution = typeExecutions.find(e => e.status === 'timeout') || null;

    const todayTypeExecs = todayExecutions.filter((e: any) => e.tipo === tipo);
    
    // USAR DADOS REAIS DO BANCO em vez de registros_encontrados das execuções
    const dbStatsForType = (realDbStats as Record<string, any>)[tipo];
    const novas = dbStatsForType?.novas ?? 0;
    const descartadas = dbStatsForType?.descartadas ?? 0;
    const novasNaoLidas = dbStatsForType?.novas_nao_lidas ?? 0;
    
    const todayStats = {
      executions: todayTypeExecs.length,
      successful: todayTypeExecs.filter((e: any) => e.status === 'concluido').length,
      failed: todayTypeExecs.filter((e: any) => e.status === 'falhou').length,
      found: novas, // USAR DADOS REAIS DO BANCO
      processed: todayTypeExecs.reduce((acc: number, e: any) => acc + (e.registros_processados || 0), 0),
      novas,
      novas_nao_lidas: novasNaoLidas,
      descartadas,
    };

    // IMPORTANTE: Verificar se há execução em andamento via metadata OU execucoes_agendadas
    // Só considera running se EXPLICITAMENTE status=em_andamento e não cancelado
    const metaStatus = metadata?.status as string | undefined;
    const metaCancelado = metadata?.cancelado === true;
    const metaPausedGlobally = metadata?.paused_globally === true;

    // Detectar execução stale (backend marcou last_stop_reason='stale')
    const metaStopReason = (metadata?.last_stop_reason as string | undefined) ?? undefined;
    // Não inferir "stale" por texto livre (isso causava alternância de status/% em cenários reais).
    const metaIsStale = metaStopReason === 'stale';
    
    // CORREÇÃO CRÍTICA: Para DJEN, verificar se a última execução já foi finalizada
    // O metadata pode ficar com status='em_andamento' mesmo após finalizar
    const lastExec = typeExecutions[0]; // Execução mais recente
    const execJaFinalizada = lastExec?.finalizado_em !== null && lastExec?.finalizado_em !== undefined;
    
    // Só considera running se status for EXATAMENTE 'em_andamento' e não cancelado/pausado
    // E se a execução correspondente ainda não foi finalizada
    const metaIsRunning =
      metaStatus === 'em_andamento' &&
      !metaCancelado &&
      !metaPausedGlobally &&
      !execJaFinalizada &&
      !metaIsStale;

    // Calculate progress - prioritize config metadata (real-time from edge function)
    // then fall back to execucoes_agendadas
    let progress: number | null = null;
    let processados = 0;
    let total = 0;

    // 1. Try config.metadata first (most accurate, updated by edge functions)
    // Nota: metadata já definido acima
    if (metadata) {
      const nextOffset = toNumber(metadata.next_offset);
      const currentOffset = toNumber(metadata.current);
      const metaTotal = toNumber(metadata.total);
      const metaPercentage = toNumber(metadata.percentage);

      // Se houver percentage do backend, validar coerência com current/total.
      if (metaPercentage !== null && metaPercentage >= 0) {
        const basis = nextOffset !== null ? nextOffset : currentOffset;
        if (metaTotal !== null && metaTotal > 0 && basis !== null) {
          const expected = Math.round((basis / metaTotal) * 100);
          const delta = Math.abs(metaPercentage - expected);
          if (delta <= 2) {
            progress = metaPercentage;
          }
        } else if (metaTotal !== null && metaTotal > 0) {
          progress = metaPercentage;
        }
      }

      if (nextOffset !== null) processados = nextOffset;
      else if (currentOffset !== null) processados = currentOffset;

      if (metaTotal !== null && metaTotal > 0) total = metaTotal;

      // If we have current/total, compute a correct percentage (fixes “0% com 1550/3427”).
      if (total > 0 && processados > 0 && (progress === null || progress === 0)) {
        progress = calcProgress(processados, total);
      }
    }

    // 2. Fall back to execucoes_agendadas.detalhes.progress
    const exec = currentExecution || lastCompletedExecution;
    if (exec) {
      const detalhesTotal = toNumber(exec.detalhes?.progress?.total);
      const detalhesCurrent = toNumber(exec.detalhes?.progress?.current);
      // Para distribuições, o worker usa tribunaisProcessados como total
      const tribunaisProcessados = toNumber(exec.detalhes?.tribunaisProcessados);

      // Override with exec values if config didn't have them
      if (processados === 0 && exec.registros_processados > 0) {
        processados = exec.registros_processados;
      }

      // If registros_processados isn't being updated, fallback to detalhes.progress.current
      if (processados === 0 && detalhesCurrent !== null && detalhesCurrent > 0) {
        processados = detalhesCurrent;
      }
      
      if (progress === null) {
        if (exec.total_lotes && exec.total_lotes > 0) {
          progress = Math.min(100, Math.round((exec.lotes_processados / exec.total_lotes) * 100));
          if (total === 0) total = exec.total_lotes;
        } else if (exec.detalhes?.percentage) {
          progress = exec.detalhes.percentage;
        } else if (exec.detalhes?.progress?.percentage) {
          progress = exec.detalhes.progress.percentage;
        }
        
        // Get total from detalhes if not set
        if (total === 0 && detalhesTotal !== null && detalhesTotal > 0) {
          total = detalhesTotal;
        }
        
        // Para distribuições: usar tribunaisProcessados como total se não houver outro
        if (total === 0 && tribunaisProcessados !== null && tribunaisProcessados > 0) {
          total = tribunaisProcessados;
        }
      }

      // Final safety: compute percentage from current/total if still missing or stuck at 0
      if (total > 0 && processados > 0 && (progress === null || progress === 0)) {
        progress = calcProgress(processados, total);
      }
    }

    // NORMALIZAÇÃO: se já processou tudo, progresso deve ser 100%
    // (evita ficar preso em percentuais antigos vindos de metadata.percentage)
    if (total > 0 && processados >= total) {
      progress = 100;
    }

    // Nunca considerar 100% se não há total conhecido
    const progressComplete = total > 0 && (progress === 100 || processados >= total);

    // Determine status (após calcular progresso)
    let status: MonitoringStatus = 'idle';
    let elapsedSeconds = 0;

    if (currentExecution) {
      const started = new Date(currentExecution.iniciado_em);
      const now = new Date();
      elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);

      const execProgress = getExecutionProgress({
        detalhes: currentExecution.detalhes,
        registros_processados: currentExecution.registros_processados,
        total_lotes: currentExecution.total_lotes,
        lotes_processados: currentExecution.lotes_processados,
      });
      const hasAnyProgress =
        (currentExecution.registros_processados ?? 0) > 0 ||
        (currentExecution.detalhes?.progress?.current ?? 0) > 0 ||
        execProgress.percentage > 0 ||
        (progress ?? 0) > 0;
      const isStuckNoProgress = !hasAnyProgress && elapsedSeconds > 300;

      if (progressComplete) {
        // Enquanto há execução ativa, mantém "running" mesmo em 100%
        status = 'running';
      } else if (metaCancelado || metaStatus === 'cancelado') {
        status = 'cancelled';
      } else if (isStuckNoProgress) {
        status = 'idle';
        elapsedSeconds = 0;
      } else if (elapsedSeconds > 14400) {
        status = 'timeout';
      } else {
        // Se há execução ativa e não completou, sempre "running"
        status = 'running';
      }
    } else if (metaIsRunning) {
      status = 'running';
      if (config?.ultima_execucao) {
        const started = new Date(config.ultima_execucao);
        const now = new Date();
        elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);
        if (elapsedSeconds > 14400) {
          status = 'timeout';
        }
      }
    } else if (metaIsStale) {
      status = 'timeout';
      if (config?.ultima_execucao) {
        const started = new Date(config.ultima_execucao);
        const now = new Date();
        elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);
      }
    } else if (timeoutExecution) {
      status = 'timeout';
      if (timeoutExecution.iniciado_em && timeoutExecution.finalizado_em) {
        const started = new Date(timeoutExecution.iniciado_em);
        const finished = new Date(timeoutExecution.finalizado_em);
        elapsedSeconds = Math.round((finished.getTime() - started.getTime()) / 1000);
      } else if (timeoutExecution.iniciado_em) {
        const started = new Date(timeoutExecution.iniciado_em);
        const now = new Date();
        elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);
      }
    } else if (lastCompletedExecution) {
      if (lastCompletedExecution.status === 'falhou') status = 'failed';
      else if (lastCompletedExecution.status === 'cancelado') status = 'cancelled';
      else if (lastCompletedExecution.status === 'timeout') status = 'timeout';
      else if (progressComplete) status = 'completed';

      if (lastCompletedExecution.iniciado_em && lastCompletedExecution.finalizado_em) {
        const started = new Date(lastCompletedExecution.iniciado_em);
        const finished = new Date(lastCompletedExecution.finalizado_em);
        elapsedSeconds = Math.round((finished.getTime() - started.getTime()) / 1000);
      }
    } else if (metaStatus === 'cancelado') {
      status = 'cancelled';
    } else if (metaStatus === 'erro') {
      status = 'failed';
    } else if (metaStatus === 'timeout') {
      status = 'timeout';
    } else if (progressComplete) {
      status = 'completed';
    }

    const hasActiveSignal = !!currentExecution || metaIsRunning;

    // Só marcar como concluído quando o progresso realmente chegou a 100%
    // e não há execução ativa sinalizada.
    if (progressComplete && !currentExecution && !metaIsRunning) {
      status = 'completed';
    } else if (status === 'completed') {
      // Se o banco diz "concluído" mas o progresso não chegou a 100, tratar como running/idle.
      status = hasActiveSignal ? 'running' : 'idle';
    }

    // Se a execução está concluída, garantir 100% quando houver total conhecido.
    // Para tipos sem total estruturado (distribuições), mostrar 100% se concluído
    if (status === 'completed' && progressComplete) {
      if (total > 0) {
        progress = 100;
      } else if (processados > 0) {
        // Execução concluída com processados mas sem total = 100%
        total = processados;
        progress = 100;
      }
    }

    // Se não há total e não há progresso real, não mostre 100%
    if (total === 0 && (processados ?? 0) === 0 && (progress ?? 0) === 100) {
      progress = 0;
    }

    // Estabilização (monotônico) para status=running com executionId.
    // - Não deixa % cair
    // - Não deixa a barra sumir (progress null) durante execução
    if (status === 'running' && currentExecution?.id) {
      const key = currentExecution.id;
      const prev = stableProgressByTipoRef.current.get(tipo);

      if (prev && prev.execId === key) {
        // current/total não podem “andar para trás”
        processados = Math.max(processados, prev.processados);
        if (prev.total > 0 && total === 0) total = prev.total;
        if (total > 0 && prev.total > 0) total = Math.max(total, prev.total);

        // % também não
        if (typeof progress === 'number') {
          progress = prev.progress === null ? progress : Math.max(progress, prev.progress);
        } else {
          progress = prev.progress;
        }
      }

      // Clamp final
      if (typeof progress === 'number' && Number.isFinite(progress)) {
        progress = Math.max(0, Math.min(100, Math.round(progress)));
      }

      stableProgressByTipoRef.current.set(tipo, {
        execId: key,
        progress,
        processados,
        total,
      });
    } else {
      stableProgressByTipoRef.current.delete(tipo);
    }

    return {
      tipo,
      nome,
      icon,
      config,
      currentExecution: currentExecution ? {
        ...currentExecution,
        // Enhance with metadata values for display
        registros_processados: processados > currentExecution.registros_processados ? processados : currentExecution.registros_processados,
      } : null,
      lastCompletedExecution,
      todayStats,
      status,
      progress,
      elapsedSeconds,
    };
  });

  const hasRunningJobs = monitoringStats.some(s => s.status === 'running');

  // Execute monitoring via orchestrator
  const executeMonitoring = useCallback(async (
    tipo: string,
    options?: ExecuteMonitoringOptions
  ): Promise<ExecuteMonitoringResult> => {
    const monitoringType = MONITORING_TYPES.find(t => t.tipo === tipo);
    if (!monitoringType) throw new Error('Tipo inválido');

    // DJEN Termos usa busca direta - redirecionar para aba DJEN
    if (tipo === 'djen') {
      return {
        execucaoId: null,
        success: false,
        useDireta: true,
        message: 'DJEN Termos usa busca direta. Acesse a aba "DJEN" para executar.',
      };
    }

    // Use orchestrator to prevent WORKER_LIMIT
    const invokePromise = supabase.functions.invoke('executar-monitoramento', {
      body: { tipo, retomar: options?.retomar === true },
    });
    const timeoutMs = 15000;
    const timeoutPromise = new Promise<{ data: any; error: null }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: {
            success: true,
            timeout: true,
            background: true,
            message: 'Início em background. Acompanhe o progresso no painel.',
          },
          error: null,
        });
      }, timeoutMs);
    });
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

    if (error) throw error;
    
    // Invalidate configs to get fresh metadata
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    refetchExecutions();

    return {
      execucaoId: data?.execucaoId || null,
      ...(data || {}),
    };
  }, [queryClient, refetchExecutions]);

  // Cancel monitoring
  const cancelMonitoring = useCallback(async (tipo: string) => {
    // 1. Update config metadata
    const config = configs.find(c => c.tipo === tipo);
    if (config) {
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(config.metadata || {}),
            cancelado: true,
            status: 'cancelado',
            continuingRun: false,
            cancelled_at: new Date().toISOString(),
          },
        })
        .eq('id', config.id);
    }

    // 2. Cancel all running executions of this type
    await supabase
      .from('execucoes_agendadas')
      .update({
        status: 'cancelado',
        finalizado_em: new Date().toISOString(),
      })
      .eq('tipo', tipo)
      .eq('status', 'executando');

    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    refetchExecutions();
  }, [configs, queryClient, refetchExecutions]);

  // Refetch "global" usado pelo dashboard (inclui contadores deduplicados)
  const refetchAll = useCallback(async () => {
    // Invalidate
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-today-stats'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-real-db-stats'] });

    // Refetch ativo (força atualização imediata do que está montado)
    await Promise.all([
      refetchConfigs(),
      refetchExecutions(),
      queryClient.refetchQueries({ queryKey: ['monitoring-today-stats'], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['monitoring-real-db-stats'], type: 'active' }),
    ]);
  }, [queryClient, refetchConfigs, refetchExecutions]);

  return {
    monitoringStats,
    monitoringTypes: MONITORING_TYPES,
    hasRunningJobs,
    executeMonitoring,
    cancelMonitoring,
    refetch: refetchAll,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDateTime(date: string | null): string {
  if (!date) return 'Nunca';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return 'Data inválida';
  }
}
