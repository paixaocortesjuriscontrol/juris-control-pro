/**
 * Mapeamento dos tribunais trabalhistas no DEJT (Diário Eletrônico
 * da Justiça do Trabalho). Usado pela DJET Pautas Paralela.
 *
 * Fontes de URL conhecidas:
 *  - https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=TRTx&data=DD/MM/YYYY&caderno=judiciario
 *  - Fallback novo: https://diario.jt.jus.br/cadernos/YYYY/MM/DD/<tribunal>_J.pdf
 */

export type DejtCaderno = "judiciario" | "administrativo";

export interface DejtTribunal {
  sigla: string;       // TST, TRT1..TRT24
  nome: string;
  cadernos: DejtCaderno[];
}

export const DEJT_TRIBUNAIS: DejtTribunal[] = [
  { sigla: "TST",   nome: "TST - Tribunal Superior do Trabalho",     cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT1",  nome: "TRT1 - Rio de Janeiro",                   cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT2",  nome: "TRT2 - São Paulo (Capital + Grande SP)",  cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT3",  nome: "TRT3 - Minas Gerais",                     cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT4",  nome: "TRT4 - Rio Grande do Sul",                cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT5",  nome: "TRT5 - Bahia",                            cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT6",  nome: "TRT6 - Pernambuco",                       cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT7",  nome: "TRT7 - Ceará",                            cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT8",  nome: "TRT8 - Pará e Amapá",                     cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT9",  nome: "TRT9 - Paraná",                           cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT10", nome: "TRT10 - Brasília/Tocantins",              cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT11", nome: "TRT11 - Amazonas e Roraima",              cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT12", nome: "TRT12 - Santa Catarina",                  cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT13", nome: "TRT13 - Paraíba",                         cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT14", nome: "TRT14 - Rondônia e Acre",                 cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT15", nome: "TRT15 - Campinas/Interior SP",            cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT16", nome: "TRT16 - Maranhão",                        cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT17", nome: "TRT17 - Espírito Santo",                  cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT18", nome: "TRT18 - Goiás",                           cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT19", nome: "TRT19 - Alagoas",                         cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT20", nome: "TRT20 - Sergipe",                         cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT21", nome: "TRT21 - Rio Grande do Norte",             cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT22", nome: "TRT22 - Piauí",                           cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT23", nome: "TRT23 - Mato Grosso",                     cadernos: ["judiciario", "administrativo"] },
  { sigla: "TRT24", nome: "TRT24 - Mato Grosso do Sul",              cadernos: ["judiciario", "administrativo"] },
];

export function getDejtTribunal(sigla: string): DejtTribunal | null {
  const up = (sigla || "").toUpperCase();
  return DEJT_TRIBUNAIS.find((t) => t.sigla === up) ?? null;
}

/**
 * URLs candidatas (em ordem) para baixar o PDF de um caderno específico.
 * Tenta primeiro o downloadcaderno.do (URL clássica) e, em fallback,
 * o diario.jt.jus.br (estrutura nova por pasta YYYY/MM/DD).
 */
export function buildDejtPdfUrls(
  sigla: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno = "judiciario",
): string[] {
  const tribunal = sigla.toUpperCase();
  const urls: string[] = [
    `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=${encodeURIComponent(tribunal)}&data=${encodeURIComponent(dataDDMMYYYY)}&caderno=${encodeURIComponent(caderno)}`,
  ];

  // Fallback: diario.jt.jus.br
  const m = dataDDMMYYYY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const base = `https://diario.jt.jus.br/cadernos/${y}/${mo}/${d}`;
    const code = caderno === "administrativo" ? "A" : "J";
    urls.push(
      `${base}/${tribunal}_${code}.pdf`,
      `${base}/${tribunal}_${code.toLowerCase()}.pdf`,
      `${base}/${tribunal}${code}.pdf`,
      `${base}/${tribunal}_${caderno}.pdf`,
    );
  }

  return urls;
}

export function ddmmyyyyToIso(dmy: string): string | null {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

export function isoToDdmmyyyy(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}