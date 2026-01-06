import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfiguracaoMonitoramento {
  id: string;
  tipo: string;
  frequencia: string;
  ativo: boolean;
  ultima_execucao: string | null;
  coordenacao_id: string | null;
  metadata: {
    next_offset?: number;
    last_batch_size?: number;
    last_complete_run?: string;
    current_monitoramento_index?: number;
    current_tribunal_offset?: number;
    monitoramentos_processados?: number;
    novas_publicacoes?: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export function useConfiguracoesMonitoramento(coordenacaoId?: string | null) {
  const queryClient = useQueryClient();

  // Monitoramentos são globais (coordenacao_id = null), não por coordenação
  // O parâmetro coordenacaoId é mantido para compatibilidade futura
  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ['configuracoes-monitoramento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, tipo, frequencia, ativo, ultima_execucao, coordenacao_id, metadata, created_at, updated_at')
        .is('coordenacao_id', null)
        .order('tipo');

      if (error) throw error;
      return data as ConfiguracaoMonitoramento[];
    },
  });

  const atualizarConfiguracao = useMutation({
    mutationFn: async ({ id, frequencia, ativo, tipo }: { id: string; frequencia?: string; ativo?: boolean; tipo?: string }) => {
      const updates: any = {};
      if (frequencia !== undefined) updates.frequencia = frequencia;
      if (ativo !== undefined) updates.ativo = ativo;

      const { error } = await supabase
        .from('configuracoes_monitoramento')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Se a frequência foi alterada, atualizar o cron job com o tipo
      if (frequencia !== undefined && tipo) {
        const { error: cronError } = await supabase.functions.invoke('atualizar-cron-monitoramento', {
          body: { frequencia, tipo }
        });
        if (cronError) {
          console.error('Erro ao atualizar cron:', cronError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      toast.success("Configuração atualizada!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const executarMonitoramento = useMutation({
    mutationFn: async (tipo: string) => {
      if (tipo === 'redistribuicoes') {
        const { data, error } = await supabase.functions.invoke('monitorar-redistribuicoes');
        if (error) throw error;
        return data;
      }
      if (tipo === 'andamentos') {
        const { data, error } = await supabase.functions.invoke('monitorar-andamentos');
        if (error) throw error;
        return data;
      }
      if (tipo === 'distribuicoes') {
        const { data, error } = await supabase.functions.invoke('monitorar-distribuicoes');
        if (error) throw error;
        return data;
      }
      if (tipo === 'djen') {
        const { data, error } = await supabase.functions.invoke('monitorar-djen');
        if (error) throw error;
        return data;
      }
      if (tipo === 'termos') {
        const { data, error } = await supabase.functions.invoke('monitorar-termos');
        if (error) throw error;
        return data;
      }
      throw new Error("Tipo de monitoramento não suportado");
    },
    onSuccess: (data, tipo) => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      
      if (tipo === 'distribuicoes') {
        const found = data?.novasDistribuicoes || 0;
        const tribunais = data?.tribunaisProcessados || 0;
        if (data?.completedRun) {
          toast.success(`Monitoramento completo: ${found} novas distribuições encontradas`);
        } else {
          toast.success(`Lote processado: ${tribunais} tribunais verificados, ${found} distribuições encontradas`);
        }
      } else if (tipo === 'djen') {
        const novas = data?.novasPublicacoes || 0;
        const processados = data?.monitoramentosProcessados || 0;
        toast.success(`Monitoramento concluído: ${processados} monitoramentos verificados, ${novas} novas publicações`);
      } else if (tipo === 'termos') {
        const alertas = data?.alertasCriados || 0;
        const processos = data?.processosVerificados || 0;
        toast.success(`Varredura concluída: ${processos} processos verificados, ${alertas} alertas criados`);
      } else if (data?.isComplete) {
        const message = tipo === 'andamentos' 
          ? `Monitoramento completo: ${data?.results?.checked || 0} processos verificados, ${data?.results?.newMovements || 0} andamentos encontrados`
          : `Monitoramento completo: ${data?.results?.checked || 0} processos verificados`;
        toast.success(message);
      } else if (data?.progress) {
        toast.success(`Lote processado: ${data.progress.current} de ${data.progress.total} (${data.progress.percentage}%)`);
      } else {
        toast.success(`Monitoramento concluído: ${data?.results?.checked || 0} processos verificados`);
      }
    },
    onError: (error) => {
      toast.error(`Erro no monitoramento: ${error.message}`);
    },
  });

  const configuracaoRedistribuicoes = configuracoes.find(c => c.tipo === 'redistribuicoes');
  const configuracaoAndamentos = configuracoes.find(c => c.tipo === 'andamentos');
  const configuracaoDistribuicoes = configuracoes.find(c => c.tipo === 'distribuicoes');
  const configuracaoDjen = configuracoes.find(c => c.tipo === 'djen');
  const configuracaoTermos = configuracoes.find(c => c.tipo === 'termos');

  return {
    configuracoes,
    configuracaoRedistribuicoes,
    configuracaoAndamentos,
    configuracaoDistribuicoes,
    configuracaoDjen,
    configuracaoTermos,
    isLoading,
    atualizarConfiguracao,
    executarMonitoramento,
  };
}
