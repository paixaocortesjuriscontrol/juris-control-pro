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
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id, cargo, usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(id, nome, email)")
        .eq("coordenacao_id", coordenacaoId!);
      if (error) throw error;
      return ((data || []) as any[]).map((m) => ({
        id: m.usuario_id || m.usuario?.id,
        nome: m.usuario?.nome || "Sem nome",
        email: m.usuario?.email,
        cargo: m.cargo,
      }));
    },
  });
}
