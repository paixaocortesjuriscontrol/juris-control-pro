import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioResumoData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-resumo-data"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
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
