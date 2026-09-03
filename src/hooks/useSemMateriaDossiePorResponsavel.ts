import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { ensurePedidosPorDossie } from "@/utils/pedidosPorDossieCache";
import { precisaRevisarListaMaterias } from "@/utils/distribuicaoTstPendencias";

export const SEM_RESPONSAVEL_ID = "00000000-0000-0000-0000-000000000000";

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

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
  const [idsPorUsuario, setIdsPorUsuario] = useState<Record<string, string[]>>({});
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
          ensurePedidosPorDossie(),
        ]);
        if (cancelled) return;
        if (!idsFiltrados || idsFiltrados.length === 0 || pedidosPorDossie.size === 0) {
          setMap({});
          setIdsPorUsuario({});
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
            // Atenção: não existe coluna `materias_analise_terceiro` em
            // `dados_benner` — incluí-la fazia o select falhar e o card do
            // "Revisar Lista de matérias" ficar zerado.
            .select(
              "id, dossie, recorrente, materias_analise_reclamante, materias_analise_banco",
            )
            .in("status", STATUS_CONCLUIDOS)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data as any[]) || [];
          for (const r of rows) {
            if (!permitidos.has(r.id)) continue;
            // MESMA regra da pendência exibida na lista (`revisar_lista_materias`).
            if (precisaRevisarListaMaterias(r)) alvo.push(r.id);
          }
          if (rows.length < PAGE) break;
          from += PAGE;
        }

        if (alvo.length === 0) {
          if (!cancelled) {
            setMap({});
            setIdsPorUsuario({});
          }
          return;
        }

        const porUsuario: Record<string, number> = {};
        const idsUsuario: Record<string, string[]> = {};
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
            (idsUsuario[row.usuario_id] = idsUsuario[row.usuario_id] || []).push(row.dados_benner_id);
          }
        }
        const semIds = alvo.filter((id) => !comResponsavel.has(id));
        if (semIds.length > 0) {
          porUsuario[SEM_RESPONSAVEL_ID] = semIds.length;
          idsUsuario[SEM_RESPONSAVEL_ID] = semIds;
        }
        if (!cancelled) {
          setMap(porUsuario);
          setIdsPorUsuario(idsUsuario);
        }
      } catch (e) {
        console.warn("[useSemMateriaDossiePorResponsavel] falhou:", e);
        if (!cancelled) {
          setMap({});
          setIdsPorUsuario({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadTick]);

  return { map, idsPorUsuario, loading, refetch: () => setReloadTick((t) => t + 1) };
}
