/**
 * Helpers de cabeçalho das planilhas da Carga Benner.
 *
 * A coluna final "Sem chance de êxito" não existe nos templates originais, por
 * isso além de escrever o texto na linha 2 é preciso:
 *  - mesclar o título de grupo da linha 1 ("Chance de êxito") sobre as duas
 *    colunas (Com chances de êxito + Sem chance de êxito);
 *  - reaproveitar exatamente o estilo (fonte/preenchimento/borda) das células
 *    vizinhas, para o cabeçalho novo não sair com fonte diferente.
 */

function colToLetter(c: number): string {
  let s = "";
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Lê o atributo s="..." da célula `ref` dentro do XML de uma linha. */
function styleOfCell(rowXml: string, ref: string): string | null {
  const re = new RegExp(`<c\\b(?=[^>]*\\br="${ref}")[^>]*?>`);
  const cell = rowXml.match(re)?.[0] ?? rowXml.match(new RegExp(`<c\\b(?=[^>]*\\br="${ref}")[^>]*?/>`))?.[0];
  if (!cell) return null;
  return cell.match(/\bs="(\d+)"/)?.[1] ?? null;
}

/** Substitui (ou define) o atributo s da célula `ref`. */
function applyStyleToCell(rowXml: string, ref: string, styleId: string): string {
  const re = new RegExp(`<c\\b(?=[^>]*\\br="${ref}")[^>]*?(?:/>|>)`);
  return rowXml.replace(re, (tag) =>
    /\bs="\d+"/.test(tag) ? tag.replace(/\bs="\d+"/, `s="${styleId}"`) : tag.replace(/^<c\b/, `<c s="${styleId}"`),
  );
}

export interface AjusteGrupoChanceExito {
  row1: string;
  row2: string;
  /** Ref de mesclagem a inserir (ex.: "AH1:AI1") ou null quando não se aplica. */
  mergeRef: string | null;
}

/**
 * Ajusta as linhas 1 e 2 para a coluna final "Sem chance de êxito":
 *  - a célula da linha 2 herda o estilo da coluna anterior (mesma fonte);
 *  - se a coluna anterior tiver o título de grupo próprio na linha 1, o título
 *    passa a ser mesclado sobre as duas colunas;
 *  - caso a coluna anterior já pertença a outra mesclagem, a nova coluna recebe
 *    o próprio título de grupo ("Chance de êxito").
 */
export function ajustarGrupoChanceExito(params: {
  row1: string;
  row2: string;
  sheetXml: string;
  colIdx: number;
  strIdxTituloGrupo: number;
}): AjusteGrupoChanceExito {
  const { sheetXml, colIdx, strIdxTituloGrupo } = params;
  let { row1, row2 } = params;
  const novo = colToLetter(colIdx);
  const anterior = colToLetter(colIdx - 1);

  // Linha 2: mesma fonte/estilo da coluna anterior.
  const estilo2 = styleOfCell(row2, `${anterior}2`);
  if (estilo2) row2 = applyStyleToCell(row2, `${novo}2`, estilo2);

  const estilo1 = styleOfCell(row1, `${anterior}1`);
  const jaMesclada = new RegExp(`<mergeCell ref="[A-Z]+1:${anterior}1"\\s*/>`).test(sheetXml);
  const temTituloProprio = new RegExp(`<c\\b(?=[^>]*\\br="${anterior}1")[^>]*t="s"`).test(row1);

  let mergeRef: string | null = null;
  let celula1: string;
  if (!jaMesclada && temTituloProprio) {
    // Título da coluna anterior passa a cobrir as duas colunas.
    celula1 = `<c r="${novo}1"${estilo1 ? ` s="${estilo1}"` : ""}/>`;
    mergeRef = `${anterior}1:${novo}1`;
  } else {
    celula1 = `<c r="${novo}1"${estilo1 ? ` s="${estilo1}"` : ""} t="s"><v>${strIdxTituloGrupo}</v></c>`;
  }

  const existente = new RegExp(`<c\\b[^>]*\\br="${novo}1"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  row1 = existente.test(row1)
    ? row1.replace(existente, celula1)
    : row1.replace(/<\/row>\s*$/, `${celula1}</row>`);

  return { row1, row2, mergeRef };
}

/** Insere um <mergeCell> no XML da planilha, atualizando o count. */
export function addMergeCell(sheetXml: string, ref: string | null): string {
  if (!ref) return sheetXml;
  if (/<mergeCells\b/.test(sheetXml)) {
    return sheetXml.replace(/<mergeCells count="(\d+)">/, (_m, c) => `<mergeCells count="${Number(c) + 1}">`)
      .replace(/<\/mergeCells>/, `<mergeCell ref="${ref}"/></mergeCells>`);
  }
  return sheetXml.replace(/<\/sheetData>/, `</sheetData><mergeCells count="1"><mergeCell ref="${ref}"/></mergeCells>`);
}
