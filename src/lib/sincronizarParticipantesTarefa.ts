import { supabase } from "@/integrations/supabase/client";
import { diferencaParticipantes } from "./diferencaParticipantes";
export { diferencaParticipantes };

type Tabela = "tarefa_responsaveis" | "tarefa_envolvidos" | "evento_responsaveis" | "evento_envolvidos" | "audiencia_envolvidos" | "audiencias_advogados";
const CHAVE: Record<Tabela, string> = { tarefa_responsaveis: "tarefa_id", tarefa_envolvidos: "tarefa_id", evento_responsaveis: "evento_id", evento_envolvidos: "evento_id", audiencia_envolvidos: "audiencia_id", audiencias_advogados: "audiencia_id" };
const PESSOA: Partial<Record<Tabela, string>> = { audiencias_advogados: "advogado_id" };

/** Sincroniza responsáveis/envolvidos: inclui primeiro, remove depois e lança erro se o banco recusar. */
export async function sincronizarParticipantesTarefa(tarefaId: string, tabela: Tabela, desejados: string[]) {
  const k = CHAVE[tabela];
  const col = PESSOA[tabela] ?? "usuario_id";
  const { data, error } = await (supabase as any).from(tabela).select(col).eq(k, tarefaId);
  if (error) throw error;
  const { adicionar, remover } = diferencaParticipantes((data || []).map((r: any) => r[col]), desejados);
  if (adicionar.length) {
    const { error: e } = await (supabase as any).from(tabela).insert(adicionar.map((id) => ({ [k]: tarefaId, [col]: id })));
    if (e) throw new Error(`Você não tem permissão para incluir pessoas nesta atividade (${e.message}).`);
  }
  if (remover.length) {
    const { data: removidos, error: e } = await (supabase as any).from(tabela).delete().eq(k, tarefaId).in(col, remover).select(col);
    if (e) throw new Error(`Não foi possível retirar pessoas: ${e.message}`);
    if ((removidos?.length ?? 0) < remover.length) {
      throw new Error("Você não tem permissão para retirar pessoas desta atividade. Peça ao coordenador para liberar em Quem pode agendar.");
    }
  }
}
