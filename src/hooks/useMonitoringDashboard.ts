import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback, useState } from "react";

export type MonitoringStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

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

  // Today's stats
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
    const typeExecutions = executions.filter(e => e.tipo === tipo);
    const currentExecution = typeExecutions.find(e => e.status === 'executando') || null;
    const lastCompletedExecution = typeExecutions.find(e => 
      e.status === 'concluido' || e.status === 'falhou' || e.status === 'cancelado'
    ) || null;

    const todayTypeExecs = todayExecutions.filter((e: any) => e.tipo === tipo);
    const todayStats = {
      executions: todayTypeExecs.length,
      successful: todayTypeExecs.filter((e: any) => e.status === 'concluido').length,
      failed: todayTypeExecs.filter((e: any) => e.status === 'falhou').length,
      found: todayTypeExecs.reduce((acc: number, e: any) => acc + (e.registros_encontrados || 0), 0),
      processed: todayTypeExecs.reduce((acc: number, e: any) => acc + (e.registros_processados || 0), 0),
    };

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
    } else if (lastCompletedExecution) {
      if (lastCompletedExecution.status === 'concluido') status = 'completed';
      else if (lastCompletedExecution.status === 'falhou') status = 'failed';
      else if (lastCompletedExecution.status === 'cancelado') status = 'cancelled';
    }

    // Calculate progress - prioritize config metadata (real-time from edge function)
    // then fall back to execucoes_agendadas
    let progress: number | null = null;
    let processados = 0;
    let total = 0;

    // 1. Try config.metadata first (most accurate, updated by edge functions)
    const metadata = config?.metadata as Record<string, any> | null;
    if (metadata) {
      const nextOffset = typeof metadata.next_offset === 'number' ? metadata.next_offset : null;
      const currentOffset = typeof metadata.current === 'number' ? metadata.current : null;
      const metaTotal = typeof metadata.total === 'number' ? metadata.total : null;
      const metaPercentage = typeof metadata.percentage === 'number' ? metadata.percentage : null;

      if (metaPercentage !== null && metaPercentage > 0) {
        progress = metaPercentage;
      }
      if (nextOffset !== null) processados = nextOffset;
      else if (currentOffset !== null) processados = currentOffset;
      if (metaTotal !== null && metaTotal > 0) total = metaTotal;
      
      // Recalculate percentage if we have total but no percentage
      if (progress === null && total > 0 && processados > 0) {
        progress = Math.min(100, Math.round((processados / total) * 100));
      }
    }

    // 2. Fall back to execucoes_agendadas.detalhes.progress
    const exec = currentExecution || lastCompletedExecution;
    if (exec) {
      // Override with exec values if config didn't have them
      if (processados === 0 && exec.registros_processados > 0) {
        processados = exec.registros_processados;
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
        if (total === 0 && exec.detalhes?.progress?.total) {
          total = exec.detalhes.progress.total;
        }
      }
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

  // Execute monitoring
  const executeMonitoring = useCallback(async (tipo: string): Promise<string | null> => {
    const monitoringType = MONITORING_TYPES.find(t => t.tipo === tipo);
    if (!monitoringType) throw new Error('Tipo inválido');

    // IMPORTANT: Clear cancelado flag and reset metadata BEFORE creating execution
    // This prevents "early cancellation" from leftover flags
    const config = configs.find(c => c.tipo === tipo);
    if (config) {
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(config.metadata || {}),
            next_offset: 0,
            current: 0,
            total: 0,
            percentage: 0,
            cancelado: false,
            status: 'em_andamento',
            continuingRun: true,
          },
        })
        .eq('id', config.id);
    }

    // Create execution record
    const { data: execution, error } = await supabase
      .from('execucoes_agendadas')
      .insert({
        tipo,
        job_name: `manual-${monitoringType.funcao}`,
        status: 'executando',
        iniciado_em: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    const execucaoId = execution?.id;

    // Fire and forget - background execution
    supabase.functions.invoke(monitoringType.funcao, {
      body: { completeRun: true, execucaoId },
    }).catch(err => {
      console.error(`Error in ${tipo}:`, err);
    });

    // Invalidate configs to get fresh metadata
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    refetchExecutions();
    return execucaoId;
  }, [configs, queryClient, refetchExecutions]);

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
