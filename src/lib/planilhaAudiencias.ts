/** Junta tipo e modalidade sem repetir a modalidade já escrita no tipo. */
export function tipoComModalidade(tipo?: string | null, modalidade?: string | null): string {
  const t = (tipo ?? "").trim();
  const m = (modalidade ?? "").trim();
  if (!m) return t;
  if (!t) return m;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm(t).includes(norm(m)) ? t : `${t} ${m}`;
}

/** Uma linha por processo + data + hora (registros repetidos da mesma audiência). */
export function dedupLinhasAudiencia<T extends { processo: string; data: string; hora: string }>(linhas: T[]): T[] {
  const vistos = new Set<string>();
  return linhas.filter((l) => {
    const dig = (l.processo || "").replace(/\D/g, "");
    if (!dig) return true;
    const k = `${dig}|${l.data}|${l.hora}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}
