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

type ExecutarOptions = {
  turbo?: boolean;
  coordenacaoId?: string;
  monitoramentoIds?: string[];
};

type ExecutarHibridoOptions = {
  backgroundOnly?: boolean;
  indexMode?: 'normal' | 'indexado';
  coordenacaoId?: string;
  monitoramentoIds?: string[];
};

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
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
        queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
        queryClient.invalidateQueries({ queryKey: ['descartadas-count'] });
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

  const executar = useCallback((dataInicioYmd?: string, dataFimYmd?: string, options?: ExecutarOptions) => {
    executarDjenTermos(dataInicioYmd, dataFimYmd, false, !!options?.turbo, options?.coordenacaoId, options?.monitoramentoIds);
    toast.info('DJEN Termos iniciado');
  }, []);

  const retomar = useCallback((options?: ExecutarOptions) => {
    if (!checkpoint) return;
    executarDjenTermos(checkpoint.dataInicioYmd, checkpoint.dataFimYmd, true, !!options?.turbo, options?.coordenacaoId, options?.monitoramentoIds);
    toast.info('DJEN Termos retomando de onde parou...');
  }, [checkpoint]);

  const executarHibrido = useCallback(async (
    dataInicioYmd?: string,
    dataFimYmd?: string,
    options?: ExecutarHibridoOptions
  ) => {
    try {
      toast.info(
        options?.backgroundOnly
          ? 'Iniciando DJEN Termos no backend (100% background)...'
          : 'Iniciando DJEN Termos no backend...'
      );
      const body = {
        dataInicio: dataInicioYmd,
        dataFim: dataFimYmd,
        conservative: true,
        manual: true,
        indexMode: options?.indexMode,
        coordenacaoId: options?.coordenacaoId || undefined,
        monitoramentoIds: (options?.monitoramentoIds?.length ?? 0) > 0 ? options.monitoramentoIds : undefined,
      };
      console.log("[DJEN Frontend] Invocando trigger com filtros:", {
        coordenacaoId: body.coordenacaoId ?? "(nenhum)",
        monitoramentoIds: body.monitoramentoIds ?? "(nenhum)",
      });
      const { error } = await withTimeout(
        supabase.functions.invoke('monitorar-djen-trigger', { body }),
        60_000,
        'Tempo limite ao iniciar no backend (60s)'
      );

      if (error) throw error;
      toast.info(
        options?.backgroundOnly
          ? 'DJEN Termos iniciado no backend (100% background)'
          : 'DJEN Termos iniciado no backend (modo híbrido)'
      );
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['djen-config-live'] });
      return true;
    } catch (err: any) {
      console.warn('[DJEN] Falha ao iniciar backend, usando modo local:', err?.message || err);
      if (options?.backgroundOnly) {
        toast.error('Backend indisponível. Modo 100% background não iniciado.');
        return false;
      }
      try {
        const { data } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'djen')
          .is('coordenacao_id', null)
          .maybeSingle();
        const meta = (data?.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...meta,
              cancelado: true,
              paused_globally: true,
              status: 'cancelado',
              has_more: false,
              next_offset: null,
              djen_run: null,
            },
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);
      } catch (e) {
        console.warn('[DJEN] Falha ao limpar metadata após erro:', (e as any)?.message || e);
      }
      executar(dataInicioYmd, dataFimYmd, { turbo: false, coordenacaoId: options?.coordenacaoId, monitoramentoIds: options?.monitoramentoIds });
      toast.warning('Backend indisponível. Executando no navegador.');
      return false;
    }
  }, [executar, queryClient]);

  const cancelar = useCallback(() => {
    cancelarDjenTermos();
  }, []);

  const cancelarHibrido = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...meta, cancelado: true, paused_globally: true },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
      toast.info('Cancelamento solicitado no backend');
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['djen-config-live'] });
    } catch (err: any) {
      console.error('Erro ao cancelar backend DJEN:', err);
      toast.error(`Erro ao cancelar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const limpar = useCallback(() => {
    limparEstadoDjenTermos();
  }, []);

  const limparIndiceDiario = useCallback(async (dataYmd: string) => {
    try {
      toast.info(`Limpando índice do dia ${dataYmd}...`);
      const { error: errPublicacoes } = await (supabase as any)
        .from('djen_diario_publicacoes')
        .delete()
        .eq('diario_ymd', dataYmd);
      if (errPublicacoes) throw errPublicacoes;

      const { error: errIndex } = await (supabase as any)
        .from('djen_diario_index')
        .delete()
        .eq('diario_ymd', dataYmd);
      if (errIndex) throw errIndex;

      toast.success('Índice diário removido');
      queryClient.invalidateQueries({ queryKey: ['djen-diario-index'] });
    } catch (err: any) {
      console.error('Erro ao limpar índice diário:', err);
      toast.error(`Erro ao limpar índice: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const indexarDiario = useCallback(async (dataYmd: string) => {
    try {
      toast.info(`Solicitando indexação do diário ${dataYmd}...`);

      const { data: pendingReq, error: pendingErr } = await (supabase as any)
        .from('djen_diario_index_requests')
        .select('id, status')
        .eq('data_ymd', dataYmd)
        .in('status', ['pendente', 'em_andamento'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingErr) throw pendingErr;

      if (pendingReq) {
        const { error: resetErr } = await (supabase as any)
          .from('djen_diario_index_requests')
          .update({
            status: 'pendente',
            started_at: null,
            finished_at: null,
            erro_mensagem: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingReq.id);
        if (resetErr) throw resetErr;
        toast.success('Solicitação reativada. O servidor iniciará em seguida.');
        return;
      }

      const { error: insertErr } = await (supabase as any)
        .from('djen_diario_index_requests')
        .insert({
          data_ymd: dataYmd,
          status: 'pendente',
        });
      if (insertErr) throw insertErr;

      toast.success('Solicitação registrada. O servidor iniciará em seguida.');
      queryClient.invalidateQueries({ queryKey: ['djen-diario-index'] });
    } catch (err: any) {
      console.error('Erro ao indexar diário:', err);
      toast.error(`Erro ao indexar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const cancelarIndexacao = useCallback(async (dataYmd: string) => {
    try {
      const { error } = await supabase.functions.invoke('cancelar-indexacao-djen', {
        body: { dataYmd },
      });
      if (error) throw error;
      toast.success('Indexação cancelada');
      queryClient.invalidateQueries({ queryKey: ['djen-diario-index'] });
    } catch (err: any) {
      console.error('Erro ao cancelar indexação:', err);
      toast.error(`Erro ao cancelar: ${err?.message ?? String(err)}`);
    }
  }, [queryClient]);

  const forceKill = useCallback(async () => {
    forceKillDjenTermos();
    toast.success('DJEN Termos finalizado forçadamente');
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
    queryClient.invalidateQueries({ queryKey: ['djen-config-live'] });
  }, [queryClient]);

  const forceKillHibrido = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      const meta = (data?.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...meta, cancelado: true, paused_globally: true, status: 'cancelado', has_more: false, next_offset: null, djen_run: null },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
      toast.success('DJEN Termos finalizado forçadamente (backend)');
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['djen-config-live'] });
    } catch (err: any) {
      console.error('Erro ao finalizar backend DJEN:', err);
      toast.error(`Erro ao finalizar: ${err?.message ?? String(err)}`);
    }
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
      // Parar qualquer execução (backend/local) antes de limpar
      forceKillDjenTermos();
      try {
        const { data } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('tipo', 'djen')
          .is('coordenacao_id', null)
          .maybeSingle();
        const meta = (data?.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: { ...meta, cancelado: true, paused_globally: true, status: 'cancelado', has_more: false, next_offset: null, djen_run: null },
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);
      } catch (e) {
        console.warn('[DJEN] Falha ao cancelar backend antes da limpeza:', (e as any)?.message || e);
      }

      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje', {
          body: {
            modo: 'intervalo',
            dataInicio: inicio,
            dataFim: fim,
            tipo: 'termos', // Só limpa publicações de TERMOS, nunca de processos
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
    executarHibrido,
    cancelar,
    cancelarHibrido,
    limpar,
    forceKill,
    forceKillHibrido,
    limparTudoComPublicacoes,
    limparIndiceDiario,
    indexarDiario,
    cancelarIndexacao,
  };
}
