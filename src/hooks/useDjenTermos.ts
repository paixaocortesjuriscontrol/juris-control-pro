/**
 * Hook React para usar o DJEN Termos Engine
 * 
 * Conecta ao singleton do engine e provê estado reativo para componentes React
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/utils/withTimeout';
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
   * Limpa estado + deleta publicações de HOJE (America/Sao_Paulo)
   * (tabelas: termos, processos e descartadas)
   */
  const limparTudoComPublicacoes = useCallback(async () => {
    toast.info('Limpando DJEN (hoje)...');

    try {
      // Reaproveitar a rotina robusta já existente (edge function com service role + deletes em lote)
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje'),
        180_000,
        'A limpeza demorou mais que 180s. Verifique o log da função e tente novamente.'
      );
      if (error) throw error;

      // Limpar estado do engine local (singleton)
      forceKillDjenTermos();
      limparEstadoDjenTermos();

      // Refetch imediato das telas ativas (Análise / Dashboards)
      const keys = [
        ['publicacoes-djen'],
        ['analise-djen'],
        ['publicacoes-unificadas'],
        ['publicacoes-unificadas-stats'],
        ['descartadas-djen'],
        ['publicacoes-djen-processo'],
        ['djen-stats'],
        ['djen-stats-hoje'],
        ['notificacoes-counts'],
        ['monitoring-dashboard'],
      ] as const;

      await Promise.all(
        keys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey], refetchType: 'active' })
        )
      );

      toast.success((data as any)?.message ?? 'Limpeza concluída!');
    } catch (err: any) {
      console.error('Erro ao limpar DJEN:', err);
      toast.error(`Erro ao limpar: ${err?.message ?? String(err)}`);
    }
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
