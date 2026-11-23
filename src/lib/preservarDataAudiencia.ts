/** Dia (BRT) de um timestamp ISO ou data YYYY-MM-DD. */
function diaBrt(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  if (isNaN(t)) return String(v).slice(0, 10);
  return new Date(t - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Mantém a data/hora gravada da audiência quando o usuário não mudou o dia
 * (e, se informado, a hora). Evita que mudar só a situação pareça edição de data.
 */
export function preservarDataAudiencia(
  novaIso: string | null,
  original: { data_audiencia?: string | null; hora?: string | null; hora_brasilia?: string | null } | null | undefined,
  horaNova?: string | null,
): string | null {
  const orig = original?.data_audiencia ?? null;
  if (!orig || !novaIso) return novaIso;
  if (diaBrt(novaIso) !== diaBrt(orig)) return novaIso;
  if (horaNova !== undefined) {
    const h = (x: any) => (x ? String(x).slice(0, 5) : null);
    const horaOrig = h(original?.hora_brasilia) ?? h(original?.hora);
    if (h(horaNova) !== horaOrig) return novaIso;
  }
  return orig;
}
