/** Subatividades também obedecem à coordenação escolhida no Painel. */
export function subatividadeNaCoordenacao(
  coordenacaoSelecionada: string | null | undefined,
  coordenacaoDoPai: string | null | undefined,
): boolean {
  return !coordenacaoSelecionada || coordenacaoSelecionada === "todas" || coordenacaoDoPai === coordenacaoSelecionada;
}
