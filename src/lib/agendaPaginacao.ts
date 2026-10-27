/** A página mescla fontes e expande recorrências: seu tamanho final não indica o fim. */
export function proximaPaginaAgenda(
  ultimaPagina: unknown[] & { __temMais?: boolean },
  paginasCarregadas: number,
): number | undefined {
  return ultimaPagina.__temMais === true ? paginasCarregadas : undefined;
}