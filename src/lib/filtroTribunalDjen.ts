/** Mesmo limite de token usado nas RPCs; aceita a separação de região do Kurier. */
export function correspondeTribunalDjen(valor: string | null | undefined, filtro: string): boolean {
  const sigla = filtro.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!sigla) return false;
  const regional = sigla.match(/^(TRT|TRF)([0-9]+)$/);
  const alvo = regional ? `${regional[1]}[\\s-]*${regional[2]}` : sigla;
  return new RegExp(`(?:^|[^A-Z0-9])${alvo}(?:[^A-Z0-9]|$)`).test((valor ?? "").toUpperCase());
}

/** Consultas diretas usam aliases exatos, nunca substring entre regiões. */
export function aliasesTribunalDjen(filtro: string): string[] {
  const sigla = filtro.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const regional = sigla.match(/^(TRT|TRF)([0-9]+)$/);
  const aliases = [sigla, `${sigla}_DJEN`];
  if (regional) {
    const [, tipo, numero] = regional;
    aliases.push(`${tipo} ${numero}`, `${tipo} ${numero}_DJEN`, `${tipo} - ${numero} REGIAO`);
  }
  return aliases;
}