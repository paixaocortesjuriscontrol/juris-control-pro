import { useEffect, useState } from "react";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { ensurePedidosPorDossie } from "@/utils/pedidosPorDossieCache";
import { precisaRevisarListaMaterias } from "@/utils/distribuicaoTstPendencias";
import {
  fetchProntosRowsCached,
  fetchResponsaveisPorItemCached,
  invalidateDistribuicaoTstCache,
} from "@/utils/distribuicaoTstCache";


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

        // Leitura compartilhada (cacheada) dos processos concluídos — a mesma
        // usada pelo card "Pronto sem pendência". Cruzamos localmente com os
        // IDs filtrados para evitar URLs gigantes com centenas de UUIDs.
        const rows = await fetchProntosRowsCached();
        if (cancelled) return;
        const alvo: string[] = [];
        for (const r of rows) {
          if (!permitidos.has(r.id)) continue;
          // MESMA regra da pendência exibida na lista (`revisar_lista_materias`).
          if (precisaRevisarListaMaterias(r)) alvo.push(r.id);
        }

        if (alvo.length === 0) {
          if (!cancelled) {
            setMap({});
            setIdsPorUsuario({});
          }
          return;
        }

        const respPorItem = await fetchResponsaveisPorItemCached();
        if (cancelled) return;
        const porUsuario: Record<string, number> = {};
        const idsUsuario: Record<string, string[]> = {};
        const semIds: string[] = [];
        for (const id of alvo) {
          const usuarios = respPorItem.get(id);
          if (!usuarios || usuarios.length === 0) {
            semIds.push(id);
            continue;
          }
          for (const usuarioId of usuarios) {
            porUsuario[usuarioId] = (porUsuario[usuarioId] || 0) + 1;
            (idsUsuario[usuarioId] = idsUsuario[usuarioId] || []).push(id);
          }
        }
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
