import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DistribuicaoTstFilters,
  fetchAllDistribuicaoTstIds,
} from "@/hooks/useDistribuicoesTst";
import {
  getPendencias,
  COLUNAS_SELECT_PENDENCIAS,
} from "@/utils/distribuicaoTstPendencias";

/**
 * Conta processos com status = 'pronto_envio' que NÃO possuem pendências,
 * considerando os mesmos filtros da tela / card ativo.
 *
 * Como a regra de pendência é computada no cliente (regras condicionais por
 * linha em `getPendencias`), fazemos:
 *   1. Puxa os IDs filtrados via `fetchAllDistribuicaoTstIds` (mesma lógica
 *      que a listagem principal usa).
 *   2. Em lotes, busca as linhas com `status = 'pronto_envio'` trazendo as
 *      colunas necessárias para `getPendencias`.
 *   3. Conta as linhas cujo `getPendencias(row).length === 0`.
 */
export function useProntoSemPendenciaCount(filters: DistribuicaoTstFilters) {
  const [count, setCount] = useState<number>(0);
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
        const ids = await fetchAllDistribuicaoTstIds(filters);
        if (cancelled || runId !== runIdRef.current) return;
        if (!ids || ids.length === 0) {
          setCount(0);
          setIds([]);
          return;
        }
        // Colunas necessárias para computar pendências + campos de isenção.
        const cols = Array.from(
          new Set([
            "id",
            "status",
            "acordo",
            "cejusc",
            "processo_outro_escritorio",
            "segredo_justica",
            "transito_julgado",
            "recurso_terceiro",
            "recurso_terceiros",
            "recorrente",
            "midia_negativa",
            "tem_data_julgamento",
            "materias_analise_reclamante",
            "materias_analise_banco",
            
            ...COLUNAS_SELECT_PENDENCIAS,
          ]),
        ).join(", ");

        const PAGE = 1000;
        const CONCURRENCY = 4;
        let semPendencia = 0;
        const semPendenciaIds: string[] = [];

        const lotes: string[][] = [];
        for (let i = 0; i < ids.length; i += PAGE) lotes.push(ids.slice(i, i + PAGE));

        const processarLote = async (batch: string[]) => {
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select(cols)
            .in("id", batch)
            .eq("status", "pronto_envio");
          if (error) throw error;
          for (const r of (data as any[]) || []) {
            // Espelha a lógica do botão "Verificar Pendências":
            // processos em outro escritório, sob segredo de justiça ou CEJUSC
            // não são contabilizados (nem com pendência, nem sem).
            const naoPrecisaFazer =
              (r as any).processo_outro_escritorio === true ||
              (r as any).segredo_justica === true ||
              (r as any).cejusc === true;
            if (naoPrecisaFazer) continue;

            if (getPendencias(r).length === 0) {
              semPendencia++;
              semPendenciaIds.push((r as any).id);
            }
          }
        };

        for (let i = 0; i < lotes.length; i += CONCURRENCY) {
          if (cancelled || runId !== runIdRef.current) return;
          await Promise.all(lotes.slice(i, i + CONCURRENCY).map(processarLote));
        }
        if (!cancelled && runId === runIdRef.current) {
          setCount(semPendencia);
          setIds(semPendenciaIds);
        }
      } catch (e) {
        if (!cancelled && runId === runIdRef.current) {
          console.warn("[useProntoSemPendenciaCount] falhou:", e);
          setCount(0);
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

  return { count, ids, loading, refetch: () => setReloadTick((tick) => tick + 1) };
}