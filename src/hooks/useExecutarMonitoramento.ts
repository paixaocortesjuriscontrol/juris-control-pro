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
      // Se não for retomar, limpar offset no banco
      if (!retomar && configId) {
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
              next_offset: 0,
              current: 0,
              total: 0,
              percentage: 0,
              cancelado: false,
              status: 'em_andamento',
              continuingRun: true,
            },
            ultima_execucao: new Date().toISOString(),
          })
          .eq('id', configId);
      } else if (configId) {
        // Para retomar, apenas limpar flag cancelado
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
              cancelado: false,
              status: 'em_andamento',
              continuingRun: true,
            },
          })
          .eq('id', configId);
      }

      // Chamar orquestrador (background job)
      toast.info(`${retomar ? 'Retomando' : 'Iniciando'} ${tipo}... Acompanhe o progresso abaixo.`);

      const { data, error } = await supabase.functions.invoke('executar-monitoramento', {
        body: { tipo },
      });

      if (error) {
        // Se for bloqueado por outro job, mostrar mensagem amigável
        if (data?.blocked) {
          toast.warning(data.message || 'Aguarde outra execução finalizar');
        } else {
          throw error;
        }
      } else if (data?.blocked) {
        toast.warning(data.message || 'Aguarde outra execução finalizar');
      } else if (data?.success) {
        toast.success(`${tipo} concluído: ${data.totalEncontrados || 0} encontrados`);
      } else if (data?.success === false && data?.error) {
        toast.error(`Erro: ${data.error}`);
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
