import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateDistribuicaoTstCache } from "@/utils/distribuicaoTstCache";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";

export interface ResponsavelCount {
  id: string;
  nome: string;
  count: number;
  pronto: number;
}

const LARGE_IDS_THRESHOLD = 1000;

/** Status que representam processo concluído (contam como "prontos"). */
const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

async function fetchChunkedResponsaveisCounts(filters: DistribuicaoTstFilters): Promise<ResponsavelCount[]> {
  const ids = await fetchAllDistribuicaoTstIds(filters);
  if (ids.length === 0) return [];

  const statusById = new Map<string, string | null>();
  const countByUser = new Map<string, { id: string; count: number; pronto: number }>();
  const semId = "00000000-0000-0000-0000-000000000000";
  const PAGE = 500;

  for (let i = 0; i < ids.length; i += PAGE) {
    const batch = ids.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("id, status")
      .in("id", batch);
    if (error) throw error;
    for (const row of (data as any[]) || []) {
      statusById.set(row.id, row.status || null);
    }
  }

  const fetchedIds = Array.from(statusById.keys());
  const hasResp = new Set<string>();
  for (let i = 0; i < fetchedIds.length; i += PAGE) {
    const batch = fetchedIds.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("dados_benner_responsaveis" as any)
      .select("dados_benner_id, usuario_id")
      .in("dados_benner_id", batch);
    if (error) throw error;
    for (const row of (data as any[]) || []) {
      if (!row.usuario_id || !row.dados_benner_id) continue;
      hasResp.add(row.dados_benner_id);
      const cur = countByUser.get(row.usuario_id) || { id: row.usuario_id, count: 0, pronto: 0 };
      cur.count += 1;
      if (STATUS_CONCLUIDOS.includes(String(statusById.get(row.dados_benner_id) || ""))) cur.pronto += 1;
      countByUser.set(row.usuario_id, cur);
    }
  }

  let semCount = 0;
  let semPronto = 0;
  for (const [id, status] of statusById.entries()) {
    if (hasResp.has(id)) continue;
    semCount += 1;
    if (STATUS_CONCLUIDOS.includes(String(status || ""))) semPronto += 1;
  }

  const userIds = Array.from(countByUser.keys());
  const nomes = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += PAGE) {
    const batch = userIds.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("profiles_basic" as any)
      .select("id, nome")
      .in("id", batch);
    if (error) throw error;
    for (const row of (data as any[]) || []) nomes.set(row.id, row.nome || "(sem nome)");
  }

  const result = Array.from(countByUser.values()).map((row) => ({
    ...row,
    nome: nomes.get(row.id) || "(sem nome)",
  }));
  if (semCount > 0) result.push({ id: semId, nome: "Sem responsável", count: semCount, pronto: semPronto });
  return result.sort((a, b) => b.count - a.count);
}

/**
 * Conta processos por responsável considerando TODOS os registros que batem
 * com os filtros atuais (não apenas a página visível).
 */
export function useResponsaveisCounts(filters: DistribuicaoTstFilters) {
  const [counts, setCounts] = useState<ResponsavelCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if ((filters.idsAllowed?.length || 0) > LARGE_IDS_THRESHOLD) {
          const result = await fetchChunkedResponsaveisCounts(filters);
          if (!cancelled) setCounts(result);
          return;
        }

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
  }, [filtersKey, reloadTick]);

  return { counts, loading, refetch: () => { invalidateDistribuicaoTstCache(); setReloadTick((t) => t + 1); } };
}