import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UsuarioCoordenacao {
  id: string;
  nome: string;
  email?: string;
  cargo?: string | null;
}

export function useUsuariosCoordenacao(coordenacaoId?: string | null) {
  return useQuery({
    queryKey: ["usuarios-coordenacao", coordenacaoId],
    enabled: !!coordenacaoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UsuarioCoordenacao[]> => {
      const [{ data, error }, { data: coord }] = await Promise.all([
        supabase
          .from("membros_coordenacao")
          .select("usuario_id, cargo, usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(id, nome, email)")
          .eq("coordenacao_id", coordenacaoId!),
        supabase
          .from("coordenacoes")
          .select("coordenador_id, coordenador:profiles_basic!coordenacoes_coordenador_id_fkey(id, nome, email)")
          .eq("id", coordenacaoId!)
          .maybeSingle(),
      ]);
      if (error) throw error;

      const lista: UsuarioCoordenacao[] = ((data || []) as any[]).map((m) => ({
        id: m.usuario_id || m.usuario?.id,
        nome: m.usuario?.nome || "Sem nome",
        email: m.usuario?.email,
        cargo: m.cargo,
      }));

      // Garante que o coordenador apareça mesmo sem registro em membros_coordenacao
      const c: any = coord as any;
      const coordId = c?.coordenador_id || c?.coordenador?.id;
      if (coordId && !lista.some((u) => u.id === coordId)) {
        lista.push({
          id: coordId,
          nome: c?.coordenador?.nome || "Coordenador",
          email: c?.coordenador?.email,
          cargo: "coordenador",
        });
      }

      return lista
        .filter((u) => !!u.id)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
