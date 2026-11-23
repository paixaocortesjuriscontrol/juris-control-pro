/**
 * Remove das mudanças de um prazo os campos que o formulário preenche sozinho
 * quando o registro original estava vazio, se a pessoa não alterou as datas.
 * Evita que mudar só a situação seja tratado como edição de dados.
 */
export function limparCamposAutomaticosPrazo(
  original: Record<string, any>,
  mudancas: Record<string, any>,
): Record<string, any> {
  const r = { ...mudancas };
  const datasMudaram = "data_vencimento" in r || "data_fatal" in r;
  if (!datasMudaram) {
    if (original.data_base == null) delete r.data_base;
    if (original.prazo_dias == null) { delete r.prazo_dias; delete r.prazo_unidade; }
    else if (!("prazo_dias" in r) && original.prazo_unidade == null) delete r.prazo_unidade;
  }
  return r;
}
