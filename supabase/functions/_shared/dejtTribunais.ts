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
 * Identificador do tribunal no nome do arquivo do caderno
 * ("TST", ou o número do TRT zero-padded: TRT1 -> "01", TRT15 -> "15").
 */
export function dejtFileId(sigla: string): string | null {
  const tribunal = (sigla || "").toUpperCase();
  if (tribunal === "TST") return "TST";
  const m = tribunal.match(/^TRT(\d{1,2})$/);
  return m ? m[1].padStart(2, "0") : null;
}

/** URL do caderno vigente (caminho fixo, sem data). */
export function dejtUrlVigente(sigla: string, caderno: DejtCaderno = "judiciario"): string | null {
  const id = dejtFileId(sigla);
  if (!id) return null;
  const code = caderno === "administrativo" ? "A" : "J";
  return `https://diario.jt.jus.br/cadernos/Diario_${code}_${id}.pdf`;
}

export function isDejtUrlVigente(url: string): boolean {
  return /\/cadernos\/Diario_[JA]_[A-Z0-9]{2,3}\.pdf$/.test(url);
}

/** Nome do arquivo do caderno no repositório oficial. Ex.: Diario_J_TST.pdf */
export function dejtNomeArquivo(sigla: string, caderno: DejtCaderno = "judiciario"): string | null {
  const id = dejtFileId((sigla || "").toUpperCase());
  if (!id) return null;
  return `Diario_${caderno === "administrativo" ? "A" : "J"}_${id}.pdf`;
}

export const DEJT_INDICE_URL = "https://diario.jt.jus.br/cadernos/dejt.html";

export interface DejtIndice {
  /** Data (ISO) da edição publicada no índice: "Cadernos do dia DD/MM/YYYY". */
  dataIso: string | null;
  /** Nomes dos PDFs efetivamente disponibilizados nessa edição. */
  arquivos: Set<string>;
}

/**
 * Lê o índice oficial do repositório de cadernos do DEJT.
 *
 * O repositório publica SOMENTE a edição vigente, em caminhos fixos sem data,
 * e o índice (`dejt.html`) diz de que dia é essa edição e quais órgãos
 * realmente disponibilizaram matérias. Sem consultar o índice o motor tentava
 * URLs datadas inexistentes (403/404) e concluía "0 encontradas" para todos os
 * tribunais.
 */
export async function fetchDejtIndice(
  fetcher: (url: string) => Promise<Response | null> = (u) => fetch(u),
): Promise<DejtIndice | null> {
  try {
    const res = await fetcher(DEJT_INDICE_URL);
    if (!res || !res.ok) return null;
    const html = await res.text();
    const mData = html.match(/Cadernos do dia\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const dataIso = mData ? `${mData[3]}-${mData[2]}-${mData[1]}` : null;
    const arquivos = new Set<string>();
    for (const m of html.matchAll(/href="([^"]*Diario_[JA]_[A-Z0-9]{2,3}\.pdf)"/gi)) {
      arquivos.add(m[1].split("/").pop() as string);
    }
    return { dataIso, arquivos };
  } catch (_e) {
    return null;
  }
}

/**
 * URLs candidatas (em ordem) para baixar o PDF de um caderno específico.
 *
 * O repositório oficial (`diario.jt.jus.br`) serve apenas a edição vigente em
 * caminho fixo; rotas datadas e o portal `dejt.jt.jus.br` respondem 403 para
 * IPs de datacenter e nunca retornaram PDF. Por isso a edição vigente é a
 * primeira (e única confiável) tentativa, e a validação da data da edição fica
 * a cargo do índice `dejt.html`.
 */
export function buildDejtPdfUrls(
  sigla: string,
  _dataDDMMYYYY: string,
  caderno: DejtCaderno = "judiciario",
): string[] {
  const nome = dejtNomeArquivo(sigla, caderno);
  if (!nome) return [];
  return [`https://diario.jt.jus.br/cadernos/${nome}`];
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