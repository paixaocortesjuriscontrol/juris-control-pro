import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RelatorioResumoResult {
  totalProcessos: number;
  processosAtivosAnoAtual: number;
  mediaEnvolvidos: string;
  totalMovimentacoes: number;
  processosPerArea: { name: string; value: number; color: string }[];
  processosPorTipoPessoa: { name: string; value: number; color: string }[];
  processosMensais: { mes: string; novos: number; encerrados: number }[];
  processosMptStatus: { name: string; value: number; color: string }[];
}

export function useRelatorioResumoData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-resumo-data"],
    staleTime: 0, // Sempre buscar dados frescos
    gcTime: 5 * 60 * 1000, // 5 minutos
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async (): Promise<RelatorioResumoResult> => {
      const { data, error } = await supabase.rpc("get_relatorio_resumo");
      
      if (error) throw error;
      
      return data as unknown as RelatorioResumoResult;
    },
  });
}
