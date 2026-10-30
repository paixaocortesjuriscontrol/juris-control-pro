export const RITO_JEC = "Juizado Especial Cível";
export const RITO_VC = "Vara Cível";

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Normaliza o valor vindo da planilha: JEC/VC viram os nomes oficiais; vazio vira null. */
export function normalizarRitoProcessual(valor: unknown): string | null {
  const bruto = String(valor ?? "").replace(/\s+/g, " ").trim();
  if (!bruto) return null;
  const k = semAcento(bruto);
  if (k === "jec" || k === "juizado especial civel" || k === "juizado especial") return RITO_JEC;
  if (k === "vc" || k === "vara civel") return RITO_VC;
  return bruto;
}

export const chaveRito = semAcento;
