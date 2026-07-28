import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna os IDs dos coordenadores (titular + membros com papel de coordenador
 * ou assistente coordenador) de uma coordenação.
 */
export function useCoordenadoresDaCoordenacao(coordenacaoId?: string | null) {
  return useQuery({
    queryKey: ["coordenadores-da-coordenacao", coordenacaoId],
    enabled: !!coordenacaoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
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
