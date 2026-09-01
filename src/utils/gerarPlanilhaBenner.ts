import JSZip from "jszip";
import { format } from "date-fns";
import { DadoBenner } from "@/hooks/useDadosBenner";
import * as XLSX from "xlsx";
import { deriveRecorrenteFromRecursos, normalizeRecorrenteBenner, splitRecursoValues } from "@/utils/recorrenteFromRecursos";
import { isOutraMateria } from "@/utils/outraMateria";
import { ajustarGrupoChanceExito, addMergeCell } from "@/utils/cargaBennerHeader";
import { getDataDistribuicaoReal } from "@/utils/dataDistribuicaoBenner";

const DOSSIE_INVALIDO_PATTERNS = [
  /n[aã]o\s*(encontrad|localizad)/i,
  /inv[aá]lid/i,
  /sem\s*dossi[eê]/i,
  /dossi[eê]\s*n[aã]o/i,
];

export function isDossieInvalido(dossie: string | null | undefined): boolean {
  if (!dossie || !dossie.trim()) return true;
  return DOSSIE_INVALIDO_PATTERNS.some(p => p.test(dossie));
}

export type ExportModeBenner = "full" | "aq" | "ag" | "conferencia";

export interface ResultadoGeracaoBenner {
  filename: string;
  totalValidos: number;
  totalRejeitados: number;
  rejeitados: DadoBenner[];
}

const colLetters = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q",
  "R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH",
  "AI",
];

function colToLetter(c: number): string {
  if (c < colLetters.length) return colLetters[c];
  let s = "";
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateForSpreadsheet(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yearNum = Number(y.length === 2 ? `20${y}` : y);
    const monthNum = Number(m);
    const dayNum = Number(d);
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));

    if (
      result.getUTCFullYear() === yearNum &&
      result.getUTCMonth() === monthNum - 1 &&
      result.getUTCDate() === dayNum
    ) {
      return `${String(dayNum).padStart(2, "0")}/${String(monthNum).padStart(2, "0")}/${yearNum}`;
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    const yearNum = Number(y);
    const monthNum = Number(m);
    const dayNum = Number(d);
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));

    if (
      result.getUTCFullYear() === yearNum &&
      result.getUTCMonth() === monthNum - 1 &&
      result.getUTCDate() === dayNum
    ) {
      return `${d}/${m}/${y}`;
    }
  }

  return raw;
}

function normalizeText(val: unknown): string {
  return String(val ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toSN(val: unknown): string {
  const n = normalizeText(val);
  if (!n) return "";
  if (n === "sim" || n === "s" || n.startsWith("sim")) return "S";
  if (n === "nao" || n === "n" || n === "não") return "N";
  return String(val ?? "");
}

function cleanDadoBennerValue(val: unknown): string {
  const s = String(val ?? "").trim();
  return s && !/^[-–—_\s]+$/.test(s) ? s : "";
}

function fixVicePresidencia(s: string): string {
  return String(s ?? "")
    .replace(/Vice[\s\-]*Presi[eêEÊ]ncia/gi, "Vice-Presidência")
    .replace(/Vice[\s\-]*Presid[eê]ncia/gi, "Vice-Presidência");
}
// Opções exatas exibidas na tela (Decisão - Análise do Quarteirizado).
// A planilha deve respeitar exatamente esse texto, incluindo "C. TST".
const OPCOES_QUARTEIRIZADO = [
  "Desistir - Falha Processual",
  "Desistir - Fatos e Provas",
  "Desistir - Jurisprudência consolidada",
  "Desistir - Mídia Negativa",
  "Desistir Súmula 266 C. TST",
  "Prosseguir",
];
function canonQuarteirizado(s: string): string | null {
  const n = normalizeText(s).replace(/[\s.]+/g, " ").replace(/\s*-\s*/g, " - ").trim();
  for (const opt of OPCOES_QUARTEIRIZADO) {
    const on = normalizeText(opt).replace(/[\s.]+/g, " ").replace(/\s*-\s*/g, " - ").trim();
    if (n === on) return opt;
  }
  return null;
}
function toSentenceCase(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
function toSentenceCaseDash(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const canon = canonQuarteirizado(t);
  if (canon) return canon;
  if (!t.includes("-")) return toSentenceCase(t);
  return t
    .split("-")
    .map(part => {
      const p = part.trim().toLowerCase();
      if (!p) return "";
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .filter(Boolean)
    .join(" - ");
}
const SMALL_WORDS_PT = new Set(["de","da","do","das","dos","e","du","del","la","los","las"]);
function toTitleCasePt(s: string): string {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t) return "";
  return t.split(/\s+/).map((w, i) => {
    if (i > 0 && SMALL_WORDS_PT.has(w)) return w;
    return w.split("-").map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join("-");
  }).join(" ");
}
function formatTipoRecursoList(parts: string[]): string {
  return parts
    .map(p => String(p ?? "").trim())
    .filter(Boolean)
    .map(p => toTitleCasePt(p))
    .join(", ");
}
function cleanRelator(s: string): string {
  const cleaned = String(s ?? "")
    .replace(/\b(Ministr[oa]s?)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return toTitleCasePt(cleaned);
}
function parseDateAny(s: any): number {
  const v = String(s ?? "").trim();
  if (!v) return Number.POSITIVE_INFINITY;
  const dm = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dm) {
    const y = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3];
    return Date.UTC(y, +dm[2] - 1, +dm[1]);
  }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const t = Date.parse(v);
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function getValuesFromDado(d: DadoBenner): string[] {
  // IMPORTANTE: Todos os valores devem vir EXCLUSIVAMENTE do formulário
  // da aba "Dados Benner" / "Distribuição TST". Nunca usar fallback.
  const reclList = splitRecursoValues((d as any).tipo_recurso_reclamante);
  const bancoList = splitRecursoValues((d as any).tipo_recurso_banco);
  const tipoRecurso = formatTipoRecursoList([...reclList, ...bancoList]);
  const midiaSN = d.risco_midia ? toSN(d.risco_midia) : "";
  const riscoNivel = cleanDadoBennerValue((d as any).risco_nivel);
  const riscoDescRaw = cleanDadoBennerValue(d.risco_descricao);
  const riscoDescCalc = riscoNivel && riscoDescRaw
    ? `${riscoNivel} - ${riscoDescRaw}`
    : (riscoNivel || riscoDescRaw);
  // Se "Há risco de mídia negativa? (S/N)" = N, a coluna Risco fica vazia.
  const riscoDesc = midiaSN === "N" ? "" : riscoDescCalc;

  // Listas de matérias com análise (Reclamante + Banco) - novas colunas AB..AH
  const materiasAnalise: Array<any> = [
    ...(Array.isArray((d as any).materias_analise_reclamante) ? (d as any).materias_analise_reclamante : []),
    ...(Array.isArray((d as any).materias_analise_banco) ? (d as any).materias_analise_banco : []),
    // "Outra Matéria" é neutra e vai normalmente para a planilha.
  ].filter((i) => i && i.materia);
  const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const joinUnique = (items: any[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      const k = norm(it.materia);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(String(it.materia).trim());
    }
    return out.join(",");
  };
  const turmaFav = joinUnique(materiasAnalise.filter((i) => norm(i.chance_turma).startsWith("FAVOR")));
  const turmaDesf = joinUnique(materiasAnalise.filter((i) => norm(i.chance_turma).startsWith("DESF")));
  const relFav = joinUnique(materiasAnalise.filter((i) => norm(i.chance_relator).startsWith("FAVOR")));
  const relDesf = joinUnique(materiasAnalise.filter((i) => norm(i.chance_relator).startsWith("DESF")));
  const bem = joinUnique(materiasAnalise.filter((i) => norm(i.aparelhamento).startsWith("BEM")));
  const mal = joinUnique(materiasAnalise.filter((i) => norm(i.aparelhamento).startsWith("MAL")));
  const exito = joinUnique(materiasAnalise.filter((i) => norm(i.chance_exito) === "SIM"));
  const semExito = joinUnique(materiasAnalise.filter((i) => norm(i.chance_exito) === "NAO"));


  return [
    d.dossie || "",
    d.tribunal || "",
    tipoRecurso,
    formatDateForSpreadsheet(getDataDistribuicaoReal(d)),
    fixVicePresidencia(d.turma || ""),
    cleanRelator(d.relator || ""),
    toSentenceCaseDash(cleanDadoBennerValue((d as any).decisao_quarteirizado)),
    midiaSN,
    riscoDesc,
    d.provas_digitais ? toSN(d.provas_digitais) : "",
    d.tem_data_julgamento || "",
    d.data_julgamento || "",
    d.horario_julgamento || "",
    d.tipo_julgamento || "",
    d.materia_honra ? toSN(d.materia_honra) : "",
    d.entrega_memoriais ? toSN(d.entrega_memoriais) : "",
    d.sustentacao_oral ? toSN(d.sustentacao_oral) : "",
    d.resultado_sem_transcendencia ? "X" : "",
    d.resultado_nao_conhecido ? "X" : "",
    d.resultado_conhecido_provido ? "X" : "",
    d.resultado_conhecido_nao_provido ? "X" : "",
    d.resultado_outra || "",
    d.observacoes || "",
    d.ganhamos ? "X" : "",
    d.perdemos ? "X" : "",
    d.processo_baixado ? toSN(d.processo_baixado) : "",
    normalizeRecorrenteBenner(
      deriveRecorrenteFromRecursos((d as any).tipo_recurso_reclamante, (d as any).tipo_recurso_banco) ||
        (d as any).parte_recorrente ||
        (d as any).recorrente
    ),
    turmaFav,
    turmaDesf,
    relFav,
    relDesf,
    bem,
    mal,
    exito,
    semExito,
  ];
}

/** Cabeçalho da coluna final acrescentada em todas as planilhas de carga. */
const HEADER_SEM_EXITO = "Sem chance de êxito";
/** Índice da coluna "Sem chance de êxito" no array de getValuesFromDado. */
const IDX_SEM_EXITO = 34;

/**
 * Acrescenta/substitui uma célula de cabeçalho de texto em uma linha XML.
 */
function setHeaderCell(
  rowXml: string,
  rowNum: number,
  colIdx: number,
  strIdx: number,
  styleId: number,
  totalCols: number,
): string {
  const letter = colToLetter(colIdx);
  const cellXml = `<c r="${letter}${rowNum}" t="s"${styleId > 0 ? ` s="${styleId}"` : ""}><v>${strIdx}</v></c>`;
  if (!rowXml) return `<row r="${rowNum}" spans="1:${totalCols}">${cellXml}</row>`;
  const existing = new RegExp(`<c\\b[^>]*\\br="${letter}${rowNum}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  let out = existing.test(rowXml)
    ? rowXml.replace(existing, cellXml)
    : rowXml.replace(/<\/row>\s*$/, `${cellXml}</row>`);
  out = out.replace(/spans="[^"]*"/, `spans="1:${totalCols}"`);
  return out;
}


/**
 * Generates an XLSX file from Dados Benner records using the original template.
 * Supports multiple export modes:
 * - full: Complete (A-AH) - all 34 columns
 * - aq: Até Recurso (A-Q) - first 17 columns
 * - ag: Até Análise quarteirizado (A-G) - first 7 columns
 * - conferencia: Planilha de Conferência - inserts Processo after Dossiê
 */
export async function gerarPlanilhaBenner(
  dados: DadoBenner[],
  mode: ExportModeBenner = "full"
): Promise<ResultadoGeracaoBenner> {
  // Ordenação obrigatória: Data da Distribuição (menor para maior) antes de exportar
  const dadosOrdenados = [...dados].sort(
    (a, b) => parseDateAny(getDataDistribuicaoReal(a)) - parseDateAny(getDataDistribuicaoReal(b))
  );
  const validos = dadosOrdenados.filter(d => !isDossieInvalido(d.dossie));
  const rejeitados = dadosOrdenados.filter(d => isDossieInvalido(d.dossie));

  if (rejeitados.length > 0) {
    gerarPlanilhaRejeicoes(rejeitados);
  }

  const response = await fetch("/templates/layout_carga_benner_template.xlsx");
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  // Read shared strings
  const ssXml = await zip.file("xl/sharedStrings.xml")!.async("string");
  const existingStrings: string[] = [];
  const siRegex = /<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(ssXml)) !== null) {
    existingStrings.push(siMatch[1]);
  }

  const stringMap = new Map<string, number>();
  existingStrings.forEach((s, i) => stringMap.set(s, i));
  const newStrings = [...existingStrings];

  function getStrIdx(val: string): number {
    const escaped = escapeXml(val);
    if (stringMap.has(escaped)) return stringMap.get(escaped)!;
    const idx = newStrings.length;
    newStrings.push(escaped);
    stringMap.set(escaped, idx);
    return idx;
  }

  // Read styles to create centered style + yellow fill style
  let stylesXml = await zip.file("xl/styles.xml")!.async("string");

  // Find existing yellow fill index (FFFFFF00) in template
  let yellowFillId = 0;
  const fillRegex = /<fill>/g;
  let fillIdx = 0;
  let fillMatch: RegExpExecArray | null;
  const fillsSection = stylesXml.match(/<fills[^>]*>([\s\S]*?)<\/fills>/);
  if (fillsSection) {
    const singleFillRegex = /<fill>[\s\S]*?<\/fill>/g;
    let fm: RegExpExecArray | null;
    let fi = 0;
    while ((fm = singleFillRegex.exec(fillsSection[1])) !== null) {
      if (fm[0].includes("FFFFFF00")) {
        yellowFillId = fi;
        break;
      }
      fi++;
    }
    if (yellowFillId === 0) {
      // No yellow fill found, add one
      const fillsCountMatch = stylesXml.match(/<fills count="(\d+)">/);
      if (fillsCountMatch) {
        const fillCount = parseInt(fillsCountMatch[1]);
        yellowFillId = fillCount;
        const yellowFill = `<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>`;
        stylesXml = stylesXml.replace(/<\/fills>/, yellowFill + `</fills>`);
        stylesXml = stylesXml.replace(`<fills count="${fillCount}">`, `<fills count="${fillCount + 1}">`);
      }
    }
  }

  const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
  let centeredStyleId = 0;
  let yellowStyleId = 0;
  if (cellXfsMatch) {
    const currentCount = parseInt(cellXfsMatch[1]);
    const centeredXf = `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`;
    const yellowXf = `<xf numFmtId="0" fontId="0" fillId="${yellowFillId}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`;
    stylesXml = stylesXml.replace(/<\/cellXfs>/, centeredXf + yellowXf + `</cellXfs>`);
    stylesXml = stylesXml.replace(`<cellXfs count="${currentCount}">`, `<cellXfs count="${currentCount + 2}">`);
    centeredStyleId = currentCount;
    yellowStyleId = currentCount + 1;
    zip.file("xl/styles.xml", stylesXml);
  }

  const isConferencia = mode === "conferencia";
  const baseCols = mode === "full" || isConferencia ? 34 : mode === "ag" ? 7 : 17;
  // A coluna "Sem chance de êxito" é a última em TODAS as planilhas geradas.
  const colIdxs = [...Array(baseCols).keys(), IDX_SEM_EXITO];
  const maxCol = colIdxs.length;
  const totalCols = isConferencia ? maxCol + 1 : maxCol; // +1 for inserted Processo column

  let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  
  let headerRows = "";
  let mergeChanceExito: string | null = null;
  if (sheetDataMatch) {
    const allRowsContent = sheetDataMatch[1];
    const row1Match = allRowsContent.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
    const row2Match = allRowsContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/);

    let h1 = row1Match?.[0] ?? "";
    let h2 = row2Match?.[0] ?? "";

    if (isConferencia) {
      const shifted = shiftAndInsertHeader(h1, h2, getStrIdx, centeredStyleId, totalCols);
      const h1End = shifted.indexOf("</row>") + "</row>".length;
      h1 = shifted.slice(0, h1End);
      h2 = shifted.slice(h1End);
    }

    h2 = setHeaderCell(h2, 2, totalCols - 1, getStrIdx(HEADER_SEM_EXITO), centeredStyleId, totalCols);

    const ajuste = ajustarGrupoChanceExito({
      row1: h1,
      row2: h2,
      sheetXml,
      colIdx: totalCols - 1,
      strIdxTituloGrupo: getStrIdx("Chance de êxito"),
    });
    mergeChanceExito = ajuste.mergeRef;
    headerRows = ajuste.row1 + ajuste.row2;
  }


  // Build data rows
  let dataRowsXml = "";
  validos.forEach((d, idx) => {
    const rowNum = idx + 3;
    const values = getValuesFromDado(d);
    let cellsXml = "";

    if (isConferencia) {
      // Col A = Dossiê
      const dossieVal = values[0];
      if (dossieVal) {
        cellsXml += `<c r="A${rowNum}" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${getStrIdx(dossieVal)}</v></c>`;
      }
      // Col B = Processo
      const procVal = d.processo || "";
      if (procVal) {
        cellsXml += `<c r="B${rowNum}" t="s"${centeredStyleId > 0 ? ` s="${centeredStyleId}"` : ""}><v>${getStrIdx(procVal)}</v></c>`;
      }
      // Cols C onwards = original cols B..AH (shifted +1) + coluna final
      for (let p = 1; p < colIdxs.length; p++) {
        const c = colIdxs[p];
        const val = values[c];
        if (!val) continue;
        const ref = colToLetter(p + 1) + rowNum;
        // c==2 is tipo_recurso (original index 2, shifted to col D)
        const isYellow = c === 2 && d.tipo_recurso_auto && yellowStyleId > 0;
        const styleId = isYellow ? yellowStyleId : (centeredStyleId > 0 ? centeredStyleId : 0);
        if (styleId > 0) {
          cellsXml += `<c r="${ref}" t="s" s="${styleId}"><v>${getStrIdx(val)}</v></c>`;
        } else {
          cellsXml += `<c r="${ref}" t="s"><v>${getStrIdx(val)}</v></c>`;
        }
      }
    } else {
      // Standard mode
      for (let p = 0; p < colIdxs.length; p++) {
        const c = colIdxs[p];
        const val = values[c];
        if (!val) continue;
        const ref = colToLetter(p) + rowNum;
        // c==2 is tipo_recurso column
        const isYellow = c === 2 && d.tipo_recurso_auto && yellowStyleId > 0;
        const styleId = isYellow ? yellowStyleId : (centeredStyleId > 0 ? centeredStyleId : 0);
        if (styleId > 0) {
          cellsXml += `<c r="${ref}" t="s" s="${styleId}"><v>${getStrIdx(val)}</v></c>`;
        } else {
          cellsXml += `<c r="${ref}" t="s"><v>${getStrIdx(val)}</v></c>`;
        }
      }
    }

    dataRowsXml += `<row r="${rowNum}" spans="1:${totalCols}">${cellsXml}</row>`;
  });


  const lastRow = validos.length + 2;
  const lastColLetter = colToLetter(totalCols - 1);
  sheetXml = sheetXml.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:${lastColLetter}${lastRow}"`);
  sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRows}${dataRowsXml}</sheetData>`);

  // For conferência mode, insert one column after A: keep A refs, shift B+ refs by 1
  if (isConferencia) {
    sheetXml = sheetXml.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, (mergeCellsBlock) => {
      return mergeCellsBlock.replace(/ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g, (_m, startCol, startRow, endCol, endRow) => {
        const startIdx = letterToCol(startCol);
        const endIdx = letterToCol(endCol);
        const newStart = colToLetter(startIdx === 0 ? startIdx : startIdx + 1);
        const newEnd = colToLetter(endIdx === 0 ? endIdx : endIdx + 1);
        return `ref="${newStart}${startRow}:${newEnd}${endRow}"`;
      });
    });
  }

  // Mescla o título "Chance de êxito" sobre as duas últimas colunas.
  sheetXml = addMergeCell(sheetXml, mergeChanceExito);



  zip.file("xl/worksheets/sheet1.xml", sheetXml);

  // Rebuild shared strings
  const newSstEntries = newStrings.map(s => `<si><t xml:space="preserve">${s}</t></si>`).join("");
  const newSst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newSstEntries}</sst>`;
  zip.file("xl/sharedStrings.xml", newSst);

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const suffixMap: Record<ExportModeBenner, string> = {
    full: "",
    aq: "_ate_recurso",
    ag: "_ate_analise",
    conferencia: "_conferencia",
  };
  const filename = `Layout_Carga_Benner${suffixMap[mode]}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { filename, totalValidos: validos.length, totalRejeitados: rejeitados.length, rejeitados };
}

/**
 * For conferência mode: keep A and shift B:AH right by 1 to insert "Processo" at B
 */
function shiftAndInsertHeader(
  row1Xml: string,
  row2Xml: string,
  getStrIdx: (val: string) => number,
  centeredStyleId: number,
  totalCols: number
): string {
  function shiftRow(rowXml: string, rowNum: number, insertCells?: { col: number; xml: string }[]): string {
    if (!rowXml) return "";
    const cellRegex = /<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
    const cells: { col: number; xml: string }[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rowXml)) !== null) {
      const letter = cm[1];
      const colIdx = letterToCol(letter);
      const newColIdx = colIdx === 0 ? 0 : colIdx + 1;
      const newLetter = colToLetter(newColIdx);
      const newXml = cm[0].replace(/r="[A-Z]+\d+"/, `r="${newLetter}${rowNum}"`);
      cells.push({ col: newColIdx, xml: newXml });
    }
    if (insertCells) cells.push(...insertCells);
    cells.sort((a, b) => a.col - b.col);
    let rowTag = rowXml.match(/<row [^>]*>/)?.[0] || `<row r="${rowNum}">`;
    rowTag = rowTag.replace(/spans="[^"]*"/, `spans="1:${totalCols}"`);
    return rowTag + cells.map(c => c.xml).join("") + "</row>";
  }

  const h1 = shiftRow(row1Xml, 1);
  const procIdx = getStrIdx("Processo");
  const sAttr = centeredStyleId > 0 ? ` s="${centeredStyleId}"` : "";
  const procCell = `<c r="B2" t="s"${sAttr}><v>${procIdx}</v></c>`;
  const h2 = shiftRow(row2Xml, 2, [
    { col: 1, xml: procCell },
  ]);

  return h1 + h2;
}

function letterToCol(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

function gerarPlanilhaRejeicoes(rejeitados: DadoBenner[]) {
  const wb = XLSX.utils.book_new();
  const rows = rejeitados.map(d => ({
    "Dossiê": d.dossie || "",
    "Nº Processo": d.processo || "",
    "Tribunal": d.tribunal || "",
    "Turma": d.turma || "",
    "Relator": d.relator || "",
    "Motivo": "Dossiê inválido/não localizado",
    [HEADER_SEM_EXITO]: getValuesFromDado(d)[IDX_SEM_EXITO] || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(wb, ws, "Rejeições");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rejeicoes_Benner_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
