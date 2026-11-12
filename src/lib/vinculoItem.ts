export interface ItemComVinculo {
  processo_id?: string | null;
  processo_numero?: string | null;
  origem_registro?: string | null;
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
  const temProcesso = Boolean(item.processo?.id || item.processo_id || String(item.processo_numero ?? "").trim());
  const temPublicacao = itemVeioDePublicacao(item, temPublicacaoVinculada);
  return !temProcesso && !temPublicacao;
}

/** Origens de cadastro que sempre nascem de uma publicação (Análise DJEN / IA). */
const ORIGENS_DE_PUBLICACAO = new Set(["analise_djen", "ia_djen"]);

/** Diz se o item veio de publicação: vínculo gravado ou origem de cadastro DJEN. */
export function itemVeioDePublicacao(item: ItemComVinculo, temPublicacaoVinculada = false): boolean {
  return Boolean(
    temPublicacaoVinculada ||
    item.publicacao_id ||
    item.publicacao_origem_id ||
    item.data_publicacao_origem ||
    ORIGENS_DE_PUBLICACAO.has(String(item.origem_registro ?? "").toLowerCase())
  );
}
