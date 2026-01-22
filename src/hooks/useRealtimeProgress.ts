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
 * Hook para acompanhar progresso de monitoramentos em tempo real.
 * Usa subscription no Supabase para atualizar quando `configuracoes_monitoramento.metadata` muda.
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

  // Função para extrair progresso do metadata
  const extractProgress = useCallback((metadata: Record<string, any> | null): RealtimeProgress => {
    if (!metadata) {
      return { current: 0, total: 0, percentage: 0, isRunning: false };
    }

    const status = metadata.status as string | undefined;
    const cancelado = metadata.cancelado === true;
    const isRunning = status === 'em_andamento' && !cancelado;

    // Tenta múltiplas fontes de progresso
    const current = metadata.current ?? metadata.next_offset ?? metadata.processados ?? 0;
    const total = metadata.total ?? metadata.totalProcessos ?? 0;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return {
      current,
      total,
      percentage,
      novas: metadata.novas ?? metadata.last_batch_novas,
      descartadas: metadata.descartadas,
      status,
      isRunning,
      lastUpdate: new Date(),
    };
  }, []);

  // Fetch inicial
  useEffect(() => {
    if (!enabled) return;

    const fetchInitialProgress = async () => {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      if (data?.metadata) {
        const newProgress = extractProgress(data.metadata as Record<string, any>);
        setProgress(newProgress);
      }
    };

    fetchInitialProgress();
  }, [tipo, enabled, extractProgress]);

  // Realtime subscription
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
        (payload) => {
          const metadata = payload.new?.metadata as Record<string, any> | null;
          const newProgress = extractProgress(metadata);
          
          setProgress((prev) => {
            // Se estava running e agora não está mais, chamar onComplete
            if (prev.isRunning && !newProgress.isRunning && onComplete) {
              onComplete(newProgress);
            }
            return newProgress;
          });

          // Invalidar queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
          queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
          queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tipo, enabled, extractProgress, onComplete, queryClient]);

  // Também fazer polling como fallback (a cada 5s quando running)
  useEffect(() => {
    if (!enabled || !progress.isRunning) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      if (data?.metadata) {
        const newProgress = extractProgress(data.metadata as Record<string, any>);
        setProgress((prev) => {
          if (prev.isRunning && !newProgress.isRunning && onComplete) {
            onComplete(newProgress);
          }
          return newProgress;
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tipo, enabled, progress.isRunning, extractProgress, onComplete]);

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
  };
}
