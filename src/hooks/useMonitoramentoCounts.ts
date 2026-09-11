import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Contadores do menu Monitoramento (calculados no servidor via RPC, respeitando o escopo do usuário):
 * - movimentacoes: eventos (movimentações) ainda não lidos
 * - divergencias: divergências Judit pendentes
 */
export function useMonitoramentoCounts() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["monitoramento-counts", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monitoramento_counts");
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return {
        movimentacoes: Number(row?.movimentacoes ?? 0),
        divergencias: Number(row?.divergencias ?? 0),
      };
    },
  });

  const movimentacoes = data?.movimentacoes ?? 0;
  const divergencias = data?.divergencias ?? 0;

  return { movimentacoes, divergencias, total: movimentacoes + divergencias };
}

