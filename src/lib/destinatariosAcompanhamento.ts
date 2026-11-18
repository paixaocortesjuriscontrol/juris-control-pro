/**
 * Regras da lista "Quem recebe os avisos" do Acompanhamento Especial.
 *
 * - Coordenadores da coordenação sempre recebem: vêm marcados na tela e não
 *   podem ser desmarcados.
 * - Lista salva vazia mantém o comportamento padrão (responsáveis do processo
 *   + coordenadores).
 * - Lista salva com gente faz só essas pessoas receberem — e os coordenadores
 *   entram sempre nessa lista.
 */

/** O que a tela mostra marcado "a mais": o que foi salvo sem os coordenadores. */
export function destinatariosExtras(salvos: string[], coordenadores: string[]): string[] {
  const coord = new Set(coordenadores ?? []);
  return (salvos ?? []).filter((id) => !!id && !coord.has(id));
}

/** O que vai para o banco: vazia quando ninguém foi escolhido, senão escolhidos + coordenadores. */
export function destinatariosParaSalvar(
  escolhidos: string[],
  coordenadores: string[],
): string[] {
  if (!escolhidos || escolhidos.length === 0) return [];
  return Array.from(new Set([...escolhidos, ...(coordenadores ?? [])]));
}
