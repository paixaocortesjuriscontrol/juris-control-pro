import { supabase } from "@/integrations/supabase/client";
import { isItemTratado, isItemCancelado } from "@/utils/executionProgress";

export type OrigemOcorrencia = "tarefa" | "evento";

/**
 * Itens recorrentes são UM registro no banco expandido em várias ocorrências
 * virtuais no calendário (id "<itemId>::YYYY-MM-DD").
 * A baixa individual é gravada em `ocorrencias_recorrentes_status`, sem
 * alterar a situação do registro-pai (que vale para toda a série).
 */
export function parseOcorrenciaId(id: string): { rawId: string; dataOcorrencia: string | null } {
  const str = String(id ?? "");
  const [rawId, data] = str.split("::");
  return { rawId, dataOcorrencia: data ? data.slice(0, 10) : null };
}

export function isOcorrenciaRecorrente(item: any): boolean {
  if (!item) return false;
  return String(item.id ?? "").includes("::") || !!item.recorrencia_pai_id;
}

export function dadosOcorrencia(item: any): {
  origem: OrigemOcorrencia;
  itemId: string;
  dataOcorrencia: string;
} | null {
  if (!isOcorrenciaRecorrente(item)) return null;
  const { rawId, dataOcorrencia } = parseOcorrenciaId(item.id);
  const itemId = (item.recorrencia_pai_id as string | undefined) ?? rawId;
  const data = dataOcorrencia ?? String(item.data_inicio ?? "").slice(0, 10);
  if (!itemId || !data) return null;
  return { origem: item.origem === "tarefa" ? "tarefa" : "evento", itemId, dataOcorrencia: data };
}

/** Grava (ou atualiza) a baixa de UMA ocorrência da série. */
export async function salvarBaixaOcorrencia(params: {
  origem: OrigemOcorrencia;
  itemId: string;
  dataOcorrencia: string;
  status: string;
  observacao?: string | null;
  userId?: string | null;
}) {
  const concluido = isItemTratado({ status: params.status } as any);
  const { error } = await supabase
    .from("ocorrencias_recorrentes_status")
    .upsert(
      {
        origem: params.origem,
        item_id: params.itemId,
        data_ocorrencia: params.dataOcorrencia,
        status: params.status,
        observacao: params.observacao ?? null,
        alterado_por: params.userId ?? null,
        concluido_em: concluido ? new Date().toISOString() : null,
      },
      { onConflict: "origem,item_id,data_ocorrencia" },
    );
  if (error) throw error;
}

/** Remove a baixa individual, voltando a ocorrência à situação da série. */
export async function removerBaixaOcorrencia(params: {
  origem: OrigemOcorrencia;
  itemId: string;
  dataOcorrencia: string;
}) {
  const { error } = await supabase
    .from("ocorrencias_recorrentes_status")
    .delete()
    .eq("origem", params.origem)
    .eq("item_id", params.itemId)
    .eq("data_ocorrencia", params.dataOcorrencia);
  if (error) throw error;
}

/** Busca a baixa individual de uma ocorrência (se existir). */
export async function buscarBaixaOcorrencia(params: {
  origem: OrigemOcorrencia;
  itemId: string;
  dataOcorrencia: string;
}) {
  const { data } = await supabase
    .from("ocorrencias_recorrentes_status")
    .select("*")
    .eq("origem", params.origem)
    .eq("item_id", params.itemId)
    .eq("data_ocorrencia", params.dataOcorrencia)
    .maybeSingle();
  return data ?? null;
}

export { isItemTratado, isItemCancelado };
