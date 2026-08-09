/**
 * Itens de agenda (tarefas, prazos, audiências, eventos e parcelamentos) são
 * privados por coordenação, mesmo quando o processo é compartilhado entre
 * várias coordenações. Administrador vê todos.
 * Itens sem coordenação definida permanecem visíveis para todos.
 */
export function filtrarItensPorCoordenacao<T extends { coordenacao_id?: string | null }>(
  itens: T[] | undefined | null,
  isAdmin: boolean,
  coordenacoesDoUsuario: string[]
): T[] {
  const lista = itens || [];
  if (isAdmin) return lista;
  if (coordenacoesDoUsuario.length === 0) return lista;
  return lista.filter(
    (item) => !item.coordenacao_id || coordenacoesDoUsuario.includes(item.coordenacao_id)
  );
}
