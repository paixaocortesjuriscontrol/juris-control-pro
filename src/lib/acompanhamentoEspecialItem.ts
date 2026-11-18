/**
 * Identificação do processo de um item de agenda para fins de exibição da
 * marca de Acompanhamento Especial.
 */
export function idProcessoDoItem(item: any): string | null {
  const id = item?.processo?.id ?? item?.processo_id ?? null;
  return id ? String(id) : null;
}

/** true quando o processo do item está na lista de processos monitorados. */
export function itemEmAcompanhamentoEspecial(
  item: any,
  processosAcompanhados: ReadonlySet<string> | undefined | null,
): boolean {
  if (!processosAcompanhados || processosAcompanhados.size === 0) return false;
  const id = idProcessoDoItem(item);
  return !!id && processosAcompanhados.has(id);
}

/** IDs de processo (sem duplicados, ordenados) presentes nos itens. */
export function idsProcessosDosItens(itens: readonly any[]): string[] {
  const ids = new Set<string>();
  for (const item of itens ?? []) {
    const id = idProcessoDoItem(item);
    if (id) ids.add(id);
  }
  return Array.from(ids).sort();
}
