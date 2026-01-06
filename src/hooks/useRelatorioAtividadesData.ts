import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * @deprecated Use useRelatorioPrazosData, useRelatorioTarefasData, and useRelatorioAndamentosData instead.
 * This hook is kept for backward compatibility but calls the legacy RPC.
 */
export function useRelatorioAtividadesData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-atividades-data"],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_atividades');
      
      if (error) throw error;
      
      return data as {
        totalPrazos: number;
        prazosStatus: { name: string; value: number; color: string }[];
        atividadesConcluidas: number;
        atividadesNaoConcluidas: number;
        atividadesPorArea: { name: string; concluidas: number; pendentes: number }[];
        evolucaoAndamentos: { ano: string; total: number }[];
        andamentosPorArea: { name: string; value: number; color: string }[];
      };
    },
  });
}
