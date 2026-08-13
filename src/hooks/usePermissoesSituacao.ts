import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

export interface PermissaoSituacaoRow {
  situacao: string;
  perfis: string[];
  usuarios: string[];
  ativa: boolean;
  comentarioObrigatorio: boolean;
}

/** Linha usada para guardar regras que valem para todo o tipo de tarefa */
export const SITUACAO_TODAS = "__TODAS__";

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
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();

  /**
   * Quando o formulário ainda não tem coordenação escolhida, usa as coordenações
   * do próprio usuário (não-admin) para já aplicar as regras configuradas.
   */
  const idsEfetivos = coordenacaoId
    ? [coordenacaoId]
    : isAdmin
      ? []
      : coordenacoes.map((c) => c.id);

  const { data = [], isLoading } = useQuery({
    queryKey: ["permissoes-situacao", idsEfetivos.slice().sort().join(","), tipoTarefa],
    enabled: idsEfetivos.length > 0 && !!tipoTarefa,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PermissaoSituacaoRow[]> => {
      const { data, error } = await supabase
        .from("permissoes_situacao_tipo_tarefa")
        .select("situacao, perfis, usuarios, ativa, comentario_obrigatorio")
        .in("coordenacao_id", idsEfetivos)
        .eq("tipo_tarefa", (tipoTarefa || "").trim().toUpperCase());
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        situacao: r.situacao,
        perfis: (r.perfis || []) as string[],
        usuarios: (r.usuarios || []) as string[],
        ativa: r.ativa !== false,
        comentarioObrigatorio: r.comentario_obrigatorio === true,
      }));
    },
  });

  /** Comentário obrigatório ao mudar a situação deste tipo de tarefa */
  const comentarioObrigatorio = data.some(
    (r) => r.situacao === SITUACAO_TODAS && r.comentarioObrigatorio,
  );

  /** Situação desativada por tipo de item não deve aparecer no seletor */
  const situacaoAtiva = useCallback(
    (valor?: string | null) => {
      if (!valor) return true;
      const regras = data.filter((r) => r.situacao === valor);
      if (regras.length === 0) return true;
      // Desativada em qualquer coordenação aplicável => não aparece no seletor
      return !regras.some((r) => !r.ativa);
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

  return {
    regras: data,
    podeUsarSituacao,
    situacaoAtiva,
    comentarioObrigatorio,
    loading: isLoading || roleLoading,
  };
}
