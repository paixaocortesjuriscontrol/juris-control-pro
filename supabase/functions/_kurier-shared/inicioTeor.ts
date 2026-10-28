/** A heading may end a compact party header; a word inside prose never does. */
export function inicioTeorKurier(miolo: string): number | null {
  const heading = /(?:^|\s)(?:D\s+E\s+C\s+I\s+S\s+[ÃA]\s+O|DECISÃO|DESPACHO|SENTENÇA|ACÓRDÃO|EMENTA|RELATÓRIO|VOTO)\b/g;
  const match = heading.exec(miolo);
  if (!match) return null;
  const index = match.index + (match[0].startsWith(" ") || /^\s/.test(match[0]) ? 1 : 0);
  const prefix = miolo.slice(0, index);
  // Explicit judicial text and running sentences must remain intact, even
  // when they contain a later uppercase title or mention a decision.
  if (/[a-zà-ÿ]/.test(prefix) || /PODER\s+JUDICI[ÁA]RIO|ATO\s+DE\s+ORDEM/i.test(prefix)) return null;
  return index;
}