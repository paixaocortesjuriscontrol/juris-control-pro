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
