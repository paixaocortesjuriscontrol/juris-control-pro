import { getItemRawId } from "@/hooks/useItensComAtividades";

export type DestinoVinculoProcesso = {
  tabela: "tarefas" | "eventos_agenda";
  id: string;
};

/** Identifica o registro cuja ligação com o processo pode ser alterada na ficha. */
export function destinoVinculoProcesso(item: any): DestinoVinculoProcesso | null {
  if (!item?.id) return null;
  const id = String(item.id);
  const tipo = String(item.tipo ?? "").toLowerCase();

  // Prazo fatal TST deriva do processo; parcelamentos admitem vários processos e
  // audiências preservam o número informado no próprio cadastro.
  if (
    id.startsWith("prazo-tst-") ||
    id.startsWith("audiencia-det-") ||
    tipo === "audiencia" ||
    tipo === "parcelamento" ||
    tipo === "prazo_parcela"
  ) {
    return null;
  }

  const rawId = getItemRawId(id);
  if (tipo === "evento") return { tabela: "eventos_agenda", id: rawId };
  if (["tarefa", "tarefa_delegada", "prazo"].includes(tipo)) {
    return { tabela: "tarefas", id: rawId };
  }
  return null;
}

/** Garante que a operação destrutiva só execute após confirmação explícita. */
export async function desvincularProcessoComConfirmacao(
  confirmado: boolean,
  desvincular: () => Promise<void>,
): Promise<boolean> {
  if (!confirmado) return false;
  await desvincular();
  return true;
}
