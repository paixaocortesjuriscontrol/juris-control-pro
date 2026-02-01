/**
 * Hook React para usar o DJEN Termos Engine
 * 
 * Conecta ao singleton do engine e provê estado reativo para componentes React
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DjenTermosProgress,
  executarDjenTermos,
  cancelarDjenTermos,
  limparEstadoDjenTermos,
  forceKillDjenTermos,
  getDjenTermosProgress,
  isDjenTermosRunning,
  getCheckpoint,
  subscribeDjenTermos,
} from './useDjenTermosEngine';

export type { DjenTermosProgress };

export function useDjenTermos() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DjenTermosProgress>(getDjenTermosProgress);
  const [isRunning, setIsRunning] = useState(isDjenTermosRunning);

  // Subscrever às mudanças do singleton
  useEffect(() => {
    const unsubscribe = subscribeDjenTermos((p) => {
      setProgress(p);
      setIsRunning(isDjenTermosRunning());
      
      // Invalidar queries quando concluir
      if (p.status === 'concluido') {
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['djen-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
        
        if (p.novas > 0) {
          toast.success(`DJEN: ${p.novas} novas publicações encontradas!`);
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  // Verificar se há checkpoint válido para retomada
  const checkpoint = getCheckpoint();
  const canResume = !!checkpoint && progress.status !== 'executando';

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string) => {
    executarDjenTermos(dataInicioYmd, dataFimYmd, false);
    toast.info('DJEN Termos iniciado');
  }, []);

  const retomar = useCallback(() => {
    if (!checkpoint) return;
    executarDjenTermos(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true);
    toast.info('DJEN Termos retomando de onde parou...');
  }, [checkpoint]);

  const cancelar = useCallback(() => {
    cancelarDjenTermos();
  }, []);

  const limpar = useCallback(() => {
    limparEstadoDjenTermos();
  }, []);

  const forceKill = useCallback(async () => {
    forceKillDjenTermos();
    toast.success('DJEN Termos finalizado forçadamente');
    queryClient.invalidateQueries({ queryKey: ['monitoring-dashboard'] });
  }, [queryClient]);

  /**
   * Limpa estado + deleta TODAS as publicações DJEN do banco
   * (não apenas de hoje, mas todas encontradas via termos)
   */
  const limparTudoComPublicacoes = useCallback(async () => {
    toast.info('Deletando publicações...');
    
    // Deletar TODAS as publicações (não apenas de hoje)
    const { error: errPub, count: countPub } = await supabase
      .from('publicacoes_djen')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (errPub) {
      console.error('Erro ao deletar publicações:', errPub);
      toast.error('Erro ao limpar publicações');
      return;
    }
    
    // Deletar descartadas também
    const { count: countDesc } = await supabase
      .from('publicacoes_djen_descartadas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Limpar estado do engine
    limparEstadoDjenTermos();
    forceKillDjenTermos();
    
    // Invalidar queries
    queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
    queryClient.invalidateQueries({ queryKey: ['analise-djen'] });
    queryClient.invalidateQueries({ queryKey: ['djen-stats'] });
    queryClient.invalidateQueries({ queryKey: ['djen-stats-hoje'] });
    queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-dashboard'] });
    
    toast.success(`Publicações removidas e estado limpo!`);
  }, [queryClient]);

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
    limparTudoComPublicacoes,
  };
}
