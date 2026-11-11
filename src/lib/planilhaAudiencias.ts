/** Junta tipo e modalidade sem repetir a modalidade já escrita no tipo. */
export function tipoComModalidade(tipo?: string | null, modalidade?: string | null): string {
  const t = (tipo ?? "").trim();
  const m = (modalidade ?? "").trim();
  if (!m) return t;
  if (!t) return m;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm(t).includes(norm(m)) ? t : `${t} ${m}`;
}

/** Uma linha por processo + data + hora; junta as datas de cadastro dos repetidos em `cadastro`. */
export function dedupLinhasAudiencia<T extends { processo: string; data: string; hora: string; cadastro?: string }>(linhas: T[]): T[] {
  const porChave = new Map<string, T>();
  const saida: T[] = [];
  for (const l of linhas) {
    const dig = (l.processo || "").replace(/\D/g, "");
    if (!dig) { saida.push(l); continue; }
    const k = `${dig}|${l.data}|${l.hora}`;
    const ex = porChave.get(k);
    if (ex) {
      if (l.cadastro) ex.cadastro = ex.cadastro ? `${ex.cadastro} | ${l.cadastro}` : l.cadastro;
      continue;
    }
    const copia = { ...l };
    porChave.set(k, copia);
    saida.push(copia);
  }
  return saida;
}
