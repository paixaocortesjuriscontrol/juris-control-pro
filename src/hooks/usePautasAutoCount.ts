import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Contador de pautas encontradas automaticamente pelo DJEN (origem='djen_auto')
 * ainda aguardando avaliação (status_avaliacao='a_avaliar').
 * Exibido como badge no item "Pautas de Julgamento" do menu (item já restrito
 * à Coordenação Dra. Renata Oficial).
 */
export function usePautasAutoCount() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["pautas-auto-count", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pautas_tst" as any)
        .select("id", { count: "exact", head: true })
        .eq("origem", "djen_auto")
        .eq("status_avaliacao", "a_avaliar");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return data ?? 0;
}
