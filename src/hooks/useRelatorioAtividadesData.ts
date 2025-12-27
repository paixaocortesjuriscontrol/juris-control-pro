import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioAtividadesData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-atividades-data"],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
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
