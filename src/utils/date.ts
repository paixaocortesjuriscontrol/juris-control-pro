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

const BRT_TZ = "America/Sao_Paulo";

/**
 * Retorna a hora (HH:mm) sempre no fuso de Brasília.
 *
 * - "14:30" ou "14:30:00" → devolve "14:30" (já é hora local, não converte).
 * - "2026-08-12T17:00:00+00:00" / "...Z" → converte para BRT ("14:00").
 * - "2026-08-12T14:00:00" (sem fuso) → devolve "14:00" (tratado como hora local).
 */
export function horaBrt(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const soHora = /^(\d{2}):(\d{2})/.exec(value.trim());
    if (soHora) return `${soHora[1]}:${soHora[2]}`;
    const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
    if (!temFuso) {
      const m = /T(\d{2}):(\d{2})/.exec(value);
      return m ? `${m[1]}:${m[2]}` : "";
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Formata data e hora (dd/MM/yyyy HH:mm) no fuso de Brasília. */
export function dataHoraBrt(value: string | Date | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
}

/** Hora BRT de uma audiência, priorizando os campos já gravados em horário local. */
export function horaAudienciaBrt(a: {
  hora_brasilia?: string | null;
  hora_local?: string | null;
  hora?: string | null;
  data_inicio?: string | null;
}): string {
  return horaBrt(a.hora_brasilia || a.hora_local || a.hora || a.data_inicio || null);
}

/**
 * Compõe o data_inicio de um item de agenda de audiência usando o dia gravado em
 * data_audiencia e a hora real da audiência (hora / hora_local / hora_brasilia).
 * Sem isso, audiências vindas do DJEN (normalizadas para 12:00 UTC) mostravam
 * "12:00" na lista/calendário, diferente do horário exibido ao abrir o item.
 */
export function dataInicioAudiencia(
  dataAudiencia: string | null | undefined,
  a: { hora?: string | null; hora_local?: string | null; hora_brasilia?: string | null } = {},
): string | null {
  if (!dataAudiencia) return null;
  const dia = dataAudiencia.slice(0, 10);
  const horaRaw = (a.hora || a.hora_local || a.hora_brasilia || "").trim();
  const match = horaRaw.match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !match) return dataAudiencia;
  const hh = match[1].padStart(2, "0");
  return `${dia}T${hh}:${match[2]}:00`;
}
