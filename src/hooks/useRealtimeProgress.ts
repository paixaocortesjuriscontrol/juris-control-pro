import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeProgress {
  current: number;
  total: number;
  percentage: number;
  novas?: number;
  descartadas?: number;
  status?: string;
  isRunning: boolean;
  lastUpdate?: Date;
  /** Identificador da execução corrente (quando vindo de execucoes_agendadas). */
  executionId?: string;
  /** Timestamp de início da execução (quando disponível). */
  startedAt?: string;
  /** Fonte principal usada para calcular o progresso (debug/observabilidade). */
  source?: 'execucao' | 'metadata' | 'none';
}

interface UseRealtimeProgressOptions {
  tipo: string;
  enabled?: boolean;
  onComplete?: (finalProgress: RealtimeProgress) => void;
}

/**
 * Hook unificado para acompanhar progresso de monitoramentos em tempo real.
 * Combina dados de `configuracoes_monitoramento.metadata` e `execucoes_agendadas`.
 * 
 * IMPORTANTE: Implementa normalização monotônica para evitar regressão de progresso
 * quando as fontes de dados oscilam ou chegam em ordem diferente.
 */
export function useRealtimeProgress({
  tipo,
  enabled = true,
  onComplete,
}: UseRealtimeProgressOptions) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<RealtimeProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    isRunning: false,
  });

  // Referência para guardar o maior progresso visto durante a execução atual
  const maxProgressRef = useRef<{ current: number; total: number; percentage: number; executionId?: string }>({
    current: 0,
    total: 0,
    percentage: 0,
  });

  // Função para extrair progresso de múltiplas fontes
  const extractProgress = useCallback((
    metadata: Record<string, any> | null,
    execucao: Record<string, any> | null
  ): RealtimeProgress => {
    // Primeiro verifica execucao (mais atualizado durante execução)
    const execProgress = execucao?.detalhes?.progress;
    const metaStatus = metadata?.status as string | undefined;
    const cancelado = metadata?.cancelado === true;
    
    // Determina se está rodando com base nas duas fontes
    const execStatus = execucao?.status;
    const hasActiveExec = execStatus === 'executando' && !execucao?.finalizado_em;
    const metaRunning = metaStatus === 'em_andamento' && !cancelado;
    const isRunning = hasActiveExec || metaRunning;

    // Usa progresso da execução se disponível, senão do metadata
    let current = 0;
    let total = 0;
    let novas = 0;
    let source: RealtimeProgress['source'] = 'none';

    if (execProgress && typeof execProgress.current === 'number') {
      current = execProgress.current;
      total = execProgress.total ?? 0;
      novas = execucao?.registros_encontrados ?? metadata?.novas ?? 0;
      source = 'execucao';
    } else if (metadata) {
      current = metadata.current ?? metadata.next_offset ?? 0;
      total = metadata.total ?? metadata.totalProcessos ?? 0;
      novas = metadata.novas ?? metadata.last_batch_novas ?? 0;
      source = 'metadata';
    }

    const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    return {
      current,
      total,
      percentage,
      novas,
      descartadas: metadata?.descartadas,
      status: isRunning ? 'em_andamento' : (metaStatus || execStatus),
      isRunning,
      lastUpdate: new Date(),
      executionId: execucao?.id,
      startedAt: execucao?.iniciado_em,
      source,
    };
  }, []);

  // Normaliza para NÃO regredir durante a MESMA execução.
  // Isso evita o efeito "5% voltou para 4%" quando a UI alterna entre
  // fontes (execucao vs metadata) ou quando total/current chegam em ordem diferente.
  const normalizeMonotonic = useCallback((
    prev: RealtimeProgress,
    next: RealtimeProgress
  ): RealtimeProgress => {
    const maxRef = maxProgressRef.current;
    
    // Se identificador mudou, é uma nova execução -> resetar referência e permitir reset
    const prevId = prev.executionId || maxRef.executionId;
    const nextId = next.executionId;
    const isNewExecution = nextId && prevId && nextId !== prevId;
    
    if (isNewExecution) {
      // Nova execução: resetar referência
      maxProgressRef.current = {
        current: next.current,
        total: next.total,
        percentage: next.percentage,
        executionId: nextId,
      };
      return next;
    }

    // Atualiza referência com o executionId atual
    if (nextId && !maxRef.executionId) {
      maxRef.executionId = nextId;
    }

    // Se nenhum está rodando E current é zero, é um reset legítimo (início de nova execução)
    if (!prev.isRunning && !next.isRunning && next.current === 0 && prev.current === 0) {
      maxProgressRef.current = { current: 0, total: 0, percentage: 0 };
      return next;
    }

    // CORREÇÃO PRINCIPAL: Sempre aplica monotonicidade se houve algum progresso
    // Usa a referência máxima para garantir que nunca regride
    const stableTotal = Math.max(maxRef.total, prev.total, next.total);
    const stableCurrent = Math.max(maxRef.current, prev.current, next.current);
    
    // Recalcula % com base em valores estabilizados
    const computedPct = stableTotal > 0
      ? Math.min(100, Math.round((stableCurrent / stableTotal) * 100))
      : next.percentage;

    const stablePct = Math.max(maxRef.percentage, prev.percentage, computedPct, next.percentage);

    // Atualiza a referência máxima
    maxProgressRef.current = {
      current: stableCurrent,
      total: stableTotal,
      percentage: stablePct,
      executionId: nextId || prevId,
    };

    // Preserva isRunning como true se ainda há progresso a fazer
    const stableIsRunning = next.isRunning || (prev.isRunning && stableCurrent < stableTotal);

    return {
      ...next,
      current: stableCurrent,
      total: stableTotal,
      percentage: stablePct,
      isRunning: stableIsRunning,
    };
  }, []);

  // Reset manual da referência quando o componente inicia uma nova busca
  const resetMaxProgress = useCallback(() => {
    maxProgressRef.current = { current: 0, total: 0, percentage: 0 };
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      isRunning: false,
    });
  }, []);

  // Fetch inicial combinando ambas as fontes
  const fetchProgress = useCallback(async () => {
    const [configResult, execResult] = await Promise.all([
      supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle(),
      supabase
        .from('execucoes_agendadas')
        .select('*')
        .eq('tipo', tipo)
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const metadata = configResult.data?.metadata as Record<string, any> | null;
    const execucao = execResult.data as Record<string, any> | null;
    
    return extractProgress(metadata, execucao);
  }, [tipo, extractProgress]);

  // Fetch inicial
  useEffect(() => {
    if (!enabled) return;
    fetchProgress().then((newProgress) => {
      // Inicializa a referência máxima com os valores iniciais
      maxProgressRef.current = {
        current: newProgress.current,
        total: newProgress.total,
        percentage: newProgress.percentage,
        executionId: newProgress.executionId,
      };
      setProgress(newProgress);
    });
  }, [enabled, fetchProgress]);

  // Realtime subscription para configuracoes_monitoramento
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`realtime-progress-${tipo}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'configuracoes_monitoramento',
          filter: `tipo=eq.${tipo}`,
        },
        async () => {
          // Refetch completo para ter dados consistentes
          const newProgress = await fetchProgress();
          
          setProgress((prev) => {
            const normalized = normalizeMonotonic(prev, newProgress);
            if (prev.isRunning && !normalized.isRunning && onComplete) {
              onComplete(normalized);
            }
            return normalized;
          });

          queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
          queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'execucoes_agendadas',
          filter: `tipo=eq.${tipo}`,
        },
        async () => {
          const newProgress = await fetchProgress();
          
          setProgress((prev) => {
            const normalized = normalizeMonotonic(prev, newProgress);
            if (prev.isRunning && !normalized.isRunning && onComplete) {
              onComplete(normalized);
            }
            return normalized;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tipo, enabled, fetchProgress, onComplete, queryClient, normalizeMonotonic]);

  // Polling como fallback (a cada 3s quando running)
  useEffect(() => {
    if (!enabled || !progress.isRunning) return;

    const interval = setInterval(async () => {
      const newProgress = await fetchProgress();
      setProgress((prev) => {
        const normalized = normalizeMonotonic(prev, newProgress);
        if (prev.isRunning && !normalized.isRunning && onComplete) {
          onComplete(normalized);
        }
        return normalized;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, progress.isRunning, fetchProgress, onComplete, normalizeMonotonic]);

  return {
    progress,
    reset: resetMaxProgress,
    refetch: fetchProgress,
  };
}
