/**
 * Hook React para usar o DJEN Termos Engine
 * 
 * Conecta ao singleton do engine e provê estado reativo para componentes React
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { addDays, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
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
    const tz = 'America/Sao_Paulo';
    toast.info('Limpando publicações de hoje...');

    // Intervalo [início do dia, início do próximo dia) em São Paulo
    const now = new Date();
    const nowTz = toZonedTime(now, tz);
    const startTz = startOfDay(nowTz);
    const nextDayTz = addDays(startTz, 1);
    const startUtc = fromZonedTime(startTz, tz);
    const nextDayUtc = fromZonedTime(nextDayTz, tz);
    const inicioIso = startUtc.toISOString();
    const fimIso = nextDayUtc.toISOString();

    const [pubRes, procRes, descRes] = await Promise.all([
      supabase
        .from('publicacoes_djen')
        .delete({ count: 'exact' })
        .gte('created_at', inicioIso)
        .lt('created_at', fimIso),
      supabase
        .from('publicacoes_djen_processos')
        .delete({ count: 'exact' })
        .gte('created_at', inicioIso)
        .lt('created_at', fimIso),
      supabase
        .from('publicacoes_djen_descartadas')
        .delete({ count: 'exact' })
        .gte('created_at', inicioIso)
        .lt('created_at', fimIso),
    ]);

    const err = pubRes.error || procRes.error || descRes.error;
    if (err) {
      console.error('Erro ao limpar publicações DJEN:', {
        termos: pubRes.error,
        processos: procRes.error,
        descartadas: descRes.error,
      });
      toast.error(`Erro ao limpar: ${err.message}`);
      return;
    }

    // Limpar estado do engine
    forceKillDjenTermos();
    limparEstadoDjenTermos();

    // Invalidar queries (telas de análise + dashboards + processos)
    queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
    queryClient.invalidateQueries({ queryKey: ['analise-djen'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
    queryClient.invalidateQueries({ queryKey: ['descartadas-djen'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-djen-processo'] });
    queryClient.invalidateQueries({ queryKey: ['djen-stats'] });
    queryClient.invalidateQueries({ queryKey: ['djen-stats-hoje'] });
    queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-dashboard'] });

    const removidas = (pubRes.count ?? 0) + (procRes.count ?? 0) + (descRes.count ?? 0);
    toast.success(`Limpeza concluída: ${removidas} registros de hoje removidos.`);
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
