import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

/**
 * Extrai o ID "real" de um item no banco, removendo prefixos usados na UI
 * (audiência, prazo-tst) e chaves compostas (::) criadas para recorrência.
 */
export function getItemRawId(itemId: string): string {
  return String(itemId)
    .replace(/^audiencia-det-/, "")
    .replace(/^prazo-tst-/, "")
    .replace(/^parcela-/, "")
    .split("::")[0];
}

/**
 * Retorna o Set de IDs de itens que possuem pelo menos uma subatividade vinculada.
 * Util para mostrar o indicador "A" (atividade) em cards/listas de tarefas, prazos, audiências etc.
 */
export function useItensComAtividades(items: ItemAgendaUnificado[] | undefined) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((item) => {
      if (!item?.id) return;
      set.add(getItemRawId(item.id));
    });
    return Array.from(set);
  }, [items]);

  return useQuery({
    queryKey: ["itens-com-atividades", ids],
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const result = new Set<string>();
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) {
        chunks.push(ids.slice(i, i + 100));
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await (supabase as any)
            .from("subatividades_item")
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

/**
 * Retorna a contagem de atividades (subatividades) por item, para exibir
 * badges "N atividade(s)" em listas/cards (ex.: abas laterais do Processo).
 */
export function useContagemAtividades(itemIds: (string | null | undefined)[]) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    (itemIds || []).forEach((id) => {
      if (id) set.add(getItemRawId(String(id)));
    });
    return Array.from(set).sort();
  }, [itemIds]);

  return useQuery({
    queryKey: ["contagem-atividades-itens", ids],
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const contagem: Record<string, number> = {};
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
      await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await (supabase as any)
            .from("subatividades_item")
            .select("item_id")
            .in("item_id", chunk);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            if (!row.item_id) return;
            contagem[row.item_id] = (contagem[row.item_id] || 0) + 1;
          });
        })
      );
      return contagem;
    },
  });
}
