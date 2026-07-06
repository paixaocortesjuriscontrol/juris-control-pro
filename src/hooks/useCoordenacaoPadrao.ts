import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Retorna o id da coordenação padrão do usuário logado.
 * Prioridade:
 *  1. profiles.coordenacao_padrao_id (definida em Configurações → Meu Perfil)
 *  2. primeira coordenação encontrada em membros_coordenacao
 */
export function useCoordenacaoPadrao() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["coordenacao-padrao", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null;

      // 1) profile.coordenacao_padrao_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("coordenacao_padrao_id")
        .eq("id", user.id)
        .maybeSingle();

      const padraoId = (profile as any)?.coordenacao_padrao_id as string | null | undefined;
      if (padraoId) return padraoId;

      // 2) primeira coordenação em membros_coordenacao
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id)
        .limit(1);

      return membros?.[0]?.coordenacao_id ?? null;
    },
  });
}