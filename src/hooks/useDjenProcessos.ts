/**
 * Hook React para conectar ao DJEN Processos Singleton Engine
 * 
 * Wrapper fino que provê reatividade ao componente React
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  subscribeDjenProcessos,
  getDjenProcessosProgress,
  isDjenProcessosRunning,
  executarDjenProcessos,
  cancelarDjenProcessos,
  limparEstadoDjenProcessos,
  forceKillDjenProcessos,
  getCheckpointProcessos,
  DjenProcessosProgress,
} from "./useDjenProcessosEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { withTimeout } from "@/utils/withTimeout";

export interface ExecutarOptions {
  retomar?: boolean;
  turbo?: boolean;
}

export interface ExecutarHibridoOptions {
  backgroundOnly?: boolean;
}

export interface UseDjenProcessosReturn {
  progress: DjenProcessosProgress;
  isRunning: boolean;
  hasCheckpoint: boolean;
  executar: (dataInicio?: string, dataFim?: string, options?: ExecutarOptions) => void;
  executarHibrido: (dataInicio?: string, dataFim?: string, options?: ExecutarHibridoOptions) => Promise<boolean>;
  cancelar: () => void;
  cancelarHibrido: () => Promise<void>;
  limpar: () => void;
  forceKill: () => Promise<void>;
  forceKillHibrido: () => Promise<void>;
  limparPublicacoesProcesso: (dataInicioYmd?: string, dataFimYmd?: string) => Promise<void>;
}

export function useDjenProcessos(): UseDjenProcessosReturn {
  const [progress, setProgress] = useState<DjenProcessosProgress>(getDjenProcessosProgress);
  const [isRunning, setIsRunning] = useState(isDjenProcessosRunning);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Inscrever para receber atualizações de progresso
    const unsubscribe = subscribeDjenProcessos((p) => {
      setProgress(p);
      const running = isDjenProcessosRunning();
      setIsRunning(running);
      
      // Quando finaliza (concluido, cancelado, erro), invalida queries
      if (!running && (p.status === 'concluido' || p.status === 'cancelado' || p.status === 'erro')) {
        queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
        queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
        queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
      }
    });

    return unsubscribe;
  }, [queryClient]);

  const executar = useCallback((dataInicio?: string, dataFim?: string, options?: ExecutarOptions): boolean => {
    return executarDjenProcessos(dataInicio, dataFim, !!options?.retomar, !!options?.turbo);
  }, []);

  const executarHibrido = useCallback(async (
    dataInicio?: string,
    dataFim?: string,
    options?: ExecutarHibridoOptions
  ) => {
    try {
      toast.info(
        options?.backgroundOnly
          ? 'Iniciando DJEN Processos no backend (100% background)...'
          : 'Iniciando DJEN Processos no backend...'
      );
      const { error } = await withTimeout(
        supabase.functions.invoke('executar-monitoramento', {
          body: {
            tipo: 'djen_processos',
            dataInicio,
            dataFim,
            scheduled: true,
          },
        }),
        60_000,
        'Tempo limite ao iniciar no backend (60s)'
      );

      if (error) throw error;
      toast.info(
        options?.backgroundOnly
          ? 'DJEN Processos iniciado no backend (100% background)'
          : 'DJEN Processos iniciado no backend (modo híbrido)'
      );
      queryClient.invalidateQueries({ queryKey: ['monitoring-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      return true;
    } catch (err: any) {
      console.warn('[DJEN Processos] Falha ao iniciar backend, usando modo local:', err?.message || err);
      if (options?.backgroundOnly) {
        toast.error('Backend indisponível. Modo 100% background não iniciado.');
        return false;
      }
      executar(dataInicio, dataFim, { retomar: false, turbo: false });
      toast.warning('Backend indisponível. Executando no navegador.');
      return false;
    }
  }, [executar, queryClient]);

  const cancelar = useCallback(() => {
    cancelarDjenProcessos();
  }, []);

  const cancelarHibrido = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...meta, cancelado: true, status: 'cancelado' },
        })
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null);

      await supabase
        .from('execucoes_agendadas')
        .update({
          status: 'cancelado',
          finalizado_em: new Date().toISOString(),
        })
        .eq('tipo', 'djen_processos')
        .eq('status', 'executando');

      toast.info('Cancelamento solicitado no backend');
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    } catch (err: any) {
      console.error('Erro ao cancelar backend DJEN Processos:', err);
      toast.error(`Erro ao cancelar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const limpar = useCallback(() => {
    limparEstadoDjenProcessos();
  }, []);

  const forceKill = useCallback(async () => {
    await forceKillDjenProcessos();
    toast.success('Estado limpo. Você pode iniciar uma nova execução.');
    queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
  }, [queryClient]);

  const forceKillHibrido = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...meta, cancelado: true, status: 'cancelado', has_more: false, next_offset: null },
        })
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null);
      toast.success('DJEN Processos finalizado forçadamente (backend)');
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
    } catch (err: any) {
      console.error('Erro ao finalizar backend DJEN Processos:', err);
      toast.error(`Erro ao finalizar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const limparPublicacoesProcesso = useCallback(async (dataInicioYmd?: string, dataFimYmd?: string) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 2);
    const inicio = dataInicioYmd || tresDiasAtras.toISOString().slice(0, 10);
    const fim = dataFimYmd || hoje;
    toast.info(`Limpando publicações DJEN Processo (${inicio} → ${fim})...`);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje', {
          body: {
            modo: 'intervalo',
            dataInicio: inicio,
            dataFim: fim,
            tipo: 'processos', // SOMENTE publicacoes_djen_processos, nunca termos
          },
        }),
        120_000,
        'A limpeza demorou mais que 120s.'
      );
      if (error) throw error;
      await forceKillDjenProcessos();
      limparEstadoDjenProcessos();
      await queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
      await queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
      toast.success((data as any)?.message ?? 'Publicações por processo limpas!');
    } catch (err: any) {
      console.error('Erro ao limpar DJEN Processos:', err);
      toast.error(`Erro ao limpar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const hasCheckpoint = !!getCheckpointProcessos();

  return {
    progress,
    isRunning,
    hasCheckpoint,
    executar,
    executarHibrido,
    cancelar,
    cancelarHibrido,
    limpar,
    forceKill,
    forceKillHibrido,
    limparPublicacoesProcesso,
  };
}
