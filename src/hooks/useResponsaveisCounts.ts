import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";

export interface ResponsavelCount {
  id: string;
  nome: string;
  count: number;
  pronto: number;
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
        // Agregação inteira no banco — mesma técnica dos demais totalizadores
        // (get_distribuicao_tst_stats). Aplica todos os filtros via JSONB.
        const { data, error } = await supabase.rpc(
          "get_distribuicao_tst_responsaveis_counts" as any,
          { filters: filters as any }
        );
        if (error) throw error;
        if (cancelled) return;
        const result: ResponsavelCount[] = ((data as any[]) || []).map((r: any) => ({
          id: r.id,
          nome: r.nome || "(sem nome)",
          count: Number(r.count) || 0,
          pronto: Number(r.pronto) || 0,
        }));
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