import { supabase } from "@/integrations/supabase/client";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import { parseOcorrenciaId, salvarBaixaOcorrencia } from "@/lib/baixaOcorrencia";

export type ItemConclusaoLote = {
  id: string;
  tipo?: string | null;
  origem?: string | null;
};

/** Conclui tarefas, eventos e audiências, respeitando a baixa individual das recorrências. */
export async function concluirItensEmLote(itens: ItemConclusaoLote[]): Promise<number> {
  const agora = new Date().toISOString();
  const tarefaIds: string[] = [];
  const eventoIds: string[] = [];
  const audienciaIds: string[] = [];
  const ocorrencias: { origem: "tarefa" | "evento"; itemId: string; dataOcorrencia: string }[] = [];

  for (const item of itens) {
    const { rawId, dataOcorrencia } = parseOcorrenciaId(String(item.id));
    if (dataOcorrencia && (item.origem === "tarefa" || item.tipo === "evento")) {
      ocorrencias.push({
        origem: item.origem === "tarefa" ? "tarefa" : "evento",
        itemId: rawId,
        dataOcorrencia,
      });
    } else if (item.tipo === "audiencia") {
      audienciaIds.push(getItemRawId(String(item.id)));
    } else if (item.tipo === "evento") {
      eventoIds.push(rawId);
    } else if (item.origem === "tarefa") {
      tarefaIds.push(rawId);
    }
  }

  if (tarefaIds.length) {
    const { error } = await supabase
      .from("tarefas")
      .update({ status: "cumprido", data_cumprimento: agora, updated_at: agora })
      .in("id", tarefaIds);
    if (error) throw error;
  }
  if (eventoIds.length) {
    const { error } = await supabase
      .from("eventos_agenda")
      .update({ status: "concluido", concluido_em: agora, updated_at: agora })
      .in("id", eventoIds);
    if (error) throw error;
  }
  if (audienciaIds.length) {
    const { error } = await supabase
      .from("audiencias_detectadas")
      .update({ status: "concluido", concluido_em: agora, updated_at: agora })
      .in("id", audienciaIds);
    if (error) throw error;
  }

  if (ocorrencias.length) {
    const { data: auth } = await supabase.auth.getUser();
    for (const ocorrencia of ocorrencias) {
      await salvarBaixaOcorrencia({
        ...ocorrencia,
        status: ocorrencia.origem === "tarefa" ? "cumprido" : "concluido",
        observacao: null,
        userId: auth.user?.id ?? null,
      });
    }
  }

  return tarefaIds.length + eventoIds.length + audienciaIds.length + ocorrencias.length;
}
