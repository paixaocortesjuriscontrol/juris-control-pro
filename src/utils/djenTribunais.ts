export function normalizeTribunalId(tribunal: string | null | undefined): string | null {
  if (typeof tribunal !== "string") return null;

  const normalized = tribunal.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeTribunais(
  tribunais: Array<string | null | undefined> | null | undefined,
): string[] | null {
  if (!tribunais || tribunais.length === 0) return null;

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tribunal of tribunais) {
    const tribunalId = normalizeTribunalId(tribunal);
    if (!tribunalId || seen.has(tribunalId)) continue;

    seen.add(tribunalId);
    normalized.push(tribunalId);
  }

  return normalized.length > 0 ? normalized : null;
}