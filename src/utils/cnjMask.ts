function cnjValido(d: string): boolean {
  if (!/^\d{20}$/.test(d)) return false;
  const rearranjado = `${d.slice(0, 7)}${d.slice(9, 13)}${d.slice(13, 14)}${d.slice(14, 16)}${d.slice(16, 20)}${d.slice(7, 9)}`;
  return BigInt(rearranjado) % 97n === 1n;
}

function normalizarDigitosCnj(d: string): string | null {
  if (d.length === 20) return cnjValido(d) ? d : null;

  for (let i = 0; i <= d.length - 20; i++) {
    const candidato = d.slice(i, i + 20);
    if (cnjValido(candidato)) return candidato;
  }

  if (d.length > 20 && d.length <= 25) {
    for (let i = 0; i < d.length; i++) {
      const candidato = d.slice(0, i) + d.slice(i + 1);
      const normalizado = normalizarDigitosCnj(candidato);
      if (normalizado && cnjValido(normalizado)) return normalizado;
    }
  }

  return null;
}

/**
 * Aplica a máscara CNJ canônica NNNNNNN-DD.AAAA.J.TR.OOOO.
 * Também corrige entradas com dígito extra quando ainda é possível validar o CNJ.
 */
export function aplicarMascaraCnj(valor: string | null | undefined): string {
  const raw = String(valor ?? "").trim();
  const d = raw.replace(/\D/g, "");
  const normalizado = normalizarDigitosCnj(d);
  if (!normalizado) return raw;
  return `${normalizado.slice(0, 7)}-${normalizado.slice(7, 9)}.${normalizado.slice(9, 13)}.${normalizado.slice(13, 14)}.${normalizado.slice(14, 16)}.${normalizado.slice(16, 20)}`;
}

export function obterVariantesCnjBusca(valor: string | null | undefined): string[] {
  const raw = String(valor ?? "").trim();
  const masked = aplicarMascaraCnj(raw);
  const rawDigits = raw.replace(/\D/g, "");
  const maskedDigits = masked.replace(/\D/g, "");
  return [...new Set([raw, masked, rawDigits, maskedDigits].filter(Boolean))];
}