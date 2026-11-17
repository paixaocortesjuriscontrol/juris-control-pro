/** Padrões da Pauta de Julgamento TST (pedido Dra. Lienne, 17/11/2026). */
export const PREFIXO_EQUIPE = "Jurídico Trabalhista - ";

export const EQUIPES_TST = [
  "Jurídico Trabalhista - Ações Corporativas",
  "Jurídico Trabalhista - Ações Especiais",
  "Jurídico Trabalhista - Autos de Infração",
  "Jurídico Trabalhista - Núcleo Adm e Coligadas",
  "Jurídico Trabalhista - Núcleo Noroeste Sul",
  "Jurídico Trabalhista - Núcleo Complementação de Aposentadoria",
  "Jurídico Trabalhista - Núcleo Execução",
  "Jurídico Trabalhista - Núcleo Sudeste",
  "Jurídico Trabalhista - Núcleo de Terceiros",
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mesmo critério de normalizar_equipe_tst no banco. */
export function normalizarEquipeTst(v?: string | null): string | null {
  const t = String(v ?? "").replace(/\t/g, " ").normalize("NFC").trim();
  if (!t) return null;
  const sem = t.replace(/^jur[ií]dico trabalhista\s*-\s*/i, "").trim();
  const k = semAcento(sem);
  const achada = EQUIPES_TST.find((e) => semAcento(e.slice(PREFIXO_EQUIPE.length)) === k)
    || (k === "adm e coligadas" ? EQUIPES_TST[3] : undefined);
  if (achada) return achada;
  return /^jur[ií]dico trabalhista/i.test(t) ? PREFIXO_EQUIPE + sem : t;
}

export const RECLAMADAS = ["SANTANDER", "AYMORÉ", "F1RST", "SANTANDER CORRETORA"];

export function normalizarReclamada(v?: string | null): string | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const k = semAcento(t);
  if (/corretora/.test(k) && /santander/.test(k)) return "SANTANDER CORRETORA";
  if (/aymore/.test(k)) return "AYMORÉ";
  if (/f1rst|first tecnologia/.test(k)) return "F1RST";
  if (/santander/.test(k)) return "SANTANDER";
  return t.toUpperCase();
}

export function relatorSoNome(v?: string | null): string | null {
  let t = String(v ?? "").trim();
  if (!t || /^sem informa/i.test(t)) return t ? null : null;
  t = t.replace(/^(desembargador[a]?\s+convocad[oa]\s+|ministr[oa]\s+)/i, "").replace(/[.\s]+$/, "");
  return t.toUpperCase() || null;
}

export function horarioPadrao(v?: string | null): string {
  const t = String(v ?? "").trim();
  if (!t) return "00:00";
  const m = t.match(/^(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  return m ? `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` : t;
}

export const MAIUSCULAS = (v?: string | null) => (v ? String(v).trim().toUpperCase() : null);

export const OPCOES_PAUTA: Record<string, string[]> = {
  modalidade: ["VIRTUAL", "PRESENCIAL", "TELEPRESENCIAL"],
  decisao: ["PROSSEGUIR", "RECURSO DA UNIÃO", "RECURSO DO RECLAMANTE", "RECURSO DEMAIS RECLAMADAS"],
  sustentacao_oral: ["SIM", "NÃO", "NÃO CABE"],
  desistencia_recurso: ["SIM", "NÃO", "-------"],
  midia_negativa: ["SIM", "NÃO", "A PREENCHER"],
  reclamada: RECLAMADAS,
  equipe: EQUIPES_TST,
};

/** Campos que, sem informação da Distribuição TST, saem como "A PREENCHER". */
export const CAMPOS_A_PREENCHER = [
  "parte_recorrente", "tipo_recurso", "materia_recurso_reclamante", "aparelhamento_reclamante",
  "materia_recurso_banco", "aparelhamento_banco", "honra",
];
