import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DistribuicaoTstFilters,
  fetchAllDistribuicaoTstIds,
} from "@/hooks/useDistribuicoesTst";
import {
  getPendencias,
  COLUNAS_SELECT_PRONTO_SEM_PENDENCIA,
  isNaoPrecisaFazer,
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
        const cols = COLUNAS_SELECT_PRONTO_SEM_PENDENCIA.join(", ");

        const PAGE = 1000;
        let semPendencia = 0;
        const semPendenciaIds: string[] = [];
        const idsPermitidos = new Set(ids);

        // Não use `.in("id", batch)` aqui. Com centenas de UUIDs, o filtro é
        // enviado na URL pelo PostgREST e pode ultrapassar o limite HTTP; o
        // card então caía no catch e mostrava zero. Há poucos registros prontos
        // em relação à base inteira, então paginamos diretamente esse conjunto
        // e cruzamos localmente com os IDs que respeitam os filtros da tela.
        let from = 0;
        while (true) {
          if (cancelled || runId !== runIdRef.current) return;
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select(cols)
            .in("status", ["pronto_envio", "planilhado", "enviado"])
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data as any[]) || [];
          for (const r of rows) {
            if (!idsPermitidos.has((r as any).id)) continue;
            // Espelha a lógica do botão "Verificar Pendências":
            // processos em outro escritório, sob segredo de justiça ou CEJUSC
            // não são contabilizados (nem com pendência, nem sem).
            if (isNaoPrecisaFazer(r)) continue;

            if (getPendencias(r).length === 0) {
              semPendencia++;
              semPendenciaIds.push((r as any).id);
            }
          }
          if (rows.length < PAGE) break;
          from += PAGE;
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