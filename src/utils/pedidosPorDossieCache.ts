/**
 * Cache em memória dos pedidos cadastrados por dossiê (`pedidos_por_dossie`),
 * importados pela planilha "Pedidos por dossiê".
 *
 * As funções de pendência (`distribuicaoTstPendencias.ts`) e a geração da
 * Carga Benner são síncronas, por isso o mapa precisa estar carregado antes.
 * Enquanto não estiver, `pedidosDoDossieSync` devolve `null` (sem lista para
 * comparar → comportamento atual preservado).
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeMateriaNome } from "./outraMateria";

let cache: Map<string, Set<string>> | null = null;
let inflight: Promise<Map<string, Set<string>>> | null = null;

export function pedidosPorDossieCarregados(): boolean {
  return cache !== null && cache.size > 0;
}

export function resetPedidosPorDossie(): void {
  cache = null;
  inflight = null;
}

/** Carrega (uma única vez) o mapa dossiê -> Set de pedidos normalizados. */
export function ensurePedidosPorDossie(): Promise<Map<string, Set<string>>> {
  if (cache && cache.size > 0) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const mapa = new Map<string, Set<string>>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("pedidos_por_dossie" as any)
        .select("dossie, pedido, pedido_normalizado")
        .order("dossie", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as any[]) || [];
      for (const r of rows) {
        const dossie = String(r?.dossie || "").trim();
        if (!dossie) continue;
        const set = mapa.get(dossie) || new Set<string>();
        set.add(String(r?.pedido_normalizado || normalizeMateriaNome(r?.pedido)));
        mapa.set(dossie, set);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    if (mapa.size > 0) cache = mapa;
    inflight = null;
    return mapa;
  })().catch((e) => {
    inflight = null;
    throw e;
  });
  return inflight;
}

/**
 * Pedidos cadastrados para o dossiê, ou `null` quando o cache não carregou
 * ou o dossiê não tem lista cadastrada (nesses casos não há o que comparar).
 */
export function pedidosDoDossieSync(
  dossie: string | null | undefined,
): Set<string> | null {
  if (!cache || cache.size === 0) return null;
  const key = String(dossie || "").trim();
  if (!key) return null;
  const set = cache.get(key);
  return set && set.size > 0 ? set : null;
}

/** A matéria consta na lista de pedidos do dossiê? (sem lista → `true`) */
export function isMateriaDoDossieSync(
  dossie: string | null | undefined,
  materia: string | null | undefined,
): boolean {
  const set = pedidosDoDossieSync(dossie);
  if (!set) return true;
  return set.has(normalizeMateriaNome(materia));
}
