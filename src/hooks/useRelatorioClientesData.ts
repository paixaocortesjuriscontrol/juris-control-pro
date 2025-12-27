import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRelatorioClientesData(enabled: boolean) {
  return useQuery({
    queryKey: ["relatorio-clientes-data"],
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    enabled,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_relatorio_clientes');
      
      if (error) throw error;
      
      return data as {
        processosPorCliente: { nome: string; tipo: string; total: number; ativos: number; encerrados: number; prazosPendentes: number }[];
        processosPorVara: { vara: string; total: number }[];
        duracaoClientes: { nome: string; mediaDias: number; processos: number }[];
        atividadesPorTarefa: { titulo: string; total: number; concluidas: number; atrasadas: number }[];
        produtividadeAdvogados: { nome: string; processos: number }[];
      };
    },
  });
}
