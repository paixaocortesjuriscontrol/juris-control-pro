import { supabase } from "@/integrations/supabase/client";

/**
 * Liga um item (prazo/tarefa/audiência) à publicação de origem.
 * Usado no início do workflow e em cada etapa seguinte materializada.
 * Ignora duplicidade (item já vinculado).
 */
export async function vincularItemPublicacao(
  item: { id: string; tipo: string },
  origem: { tipo?: string | null; id?: string | null },
) {
  if (!origem?.id || !origem.tipo || !item?.id) return;
  const tipo = item.tipo.toLowerCase();
  let res: { error: any } | null = null;
  if (tipo === "tarefa" || tipo === "prazo") {
    if (origem.tipo === "termo") {
      res = await supabase.from("tarefas_publicacoes").insert({ tarefa_id: item.id, publicacao_id: origem.id });
    } else if (origem.tipo === "processo") {
      res = await supabase.from("tarefas_publicacoes_processos").insert({ tarefa_id: item.id, publicacao_processo_id: origem.id });
    }
  } else if (tipo === "audiencia") {
    if (origem.tipo === "termo") {
      res = await supabase.from("audiencias_publicacoes").insert({ audiencia_id: item.id, publicacao_id: origem.id });
    } else if (origem.tipo === "processo") {
      res = await supabase.from("audiencias_publicacoes_processos").insert({ audiencia_id: item.id, publicacao_processo_id: origem.id });
    } else if (origem.tipo === "descartada") {
      res = await supabase.from("audiencias_publicacoes_descartadas").insert({ audiencia_id: item.id, publicacao_descartada_id: origem.id });
    }
  }
  if (res?.error && res.error.code !== "23505") throw res.error;
}
