export type ItemSelecionavelLista = {
  id: string;
  tipo?: string | null;
  origem?: string | null;
};

/** Itens cuja situação pode ser concluída em lote pela Lista de Atividades. */
export function podeSelecionarItemLista(item: ItemSelecionavelLista): boolean {
  const id = String(item.id ?? "");
  if (!id || id.startsWith("prazo-tst-") || id.startsWith("parcela-")) return false;
  return item.origem === "tarefa" || item.tipo === "evento" || item.tipo === "audiencia";
}
