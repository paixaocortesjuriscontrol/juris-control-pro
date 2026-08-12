import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Escopo de visibilidade do Acompanhamento Especial:
 * - admin: todos os processos em acompanhamento especial
 * - coordenador / assistente coordenador: processos das suas coordenações
 * - qualquer usuário: processos em que é responsável ativo
 *
 * `processoIds === null` significa "sem restrição" (admin).
 */
export function useEscopoAcompanhamentoEspecial() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const query = useQuery({
    queryKey: ["escopo-acomp-especial", user?.id, isAdmin],
    enabled: !!user?.id && !roleLoading,
    staleTime: 60_000,
    queryFn: async () => {
      if (isAdmin) return { processoIds: null as string[] | null, podeExecutar: true };

      const userId = user!.id;
      const ids = new Set<string>();

      // Responsável ativo
      const { data: resps } = await supabase
        .from("processos_responsaveis")
        .select("processo_id")
        .eq("usuario_id", userId)
        .eq("ativo", true);
      (resps ?? []).forEach((r: any) => r.processo_id && ids.add(r.processo_id));

      // Coordenações do usuário (membro ou coordenador titular)
      const [{ data: membros }, { data: titular }] = await Promise.all([
        supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", userId),
        supabase.from("coordenacoes").select("id").eq("coordenador_id", userId),
      ]);
      const coordIds = Array.from(
        new Set([
          ...(membros ?? []).map((m: any) => m.coordenacao_id).filter(Boolean),
          ...(titular ?? []).map((c: any) => c.id).filter(Boolean),
        ])
      );

      if (coordIds.length > 0) {
        const [{ data: porCoord }, { data: extras }] = await Promise.all([
          supabase
            .from("processos")
            .select("id")
            .eq("acompanhamento_especial", true)
            .in("coordenacao_id", coordIds),
          supabase
            .from("processos_coordenacoes_responsaveis")
            .select("processo_id")
            .in("coordenacao_id", coordIds),
        ]);
        (porCoord ?? []).forEach((p: any) => ids.add(p.id));
        (extras ?? []).forEach((p: any) => p.processo_id && ids.add(p.processo_id));
      }

      return { processoIds: Array.from(ids), podeExecutar: ids.size > 0 };
    },
  });

  return {
    processoIds: query.data?.processoIds ?? [],
    semRestricao: query.data?.processoIds === null,
    podeExecutar: query.data?.podeExecutar ?? false,
    isLoading: roleLoading || query.isLoading,
  };
}
