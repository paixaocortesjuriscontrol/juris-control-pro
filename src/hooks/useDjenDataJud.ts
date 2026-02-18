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

/** Intervalo rápido (execução ativa) vs. lento (idle/concluido — para detectar nova execução) */
const FAST_INTERVAL = 3000;
const SLOW_INTERVAL = 10000;

export function useDjenDataJud() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<DataJudProgress>(INITIAL);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIntervalRef = useRef<number>(SLOW_INTERVAL);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Ref para sempre acessar a versão mais recente de fetchProgress sem recriação
  const fetchRef = useRef<() => Promise<DataJudProgress>>(async () => INITIAL);

  const startPolling = useCallback((fast: boolean) => {
    stopPolling();
    const interval = fast ? FAST_INTERVAL : SLOW_INTERVAL;
    currentIntervalRef.current = interval;
    pollingRef.current = setInterval(() => fetchRef.current(), interval);
  }, [stopPolling]);

  const fetchProgress = useCallback(async (): Promise<DataJudProgress> => {
    const { data } = await supabase
      .from('configuracoes_monitoramento')
      .select('metadata')
      .eq('tipo', 'datajud_termos')
      .is('coordenacao_id', null)
      .maybeSingle();

    const meta = (data?.metadata as any) || INITIAL;
    setProgress(meta);

    const isActive = meta.status === 'em_andamento' || meta.status === 'executando';
    setIsRunning(isActive);

    // Ajusta intervalo automaticamente conforme estado detectado
    const wantedInterval = isActive ? FAST_INTERVAL : SLOW_INTERVAL;
    if (currentIntervalRef.current !== wantedInterval) {
      startPolling(isActive);
    }

    if (!isActive && meta.status === 'concluido') {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-real-db-stats'] });
    }

    return meta;
  }, [startPolling, queryClient]);

  // Mantém fetchRef sempre atualizado
  useEffect(() => {
    fetchRef.current = fetchProgress;
  }, [fetchProgress]);

  const executar = useCallback(async (
    dias = 7,
    filtros?: { coordenacaoId?: string; monitoramentoIds?: string[] },
  ) => {
    try {
      setIsRunning(true);
      setProgress({ ...INITIAL, status: 'em_andamento' });
      startPolling(true);

      const body: any = { dias };
      if (filtros?.coordenacaoId) body.coordenacaoId = filtros.coordenacaoId;
      if (filtros?.monitoramentoIds) body.monitoramentoIds = filtros.monitoramentoIds;

      const { data, error } = await supabase.functions.invoke('monitorar-datajud-termos', { body });

      if (error) {
        toast.error(`Erro ao executar DataJud: ${error.message}`);
        setIsRunning(false);
        startPolling(false);
      } else {
        toast.info(data?.message || 'DataJud iniciado em background');
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
      setIsRunning(false);
      startPolling(false);
    }
  }, [startPolling]);

  const forceReset = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('monitorar-datajud-termos', {
        body: { forceReset: true },
      });

      if (error) {
        toast.error(`Erro ao resetar: ${error.message}`);
      } else {
        setProgress(INITIAL);
        setIsRunning(false);
        toast.success('Estado DataJud resetado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
        startPolling(false);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  }, [startPolling, queryClient]);

  // Inicializa polling ao montar
  useEffect(() => {
    fetchRef.current = fetchProgress;
    fetchProgress().then((meta) => {
      const isActive = meta?.status === 'em_andamento' || meta?.status === 'executando';
      startPolling(isActive);
    });
    return stopPolling;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isRunning, progress, executar, forceReset };
}
