import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LoteDetalhes {
  offset?: number;
  duplicadas?: number;
  hasMore?: boolean;
  dataInicio?: string;
  dataFim?: string;
  totalProcessos?: number;
  processosComResultados?: number;
}

export interface LoteDjenProcessos {
  id: string;
  executado_em: string;
  processos_verificados: number;
  novos_andamentos: number;
  processos_com_novos: number;
  erros: number;
  detalhes: LoteDetalhes | null;
}

export function useAuditoriaDjenProcessos() {
  const queryClient = useQueryClient();

  const lotes = useQuery({
    queryKey: ['auditoria-djen-processos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .order('executado_em', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((row) => ({
        ...row,
        detalhes: row.detalhes as LoteDetalhes | null,
      })) as LoteDjenProcessos[];
    },
  });

  // REMOVIDO: reprocessarLote via Edge Function
  // DJEN Processos agora é 100% browser-only para evitar WORKER_LIMIT (546).
  // Use o hook useMonitorarDjenProcessosBrowser diretamente no componente.
  const reprocessarLote = useMutation({
    mutationFn: async (_lote: LoteDjenProcessos) => {
      // Não chamar Edge Function - use o hook de browser no componente
      throw new Error(
        'Reprocessamento via Edge Function desabilitado. ' +
        'Use o botão "Executar" no card DJEN Processos (execução local no navegador).'
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // REMOVIDO: retomarDeOndeParou via Edge Function
  // DJEN Processos agora é 100% browser-only para evitar WORKER_LIMIT (546).
  const retomarDeOndeParou = useMutation({
    mutationFn: async () => {
      throw new Error(
        'Retomada via Edge Function desabilitada. ' +
        'Use o botão "Retomar" no card DJEN Processos (execução local no navegador).'
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // REMOVIDO: reiniciarDoZero via Edge Function
  // DJEN Processos agora é 100% browser-only para evitar WORKER_LIMIT (546).
  const reiniciarDoZero = useMutation({
    mutationFn: async () => {
      // Limpar metadata para permitir novo início
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            status: 'idle',
            next_offset: 0,
            current: 0,
            total: 0,
            novas: 0,
            percentage: 0,
            pode_retomar: false,
            cancelado: false,
            ultimo_erro: null,
            erro_em: null,
            browser_execution: true,
          },
        })
        .eq('tipo', 'djen_processos');

      toast.info('Checkpoint limpo. Use o botão "Executar" no card DJEN Processos.');
      return { cleared: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditoria-djen-processos'] });
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
    },
    onError: (error) => {
      toast.error(`Erro ao limpar: ${error.message}`);
    },
  });

  return {
    lotes,
    reprocessarLote,
    retomarDeOndeParou,
    reiniciarDoZero,
  };
}
