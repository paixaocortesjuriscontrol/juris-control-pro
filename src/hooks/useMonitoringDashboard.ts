import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback, useState } from "react";

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
    descartadas?: number;
  };
  status: MonitoringStatus;
  progress: number | null;
  elapsedSeconds: number;
}

const MONITORING_TYPES = [
  { tipo: 'redistribuicoes', nome: 'Redistribuições', icon: 'RefreshCw', funcao: 'monitorar-redistribuicoes' },
  { tipo: 'andamentos', nome: 'Andamentos', icon: 'Activity', funcao: 'monitorar-andamentos' },
  { tipo: 'distribuicoes', nome: 'Distribuições', icon: 'Globe', funcao: 'monitorar-distribuicoes' },
  { tipo: 'djen', nome: 'DJEN (Termos)', icon: 'Newspaper', funcao: 'monitorar-djen' },
  { tipo: 'djen_processos', nome: 'DJEN Processos', icon: 'FileSearch', funcao: 'monitorar-djen-processos' },
  { tipo: 'termos', nome: 'Monitoração 360', icon: 'Radar', funcao: 'monitorar-termos' },
] as const;

export function useMonitoringDashboard() {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

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
    staleTime: 60000,
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
    staleTime: 5000,
    refetchInterval: 10000,
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
    queryKey: ['monitoring-real-db-stats'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString();
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();

      // DJEN Termos - publicações novas hoje
      const { count: djenNovas } = await supabase
        .from('publicacoes_djen')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // DJEN Termos - descartadas hoje
      const { count: djenDescartadas } = await supabase
        .from('publicacoes_djen_descartadas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // DJEN Processos - publicações novas hoje
      const { count: djenProcessosNovas } = await supabase
        .from('publicacoes_djen_processos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

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

      // Movimentações (andamentos) hoje
      const { count: andamentosNovos } = await supabase
        .from('movimentacoes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Historico monitoramento para redistribuições (usa novos_andamentos como campo de contagem)
      const { data: redistribuicoesData } = await supabase
        .from('historico_monitoramento')
        .select('novos_andamentos')
        .eq('tipo', 'redistribuicoes')
        .gte('executado_em', inicioDia)
        .lte('executado_em', fimDia);

      const redistribuicoesNovas = redistribuicoesData?.reduce((acc, h) => acc + (h.novos_andamentos || 0), 0) || 0;

      return {
        djen: { novas: djenNovas ?? 0, descartadas: djenDescartadas ?? 0 },
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

  // Tick for elapsed time updates
  useEffect(() => {
    const hasRunning = executions.some(e => e.status === 'executando');
    if (!hasRunning) return;

    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [executions]);

  // Build unified stats
  const monitoringStats: MonitoringStats[] = MONITORING_TYPES.map(({ tipo, nome, icon }) => {
    const config = configs.find(c => c.tipo === tipo) || null;
    const metadata = config?.metadata as Record<string, any> | null;
    const typeExecutions = executions.filter(e => e.tipo === tipo);
    
    // CORREÇÃO: Só considerar "ativo" se status=executando E finalizado_em=null
    const currentExecution = typeExecutions.find(e => 
      e.status === 'executando' && e.finalizado_em === null
    ) || null;
    
    const lastCompletedExecution = typeExecutions.find(e => 
      e.status === 'concluido' || e.status === 'falhou' || e.status === 'cancelado' || e.status === 'timeout'
    ) || null;

    const todayTypeExecs = todayExecutions.filter((e: any) => e.tipo === tipo);
    
    // USAR DADOS REAIS DO BANCO em vez de registros_encontrados das execuções
    const dbStatsForType = (realDbStats as Record<string, any>)[tipo];
    const novas = dbStatsForType?.novas ?? 0;
    const descartadas = dbStatsForType?.descartadas ?? 0;
    
    const todayStats = {
      executions: todayTypeExecs.length,
      successful: todayTypeExecs.filter((e: any) => e.status === 'concluido').length,
      failed: todayTypeExecs.filter((e: any) => e.status === 'falhou').length,
      found: novas, // USAR DADOS REAIS DO BANCO
      processed: todayTypeExecs.reduce((acc: number, e: any) => acc + (e.registros_processados || 0), 0),
      novas,
      descartadas,
    };

    // IMPORTANTE: Verificar se há execução em andamento via metadata OU execucoes_agendadas
    // Só considera running se EXPLICITAMENTE status=em_andamento e não cancelado
    const metaStatus = metadata?.status as string | undefined;
    const metaCancelado = metadata?.cancelado === true;
    const metaPausedGlobally = metadata?.paused_globally === true;
    // Só considera running se status for EXATAMENTE 'em_andamento' e não cancelado/pausado
    const metaIsRunning = metaStatus === 'em_andamento' && !metaCancelado && !metaPausedGlobally;

    // Determine status
    let status: MonitoringStatus = 'idle';
    let elapsedSeconds = 0;

    if (currentExecution) {
      const started = new Date(currentExecution.iniciado_em);
      const now = new Date();
      elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);
      
      if (elapsedSeconds > 3600) { // 60 minutes
        status = 'timeout';
      } else {
        status = 'running';
      }
    } else if (metaIsRunning) {
      // Execução manual em andamento (detectada via metadata, sem registro em execucoes_agendadas)
      status = 'running';
      // Tentar calcular tempo decorrido desde ultima_execucao
      if (config?.ultima_execucao) {
        const started = new Date(config.ultima_execucao);
        const now = new Date();
        elapsedSeconds = Math.round((now.getTime() - started.getTime()) / 1000);
      }
    } else if (lastCompletedExecution) {
      if (lastCompletedExecution.status === 'concluido') status = 'completed';
      else if (lastCompletedExecution.status === 'falhou') status = 'failed';
      else if (lastCompletedExecution.status === 'cancelado') status = 'cancelled';
    } else if (metaStatus === 'concluido') {
      status = 'completed';
    }

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

      // If the edge function provides a percentage, accept it (including 0).
      if (metaPercentage !== null && metaPercentage >= 0) {
        progress = metaPercentage;
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

    // Se a execução está concluída, garantir 100% quando houver total conhecido.
    if (status === 'completed' && total > 0) {
      progress = 100;
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
  const executeMonitoring = useCallback(async (tipo: string): Promise<ExecuteMonitoringResult> => {
    const monitoringType = MONITORING_TYPES.find(t => t.tipo === tipo);
    if (!monitoringType) throw new Error('Tipo inválido');

    // Use orchestrator to prevent WORKER_LIMIT
    const { data, error } = await supabase.functions.invoke('executar-monitoramento', {
      body: { tipo },
    });

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

  return {
    monitoringStats,
    monitoringTypes: MONITORING_TYPES,
    hasRunningJobs,
    executeMonitoring,
    cancelMonitoring,
    refetch: refetchExecutions,
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
