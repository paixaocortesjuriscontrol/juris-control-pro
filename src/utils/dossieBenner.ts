/**
 * Validação do campo "Dossiê" usada tanto na geração da Carga Benner quanto
 * na validação de pendências da Distribuição TST (para que a lista e a carga
 * apliquem exatamente a mesma regra).
 */

const DOSSIE_INVALIDO_PATTERNS = [
  /nao\s*(encontrad|localizad)/i,
  /inv[aá]lid/i,
  /sem\s*dossie/i,
  /caso\s+encerrado/i,
  /em\s+andamento\s+no\s+benner/i,
];

export const DOSSIE_VALIDO_REGEX = /^\d{2}\.\d{2}\.\d{3}\.\d{6,12}\/\d{2}$/;

function normalizeText(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isCnjLike(val: string): boolean {
  const s = String(val ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(s) || digits.length === 20;
}

/** Motivo de rejeição do dossiê (ou `null` quando o dossiê é válido). */
export function getMotivoRejeicaoDossie(
  dossie: unknown,
  numProcesso: unknown,
): string | null {
  const raw = String(dossie ?? "").trim();
  const normalized = normalizeText(raw);
  const procDigits = String(numProcesso ?? "").replace(/\D/g, "");
  const dossieDigits = raw.replace(/\D/g, "");
  if (!raw) return "Dossiê vazio";
  if (DOSSIE_INVALIDO_PATTERNS.some((p) => p.test(normalized))) return "Dossiê não localizado";
  if (procDigits && dossieDigits === procDigits) return "Dossiê igual ao número do processo";
  if (isCnjLike(raw)) return "Dossiê preenchido com número do processo";
  if (/[a-z]/i.test(normalized)) return "Dossiê contém texto inválido";
  if (!DOSSIE_VALIDO_REGEX.test(raw)) return "Dossiê fora do padrão esperado";
  return null;
}
