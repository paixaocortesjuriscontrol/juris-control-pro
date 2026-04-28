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
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
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
      if (!isDjenTermosParalelaRunning()) {
        void hydrateDjenTermosParalelaFromBackend();
      }
    }, 30_000);

    return () => {
      unsub();
      clearInterval(intv);
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

  const cancelar = useCallback(() => cancelarDjenTermosParalela(), []);
  const limpar = useCallback(() => limparEstadoDjenTermosParalela(), []);
  const forceKill = useCallback((clearCheckpoint = false) => {
    forceKillDjenTermosParalela(clearCheckpoint);
    toast.success(clearCheckpoint ? 'Paralela finalizada e checkpoint limpo' : 'Paralela parada.');
  }, []);

  const resetTotal = useCallback(() => {
    resetTotalDjenTermosParalela();
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