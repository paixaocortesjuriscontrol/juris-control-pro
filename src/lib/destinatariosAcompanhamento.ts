/**
 * Regras da lista "Quem recebe os avisos" do Acompanhamento Especial.
 *
 * - Coordenadores da coordenação vêm marcados por padrão, mas podem ser
 *   desmarcados para deixar de receber.
 * - Ninguém escolhido além dos coordenadores: o comportamento padrão continua
 *   valendo (responsáveis do processo + coordenadores).
 * - Alguém escolhido além dos coordenadores: só as pessoas marcadas recebem.
 */

export type ConfigAcompanhamento = {
  destinatarios_ids: string[];
  coordenadores_excluidos_ids: string[];
};

/** Quem aparece marcado quando a tela abre. */
export function destinatariosMarcadosInicialmente(
  salvos: string[],
  coordenadores: string[],
  excluidos: string[],
): string[] {
  const lista = (salvos ?? []).filter(Boolean);
  if (lista.length === 0) {
    const ex = new Set(excluidos ?? []);
    return (coordenadores ?? []).filter((c) => !!c && !ex.has(c));
  }
  return Array.from(new Set(lista));
}

/** O que vai para o banco a partir do que está marcado na tela. */
export function montarConfigAcompanhamento(
  marcados: string[],
  coordenadores: string[],
): ConfigAcompanhamento {
  const coord = new Set(coordenadores ?? []);
  const marc = new Set((marcados ?? []).filter(Boolean));
  const extras = Array.from(marc).filter((id) => !coord.has(id));

  if (extras.length === 0) {
    return {
      destinatarios_ids: [],
      coordenadores_excluidos_ids: (coordenadores ?? []).filter((c) => !marc.has(c)),
    };
  }

  return {
    destinatarios_ids: Array.from(
      new Set([...extras, ...(coordenadores ?? []).filter((c) => marc.has(c))]),
    ),
    coordenadores_excluidos_ids: [],
  };
}
