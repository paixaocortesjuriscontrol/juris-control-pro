import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PublicacaoUnificada } from "@/hooks/usePublicacoesDjenUnificadas";
import type { ItemCriado } from "@/components/shared/ItensCriadosPublicacaoCard";

/**
 * Busca itens (tarefas/prazos/eventos/audiências) já existentes vinculados
 * a uma publicação selecionada na Análise DJEN. Considera:
 *   - vínculos diretos via tabelas de junção (tarefas_publicacoes*,
 *     audiencias_publicacoes*) para a própria publicação;
 *   - itens do mesmo processo (por processo_id).
 *
 * O resultado alimenta o card verde para que, ao abrir uma publicação cujo
 * processo já tem itens registrados, o usuário veja imediatamente o que já
 * existe antes de decidir criar algo novo.
 */
export function useItensExistentesPublicacao(pub: PublicacaoUnificada | null) {
  return useQuery({
    queryKey: [
      "itens-existentes-publicacao",
      pub?.id,
      pub?.tipo_origem,
      pub?.processo_id,
    ],
    enabled: !!pub,
    staleTime: 15_000,
    queryFn: async (): Promise<ItemCriado[]> => {
      if (!pub) return [];

      const tarefaIds = new Set<string>();
      const audienciaIds = new Set<string>();

      // 1. Vínculos diretos com a publicação (via tabelas de junção)
      try {
        if (pub.tipo_origem === "termo") {
          const [tp, ap] = await Promise.all([
            supabase.from("tarefas_publicacoes").select("tarefa_id").eq("publicacao_id", pub.id),
            supabase.from("audiencias_publicacoes").select("audiencia_id").eq("publicacao_id", pub.id),
          ]);
          (tp.data || []).forEach((r: any) => r?.tarefa_id && tarefaIds.add(r.tarefa_id));
          (ap.data || []).forEach((r: any) => r?.audiencia_id && audienciaIds.add(r.audiencia_id));
        } else if (pub.tipo_origem === "processo") {
          const [tp, ap] = await Promise.all([
            supabase
              .from("tarefas_publicacoes_processos")
              .select("tarefa_id")
              .eq("publicacao_processo_id", pub.id),
            supabase
              .from("audiencias_publicacoes_processos")
              .select("audiencia_id")
              .eq("publicacao_processo_id", pub.id),
          ]);
          (tp.data || []).forEach((r: any) => r?.tarefa_id && tarefaIds.add(r.tarefa_id));
          (ap.data || []).forEach((r: any) => r?.audiencia_id && audienciaIds.add(r.audiencia_id));
        } else if (pub.tipo_origem === "descartada") {
          const ap = await supabase
            .from("audiencias_publicacoes_descartadas")
            .select("audiencia_id")
            .eq("publicacao_descartada_id", pub.id);
          (ap.data || []).forEach((r: any) => r?.audiencia_id && audienciaIds.add(r.audiencia_id));
        }
      } catch (err) {
        console.warn("[itens-existentes-publicacao] junção falhou:", err);
      }

      // 2. Buscar registros completos (tarefas + audiencias) e também os
      //    itens do mesmo processo (por processo_id).
      const processoId = pub.processo_id;

      const [tarefasJuncao, tarefasProc, audsJuncao, audsProc, eventosProc] = await Promise.all([
        tarefaIds.size
          ? supabase
              .from("tarefas")
              .select("id, titulo, tipo_tarefa")
              .in("id", Array.from(tarefaIds))
          : Promise.resolve({ data: [] as any[], error: null }),
        processoId
          ? supabase
              .from("tarefas")
              .select("id, titulo, tipo_tarefa")
              .eq("processo_id", processoId)
              .limit(200)
          : Promise.resolve({ data: [] as any[], error: null }),
        audienciaIds.size
          ? supabase
              .from("audiencias_detectadas")
              .select("id, titulo, tipo_audiencia")
              .in("id", Array.from(audienciaIds))
          : Promise.resolve({ data: [] as any[], error: null }),
        processoId
          ? supabase
              .from("audiencias_detectadas")
              .select("id, titulo, tipo_audiencia")
              .eq("processo_id", processoId)
              .limit(200)
          : Promise.resolve({ data: [] as any[], error: null }),
        processoId
          ? supabase
              .from("eventos_agenda")
              .select("id, titulo")
              .eq("processo_id", processoId)
              .limit(200)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const itensById = new Map<string, ItemCriado>();

      const addTarefa = (t: any) => {
        if (!t?.id || itensById.has(t.id)) return;
        const isPrazo = String(t.tipo_tarefa || "").toUpperCase() === "PRAZO";
        itensById.set(t.id, {
          id: t.id,
          tipo: isPrazo ? "prazo" : "tarefa",
          titulo: t.titulo || (isPrazo ? "Prazo" : "Tarefa"),
          createdAt: 0,
        });
      };
      const addAudiencia = (a: any) => {
        if (!a?.id || itensById.has(a.id)) return;
        itensById.set(a.id, {
          id: a.id,
          tipo: "audiencia",
          titulo: a.titulo || a.tipo_audiencia || "Audiência",
          createdAt: 0,
        });
      };
      const addEvento = (e: any) => {
        if (!e?.id || itensById.has(e.id)) return;
        itensById.set(e.id, {
          id: e.id,
          tipo: "evento",
          titulo: e.titulo || "Evento",
          createdAt: 0,
        });
      };

      (tarefasJuncao.data || []).forEach(addTarefa);
      (tarefasProc.data || []).forEach(addTarefa);
      (audsJuncao.data || []).forEach(addAudiencia);
      (audsProc.data || []).forEach(addAudiencia);
      (eventosProc.data || []).forEach(addEvento);

      return Array.from(itensById.values());
    },
  });
}