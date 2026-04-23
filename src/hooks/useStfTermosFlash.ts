/**
 * Hook React para o STF Termos Flash Engine
 *
 * Wrapper reativo para o singleton do engine STF.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type StfTermosFlashProgress,
  executarStfTermosFlash,
  cancelarStfTermosFlash,
  limparEstadoStfTermosFlash,
  forceKillStfTermosFlash,
  getStfTermosFlashProgress,
  isStfTermosFlashRunning,
  getCheckpointStfFlash,
  subscribeStfTermosFlash,
} from './useStfTermosFlashEngine';

export type { StfTermosFlashProgress };

export function useStfTermosFlash() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<StfTermosFlashProgress>(getStfTermosFlashProgress);
  const [isRunning, setIsRunning] = useState(isStfTermosFlashRunning);

  useEffect(() => {
    const unsubscribe = subscribeStfTermosFlash((p) => {
      setProgress(p);
      setIsRunning(isStfTermosFlashRunning());

      if (p.status === 'concluido') {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-stf'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
        if (p.novas > 0) {
          toast.success(`STF Flash: ${p.novas} novas publicações encontradas!`);
        }
      }

      if (p.status === 'erro') {
        toast.error(p.mensagem || 'Erro na execução STF Flash');
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const checkpoint = getCheckpointStfFlash();
  const canResume = !!checkpoint && progress.status !== 'executando';

  const executar = useCallback(
    (dataInicioYmd?: string, dataFimYmd?: string, coordenacaoId?: string, monitoramentoIds?: string[]) => {
      executarStfTermosFlash(dataInicioYmd, dataFimYmd, false, coordenacaoId, monitoramentoIds);
      toast.info('STF Termos Flash iniciado');
    },
    [],
  );

  const retomar = useCallback(
    (coordenacaoId?: string, monitoramentoIds?: string[]) => {
      if (!checkpoint) return;
      executarStfTermosFlash(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, coordenacaoId, monitoramentoIds);
      toast.info('STF Termos Flash retomando...');
    },
    [checkpoint],
  );

  const cancelar = useCallback(() => cancelarStfTermosFlash(), []);
  const limpar = useCallback(() => limparEstadoStfTermosFlash(), []);
  const forceKill = useCallback((clearCheckpoint = false) => {
    forceKillStfTermosFlash(clearCheckpoint);
    toast.success(clearCheckpoint
      ? 'STF Flash finalizado e checkpoint limpo'
      : 'STF Flash parado. Use Executar para retomar.');
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
  };
}