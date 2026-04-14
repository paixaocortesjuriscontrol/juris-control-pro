/**
 * Feriados nacionais brasileiros (2024-2026).
 * TODO: incluir feriados locais do tribunal (ex: aniversário da cidade sede do TRT).
 * Formato: "YYYY-MM-DD"
 */
export const FERIADOS_NACIONAIS: string[] = [
  // 2024
  "2024-01-01", // Ano Novo
  "2024-02-12", // Carnaval (segunda)
  "2024-02-13", // Carnaval (terça)
  "2024-03-29", // Sexta-feira Santa
  "2024-04-21", // Tiradentes
  "2024-05-01", // Dia do Trabalho
  "2024-05-30", // Corpus Christi
  "2024-09-07", // Independência
  "2024-10-12", // N. Sra. Aparecida
  "2024-11-02", // Finados
  "2024-11-15", // Proclamação da República
  "2024-11-20", // Consciência Negra
  "2024-12-25", // Natal

  // 2025
  "2025-01-01",
  "2025-03-03", // Carnaval (segunda)
  "2025-03-04", // Carnaval (terça)
  "2025-04-18", // Sexta-feira Santa
  "2025-04-21", // Tiradentes
  "2025-05-01",
  "2025-06-19", // Corpus Christi
  "2025-09-07",
  "2025-10-12",
  "2025-11-02",
  "2025-11-15",
  "2025-11-20",
  "2025-12-25",

  // 2026
  "2026-01-01",
  "2026-02-16", // Carnaval (segunda)
  "2026-02-17", // Carnaval (terça)
  "2026-04-03", // Sexta-feira Santa
  "2026-04-21",
  "2026-05-01",
  "2026-06-04", // Corpus Christi
  "2026-09-07",
  "2026-10-12",
  "2026-11-02",
  "2026-11-15",
  "2026-11-20",
  "2026-12-25",
];

const feriadoSet = new Set(FERIADOS_NACIONAIS);

export function ehFeriado(dataISO: string): boolean {
  return feriadoSet.has(dataISO);
}

/**
 * Recesso forense trabalhista: 20/12 a 20/01 (art. 775-A CLT).
 * Durante esse período, prazos ficam suspensos.
 */
export function ehRecesso(data: Date): boolean {
  const m = data.getMonth() + 1; // 1-12
  const d = data.getDate();
  return (m === 12 && d >= 20) || (m === 1 && d <= 20);
}
