import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioPrazosData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-prazos-data"],
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_prazos');
      
      if (error) throw error;
      
      return data as {
        totalPrazos: number;
        prazosStatus: { name: string; value: number; color: string }[];
        prazosCumpridos: number;
        prazosPendentes: number;
        prazosAtrasados: number;
      };
    },
  });
}
