import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

export interface MembroMencionavel {
  id: string;
  nome: string;
}

/**
 * Membros mencionáveis (@) — todos os usuários das coordenações às quais o
 * usuário logado pertence. Admin: todos os membros de todas as coordenações.
 */
export function useMembrosMencionaveis() {
  const { coordenacoes, isLoading: loadingCoords } = useCoordenacoesDoUsuario();
  const ids = coordenacoes.map((c) => c.id).sort();

  const query = useQuery({
    queryKey: ["membros-mencionaveis", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MembroMencionavel[]> => {
      const userIds = new Set<string>();

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", ids);
      (membros || []).forEach((m: any) => m.usuario_id && userIds.add(m.usuario_id));

      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .in("id", ids);
      (coords || []).forEach((c: any) => c.coordenador_id && userIds.add(c.coordenador_id));

      if (userIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", Array.from(userIds));

      return (profiles || [])
        .map((p: any) => ({ id: p.id as string, nome: (p.nome as string) || "Usuário" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  return {
    membros: query.data ?? [],
    isLoading: loadingCoords || query.isLoading,
  };
}