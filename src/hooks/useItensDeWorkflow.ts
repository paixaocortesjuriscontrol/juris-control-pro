import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

/**
 * Retorna o Set de IDs de itens (tarefas, prazos, audiências, eventos)
 * que foram materializados por uma execução de Workflow.
 * Usado para exibir o indicador verde "W" no Painel de Controle.
 */
export function useItensDeWorkflow(items: ItemAgendaUnificado[] | undefined) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((item) => {
      if (!item?.id) return;
      set.add(getItemRawId(item.id));
    });
    return Array.from(set).sort();
  }, [items]);

  return useQuery({
    queryKey: ["itens-de-workflow", ids],
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const result = new Set<string>();
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
      await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await (supabase as any)
            .from("workflow_execucao_etapas")
            .select("item_id")
            .in("item_id", chunk);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            if (row.item_id) result.add(row.item_id);
          });
        })
      );
      return result;
    },
  });
}
