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
 *
 * IMPORTANTE: o servidor `diario.jt.jus.br` publica APENAS o caderno
 * vigente (do dia atual) no caminho fixo `/cadernos/Diario_<C>_<ID>.pdf`,
 * onde:
 *   - C  = "J" (Judiciário) ou "A" (Administrativo)
 *   - ID = "TST" para o TST, ou o número do TRT zero-padded a 2 dígitos
 *          (ex.: TRT1 -> "01", TRT15 -> "15")
 *
 * Para dias passados, o portal só permite consulta via formulário
 * `dejt.jt.jus.br/dejt/f/n/diariocon` (com sessão JSF), que não é
 * acessível por GET simples. Por isso, datas anteriores ao dia atual
 * podem retornar 404 e devem ser tratadas como "sem-pdf".
 */
export function buildDejtPdfUrls(
  sigla: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno = "judiciario",
): string[] {
  const tribunal = sigla.toUpperCase();
  const code = caderno === "administrativo" ? "A" : "J";

  // Identificador no nome do arquivo
  let id: string;
  if (tribunal === "TST") {
    id = "TST";
  } else {
    const m = tribunal.match(/^TRT(\d{1,2})$/);
    if (!m) return [];
    id = m[1].padStart(2, "0");
  }

  // Único endpoint público estável (caderno vigente).
  return [`https://diario.jt.jus.br/cadernos/Diario_${code}_${id}.pdf`];
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