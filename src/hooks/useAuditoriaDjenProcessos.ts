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
          dataInicio: lote.detalhes.dataInicio,
          dataFim: lote.detalhes.dataFim,
          continuarDe: lote.detalhes.offset,
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

  return {
    lotes,
    reprocessarLote,
  };
}
