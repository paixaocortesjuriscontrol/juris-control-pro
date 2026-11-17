/**
 * Helpers de tipo para os itens da agenda unificada.
 *
 * "Ata" é gravada em `tarefas` com `tipo_tarefa = "ATA"`, mas chega à agenda com
 * `tipo = "tarefa"`. Para dar cor própria às atas sem quebrar filtros e contagens
 * que dependem de `tipo`, a cor é resolvida por uma chave separada.
 */

/** Atribui "ata" às tarefas com tipo_tarefa ATA; para as demais vale o próprio tipo. */
export function corKeyItem(item: any): string {
  const ehAta = (item?.tipo_tarefa ?? "").toUpperCase().trim() === "ATA";
  return ehAta ? "ata" : item?.tipo ?? "";
}

/** A item é uma ata? */
export function isItemAta(item: any): boolean {
  return corKeyItem(item) === "ata";
}

/** Rótulo do tipo, com "Ata" no lugar de "Tarefa" quando for ata. */
export function rotuloTipoItem(item: any, labels: Record<string, string>): string {
  return labels[corKeyItem(item)] ?? labels[item?.tipo] ?? "Tarefa";
}

/**
 * Fundo do cabeçalho do painel lateral na mesma cor do tipo, seguindo o padrão
 * das etiquetas da agenda (fundo claro, texto escuro) para manter a leitura.
 */
export const CORES_HEADER_ITEM: Record<string, string> = {
  evento: "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-b border-green-300 dark:border-green-800",
  tarefa: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-b border-blue-300 dark:border-blue-800",
  tarefa_delegada: "bg-blue-100 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border-b border-blue-400 dark:border-blue-700",
  prazo: "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-b border-red-300 dark:border-red-800",
  prazo_parcela: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-b border-red-200 dark:border-red-900",
  parcelamento: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-b border-emerald-300 dark:border-emerald-800",
  audiencia: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-b border-yellow-300 dark:border-yellow-800",
  ata: "bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-b border-violet-300 dark:border-violet-800",
};

/** Classes de fundo do cabeçalho do item; vazio quando o tipo não tem cor própria. */
export function corHeaderItem(item: any): string {
  return CORES_HEADER_ITEM[corKeyItem(item)] ?? "";
}
