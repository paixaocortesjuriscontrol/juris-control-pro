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

/**
 * URLs candidatas (em ordem) para baixar o PDF de um caderno específico.
 *
 * 1) Rotas DATADAS — entregam a edição do dia pedido, mas o portal
 *    (`dejt.jt.jus.br`, atrás de WAF) responde 403 para IPs de datacenter;
 *    por isso o download tenta o pool de proxies DJEN quando o acesso
 *    direto é bloqueado.
 * 2) Caderno VIGENTE (`/cadernos/Diario_<C>_<ID>.pdf`) — caminho fixo,
 *    sem data: serve a última edição que o portal considera atual, que
 *    frequentemente está alguns dias atrasada. É apenas fallback.
 */
export function buildDejtPdfUrls(
  sigla: string,
  dataDDMMYYYY: string,
  caderno: DejtCaderno = "judiciario",
): string[] {
  const tribunal = sigla.toUpperCase();
  const id = dejtFileId(tribunal);
  if (!id) return [];
  const code = caderno === "administrativo" ? "A" : "J";

  const urls: string[] = [];
  const m = (dataDDMMYYYY || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    urls.push(
      `https://dejt.jt.jus.br/dejt/downloadcaderno.do?tribunal=${encodeURIComponent(tribunal)}` +
        `&data=${encodeURIComponent(dataDDMMYYYY)}&caderno=${caderno}`,
      `https://diario.jt.jus.br/cadernos/${y}/${mo}/${d}/Diario_${code}_${id}.pdf`,
      `https://diario.jt.jus.br/cadernos/Diario_${code}_${id}_${y}${mo}${d}.pdf`,
    );
  }

  urls.push(`https://diario.jt.jus.br/cadernos/Diario_${code}_${id}.pdf`);
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