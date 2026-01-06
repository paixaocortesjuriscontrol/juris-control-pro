import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioAndamentosData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-andamentos-data"],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_andamentos');
      
      if (error) throw error;
      
      return data as {
        totalAndamentos: number;
        evolucaoAndamentos: { ano: string; total: number }[];
        andamentosPorArea: { name: string; value: number; color: string }[];
      };
    },
  });
}
