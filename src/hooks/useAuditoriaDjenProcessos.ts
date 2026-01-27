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

  const reprocessarLote = useMutation({
    mutationFn: async (lote: LoteDjenProcessos) => {
      const { data, error } = await supabase.functions.invoke('monitorar-djen-processos', {
        body: {
          dataInicio: lote.detalhes?.dataInicio,
          dataFim: lote.detalhes?.dataFim,
          continuarDe: lote.detalhes?.offset,
          completeRun: true,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const novas = (data?.novas ?? data?.novasPublicacoes ?? 0) as number;
      toast.success(`Lote reprocessado: ${novas} novas publicações`);
      queryClient.invalidateQueries({ queryKey: ['auditoria-djen-processos'] });
    },
    onError: (error) => {
      toast.error(`Erro ao reprocessar: ${error.message}`);
    },
  });

  // Nova mutation para retomar de onde parou em caso de erro
  const retomarDeOndeParou = useMutation({
    mutationFn: async () => {
      // Buscar configuração para obter o offset salvo
      const { data: config, error: configError } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen_processos')
        .maybeSingle();

      if (configError) throw configError;

      const metadata = config?.metadata as Record<string, any> | null;
      const nextOffset = metadata?.next_offset || 0;
      const podeRetomar = metadata?.pode_retomar || nextOffset > 0;

      if (!podeRetomar && nextOffset === 0) {
        throw new Error('Não há execução para retomar. Inicie uma nova execução.');
      }

      // Limpar flags de erro antes de retomar
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...metadata,
            status: 'em_andamento',
            ultimo_erro: null,
            erro_em: null,
            pode_retomar: false,
            cancelado: false,
          },
        })
        .eq('tipo', 'djen_processos');

      // Invocar com continuarDe = offset salvo
      const { data, error } = await supabase.functions.invoke('monitorar-djen-processos', {
        body: {
          continuarDe: nextOffset,
          completeRun: true,
        },
      });

      if (error) throw error;
      return { ...data, offsetRetomado: nextOffset };
    },
    onSuccess: (data) => {
      toast.success(`Retomando do offset ${data.offsetRetomado}. Acompanhe o progresso.`);
      queryClient.invalidateQueries({ queryKey: ['auditoria-djen-processos'] });
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
    },
    onError: (error) => {
      toast.error(`Erro ao retomar: ${error.message}`);
    },
  });

  return {
    lotes,
    reprocessarLote,
    retomarDeOndeParou,
  };
}
