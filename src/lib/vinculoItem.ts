export interface ItemComVinculo {
  processo_id?: string | null;
  processo?: { id?: string | null } | null;
  publicacao_id?: string | null;
  publicacao_origem_id?: string | null;
  data_publicacao_origem?: string | null;
}

/** Identifica itens sem processo e sem qualquer publicação vinculada. */
export function itemSemProcessoEPublicacao(
  item: ItemComVinculo,
  temPublicacaoVinculada = false,
): boolean {
  const temProcesso = Boolean(item.processo?.id || item.processo_id);
  const temPublicacao = Boolean(
    temPublicacaoVinculada ||
    item.publicacao_id ||
    item.publicacao_origem_id ||
    item.data_publicacao_origem
  );
  return !temProcesso && !temPublicacao;
}
