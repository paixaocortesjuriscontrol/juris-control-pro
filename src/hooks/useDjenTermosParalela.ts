/**
 * Hook React para o DJEN Termos Paralela Engine.
 * Wrapper reativo do singleton.
 */

import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    const unsub = subscribeDjenTermosParalela((p) => {
      setProgress(p);
      setIsRunning(isDjenTermosParalelaRunning());
      if (p.status === 'concluido') {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] }),
          queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] }),
          queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats-header'] }),
          queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] }),
        ]);
        if (p.novas > 0) toast.success(`DJEN Paralela: ${p.novas} novas publicações encontradas!`);
      }
      if (p.status === 'erro') toast.error(p.mensagem || 'Erro DJEN Paralela');
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
        return {
          ...current,
          tempoDecorrido: startedAt > 0
            ? Math.floor(Math.max(0, Date.now() - startedAt) / 1000)
            : current.tempoDecorrido + 1,
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