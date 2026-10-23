interface ProcessoPartesEmail {
  polo_ativo?: unknown;
  polo_passivo?: unknown;
  reclamante?: unknown;
  reclamados?: unknown;
}

interface ParteEmail {
  nome: string;
  lado_efetivo: string | null;
  is_advogado: boolean;
}

function nomeCampo(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(nomeCampo).filter(Boolean).join("; ");
  if (typeof valor !== "string") return "";
  return valor.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Usa o cadastro do processo; só completa polos vazios com a consulta já realizada. */
export function resolverPartesEmail(processo: ProcessoPartesEmail, partes: ParteEmail[]) {
  const nomesDoPolo = (lado: string) => [...new Set(partes
    .filter((p) => !p.is_advogado && p.lado_efetivo === lado)
    .map((p) => nomeCampo(p.nome)).filter(Boolean))].join("; ");
  const ativo = nomeCampo(processo.polo_ativo) || nomeCampo(processo.reclamante) || nomesDoPolo("ACTIVE");
  const passivo = nomeCampo(processo.polo_passivo) || nomeCampo(processo.reclamados) || nomesDoPolo("PASSIVE");
  return { ativo, passivo, resumo: [ativo, passivo].filter(Boolean).join(" x ") };
}

export function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}