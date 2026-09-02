/**
 * Cache em memória da lista oficial de pedidos do Santander
 * (`materias_pedidos_oficiais`), usada tanto na Carga Benner quanto na
 * validação de pendências da Distribuição TST.
 *
 * As funções de pendência (`distribuicaoTstPendencias.ts`) são síncronas, por
 * isso a lista precisa estar carregada antes. Enquanto o cache não estiver
 * pronto, `isMateriaOficialSync` devolve `true` (não acusa pendência) para
 * evitar falso positivo.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeMateriaNome } from "./outraMateria";

let cache: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

export function materiasOficiaisCarregadas(): boolean {
  return cache !== null && cache.size > 0;
}

/** Carrega (uma única vez) a lista oficial de matérias ativas. */
export function ensureMateriasOficiais(): Promise<Set<string>> {
  if (cache && cache.size > 0) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    const set = new Set<string>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("materias_pedidos_oficiais" as any)
        .select("nome, ativo")
        .eq("ativo", true)
        .order("nome")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as any[]) || [];
      for (const r of rows) {
        const n = normalizeMateriaNome(r?.nome);
        if (n) set.add(n);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    if (set.size > 0) cache = set;
    inflight = null;
    return set;
  })().catch((e) => {
    inflight = null;
    throw e;
  });
  return inflight;
}

/**
 * `true` se a matéria consta na lista oficial (que hoje inclui "Outra
 * Matéria"). Se o cache ainda não carregou, assume oficial (não bloqueia).
 */
export function isMateriaOficialSync(nome: string | null | undefined): boolean {
  if (!cache || cache.size === 0) return true;
  return cache.has(normalizeMateriaNome(nome));
}
