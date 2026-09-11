import { useCallback, useEffect, useRef, useState } from "react";
import {
  DistribuicaoTstFilters,
  fetchAllDistribuicaoTstIds,
} from "@/hooks/useDistribuicoesTst";
import { invalidateDistribuicaoTstCache } from "@/utils/distribuicaoTstCache";

/**
 * Processos "pronto sem pendência" segundo o marcador persistido
 * `dados_benner.sem_pendencia`, respeitando os filtros da tela.
 *
 * O cálculo das pendências NÃO acontece mais a cada carregamento: ele roda no
 * botão "Verificar Pendências" (`recalcularSemPendencia`) e grava a coluna.
 * Aqui só lemos os ids já marcados (consulta indexada).
 */
export function useProntoSemPendenciaCount(filters: DistribuicaoTstFilters) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const runIdRef = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const fetchIds = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    try {
      // "Pronto sem pendência" só faz sentido para processos marcados como
      // prontos. Sem esse recorte o marcador `sem_pendencia` também contava
      // registros ainda pendentes e o total podia ficar MAIOR que "Pronto".
      if (filters.status === "pendentes" || filters.status === "rascunho") {
        setIds([]);
        return;
      }
      const status = !filters.status || filters.status === "todos" ? "concluidos" : filters.status;
      const marcados = await fetchAllDistribuicaoTstIds({
        ...filters,
        status,
        semPendencia: "sem",
      });
      if (runId !== runIdRef.current) return;
      setIds(marcados || []);
    } catch (e) {
      if (runId === runIdRef.current) {
        console.warn("[useProntoSemPendenciaCount] falhou:", e);
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
