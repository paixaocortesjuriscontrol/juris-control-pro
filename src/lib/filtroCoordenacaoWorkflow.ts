export function coordenacaoInicialWorkflow(
  coordenacoes: readonly { id: string }[],
  coordenacaoPadraoId?: string | null,
): string {
  if (coordenacaoPadraoId && coordenacoes.some((c) => c.id === coordenacaoPadraoId)) {
    return coordenacaoPadraoId;
  }
  return coordenacoes[0]?.id ?? "todas";
}

export function resolverFiltroCoordenacaoWorkflow(
  escolha: string | undefined,
  coordenacoes: readonly { id: string }[],
  coordenacaoPadraoId?: string | null,
): string {
  if (escolha === "todas" || coordenacoes.some((c) => c.id === escolha)) return escolha ?? "todas";
  return coordenacaoInicialWorkflow(coordenacoes, coordenacaoPadraoId);
}