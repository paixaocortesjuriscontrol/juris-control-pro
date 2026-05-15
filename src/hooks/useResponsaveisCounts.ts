import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllDistribuicaoTstIds, DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

export interface ResponsavelCount {
  id: string;
  nome: string;
  count: number;
}

/**
 * Conta processos por responsável considerando TODOS os registros que batem
 * com os filtros atuais (não apenas a página visível).
 */
export function useResponsaveisCounts(filters: DistribuicaoTstFilters) {
  const [counts, setCounts] = useState<ResponsavelCount[]>([]);
  const [loading, setLoading] = useState(false);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ids = await fetchAllDistribuicaoTstIds(filters);
        if (cancelled) return;
        if (ids.length === 0) {
          setCounts([]);
          return;
        }

        // Busca vínculos em lotes (PostgREST tem limite de URL)
        const CHUNK = 500;
        const tally = new Map<string, number>();
        for (let i = 0; i < ids.length; i += CHUNK) {
          const slice = ids.slice(i, i + CHUNK);
          const { data, error } = await supabase
            .from("dados_benner_responsaveis" as any)
            .select("usuario_id")
            .in("dados_benner_id", slice);
          if (error) throw error;
          for (const r of (data as any[]) || []) {
            tally.set(r.usuario_id, (tally.get(r.usuario_id) || 0) + 1);
          }
        }
        if (cancelled) return;

        const userIds = Array.from(tally.keys());
        if (userIds.length === 0) {
          setCounts([]);
          return;
        }
        const { data: profs } = await supabase
          .from("profiles_basic")
          .select("id, nome")
          .in("id", userIds);

        const nameMap = new Map<string, string>();
        for (const p of (profs as any[]) || []) nameMap.set(p.id, p.nome);

        const result: ResponsavelCount[] = userIds.map((uid) => ({
          id: uid,
          nome: nameMap.get(uid) || "(sem nome)",
          count: tally.get(uid) || 0,
        }));
        result.sort((a, b) => b.count - a.count);
        if (!cancelled) setCounts(result);
      } catch (e) {
        if (!cancelled) setCounts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return { counts, loading };
}