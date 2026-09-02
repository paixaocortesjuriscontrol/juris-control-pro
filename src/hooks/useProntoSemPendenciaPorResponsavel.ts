import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import { useProntoSemPendenciaCount } from "@/hooks/useProntoSemPendenciaCount";

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
        const PAGE = 500;
        const porUsuario: Record<string, number> = {};
        const comResponsavel = new Set<string>();
        for (let i = 0; i < ids.length; i += PAGE) {
          const batch = ids.slice(i, i + PAGE);
          const { data, error } = await supabase
            .from("dados_benner_responsaveis" as any)
            .select("dados_benner_id, usuario_id")
            .in("dados_benner_id", batch);
          if (error) throw error;
          for (const row of (data as any[]) || []) {
            if (!row?.usuario_id || !row?.dados_benner_id) continue;
            comResponsavel.add(row.dados_benner_id);
            porUsuario[row.usuario_id] = (porUsuario[row.usuario_id] || 0) + 1;
          }
        }
        const sem = ids.filter((id) => !comResponsavel.has(id)).length;
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
