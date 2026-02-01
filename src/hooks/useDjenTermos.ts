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
   * Limpa estado + deleta publicações do intervalo informado (ou últimos 3 dias)
   * (tabelas: termos, processos e descartadas)
   */
  const limparTudoComPublicacoes = useCallback(async (dataInicioYmd?: string, dataFimYmd?: string) => {
    // Se não informar datas, usar o que está no checkpoint/progresso ou últimos 3 dias
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const tresDiasAtras = new Date(hoje);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 2);

    const inicio = dataInicioYmd || checkpoint?.dataInicioYmd || tresDiasAtras.toISOString().slice(0, 10);
    const fim = dataFimYmd || checkpoint?.dataFimYmd || hoje.toISOString().slice(0, 10);

    toast.info(`Limpando DJEN (${inicio} → ${fim})...`);

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje', {
          body: {
            modo: 'intervalo',
            dataInicio: inicio,
            dataFim: fim,
          },
        }),
        240_000,
        'A limpeza demorou mais que 240s. Verifique o log da função e tente novamente.'
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
  }, [queryClient, checkpoint]);

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
