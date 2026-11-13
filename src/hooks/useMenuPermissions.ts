import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { menuPermitido, type RegraMenuCoordenacao, type VinculoCoordenacao } from "@/lib/permissoesMenuCoordenacao";

/**
 * Permissões de menu: regra global do usuário, depois regras da coordenação
 * (membro > cargo). Ausência de registro = permitido. Admin vê tudo (salvo regra global).
 */
export function useMenuPermissions(userId?: string | null) {
  const { user } = useAuth();
  const { isAdmin, loading: loadingRole } = useUserRole();
  const targetId = userId ?? user?.id ?? null;
  const proprio = !userId || userId === user?.id;

  const query = useQuery({
    queryKey: ["permissoes-menu-usuario", targetId],
    enabled: !!targetId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_menu_usuario")
        .select("menu_path, permitido")
        .eq("user_id", targetId as string);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((row: any) => {
        map[row.menu_path] = row.permitido;
      });
      return map;
    },
  });

  const coordQuery = useQuery({
    queryKey: ["permissoes-menu-coordenacao-usuario", targetId],
    enabled: !!targetId && proprio,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: membros, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id, cargo")
        .eq("usuario_id", targetId as string);
      if (error) throw error;
      const vinculos = (membros ?? []) as VinculoCoordenacao[];
      if (!vinculos.length) return { vinculos, regras: [] as RegraMenuCoordenacao[] };
      const { data: regras, error: e2 } = await (supabase.from as any)("permissoes_menu_coordenacao")
        .select("coordenacao_id, cargo, user_id, menu_path, permitido")
        .in("coordenacao_id", vinculos.map((v) => v.coordenacao_id));
      if (e2) throw e2;
      return { vinculos, regras: (regras ?? []) as RegraMenuCoordenacao[] };
    },
  });

  const permissoes = query.data ?? {};
  const vinculos = coordQuery.data?.vinculos ?? [];
  const regras = coordQuery.data?.regras ?? [];

  const isMenuAllowed = (path: string) => {
    if (permissoes[path] !== undefined) return permissoes[path];
    if (!proprio || isAdmin) return true;
    return menuPermitido(path, targetId ?? "", permissoes, vinculos, regras);
  };

  return {
    permissoes,
    isMenuAllowed,
    isLoading: query.isLoading || (proprio && (coordQuery.isLoading || loadingRole)),
    refetch: query.refetch,
  };
}
