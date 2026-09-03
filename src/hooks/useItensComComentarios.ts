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
/**
 * Chave usada no Set retornado por useItensComComentarios.
 * Ocorrências de séries recorrentes usam o id completo (com "::data"), pois o
 * comentário é gravado no registro-pai e só deve aparecer no dia em que foi
 * escrito — sem isso o badge "C" apareceria em todas as ocorrências do mês.
 */
function chaveComentario(item: ItemAgendaUnificado): string {
  const id = String(item.id);
  return id.includes("::") ? id : getItemRawId(id);
}

/** Data (yyyy-MM-dd) da ocorrência de um item recorrente, se houver. */
function dataOcorrenciaItem(item: ItemAgendaUnificado): string | null {
  const id = String(item.id);
  if (!id.includes("::")) return null;
  return id.split("::")[1]?.slice(0, 10) ?? null;
}

export function useItensComComentarios(items: ItemAgendaUnificado[] | undefined) {
  // Mapa: chave do item -> { tipo, ref, dataOcorrencia }
  const lookup = useMemo(() => {
    const map = new Map<
      string,
      { tipo: "tarefa" | "evento" | "audiencia"; ref: string; dataOcorrencia: string | null }
    >();
    (items || []).forEach((item) => {
      if (!item?.id) return;
      const classif = classificarItem(item);
      if (!classif) return;
      map.set(chaveComentario(item), {
        tipo: classif.tipo,
        ref: classif.id,
        dataOcorrencia: dataOcorrenciaItem(item),
      });
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
      // chave do item -> ISO do comentário mais recente
      const result = new Map<string, string>();
      const registrar = (chave: string, iso: string | null) => {
        const atual = result.get(chave);
        if (!atual || (iso && iso > atual)) result.set(chave, iso || atual || "");
      };

      const consultar = async (
        tabela: "comentarios_tarefas" | "comentarios_eventos" | "comentarios_audiencias",
        fk: "tarefa_id" | "evento_id" | "audiencia_id",
        ids: string[],
        tipo: "tarefa" | "evento" | "audiencia"
      ) => {
        if (ids.length === 0) return;
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
        // ref -> datas (yyyy-MM-dd) em que existem comentários
        const datasPorRef = new Map<string, Set<string>>();
        // ref -> ISO do comentário mais recente (geral e por dia)
        const ultimoPorRef = new Map<string, string>();
        const ultimoPorRefDia = new Map<string, string>();
        await Promise.all(
          chunks.map(async (chunk) => {
            const { data, error } = await (supabase as any)
              .from(tabela)
              .select(`${fk}, created_at`)
              .in(fk, chunk);
            if (error) throw error;
            (data || []).forEach((row: any) => {
              const ref = row[fk];
              if (!ref) return;
              if (!datasPorRef.has(ref)) datasPorRef.set(ref, new Set<string>());
              if (row.created_at) {
                const d = new Date(row.created_at);
                const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                  d.getDate()
                ).padStart(2, "0")}`;
                datasPorRef.get(ref)!.add(dia);
                const iso = new Date(row.created_at).toISOString();
                if (!ultimoPorRef.has(ref) || ultimoPorRef.get(ref)! < iso) ultimoPorRef.set(ref, iso);
                const chaveDia = `${ref}|${dia}`;
                if (!ultimoPorRefDia.has(chaveDia) || ultimoPorRefDia.get(chaveDia)! < iso)
                  ultimoPorRefDia.set(chaveDia, iso);
              }
            });
          })
        );
        lookup.forEach((info, chave) => {
          if (info.tipo !== tipo) return;
          const datas = datasPorRef.get(info.ref);
          if (!datas) return;
          // Item simples: basta existir comentário.
          if (!info.dataOcorrencia) {
            registrar(chave, ultimoPorRef.get(info.ref) ?? null);
            return;
          }
          // Ocorrência de série: só marca no dia em que o comentário foi escrito.
          if (datas.has(info.dataOcorrencia)) {
            registrar(chave, ultimoPorRefDia.get(`${info.ref}|${info.dataOcorrencia}`) ?? null);
          }
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
 * Verifica o badge "C" de um item da agenda, respeitando ocorrências recorrentes.
 */
export function temComentarioItem(
  set: Set<string> | Map<string, string> | undefined,
  item: ItemAgendaUnificado | { id: string }
): boolean {
  if (!set || !item?.id) return false;
  const id = String(item.id);
  return id.includes("::") ? set.has(id) : set.has(getItemRawId(id));
}

/**
 * Chave usada para identificar o item nos controles de "comentário visto".
 */
export function chaveComentarioItem(item: ItemAgendaUnificado | { id: string }): string {
  const id = String(item?.id ?? "");
  return id.includes("::") ? id : getItemRawId(id);
}

/**
 * ISO do comentário mais recente do item (quando o hook retorna o Map).
 */
export function ultimoComentarioItem(
  mapa: Set<string> | Map<string, string> | undefined,
  item: ItemAgendaUnificado | { id: string }
): string | null {
  if (!mapa || !(mapa instanceof Map) || !item?.id) return null;
  return mapa.get(chaveComentarioItem(item)) || null;
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
