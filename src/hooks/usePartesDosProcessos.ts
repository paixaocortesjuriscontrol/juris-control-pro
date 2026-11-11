import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";

export interface PartesProcesso {
  ativo: string;
  passivo: string;
}

/** Busca as partes dos processos em lotes, reaproveitando o cache entre as visões. */
export function usePartesDosProcessos(itens: ItemAgendaUnificado[]) {
  const ids = useMemo(
    () =>
      Array.from(
        new Set(
          itens
            .map((item) => item.processo_id || item.processo?.id)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [itens],
  );

  return useQuery({
    queryKey: ["partes-processos-agenda", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, PartesProcesso>();
      for (let i = 0; i < ids.length; i += 200) {
        const lote = ids.slice(i, i + 200);
        const { data, error } = await supabase
          .from("processos")
          .select("id, polo_ativo, polo_passivo")
          .in("id", lote);
        if (error) throw error;
        (data ?? []).forEach((processo) => {
          map.set(processo.id, {
            ativo: (processo.polo_ativo ?? "").trim(),
            passivo: (processo.polo_passivo ?? "").trim(),
          });
        });
      }
      return map;
    },
  });
}

/** Usa os dados já presentes no item e completa com os polos cadastrados no processo. */
export function partesDoItem(
  item: ItemAgendaUnificado,
  partesPorProcesso?: ReadonlyMap<string, PartesProcesso>,
): PartesProcesso {
  const itemComPartes = item as ItemAgendaUnificado & {
    polo_ativo?: string | null;
    polo_passivo?: string | null;
  };
  const processoId = item.processo_id || item.processo?.id || "";
  const doBanco = partesPorProcesso?.get(processoId);

  return {
    ativo: (itemComPartes.partes_ativas || itemComPartes.polo_ativo || doBanco?.ativo || "").trim(),
    passivo: (itemComPartes.partes_passivas || itemComPartes.polo_passivo || doBanco?.passivo || "").trim(),
  };
}
