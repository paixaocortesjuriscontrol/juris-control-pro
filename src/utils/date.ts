/**
 * Utilitários de data para campos "data pura" (YYYY-MM-DD).
 *
 * `new Date("2025-08-05")` é interpretado como UTC 00:00 e, em BRT (UTC-3),
 * exibe 04/08 — um dia a menos. Estas funções ancoram a data ao dia-calendário
 * local, garantindo que todas as telas mostrem exatamente o mesmo dia.
 */

/** Converte "YYYY-MM-DD" (ou ISO completo) em Date local, sem deslocamento de fuso. */
export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const hasTime = /T\d{2}:\d{2}/.test(value);
    if (!hasTime || /T00:00:00(\.0+)?Z?$/.test(value)) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Formata uma data pura como dd/MM/yyyy sem deslocamento de fuso. */
export function formatDateSafe(value: string | Date | null | undefined, fallback = "—"): string {
  const d = parseDateSafe(value);
  if (!d) return fallback;
  return d.toLocaleDateString("pt-BR");
}
