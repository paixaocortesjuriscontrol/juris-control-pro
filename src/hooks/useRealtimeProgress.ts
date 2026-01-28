import { useState, useEffect, useCallback } from "react";
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
  // Isso evita o efeito “5% voltou para 4%” quando a UI alterna entre
  // fontes (execucao vs metadata) ou quando total/current chegam em ordem diferente.
  const normalizeMonotonic = useCallback((
    prev: RealtimeProgress,
    next: RealtimeProgress
  ): RealtimeProgress => {
    // Se não está rodando, não força monotonicidade.
    if (!prev.isRunning || !next.isRunning) return next;

    // Se identificador mudou, é uma nova execução -> permitir reset.
    const prevId = prev.executionId;
    const nextId = next.executionId;
    const sameRun = (prevId && nextId && prevId === nextId) || (!prevId && !nextId);
    if (!sameRun) return next;

    // Mantém total “travado” quando já conhecido, para evitar queda de % por mudança de total.
    // (Em DJEN Processos, total tende a ser estável; mudanças aqui são geralmente ruído.)
    const stableTotal = prev.total > 0 ? prev.total : next.total;

    // Current nunca deve voltar; usa o maior.
    const stableCurrent = Math.max(prev.current ?? 0, next.current ?? 0);

    // Recalcula % com base em valores estabilizados, garantindo monotonicidade.
    const computedPct = stableTotal > 0
      ? Math.min(100, Math.round((stableCurrent / stableTotal) * 100))
      : next.percentage;

    const stablePct = Math.max(prev.percentage ?? 0, computedPct ?? 0, next.percentage ?? 0);

    return {
      ...next,
      current: stableCurrent,
      total: stableTotal,
      percentage: stablePct,
    };
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
    fetchProgress().then(setProgress);
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
            if (prev.isRunning && !newProgress.isRunning && onComplete) onComplete(newProgress);
            return normalizeMonotonic(prev, newProgress);
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
            if (prev.isRunning && !newProgress.isRunning && onComplete) onComplete(newProgress);
            return normalizeMonotonic(prev, newProgress);
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
        if (prev.isRunning && !newProgress.isRunning && onComplete) onComplete(newProgress);
        return normalizeMonotonic(prev, newProgress);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, progress.isRunning, fetchProgress, onComplete, normalizeMonotonic]);

  const reset = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      isRunning: false,
    });
  }, []);

  return {
    progress,
    reset,
    refetch: fetchProgress,
  };
}
