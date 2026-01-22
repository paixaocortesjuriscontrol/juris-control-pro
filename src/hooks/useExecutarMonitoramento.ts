import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExecutarMonitoramentoOptions {
  tipo: string;
  configId?: string;
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void;
}

interface UseExecutarMonitoramentoReturn {
  executando: boolean;
  cancelando: boolean;
  progresso: { current: number; total: number; percentage: number } | null;
  executar: (retomar?: boolean) => Promise<void>;
  cancelar: () => Promise<void>;
}

/**
 * Hook centralizado para executar monitoramentos via orquestrador.
 * Usa `executar-monitoramento` para garantir serialização e evitar WORKER_LIMIT.
 */
export function useExecutarMonitoramento({
  tipo,
  configId,
  onProgress,
}: ExecutarMonitoramentoOptions): UseExecutarMonitoramentoReturn {
  const queryClient = useQueryClient();
  const [executando, setExecutando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [progresso, setProgresso] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const canceladoRef = useRef(false);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
    queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
  }, [queryClient]);

  const executar = useCallback(async (retomar = false) => {
    if (executando) return;
    
    setExecutando(true);
    setProgresso({ current: 0, total: 0, percentage: 0 });
    canceladoRef.current = false;

    try {
      // IMPORTANTE: não marcar status=em_andamento/continuingRun antes do orquestrador aceitar,
      // senão o UI mostra "acompanhando" sem existir execução real (fantasma).
      // Aqui apenas limpamos flags e (se novo run) resetamos o offset.
      if (configId) {
        const { data: config } = await supabase
          .from('configuracoes_monitoramento')
          .select('ativo, metadata')
          .eq('id', configId)
          .maybeSingle();

        const currentMetadata = (config?.metadata as Record<string, any>) || {};
        const isPaused = config?.ativo === false || currentMetadata?.paused_globally === true;

        if (isPaused) {
          toast.warning('Monitoramento está pausado. Reative para executar.');
          return;
        }

        const { error: updateError } = await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...currentMetadata,
              // se existir (reset global), remove o bloqueio na execução manual
              paused_globally: false,
              cancelado: false,
              // manter o status neutro; execução real vem de execucoes_agendadas/historico
              status: 'idle',
              continuingRun: false,
              ...(retomar
                ? {}
                : {
                    next_offset: 0,
                    current: 0,
                    total: 0,
                    percentage: 0,
                  }),
            },
          })
          .eq('id', configId);

        // Se falhou atualizar config (RLS/permissão), não adianta seguir: o orquestrador pode
        // interpretar estado antigo (ex.: cancelado) e abortar imediatamente.
        if (updateError) throw updateError;
      }

      // Chamar orquestrador (background job)
      toast.info(`${retomar ? 'Retomando' : 'Iniciando'} ${tipo}... Acompanhe o progresso abaixo.`);

      try {
        const { data, error } = await supabase.functions.invoke('executar-monitoramento', {
          body: { tipo },
        });

        if (error) {
          // Tratar erros de rede/timeout de forma amigável
          const errorMessage = error.message || '';
          if (errorMessage.includes('Failed to send a request') || errorMessage.includes('FunctionsHttpError')) {
            toast.warning('A execução foi iniciada mas pode demorar. Acompanhe o progresso no painel.');
            // Não é erro fatal - a execução pode estar rodando em background
          } else if (data?.blocked) {
            toast.warning(data.message || 'Aguarde outra execução finalizar');
          } else if (data?.paused) {
            toast.warning('Monitoramento está pausado. Reative para executar.');
          } else {
            throw error;
          }
        } else if (data?.blocked) {
          toast.warning(data.message || 'Aguarde outra execução finalizar');
        } else if (data?.paused) {
          toast.warning('Monitoramento está pausado. Reative para executar.');
        } else if (data?.success) {
          toast.success(`${tipo} concluído: ${data.totalEncontrados || 0} encontrados`);
        } else if (data?.status === 'cancelado' || data?.status === 'cancelled') {
          toast.warning('Execução foi cancelada antes de iniciar. Tente novamente.');
        } else if (data?.status === 'timeout') {
          toast.warning('Execução pausou por limite de tempo. Use “Retomar” para continuar.');
        } else if (data?.success === false && data?.error) {
          toast.error(`Erro: ${data.error}`);
        }
      } catch (invokeError: any) {
        // Erros de conexão/timeout não são fatais para o background job
        const msg = invokeError.message || '';
        if (msg.includes('Failed to send') || msg.includes('timeout') || msg.includes('504')) {
          toast.warning('Conexão perdida, mas a execução pode continuar em background. Verifique o progresso.');
        } else {
          throw invokeError;
        }
      }

      invalidateQueries();
    } catch (error: any) {
      console.error(`Erro ao executar ${tipo}:`, error);
      toast.error(`Erro ao executar ${tipo}: ${error.message}`);
    } finally {
      setExecutando(false);
      setProgresso(null);
      invalidateQueries();
    }
  }, [tipo, configId, executando, invalidateQueries]);

  const cancelar = useCallback(async () => {
    setCancelando(true);
    canceladoRef.current = true;
    toast.info("Cancelando execução...");

    try {
      // 1. Marcar no metadata para parar auto-continuação
      if (configId) {
        const { data: config } = await supabase
          .from('configuracoes_monitoramento')
          .select('metadata')
          .eq('id', configId)
          .maybeSingle();

        const currentMetadata = (config?.metadata as Record<string, any>) || {};
        
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              ...currentMetadata,
              cancelado: true,
              status: 'cancelando',
              continuingRun: false,
            },
          })
          .eq('id', configId);
      }

      // 2. Cancelar execuções em andamento deste tipo
      await supabase
        .from('execucoes_agendadas')
        .update({
          status: 'cancelado',
          finalizado_em: new Date().toISOString(),
        })
        .eq('tipo', tipo)
        .eq('status', 'executando');

      invalidateQueries();
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      toast.error(`Erro ao cancelar: ${error.message}`);
    } finally {
      setCancelando(false);
    }
  }, [tipo, configId, invalidateQueries]);

  return {
    executando,
    cancelando,
    progresso,
    executar,
    cancelar,
  };
}
