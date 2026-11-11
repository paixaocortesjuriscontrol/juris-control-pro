/** Junta tipo e modalidade sem repetir a modalidade já escrita no tipo. */
export function tipoComModalidade(tipo?: string | null, modalidade?: string | null): string {
  const t = (tipo ?? "").trim();
  const m = (modalidade ?? "").trim();
  if (!m) return t;
  if (!t) return m;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm(t).includes(norm(m)) ? t : `${t} ${m}`;
}

/**
 * Ordena as linhas da planilha de audiências SEM juntar as repetidas.
 * Audiência cadastrada duas vezes no sistema sai em duas linhas, cada uma
 * com a sua própria data de cadastro.
 */
export function ordenarLinhasAudiencia<
  T extends { data: string; hora: string; _ordemData?: string; _ordemHora?: string },
>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) => {
    const da = a._ordemData ?? a.data;
    const db = b._ordemData ?? b.data;
    if (da !== db) return da.localeCompare(db);
    return (a._ordemHora ?? a.hora).localeCompare(b._ordemHora ?? b.hora);
  });
}
