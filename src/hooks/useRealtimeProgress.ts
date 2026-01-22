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

    if (execProgress && typeof execProgress.current === 'number') {
      current = execProgress.current;
      total = execProgress.total ?? 0;
      novas = execucao?.registros_encontrados ?? metadata?.novas ?? 0;
    } else if (metadata) {
      current = metadata.current ?? metadata.next_offset ?? 0;
      total = metadata.total ?? metadata.totalProcessos ?? 0;
      novas = metadata.novas ?? metadata.last_batch_novas ?? 0;
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
            if (prev.isRunning && !newProgress.isRunning && onComplete) {
              onComplete(newProgress);
            }
            return newProgress;
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
            if (prev.isRunning && !newProgress.isRunning && onComplete) {
              onComplete(newProgress);
            }
            return newProgress;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tipo, enabled, fetchProgress, onComplete, queryClient]);

  // Polling como fallback (a cada 3s quando running)
  useEffect(() => {
    if (!enabled || !progress.isRunning) return;

    const interval = setInterval(async () => {
      const newProgress = await fetchProgress();
      setProgress((prev) => {
        if (prev.isRunning && !newProgress.isRunning && onComplete) {
          onComplete(newProgress);
        }
        return newProgress;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, progress.isRunning, fetchProgress, onComplete]);

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
