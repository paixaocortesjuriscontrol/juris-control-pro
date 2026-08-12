import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Retorna os fixos configurados (responsáveis e envolvidos) para a coordenação
 * e o tipo do item.
 */
export function useFixosDoTipoCoordenacao(
  coordenacaoId?: string | null,
  tipoTarefa?: string | null,
) {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["fixos-tipo-coordenacao", coordenacaoId, tipoTarefa, user?.id, isAdmin],
    enabled: !!coordenacaoId && !!tipoTarefa && !!user?.id && !roleLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ responsaveis: string[]; envolvidos: string[] }> => {
      const vazio = { responsaveis: [] as string[], envolvidos: [] as string[] };
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
        if (!souMembro && !souTitular) return vazio;
      }

      const { data, error } = await supabase
        .from("responsaveis_fixos_tipo_tarefa")
        .select("responsaveis, envolvidos")
        .eq("coordenacao_id", coordenacaoId!)
        .eq("tipo_tarefa", tipoTarefa!.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return {
        responsaveis: Array.from(new Set(((data as any)?.responsaveis || []) as string[])),
        envolvidos: Array.from(new Set(((data as any)?.envolvidos || []) as string[])),
      };
    },
  });
}

/** Compatibilidade: apenas os responsáveis fixos (lista de ids). */
export function useCoordenadoresDaCoordenacao(
  coordenacaoId?: string | null,
  tipoTarefa?: string | null,
) {
  const q = useFixosDoTipoCoordenacao(coordenacaoId, tipoTarefa);
  return { ...q, data: q.data?.responsaveis ?? [] } as typeof q & { data: string[] };
}

/** Envolvidos fixos configurados para a coordenação/tipo. */
export function useEnvolvidosFixosDaCoordenacao(
  coordenacaoId?: string | null,
  tipoTarefa?: string | null,
) {
  const q = useFixosDoTipoCoordenacao(coordenacaoId, tipoTarefa);
  return { ...q, data: q.data?.envolvidos ?? [] } as typeof q & { data: string[] };
}
