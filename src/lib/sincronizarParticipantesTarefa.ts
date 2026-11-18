import { supabase } from "@/integrations/supabase/client";
import { diferencaParticipantes } from "./diferencaParticipantes";
export { diferencaParticipantes };

type Tabela = "tarefa_responsaveis" | "tarefa_envolvidos";

/** Sincroniza responsáveis/envolvidos: inclui primeiro, remove depois e lança erro se o banco recusar. */
export async function sincronizarParticipantesTarefa(tarefaId: string, tabela: Tabela, desejados: string[]) {
  const { data, error } = await (supabase as any).from(tabela).select("usuario_id").eq("tarefa_id", tarefaId);
  if (error) throw error;
  const { adicionar, remover } = diferencaParticipantes((data || []).map((r: any) => r.usuario_id), desejados);
  if (adicionar.length) {
    const { error: e } = await (supabase as any).from(tabela).insert(adicionar.map((usuario_id) => ({ tarefa_id: tarefaId, usuario_id })));
    if (e) throw new Error(`Não foi possível incluir pessoas: ${e.message}`);
  }
  if (remover.length) {
    const { error: e } = await (supabase as any).from(tabela).delete().eq("tarefa_id", tarefaId).in("usuario_id", remover);
    if (e) throw new Error(`Não foi possível retirar pessoas: ${e.message}`);
  }
}
