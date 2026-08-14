import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UsuarioCoordenacao {
  id: string;
  nome: string;
  cargo?: string | null;
}

export function useUsuariosCoordenacao(coordenacaoId?: string | null) {
  return useQuery({
    queryKey: ["usuarios-coordenacao", "v2", coordenacaoId],
    enabled: !!coordenacaoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UsuarioCoordenacao[]> => {
      if (!coordenacaoId) return [];

      const [{ data: membros, error: membrosError }, { data: coord, error: coordError }] = await Promise.all([
        supabase
          .from("membros_coordenacao")
          .select("usuario_id, cargo")
          .eq("coordenacao_id", coordenacaoId),
        supabase
          .from("coordenacoes")
          .select("coordenador_id")
          .eq("id", coordenacaoId)
          .maybeSingle(),
      ]);
      if (membrosError) throw membrosError;
      if (coordError) throw coordError;

      const coordId = coord?.coordenador_id;
      const ids = Array.from(new Set([
        ...(membros || []).map((m) => m.usuario_id).filter(Boolean),
        ...(coordId ? [coordId] : []),
      ]));
      if (ids.length === 0) return [];

      // profiles_basic expõe apenas id e nome. A consulta anterior pedia email,
      // fazendo o PostgREST rejeitar toda a listagem e exibir zero usuários.
      const { data: perfis, error: perfisError } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", ids);
      if (perfisError) throw perfisError;

      const cargos = new Map(
        (membros || []).map((m) => [m.usuario_id, m.cargo] as const),
      );
      const lista: UsuarioCoordenacao[] = (perfis || []).map((perfil) => ({
        id: perfil.id,
        nome: perfil.nome || "Sem nome",
        cargo: cargos.get(perfil.id) || (perfil.id === coordId ? "coordenador" : null),
      }));

      return lista
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
