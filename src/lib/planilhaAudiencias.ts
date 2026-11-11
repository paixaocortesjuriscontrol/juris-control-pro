/** Junta tipo e modalidade sem repetir a modalidade já escrita no tipo. */
export function tipoComModalidade(tipo?: string | null, modalidade?: string | null): string {
  const t = (tipo ?? "").trim();
  const m = (modalidade ?? "").trim();
  if (!m) return t;
  if (!t) return m;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm(t).includes(norm(m)) ? t : `${t} ${m}`;
}
