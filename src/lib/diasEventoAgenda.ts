import { diaBrt } from "@/utils/date";

/**
 * Dias em que um evento aparece no calendário, sempre pelo horário de Brasília.
 * O limite evita que um cadastro com período excessivo trave a renderização.
 */
export function diasEventoAgenda(
  dataInicio: string | Date | null | undefined,
  dataFim?: string | Date | null,
  limiteDias = 92,
): string[] {
  const inicio = diaBrt(dataInicio);
  if (!inicio) return [];
  const fim = diaBrt(dataFim) || inicio;
  const dias = [inicio];
  if (fim <= inicio) return dias;

  const cursor = new Date(`${inicio}T12:00:00Z`);
  for (let i = 0; i < limiteDias; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dia = cursor.toISOString().slice(0, 10);
    if (dia > fim) break;
    dias.push(dia);
  }
  return dias;
}
