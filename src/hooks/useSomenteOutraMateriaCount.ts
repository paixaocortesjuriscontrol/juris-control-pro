import { useCallback, useEffect, useRef, useState } from "react";
import {
  DistribuicaoTstFilters,
  fetchAllDistribuicaoTstIds,
} from "@/hooks/useDistribuicoesTst";
import { invalidateDistribuicaoTstCache } from "@/utils/distribuicaoTstCache";

/**
 * AVISO "Somente Outra Matéria": processos prontos cujo quadro de matérias da
 * parte recorrente só tem "Outra Matéria". Não é pendência — a linha vai
 * normalmente para a Carga Benner, é apenas um lembrete de conferência.
 *
 * Lê o marcador persistido `dados_benner.somente_outra_materia`, respeitando
 * os filtros da tela.
 */
export function useSomenteOutraMateriaCount(filters: DistribuicaoTstFilters) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const runIdRef = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const fetchIds = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    try {
      if (filters.status === "pendentes" || filters.status === "rascunho") {
        setIds([]);
        return;
      }
      const status = !filters.status || filters.status === "todos" ? "concluidos" : filters.status;
      const marcados = await fetchAllDistribuicaoTstIds({
        ...filters,
        status,
        somenteOutraMateria: "sim",
      });
      if (runId !== runIdRef.current) return;
      setIds(marcados || []);
    } catch (e) {
      if (runId === runIdRef.current) {
        console.warn("[useSomenteOutraMateriaCount] falhou:", e);
        setIds([]);
      }
    } finally {
      if (runId === runIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    void fetchIds();
    return () => { runIdRef.current += 1; };
  }, [fetchIds]);

  return {
    count: ids.length,
    ids,
    loading,
    refetch: async () => {
      invalidateDistribuicaoTstCache();
      await fetchIds();
    },
  };
}
