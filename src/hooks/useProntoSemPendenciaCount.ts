import { useEffect, useRef, useState } from "react";
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
  const [reloadTick, setReloadTick] = useState(0);
  const runIdRef = useRef(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    const runId = ++runIdRef.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const marcados = await fetchAllDistribuicaoTstIds({
          ...filters,
          semPendencia: "sem",
        });
        if (cancelled || runId !== runIdRef.current) return;
        setIds(marcados || []);
      } catch (e) {
        if (!cancelled && runId === runIdRef.current) {
          console.warn("[useProntoSemPendenciaCount] falhou:", e);
          setIds([]);
        }
      } finally {
        if (!cancelled && runId === runIdRef.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadTick]);

  return {
    count: ids.length,
    ids,
    loading,
    refetch: () => {
      invalidateDistribuicaoTstCache();
      setReloadTick((tick) => tick + 1);
    },
  };
}
