import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HistoricoMonitoramento {
  id: string;
  tipo: string;
  processos_verificados: number;
  novos_andamentos: number;
  processos_com_novos: number;
  erros: number;
  detalhes: any;
  executado_em: string;
  created_at: string;
}

export function useHistoricoMonitoramento(tipo?: string) {
  return useQuery({
    queryKey: ['historico-monitoramento', tipo],
    queryFn: async () => {
      let query = supabase
        .from('historico_monitoramento')
        .select('*')
        .order('executado_em', { ascending: false })
        .limit(50);

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HistoricoMonitoramento[];
    },
  });
}
