import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioTarefasData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-tarefas-data"],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_tarefas');
      
      if (error) throw error;
      
      return data as {
        atividadesPorArea: { name: string; concluidas: number; pendentes: number }[];
        totalConcluidas: number;
        totalPendentes: number;
      };
    },
  });
}
