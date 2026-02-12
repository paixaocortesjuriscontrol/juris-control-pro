import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DataJudProgress {
  status: string;
  novas: number;
  duplicadas: number;
  tribunaisProcessados: number;
  totalTribunais: number;
  monitoramentosProcessados?: number;
  percentage?: number;
  erros?: string[];
  started_at?: string;
  finished_at?: string;
  erro?: string;
  execucaoId?: string;
  termoAtual?: string;
  termoTipo?: string;
  filtros?: { coordenacaoId?: string; monitoramentoIds?: string[] } | null;
}

const INITIAL: DataJudProgress = {
  status: "idle",
  novas: 0,
  duplicadas: 0,
  tribunaisProcessados: 0,
  totalTribunais: 0,
};

export function useDjenDataJud() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<DataJudProgress>(INITIAL);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    const { data } = await supabase
      .from('configuracoes_monitoramento')
      .select('metadata')
      .eq('tipo', 'datajud_termos')
      .is('coordenacao_id', null)
      .maybeSingle();

    const meta = (data?.metadata as any) || INITIAL;
    setProgress(meta);

    if (meta.status === 'concluido' || meta.status === 'erro' || meta.status === 'idle') {
      setIsRunning(false);
      stopPolling();
      if (meta.status === 'concluido') {
        queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
        queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
        queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
        queryClient.invalidateQueries({ queryKey: ['monitoring-real-db-stats'] });
      }
    }

    return meta;
  }, [stopPolling, queryClient]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(fetchProgress, 3000);
  }, [fetchProgress, stopPolling]);

  const executar = useCallback(async (
    dias = 7,
    filtros?: { coordenacaoId?: string; monitoramentoIds?: string[] },
  ) => {
    try {
      setIsRunning(true);
      setProgress({ ...INITIAL, status: 'em_andamento' });
      startPolling();

      const body: any = { dias };
      if (filtros?.coordenacaoId) body.coordenacaoId = filtros.coordenacaoId;
      if (filtros?.monitoramentoIds) body.monitoramentoIds = filtros.monitoramentoIds;

      const { data, error } = await supabase.functions.invoke('monitorar-datajud-termos', { body });

      if (error) {
        toast.error(`Erro ao executar DataJud: ${error.message}`);
        setIsRunning(false);
        stopPolling();
      } else {
        toast.info(data?.message || 'DataJud iniciado em background');
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
      setIsRunning(false);
      stopPolling();
    }
  }, [startPolling, stopPolling]);

  const forceReset = useCallback(async () => {
    try {
      stopPolling();
      setIsRunning(false);

      const { error } = await supabase.functions.invoke('monitorar-datajud-termos', {
        body: { forceReset: true },
      });

      if (error) {
        toast.error(`Erro ao resetar: ${error.message}`);
      } else {
        setProgress(INITIAL);
        toast.success('Estado DataJud resetado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  }, [stopPolling, queryClient]);

  // Check initial state
  useEffect(() => {
    fetchProgress().then((meta) => {
      if (meta?.status === 'em_andamento') {
        setIsRunning(true);
        startPolling();
      }
    });
    return stopPolling;
  }, [fetchProgress, startPolling, stopPolling]);

  return { isRunning, progress, executar, forceReset };
}
