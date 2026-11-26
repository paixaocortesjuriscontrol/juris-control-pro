/**
 * Ordem das colunas do "Exportar Atividades" do Painel de Controle.
 *
 * A planilha é montada a partir das chaves da primeira linha
 * (ver relatorioAtividadesExcel), então a ordem dos campos aqui é a ordem
 * das colunas no arquivo. A data da publicação DJEN abre a planilha.
 */
export const COLUNA_DATA_PUBLICACAO_DJEN = "Data da publicação DJEN";

export interface LinhaRelatorioAtividades {
  [COLUNA_DATA_PUBLICACAO_DJEN]: string;
  Tipo: string;
  Subtipo: string;
  Situação: string;
  [coluna: string]: string;
}

/**
 * Reordena as linhas prontas da exportação: a coluna da publicação DJEN vem
 * primeiro e as demais mantêm a ordem em que foram montadas na tela.
 */
export function montarLinhasRelatorioAtividades(
  rowsFinal: any[],
  resolverTipo: (i: number) => { Tipo?: string; Subtipo?: string } | undefined,
): LinhaRelatorioAtividades[] {
  return rowsFinal.map((r, i) => {
    const {
      Classificação,
      Status,
      [COLUNA_DATA_PUBLICACAO_DJEN]: dataPublicacao,
      ...resto
    } = r as any;
    const tipo = resolverTipo(i);
    return {
      [COLUNA_DATA_PUBLICACAO_DJEN]: dataPublicacao ?? "",
      Tipo: tipo?.Tipo || Classificação || "",
      Subtipo: tipo?.Subtipo ?? "",
      Situação: Status ?? "",
      ...resto,
    } as LinhaRelatorioAtividades;
  });
}
