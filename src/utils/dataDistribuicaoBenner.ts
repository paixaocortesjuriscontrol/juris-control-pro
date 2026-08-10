/**
 * Data de distribuição oficial para exportações (Carga Benner, relatórios).
 *
 * Regra de negócio: sempre usar a "Data Distribuição Real (D)"
 * (`data_distribuicao_real`). A data vinda da planilha
 * (`data_distribuicao_planilha`) NÃO deve ser usada nas cargas/relatórios.
 * `data_distribuicao` é mantida apenas como fallback legado do mesmo campo (D).
 */
export function getDataDistribuicaoReal(row: any): string | null {
  if (!row) return null;
  return row.data_distribuicao_real || row.data_distribuicao || null;
}
