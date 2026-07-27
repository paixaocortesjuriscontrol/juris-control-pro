import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Permissões de menu por usuário.
 * Ausência de registro = permitido (padrão: tudo liberado).
 */
export function useMenuPermissions(userId?: string | null) {
  const { user } = useAuth();
  const targetId = userId ?? user?.id ?? null;

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

  const permissoes = query.data ?? {};

  const isMenuAllowed = (path: string) => permissoes[path] !== false;

  return {
    permissoes,
    isMenuAllowed,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}