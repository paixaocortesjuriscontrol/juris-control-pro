import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { totalPublicacoesFicha } from "@/lib/contagensFichaItem";

type TipoComentario = "tarefa" | "evento" | "audiencia";

const COLUNA_ANEXO: Record<TipoComentario, "tarefa_id" | "evento_id" | "audiencia_id"> = {
  tarefa: "tarefa_id",
  evento: "evento_id",
  audiencia: "audiencia_id",
};

/**
 * Total de anexos gravados para a atividade. Consulta separada para o
 * indicador aparecer antes de a pessoa abrir a aba Anexos.
 */
export function useContagemAnexosItem(tipo: TipoComentario, itemId?: string | null) {
  return useQuery({
    queryKey: ["minhas-responsabilidades", "contagem-anexos", tipo, itemId],
    enabled: !!itemId,
    staleTime: 15_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq(COLUNA_ANEXO[tipo], itemId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Total de registros do histórico da atividade (auditoria). Os comentários que
 * aparecem como justificativas já são contados pela própria aba de comentários.
 */
export function useContagemHistoricoItem(itemId?: string | null) {
  return useQuery({
    queryKey: ["minhas-responsabilidades", "contagem-historico", itemId],
    enabled: !!itemId,
    staleTime: 15_000,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("auditoria_tarefas")
        .select("id", { count: "exact", head: true })
        .eq("tarefa_id", itemId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Totais das abas do topo da ficha (publicações, workflow e documentos),
 * buscados assim que a ficha abre — sem precisar entrar em cada aba.
 */
export function useContagensFichaResponsabilidade({
  itemId,
  processoId,
}: {
  itemId?: string | null;
  processoId?: string | null;
}) {
  const sb = supabase as any;

  const { data: totalPublicacoes = 0 } = useQuery({
    queryKey: ["minhas-responsabilidades", "contagem-publicacoes", itemId, processoId],
    enabled: !!itemId,
    staleTime: 15_000,
    queryFn: async () => {
      const [termos, doProcesso] = await Promise.all([
        sb.from("tarefas_publicacoes").select("publicacao_id").eq("tarefa_id", itemId),
        processoId
          ? sb.from("publicacoes_djen_processos").select("id", { count: "exact", head: true }).eq("processo_id", processoId)
          : Promise.resolve({ count: 0, error: null } as any),
      ]);
      if (termos.error) throw termos.error;
      if (doProcesso.error) throw doProcesso.error;

      const idsTermos = (termos.data ?? []).map((linha: any) => linha?.publicacao_id).filter(Boolean);
      let daAtividade = 0;
      if (idsTermos.length > 0) {
        const { count, error } = await sb
          .from("publicacoes_djen")
          .select("id", { count: "exact", head: true })
          .in("id", idsTermos);
        if (error) throw error;
        daAtividade = count ?? 0;
      }
      return totalPublicacoesFicha(doProcesso.count ?? 0, daAtividade);
    },
  });

  const { data: totalEtapasWorkflow = 0 } = useQuery({
    queryKey: ["minhas-responsabilidades", "contagem-workflow", itemId],
    enabled: !!itemId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: vinculo, error } = await sb
        .from("workflow_execucao_etapas")
        .select("execucao_id")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!vinculo?.execucao_id) return 0;
      const { count, error: erroContagem } = await sb
        .from("workflow_execucao_etapas")
        .select("id", { count: "exact", head: true })
        .eq("execucao_id", vinculo.execucao_id);
      if (erroContagem) throw erroContagem;
      return count ?? 0;
    },
  });

  const { data: totalDocumentos = 0 } = useQuery({
    queryKey: ["minhas-responsabilidades", "contagem-documentos", processoId],
    enabled: !!processoId,
    staleTime: 15_000,
    queryFn: async () => {
      const { count, error } = await sb
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("processo_id", processoId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return { totalPublicacoes, totalEtapasWorkflow, totalDocumentos };
}
