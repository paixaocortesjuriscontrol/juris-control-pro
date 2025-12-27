import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioResumoData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-resumo-data"],
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_resumo');
      
      if (error) throw error;
      
      return data as {
        totalProcessos: number;
        processosAtivosAnoAtual: number;
        mediaEnvolvidos: string;
        totalMovimentacoes: number;
        processosPerArea: { name: string; value: number; color: string }[];
        processosPorTipoPessoa: { name: string; value: number; color: string }[];
        processosMensais: { mes: string; novos: number; encerrados: number }[];
      };
    },
  });
}
