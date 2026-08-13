import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export interface PermissaoSituacaoRow {
  situacao: string;
  perfis: string[];
  usuarios: string[];
  ativa: boolean;
}

/**
 * Restrições de situação por coordenação + tipo de tarefa.
 * Se não existir configuração para a situação, ela é liberada para todos.
 */
export function usePermissoesSituacao(
  coordenacaoId?: string | null,
  tipoTarefa?: string | null,
) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const { data = [], isLoading } = useQuery({
    queryKey: ["permissoes-situacao", coordenacaoId, tipoTarefa],
    enabled: !!coordenacaoId && !!tipoTarefa,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PermissaoSituacaoRow[]> => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("situacao, perfis, usuarios, ativa")
        .eq("coordenacao_id", coordenacaoId!)
        .eq("tipo_tarefa", (tipoTarefa || "").trim().toUpperCase());
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        situacao: r.situacao,
        perfis: (r.perfis || []) as string[],
        usuarios: (r.usuarios || []) as string[],
        ativa: r.ativa !== false,
      }));
    },
  });

  /** Situação desativada por tipo de item não deve aparecer no seletor */
  const situacaoAtiva = useCallback(
    (valor?: string | null) => {
      if (!valor) return true;
      const regra = data.find((r) => r.situacao === valor);
      return regra ? regra.ativa : true;
    },
    [data],
  );

  const podeUsarSituacao = useCallback(
    (valor?: string | null) => {
      if (!valor) return true;
      if (role === "admin") return true;
      const regra = data.find((r) => r.situacao === valor);
      if (!regra) return true;
      if (regra.perfis.length === 0 && regra.usuarios.length === 0) return true;
      if (user?.id && regra.usuarios.includes(user.id)) return true;
      if (role && regra.perfis.includes(role)) return true;
      return false;
    },
    [data, role, user?.id],
  );

  return { regras: data, podeUsarSituacao, situacaoAtiva, loading: isLoading || roleLoading };
}
