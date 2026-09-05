import { useEffect, useState } from "react";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import {
  fetchResponsaveisPorItemCached,
  invalidateDistribuicaoTstCache,
} from "@/utils/distribuicaoTstCache";

export const SEM_RESPONSAVEL_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Processos marcados como prontos em que NENHUMA das matérias selecionadas
 * consta na lista de pedidos do dossiê ("Revisar Lista de matérias").
 *
 * O cálculo NÃO acontece mais no navegador: ele é gravado na coluna
 * `revisar_lista_materias` sempre que a ficha é salva, no "Marcar Pronto" em
 * lote e no botão "Verificar Pendências". Aqui apenas filtramos por essa
 * coluna no banco e distribuímos os IDs entre os responsáveis.
 */
export function useSemMateriaDossiePorResponsavel(filters: DistribuicaoTstFilters) {
  const [map, setMap] = useState<Record<string, number>>({});
  const [idsPorUsuario, setIdsPorUsuario] = useState<Record<string, string[]>>({});
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const alvo = await fetchAllDistribuicaoTstIds({
          ...filters,
          revisarListaMaterias: "sim",
        });
        if (cancelled) return;
        if (!alvo || alvo.length === 0) {
          setMap({});
          setIdsPorUsuario({});
          setIds([]);
          return;
        }
        setIds(alvo);

        const respPorItem = await fetchResponsaveisPorItemCached();
        if (cancelled) return;
        const porUsuario: Record<string, number> = {};
        const idsUsuario: Record<string, string[]> = {};
        const semIds: string[] = [];
        for (const id of alvo) {
          const usuarios = respPorItem.get(id);
          if (!usuarios || usuarios.length === 0) {
            semIds.push(id);
            continue;
          }
          for (const usuarioId of usuarios) {
            porUsuario[usuarioId] = (porUsuario[usuarioId] || 0) + 1;
            (idsUsuario[usuarioId] = idsUsuario[usuarioId] || []).push(id);
          }
        }
        if (semIds.length > 0) {
          porUsuario[SEM_RESPONSAVEL_ID] = semIds.length;
          idsUsuario[SEM_RESPONSAVEL_ID] = semIds;
        }

        if (!cancelled) {
          setMap(porUsuario);
          setIdsPorUsuario(idsUsuario);
        }
      } catch (e) {
        console.warn("[useSemMateriaDossiePorResponsavel] falhou:", e);
        if (!cancelled) {
          setMap({});
          setIdsPorUsuario({});
          setIds([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadTick]);

  return {
    map,
    idsPorUsuario,
    ids,
    loading,
    refetch: () => {
      invalidateDistribuicaoTstCache();
      setReloadTick((t) => t + 1);
    },
  };
}
