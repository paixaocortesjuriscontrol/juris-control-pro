import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ItensNaoTratadosCounts {
  tarefas: number;
  prazos: number;
  eventos: number;
  audiencias: number;
  parcelas: number;
  total: number;
}

const ZERO: ItensNaoTratadosCounts = {
  tarefas: 0,
  prazos: 0,
  eventos: 0,
  audiencias: 0,
  parcelas: 0,
  total: 0,
};

/**
 * Contador de itens criados pelo botão "Adicionar" (tarefas, prazos, eventos,
 * audiências e parcelas) que já venceram e continuam sem tratamento.
 */
export function useItensNaoTratados(coordenacaoIds: string[]) {
  const key = [...coordenacaoIds].sort().join(",");

  return useQuery({
    queryKey: ["itens-nao-tratados", key],
    enabled: coordenacaoIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_itens_nao_tratados_por_coordenacao", {
        p_coordenacao_ids: coordenacaoIds,
      });
      if (error) throw error;

      const out: Record<string, ItensNaoTratadosCounts> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (data ?? []) as any[]) {
        out[row.coordenacao_id] = {
          tarefas: Number(row.tarefas ?? 0),
          prazos: Number(row.prazos ?? 0),
          eventos: Number(row.eventos ?? 0),
          audiencias: Number(row.audiencias ?? 0),
          parcelas: Number(row.parcelas ?? 0),
          total: Number(row.total ?? 0),
        };
      }
      for (const id of coordenacaoIds) if (!out[id]) out[id] = { ...ZERO };
      return out;
    },
  });
}
