export function montarAssunto(base: string, coordNome: string | null, processo: string | null): string {
  const prefixo = coordNome ? `[${coordNome}] ` : "";
  const sufixo = processo ? ` — ${processo}` : "";
  return `${prefixo}${base}${sufixo}`;
}
