import { addDays, addMonths, addYears, endOfDay, parseISO } from "date-fns";

export const normalizeRecorrenciaTipo = (tipo: string | null | undefined) => {
  const normalized = String(tipo ?? "").toLowerCase().trim();
  if (["daily", "diaria", "diário", "diario"].includes(normalized)) return "daily";
  if (["weekdays", "uteis", "úteis", "dias_uteis", "dias-uteis", "business", "businessdays"].includes(normalized))
    return "weekdays";
  if (["weekly", "semanal"].includes(normalized)) return "weekly";
  if (["monthly", "mensal"].includes(normalized)) return "monthly";
  if (["yearly", "annual", "anual"].includes(normalized)) return "yearly";
  return normalized;
};

export interface RegraRecorrencia {
  tipo?: string | null;
  intervalo?: number | null;
  fim?: string | null;
  diasSemana?: number[] | null;
}

/**
 * Expande uma recorrência (armazenada como um único registro no banco) nas datas
 * de ocorrência dentro da janela informada. Mesma regra usada na agenda unificada.
 */
export function expandirOcorrencias(
  dataBaseIso: string,
  regra: RegraRecorrencia,
  windowStart: Date,
  windowEnd: Date,
  max = 200
): Date[] {
  const dataOriginal = parseISO(dataBaseIso);
  const tipo = normalizeRecorrenciaTipo(regra.tipo);
  if (!tipo) return [dataOriginal];

  const intervalo = Math.max(1, Number(regra.intervalo || 1));
  const diasSemana = Array.isArray(regra.diasSemana) && regra.diasSemana.length > 0 ? regra.diasSemana : null;
  const fim = regra.fim
    ? String(regra.fim).length <= 10
      ? endOfDay(parseISO(String(regra.fim)))
      : parseISO(String(regra.fim))
    : null;
  const hardStop = fim && fim < windowEnd ? fim : windowEnd;

  const ocorrencias: Date[] = [];
  let cursor = new Date(dataOriginal);
  let safety = 0;

  while (cursor <= hardStop && safety < max) {
    safety++;
    if (cursor >= windowStart) {
      if (tipo === "weekly" && diasSemana) {
        for (const d of diasSemana) {
          const diff = ((d - cursor.getDay()) + 7) % 7;
          const occ = addDays(cursor, diff);
          if (occ >= windowStart && occ <= hardStop) ocorrencias.push(occ);
        }
      } else if (tipo === "weekdays") {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) ocorrencias.push(new Date(cursor));
      } else {
        ocorrencias.push(new Date(cursor));
      }
    }

    if (tipo === "daily") cursor = addDays(cursor, intervalo);
    else if (tipo === "weekdays") {
      do {
        cursor = addDays(cursor, 1);
      } while (cursor.getDay() === 0 || cursor.getDay() === 6);
    } else if (tipo === "weekly") cursor = addDays(cursor, 7 * intervalo);
    else if (tipo === "monthly") cursor = addMonths(cursor, intervalo);
    else if (tipo === "yearly") cursor = addYears(cursor, intervalo);
    else break;
  }

  if (ocorrencias.length === 0 && dataOriginal >= windowStart && dataOriginal <= hardStop) {
    ocorrencias.push(dataOriginal);
  }

  return ocorrencias;
}

/** Janela padrão para listas de processo: 1 mês atrás até 12 meses à frente. */
export function janelaRecorrenciaPadrao(hoje = new Date()) {
  return {
    windowStart: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
    windowEnd: new Date(hoje.getFullYear(), hoje.getMonth() + 12, 0, 23, 59, 59),
  };
}
