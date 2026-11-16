export function primeiraLinhaObservacao(valor?: string | null): string {
  if (!valor) return "";
  const primeiraLinha = valor.trim().split(/\r\n?|\n/, 1)[0] ?? "";
  return primeiraLinha.replace(/\s+/g, " ").trim();
}
