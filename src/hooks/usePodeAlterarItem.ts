import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const MSG_SOMENTE_RESPONSAVEL = "Somente o responsável pode alterar a situação deste item.";

/**
 * Diz se o usuário logado pode mudar a situação de um item (prazo/tarefa).
 * A regra oficial fica no banco (pode_alterar_situacao_item); aqui só espelhamos
 * para deixar o seletor somente leitura.
 */
export function usePodeAlterarItem(tarefaId?: string | null, enabled = true) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["pode-alterar-item", user?.id, tarefaId],
    enabled: enabled && !!user?.id && !!tarefaId,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pode_alterar_situacao_item", { _user: user!.id, _tarefa: tarefaId });
      if (error) return true;
      return data !== false;
    },
  });
  return { podeAlterar: data !== false, loading: isLoading };
}

/** Converte o erro do banco em mensagem amigável quando for bloqueio de terceiros. */
export function mensagemBloqueioSituacao(err: any): string | null {
  const m = String(err?.message || "");
  return m.includes("Somente o responsável") ? MSG_SOMENTE_RESPONSAVEL : null;
}
