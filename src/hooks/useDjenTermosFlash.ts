/**
 * Hook React para o DJEN Termos Flash Engine
 * 
 * Wrapper reativo para o singleton do engine Pro.
 * Independente do useDjenTermos original.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type DjenTermosFlashProgress,
  executarDjenTermosFlash,
  cancelarDjenTermosFlash,
  limparEstadoDjenTermosFlash,
  forceKillDjenTermosFlash,
  getDjenTermosFlashProgress,
  isDjenTermosFlashRunning,
  getCheckpointFlash,
  subscribeDjenTermosFlash,
} from './useDjenTermosFlashEngine';

export type { DjenTermosFlashProgress };

export function useDjenTermosFlash() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DjenTermosFlashProgress>(getDjenTermosFlashProgress);
  const [isRunning, setIsRunning] = useState(isDjenTermosFlashRunning);

  useEffect(() => {
    const unsubscribe = subscribeDjenTermosFlash((p) => {
      setProgress(p);
      setIsRunning(isDjenTermosFlashRunning());
      
      if (p.status === 'concluido') {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
        
        if (p.novas > 0) {
          toast.success(`DJEN Flash: ${p.novas} novas publicações encontradas!`);
        }
      }
      
      if (p.status === 'erro') {
        toast.error(p.mensagem || 'Erro na execução DJEN Flash');
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const checkpoint = getCheckpointFlash();
  const canResume = !!checkpoint && progress.status !== 'executando';

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string, coordenacaoId?: string, monitoramentoIds?: string[]) => {
    executarDjenTermosFlash(dataInicioYmd, dataFimYmd, false, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Termos Flash iniciado');
  }, []);

  const retomar = useCallback((coordenacaoId?: string, monitoramentoIds?: string[]) => {
    if (!checkpoint) return;
    executarDjenTermosFlash(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Termos Flash retomando de onde parou...');
  }, [checkpoint]);

  const cancelar = useCallback(() => {
    cancelarDjenTermosFlash();
  }, []);

  const limpar = useCallback(() => {
    limparEstadoDjenTermosFlash();
  }, []);

  const forceKill = useCallback((clearCheckpoint = false) => {
    forceKillDjenTermosFlash(clearCheckpoint);
    toast.success(clearCheckpoint 
      ? 'DJEN Flash finalizado e checkpoint limpo' 
      : 'DJEN Flash parado. Use Executar para retomar.'
    );
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
