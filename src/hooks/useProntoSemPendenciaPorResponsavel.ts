import { useEffect, useState } from "react";
import { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";
import { fetchResponsaveisPorItemCached } from "@/utils/distribuicaoTstCache";


export const SEM_RESPONSAVEL_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Quantidade de processos "prontos SEM pendência" por responsável.
 *
 * Reaproveita `useProntoSemPendenciaCount` (que já aplica os filtros da tela
 * e computa as pendências no cliente) e distribui os IDs resultantes entre os
 * responsáveis de `dados_benner_responsaveis`. Processos sem responsável
 * entram na chave `SEM_RESPONSAVEL_ID`.
 */
export function useProntoSemPendenciaPorResponsavel(filters: DistribuicaoTstFilters) {
  const { ids, loading: idsLoading } = useProntoSemPendenciaCount(filters);
  const [map, setMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const idsKey = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ids || ids.length === 0) {
        setMap({});
        return;
      }
      setLoading(true);
      try {
        const respPorItem = await fetchResponsaveisPorItemCached();
        const porUsuario: Record<string, number> = {};
        let sem = 0;
        for (const id of ids) {
          const usuarios = respPorItem.get(id);
          if (!usuarios || usuarios.length === 0) {
            sem += 1;
            continue;
          }
          for (const usuarioId of usuarios) {
            porUsuario[usuarioId] = (porUsuario[usuarioId] || 0) + 1;
          }
        }
        if (sem > 0) porUsuario[SEM_RESPONSAVEL_ID] = sem;
        if (!cancelled) setMap(porUsuario);

      } catch (e) {
        console.warn("[useProntoSemPendenciaPorResponsavel] falhou:", e);
        if (!cancelled) setMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { map, loading: loading || idsLoading };
}
