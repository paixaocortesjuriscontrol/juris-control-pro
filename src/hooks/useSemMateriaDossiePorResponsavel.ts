import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { normalizeMateriaNome } from "@/utils/outraMateria";

export const SEM_RESPONSAVEL_ID = "00000000-0000-0000-0000-000000000000";

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

function parseMaterias(valor: string | null | undefined): string[] {
  return String(valor || "")
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Carrega todos os pedidos por dossiê em um mapa dossiê -> Set normalizado. */
async function carregarPedidosPorDossie(): Promise<Map<string, Set<string>>> {
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
      const dossie = String(r.dossie || "").trim();
      if (!dossie) continue;
      const set = mapa.get(dossie) || new Set<string>();
      set.add(String(r.pedido_normalizado || normalizeMateriaNome(r.pedido)));
      mapa.set(dossie, set);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return mapa;
}

/**
 * Processos marcados como prontos (pronto_envio / planilhado / enviado) em que
 * NENHUMA das matérias selecionadas consta na lista de pedidos do dossiê — ou
 * seja, nenhuma etiqueta fica verde no formulário.
 *
 * Só conta processos cujo dossiê possui pedidos cadastrados e que tenham ao
 * menos uma matéria selecionada (sem lista ou sem matéria não há comparação).
 * O resultado é agrupado por responsável (`dados_benner_responsaveis`).
 */
export function useSemMateriaDossiePorResponsavel(filters: DistribuicaoTstFilters) {
  const [map, setMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [idsFiltrados, pedidosPorDossie] = await Promise.all([
          fetchAllDistribuicaoTstIds(filters),
          carregarPedidosPorDossie(),
        ]);
        if (cancelled) return;
        if (!idsFiltrados || idsFiltrados.length === 0 || pedidosPorDossie.size === 0) {
          setMap({});
          return;
        }
        const permitidos = new Set(idsFiltrados);

        // Pagina os prontos e cruza localmente com os IDs filtrados (mesma
        // técnica de useProntoSemPendenciaCount, evita URLs gigantes).
        const alvo: string[] = [];
        const PAGE = 1000;
        let from = 0;
        while (true) {
          if (cancelled) return;
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .select(
              "id, dossie, materias_recurso_reclamante, materias_recurso_banco, materias_recurso_terceiro",
            )
            .in("status", STATUS_CONCLUIDOS)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data as any[]) || [];
          for (const r of rows) {
            if (!permitidos.has(r.id)) continue;
            const lista = pedidosPorDossie.get(String(r.dossie || "").trim());
            if (!lista || lista.size === 0) continue;
            const materias = [
              ...parseMaterias(r.materias_recurso_reclamante),
              ...parseMaterias(r.materias_recurso_banco),
              ...parseMaterias(r.materias_recurso_terceiro),
            ];
            if (materias.length === 0) continue;
            const algumaVerde = materias.some((m) => lista.has(normalizeMateriaNome(m)));
            if (!algumaVerde) alvo.push(r.id);
          }
          if (rows.length < PAGE) break;
          from += PAGE;
        }

        if (alvo.length === 0) {
          if (!cancelled) setMap({});
          return;
        }

        const porUsuario: Record<string, number> = {};
        const comResponsavel = new Set<string>();
        const BATCH = 500;
        for (let i = 0; i < alvo.length; i += BATCH) {
          const batch = alvo.slice(i, i + BATCH);
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
        const sem = alvo.filter((id) => !comResponsavel.has(id)).length;
        if (sem > 0) porUsuario[SEM_RESPONSAVEL_ID] = sem;
        if (!cancelled) setMap(porUsuario);
      } catch (e) {
        console.warn("[useSemMateriaDossiePorResponsavel] falhou:", e);
        if (!cancelled) setMap({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadTick]);

  return { map, loading, refetch: () => setReloadTick((t) => t + 1) };
}
