import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Retorna os IDs dos coordenadores (titular + membros com papel de coordenador)
 * de uma coordenação — usados como responsáveis obrigatórios (cadeado).
 *
 * Regra: só travamos coordenadores da MESMA coordenação do usuário logado.
 * Se a coordenação do item pertencer a outra equipe (ex.: processo compartilhado
 * de outra coordenação), nenhum responsável é fixado. Admin não sofre restrição.
 */
export function useCoordenadoresDaCoordenacao(coordenacaoId?: string | null) {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["coordenadores-da-coordenacao", coordenacaoId, user?.id, isAdmin],
    enabled: !!coordenacaoId && !!user?.id && !roleLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      // O usuário logado pertence a esta coordenação?
      if (!isAdmin) {
        const [{ data: souMembro }, { data: souTitular }] = await Promise.all([
          supabase
            .from("membros_coordenacao")
            .select("coordenacao_id")
            .eq("coordenacao_id", coordenacaoId!)
            .eq("usuario_id", user!.id)
            .maybeSingle(),
          supabase
            .from("coordenacoes")
            .select("id")
            .eq("id", coordenacaoId!)
            .eq("coordenador_id", user!.id)
            .maybeSingle(),
        ]);
        if (!souMembro && !souTitular) return [];
      }

      const ids = new Set<string>();

      const { data: coord } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .eq("id", coordenacaoId!)
        .maybeSingle();
      if ((coord as any)?.coordenador_id) ids.add((coord as any).coordenador_id as string);

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .eq("coordenacao_id", coordenacaoId!);
      const membroIds = (membros || []).map((m: any) => m.usuario_id).filter(Boolean);

      if (membroIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", membroIds)
          .in("role", ["coordenador"]);
        (roles || []).forEach((r: any) => ids.add(r.user_id));
      }

      return Array.from(ids);
    },
  });
}
