import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { consultarIndicadoresEmLotes } from "@/lib/consultaIndicadores";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

/**
 * Retorna o Set de IDs de itens (tarefas, prazos, audiências, eventos)
 * que foram materializados por uma execução de Workflow.
 * Usado para exibir o indicador verde "W" no Painel de Controle.
 */
export function useItensDeWorkflow(items: ItemAgendaUnificado[] | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const ids = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((item) => {
      if (!item?.id) return;
      set.add(getItemRawId(item.id));
    });
    return Array.from(set);
  }, [items]);

  return useQuery({
    queryKey: ["itens-de-workflow", ids, userId],
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const result = new Set<string>();
      const rows = await consultarIndicadoresEmLotes<{ item_id: string | null }>(
        queryClient, "itens-de-workflow", [userId], ids, 100, 60_000,
        async (chunk) => {
          const { data, error } = await (supabase as any)
            .from("workflow_execucao_etapas")
            .select("item_id")
            .in("item_id", chunk);
          if (error) throw error;
          return data || [];
        },
      );
      rows.forEach((row) => { if (row.item_id) result.add(row.item_id); });
      return result;
    },
  });
}
