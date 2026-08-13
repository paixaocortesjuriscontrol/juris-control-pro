import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

export const TIPO_REAGENDAMENTO = "REAGENDAMENTO";
export const SITUACAO_REAGENDAR = "reagendar";

/**
 * Controle de quem pode reagendar itens (por coordenação).
 * Sem configuração => liberado para todos. Admin sempre pode.
 */
export function usePodeReagendar(coordenacaoId?: string | null) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();

  const idsEfetivos = coordenacaoId
    ? [coordenacaoId]
    : isAdmin
      ? []
      : coordenacoes.map((c) => c.id);

  const { data = [], isLoading } = useQuery({
    queryKey: ["permissoes-reagendamento", idsEfetivos.slice().sort().join(",")],
    enabled: idsEfetivos.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("perfis, usuarios, ativa")
        .in("coordenacao_id", idsEfetivos)
        .eq("tipo_tarefa", TIPO_REAGENDAMENTO)
        .eq("situacao", SITUACAO_REAGENDAR);
      if (error) throw error;
      return (data || []) as { perfis: string[] | null; usuarios: string[] | null; ativa: boolean | null }[];
    },
  });

  const regrasRestritivas = data.filter(
    (r) => ((r.perfis || []).length + (r.usuarios || []).length) > 0 || r.ativa === false,
  );

  const podeReagendar = (() => {
    if (role === "admin") return true;
    if (regrasRestritivas.length === 0) return true;
    return regrasRestritivas.some((r) => {
      if (r.ativa === false) return false;
      if (user?.id && (r.usuarios || []).includes(user.id)) return true;
      if (role && (r.perfis || []).includes(role)) return true;
      return false;
    });
  })();

  return { podeReagendar, loading: isLoading || roleLoading };
}
