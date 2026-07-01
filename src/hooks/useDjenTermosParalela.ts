/**
 * Hook React para o DJEN Termos Paralela Engine.
 * Wrapper reativo do singleton.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type DjenTermosParalelaProgress,
  executarDjenTermosParalela,
  cancelarDjenTermosParalela,
  limparEstadoDjenTermosParalela,
  forceKillDjenTermosParalela,
  resetTotalDjenTermosParalela,
  getDjenTermosParalelaProgress,
  isDjenTermosParalelaRunning,
  getCheckpointParalela,
  subscribeDjenTermosParalela,
  hydrateDjenTermosParalelaFromBackend,
} from './useDjenTermosParalelaEngine';

export type { DjenTermosParalelaProgress };

export function useDjenTermosParalela() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DjenTermosParalelaProgress>(getDjenTermosParalelaProgress);
  const [isRunning, setIsRunning] = useState(isDjenTermosParalelaRunning);
  const lastNotifiedStatusRef = useRef<string>(getDjenTermosParalelaProgress().status);
  // Marca a última conclusão já tratada para evitar notificações repetidas
  // quando a UI reidrata execuções finalizadas via polling/outra aba.
  const COMPLETION_HANDLED_KEY = 'djen-paralela:last-completion-handled-iniciado-em';
  const lastCompletionHandledRef = useRef<string | null>(
    typeof window !== 'undefined' ? window.localStorage.getItem(COMPLETION_HANDLED_KEY) : null,
  );

  useEffect(() => {
    const unsub = subscribeDjenTermosParalela((p) => {
      setProgress((current) => {
        if (current.status === 'executando' && p.status === 'executando') {
          return {
            ...p,
            percentage: Math.max(current.percentage || 0, p.percentage || 0),
            tempoDecorrido: Math.max(current.tempoDecorrido || 0, p.tempoDecorrido || 0),
            tribunaisConcluidos: Math.max(current.tribunaisConcluidos || 0, p.tribunaisConcluidos || 0),
          };
        }
        return p;
      });
      setIsRunning(isDjenTermosParalelaRunning());
      const prevStatus = lastNotifiedStatusRef.current;
      const statusChanged = prevStatus !== p.status;
      lastNotifiedStatusRef.current = p.status;
      // Trata conclusão da Paralela. Aceita dois cenários:
      //  (a) transição local 'executando' → 'concluido' nesta sessão;
      //  (b) hidratação trouxe uma execução nova (iniciadoEm diferente da última
      //      já tratada), o que cobre cron/scheduler/outra aba.
      const iniciadoEmKey = p.iniciadoEm ?? null;
      const isNewCompletedRun =
        p.status === 'concluido' &&
        !!iniciadoEmKey &&
        iniciadoEmKey !== lastCompletionHandledRef.current;
      const shouldHandleCompletion =
        p.status === 'concluido' &&
        ((statusChanged && prevStatus === 'executando') || isNewCompletedRun);
      if (shouldHandleCompletion) {
        lastCompletionHandledRef.current = iniciadoEmKey;
        if (iniciadoEmKey && typeof window !== 'undefined') {
          try { window.localStorage.setItem(COMPLETION_HANDLED_KEY, iniciadoEmKey); } catch {}
        }
        void (async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] }),
            queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
            queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] }),
            queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats-header'] }),
            queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] }),
          ]);
          // Atualiza estatísticas dos índices DJEN (data_disponibilizacao + coordenacao_id)
          // para que as próximas consultas usem o plano otimizado. Best-effort.
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            await (supabase as any).rpc('analyze_publicacoes_djen');
          } catch (e) {
            console.warn('[DJEN Paralela] Falha ao atualizar estatísticas (ANALYZE):', e);
          }
          if (p.novas > 0) toast.success(`DJEN Paralela: ${p.novas} novas publicações encontradas!`);
        })();
      }
      if (p.status === 'erro' && statusChanged) toast.error(p.mensagem || 'Erro DJEN Paralela');
    });

    // Reidrata visual a partir da última execução agendada (cron/scheduler).
    // Necessário porque o estado vive em memória + localStorage do navegador,
    // então execuções automáticas não aparecem na UI até esta hidratação.
    void hydrateDjenTermosParalelaFromBackend();
    const intv = setInterval(() => {
      // Mantém em sincronia caso a Paralela seja iniciada por outra aba/scheduler
      void hydrateDjenTermosParalelaFromBackend();
    }, 5_000);

    const clockIntv = setInterval(() => {
      setProgress((current) => {
        if (current.status !== 'executando') return current;
        const startedAt = current.iniciadoEm ? new Date(current.iniciadoEm).getTime() : 0;
        const nextTempo = startedAt > 0
          ? Math.floor(Math.max(0, Date.now() - startedAt) / 1000)
          : current.tempoDecorrido + 1;
        return {
          ...current,
          tempoDecorrido: Math.max(current.tempoDecorrido || 0, nextTempo),
        };
      });
      setIsRunning(isDjenTermosParalelaRunning());
    }, 1_000);

    return () => {
      unsub();
      clearInterval(intv);
      clearInterval(clockIntv);
    };
  }, [queryClient]);

  const checkpoint = getCheckpointParalela();
  const canResume = !!checkpoint && progress.status !== 'executando';

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string, coordenacaoId?: string, monitoramentoIds?: string[]) => {
    executarDjenTermosParalela(dataInicioYmd, dataFimYmd, false, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Termos Paralela iniciado');
  }, []);

  const retomar = useCallback((coordenacaoId?: string, monitoramentoIds?: string[]) => {
    if (!checkpoint) return;
    executarDjenTermosParalela(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Paralela retomando...');
  }, [checkpoint]);

  const cancelar = useCallback(async () => {
    await cancelarDjenTermosParalela();
    toast.info('DJEN Paralela cancelada.');
  }, []);
  const limpar = useCallback(() => limparEstadoDjenTermosParalela(), []);
  const forceKill = useCallback(async (clearCheckpoint = false) => {
    await forceKillDjenTermosParalela(clearCheckpoint);
    toast.success(clearCheckpoint ? 'Paralela finalizada e checkpoint limpo' : 'Paralela parada.');
  }, []);

  const resetTotal = useCallback(async () => {
    await resetTotalDjenTermosParalela();
    toast.success('Reset Total: estado, checkpoint, execuções órfãs e stats foram limpos.');
  }, []);

  return {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    limpar,
    forceKill,
    resetTotal,
  };
}