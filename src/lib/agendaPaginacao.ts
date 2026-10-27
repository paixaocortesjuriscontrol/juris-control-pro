/** Confere os registros efetivamente recebidos, inclusive da consulta alternativa. */
export function fonteAgendaCheia(registros: readonly unknown[] | null, tamanhoPagina: number): boolean {
  return (registros?.length ?? 0) >= tamanhoPagina;
}

/** A página mescla fontes e expande recorrências: seu tamanho final não indica o fim. */
export function proximaPaginaAgenda(
  ultimaPagina: unknown[] & { __temMais?: boolean },
  paginasCarregadas: number,
): number | undefined {
  return ultimaPagina.__temMais === true ? paginasCarregadas : undefined;
}