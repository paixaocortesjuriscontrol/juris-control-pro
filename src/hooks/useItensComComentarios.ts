import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { getItemRawId } from "@/hooks/useItensComAtividades";

/**
 * Mapeia um item da agenda para o identificador real usado nas tabelas de
 * comentários (comentarios_tarefas / comentarios_eventos / comentarios_audiencias),
 * agrupando por tipo para permitir consultas em lote por tabela.
 *
 * - Tarefa  -> comentarios_tarefas.tarefa_id     (id base, sem "::")
 * - Evento  -> comentarios_eventos.evento_id     (id base; parcela usa grupo_parcelas)
 * - Audiência -> comentarios_audiencias.audiencia_id
 * - Prazo fatal TST (processo) não tem comentários -> ignorado
 */
function classificarItem(item: ItemAgendaUnificado): {
  tipo: "tarefa" | "evento" | "audiencia";
  id: string;
} | null {
  const rawId = getItemRawId(item.id);
  if (item.id.startsWith("audiencia-det-")) {
    return { tipo: "audiencia", id: rawId };
  }
  if (item.origem === "tarefa") {
    return { tipo: "tarefa", id: rawId };
  }
  if (item.origem === "evento") {
    // Prazos fatais TST vêm de `processos` e não possuem comentários
    if (item.id.startsWith("prazo-tst-")) return null;
    // Parcela: comentário vive no evento-pai (parcelamento)
    const eventoId = (item as any).grupo_parcelas ?? rawId;
    return { tipo: "evento", id: eventoId };
  }
  return null;
}

/**
 * Retorna o Set de IDs (getItemRawId) de itens que possuem pelo menos um
 * comentário vinculado. Mostra o indicador "C" em cards/listas do Painel.
 *
 * Observação: o Set é indexado pelo ID "cru" retornado por getItemRawId,
 * para manter compatibilidade com a forma como os badges são verificados
 * nos componentes do painel (itensComAtividades.has(getItemRawId(item.id))).
 * Para parcelas, o ID cru é o da própria parcela, mas o comentário é buscado
 * no evento-pai — então mapeamos o ID cru da parcela para o ID do pai.
 */
export function useItensComComentarios(items: ItemAgendaUnificado[] | undefined) {
  // Mapa: rawId do item -> { tipo, idReferencia (na tabela de comentários) }
  const lookup = useMemo(() => {
    const map = new Map<string, { tipo: "tarefa" | "evento" | "audiencia"; ref: string }>();
    (items || []).forEach((item) => {
      if (!item?.id) return;
      const rawId = getItemRawId(item.id);
      const classif = classificarItem(item);
      if (!classif) return;
      map.set(rawId, { tipo: classif.tipo, ref: classif.id });
    });
    return map;
  }, [items]);

  const idsPorTipo = useMemo(() => {
    const tarefa = new Set<string>();
    const evento = new Set<string>();
    const audiencia = new Set<string>();
    lookup.forEach(({ tipo, ref }) => {
      if (tipo === "tarefa") tarefa.add(ref);
      else if (tipo === "evento") evento.add(ref);
      else audiencia.add(ref);
    });
    return {
      tarefa: Array.from(tarefa),
      evento: Array.from(evento),
      audiencia: Array.from(audiencia),
    };
  }, [lookup]);

  return useQuery({
    queryKey: ["itens-com-comentarios", idsPorTipo],
    enabled: lookup.size > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const result = new Set<string>(); // rawIds com comentário

      const consultar = async (
        tabela: "comentarios_tarefas" | "comentarios_eventos" | "comentarios_audiencias",
        fk: "tarefa_id" | "evento_id" | "audiencia_id",
        ids: string[],
        tipo: "tarefa" | "evento" | "audiencia"
      ) => {
        if (ids.length === 0) return;
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
        const comIds = new Set<string>();
        await Promise.all(
          chunks.map(async (chunk) => {
            const { data, error } = await (supabase as any)
              .from(tabela)
              .select(fk)
              .in(fk, chunk);
            if (error) throw error;
            (data || []).forEach((row: any) => {
              if (row[fk]) comIds.add(row[fk]);
            });
          })
        );
        // Mapear de volta para os rawIds do lookup
        lookup.forEach((info, rawId) => {
          if (info.tipo === tipo && comIds.has(info.ref)) result.add(rawId);
        });
      };

      await Promise.all([
        consultar("comentarios_tarefas", "tarefa_id", idsPorTipo.tarefa, "tarefa"),
        consultar("comentarios_eventos", "evento_id", idsPorTipo.evento, "evento"),
        consultar("comentarios_audiencias", "audiencia_id", idsPorTipo.audiencia, "audiencia"),
      ]);

      return result;
    },
  });
}

/**
 * Contagem de comentários de um item específico (para exibir na aba "Comentários").
 */
export function useContagemComentarios(
  tipo: "tarefa" | "evento" | "audiencia",
  itemId: string | null | undefined,
) {
  const cfg = {
    tarefa: { table: "comentarios_tarefas", fk: "tarefa_id" },
    evento: { table: "comentarios_eventos", fk: "evento_id" },
    audiencia: { table: "comentarios_audiencias", fk: "audiencia_id" },
  }[tipo];

  return useQuery({
    queryKey: ["contagem-comentarios", tipo, itemId],
    enabled: !!itemId,
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from(cfg.table)
        .select("id", { count: "exact", head: true })
        .eq(cfg.fk, itemId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
