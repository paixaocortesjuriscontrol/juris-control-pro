import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CoordenacaoUsuario {
  id: string;
  nome: string;
  area?: string | null;
}

/**
 * Regra única de coordenação para os formulários do botão "+ Adicionar":
 * - Admin ou usuário com mais de uma coordenação: precisa escolher.
 * - Usuário com exatamente uma coordenação: vinculação automática, sem select.
 */
export function useCoordenacoesDoUsuario() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["coordenacoes-do-usuario", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const userId = user!.id;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = (roles || []).some((r: any) => r.role === "admin");

      if (isAdmin) {
        const { data: all } = await supabase
          .from("coordenacoes")
          .select("id, nome, area")
          .order("nome");
        return {
          isAdmin: true,
          coordenacoes: (all || []) as CoordenacaoUsuario[],
        };
      }

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", userId);

      const { data: coordenador } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", userId);

      const ids = Array.from(new Set([
        ...(membros || []).map((m: any) => m.coordenacao_id).filter(Boolean),
        ...(coordenador || []).map((c: any) => c.id).filter(Boolean),
      ]));

      if (ids.length === 0) {
        return { isAdmin: false, coordenacoes: [] as CoordenacaoUsuario[] };
      }

      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .in("id", ids)
        .order("nome");

      return {
        isAdmin: false,
        coordenacoes: (coords || []) as CoordenacaoUsuario[],
      };
    },
  });

  const data = query.data;
  const isAdmin = data?.isAdmin ?? false;
  const coordenacoes = data?.coordenacoes ?? [];
  const unicaCoordenacaoId = !isAdmin && coordenacoes.length === 1 ? coordenacoes[0].id : null;
  const precisaSelecionar = isAdmin || coordenacoes.length > 1;

  return {
    isAdmin,
    coordenacoes,
    unicaCoordenacaoId,
    precisaSelecionar,
    isLoading: query.isLoading,
  };
}
