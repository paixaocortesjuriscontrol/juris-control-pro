/**
 * Aplica a máscara CNJ canônica NNNNNNN-DD.AAAA.J.TR.OOOO.
 * Se o input não tiver exatamente 20 dígitos, retorna o valor original (trim).
 */
export function aplicarMascaraCnj(valor: string | null | undefined): string {
  const raw = String(valor ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length !== 20) return raw;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}