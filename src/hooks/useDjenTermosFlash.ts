/**
 * Hook React para o DJEN Termos Pro Engine
 * 
 * Wrapper reativo para o singleton do engine Pro.
 * Independente do useDjenTermos original.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type DjenTermosProProgress,
  executarDjenTermosPro,
  cancelarDjenTermosPro,
  limparEstadoDjenTermosPro,
  forceKillDjenTermosPro,
  getDjenTermosProProgress,
  isDjenTermosProRunning,
  getCheckpointPro,
  subscribeDjenTermosPro,
} from './useDjenTermosProEngine';

export type { DjenTermosProProgress };

export function useDjenTermosPro() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DjenTermosProProgress>(getDjenTermosProProgress);
  const [isRunning, setIsRunning] = useState(isDjenTermosProRunning);

  useEffect(() => {
    const unsubscribe = subscribeDjenTermosPro((p) => {
      setProgress(p);
      setIsRunning(isDjenTermosProRunning());
      
      if (p.status === 'concluido') {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
        
        if (p.novas > 0) {
          toast.success(`DJEN Pro: ${p.novas} novas publicações encontradas!`);
        }
      }
      
      if (p.status === 'erro') {
        toast.error(p.mensagem || 'Erro na execução DJEN Pro');
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const checkpoint = getCheckpointPro();
  const canResume = !!checkpoint && progress.status !== 'executando';

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string, coordenacaoId?: string, monitoramentoIds?: string[]) => {
    executarDjenTermosPro(dataInicioYmd, dataFimYmd, false, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Termos Pro iniciado');
  }, []);

  const retomar = useCallback((coordenacaoId?: string, monitoramentoIds?: string[]) => {
    if (!checkpoint) return;
    executarDjenTermosPro(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, coordenacaoId, monitoramentoIds);
    toast.info('DJEN Termos Pro retomando de onde parou...');
  }, [checkpoint]);

  const cancelar = useCallback(() => {
    cancelarDjenTermosPro();
  }, []);

  const limpar = useCallback(() => {
    limparEstadoDjenTermosPro();
  }, []);

  const forceKill = useCallback((clearCheckpoint = false) => {
    forceKillDjenTermosPro(clearCheckpoint);
    toast.success(clearCheckpoint 
      ? 'DJEN Pro finalizado e checkpoint limpo' 
      : 'DJEN Pro parado. Use Executar para retomar.'
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
