/**
 * Itens de agenda (tarefas, prazos, audiências, eventos e parcelamentos) são
 * privados por coordenação, mesmo quando o processo é compartilhado entre
 * várias coordenações. Administrador vê todos.
 * Itens sem coordenação definida permanecem visíveis para todos.
 * Itens criados pelo próprio usuário (ou em que ele é responsável) também
 * permanecem visíveis, mesmo que a coordenação seja de outra equipe.
 */
export function filtrarItensPorCoordenacao<T extends Record<string, any>>(
  itens: T[] | undefined | null,
  isAdmin: boolean,
  coordenacoesDoUsuario: string[],
  userId?: string | null
): T[] {
  const lista = itens || [];
  if (isAdmin) return lista;
  if (coordenacoesDoUsuario.length === 0) return lista;
  const camposUsuario = [
    "criado_por",
    "created_by",
    "usuario_id",
    "user_id",
    "responsavel_id",
    "responsavel",
  ];
  return lista.filter((item) => {
    if (!item.coordenacao_id) return true;
    if (coordenacoesDoUsuario.includes(item.coordenacao_id)) return true;
    if (userId && camposUsuario.some((campo) => item[campo] === userId)) return true;
    return false;
  });
}
