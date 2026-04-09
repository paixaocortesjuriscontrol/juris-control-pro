import JSZip from "jszip";
import { format } from "date-fns";
import { DadoBenner } from "@/hooks/useDadosBenner";
import * as XLSX from "xlsx";

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

export interface ResultadoGeracaoBenner {
  filename: string;
  totalValidos: number;
  totalRejeitados: number;
  rejeitados: DadoBenner[];
}

/**
 * Generates an XLSX file from Dados Benner records using the original template
 * to preserve exact formatting, fonts, colors, alignments and headers.
 * Records with invalid dossiê are excluded and returned separately.
 */
export async function gerarPlanilhaBenner(dados: DadoBenner[]): Promise<ResultadoGeracaoBenner> {
  const validos = dados.filter(d => !isDossieInvalido(d.dossie));
  const rejeitados = dados.filter(d => isDossieInvalido(d.dossie));

  // Generate rejections file if any
  if (rejeitados.length > 0) {
    gerarPlanilhaRejeicoes(rejeitados);
  }

  // Fetch template
  const response = await fetch("/templates/layout_carga_benner_template.xlsx");
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  // Read shared strings
  const ssXml = await zip.file("xl/sharedStrings.xml")!.async("string");
  const ssMatch = ssXml.match(/<sst[^>]*>([\s\S]*)<\/sst>/);
  const existingSiBlocks = ssMatch ? ssMatch[1] : "";
  const existingCount = (existingSiBlocks.match(/<si>/g) || []).length;

  const newStrings: string[] = [];
  const stringIndexMap = new Map<string, number>();

  function getStringIndex(val: string): number {
    if (stringIndexMap.has(val)) return stringIndexMap.get(val)!;
    const idx = existingCount + newStrings.length;
    newStrings.push(val);
    stringIndexMap.set(val, idx);
    return idx;
  }

  const colLetters = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q",
    "R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH"
  ];

  let dataRowsXml = "";
  validos.forEach((d, idx) => {
    const rowNum = idx + 3;
    const values = [
      d.dossie || "",
      d.tribunal || "",
      d.tipo_recurso || "",
      d.data_distribuicao || "",
      d.turma || "",
      d.relator || "",
      d.analise_quarteirizado || "",
      d.risco_midia || "",
      d.risco_descricao || "",
      d.provas_digitais || "",
      d.tem_data_julgamento || "",
      d.data_julgamento || "",
      d.horario_julgamento || "",
      d.tipo_julgamento || "",
      d.materia_honra || "",
      d.entrega_memoriais || "",
      d.sustentacao_oral || "",
      d.resultado_sem_transcendencia ? "X" : "",
      d.resultado_nao_conhecido ? "X" : "",
      d.resultado_conhecido_provido ? "X" : "",
      d.resultado_conhecido_nao_provido ? "X" : "",
      d.resultado_outra || "",
      d.observacoes || "",
      d.ganhamos ? "X" : "",
      d.perdemos ? "X" : "",
      d.processo_baixado || "",
      d.recorrente || "",
      d.posicao_turma_favoravel ? "X" : "",
      d.posicao_turma_desfavoravel ? "X" : "",
      d.posicao_relator_favoravel ? "X" : "",
      d.posicao_relator_desfavoravel ? "X" : "",
      d.recurso_bem_aparelhado ? "X" : "",
      d.recurso_mal_aparelhado ? "X" : "",
      d.chance_exito || "",
    ];

    let cellsXml = "";
    values.forEach((val, colIdx) => {
      if (!val) return;
      const ref = `${colLetters[colIdx]}${rowNum}`;
      const style = ' s="5"';
      const strIdx = getStringIndex(escapeXml(val));
      cellsXml += `<c r="${ref}"${style} t="s"><v>${strIdx}</v></c>`;
    });

    dataRowsXml += `<row r="${rowNum}">${cellsXml}</row>`;
  });

  // Update shared strings XML
  let newSiXml = "";
  for (const s of newStrings) {
    newSiXml += `<si><t>${s}</t></si>`;
  }
  const totalCount = existingCount + newStrings.length;
  const updatedSsXml = ssXml
    .replace(/<sst[^>]*>/, `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalCount}" uniqueCount="${totalCount}">`)
    .replace(/<\/sst>/, `${newSiXml}</sst>`);

  zip.file("xl/sharedStrings.xml", updatedSsXml);

  let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (sheetDataMatch) {
    const allRowsContent = sheetDataMatch[1];
    const row1Match = allRowsContent.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
    const row2Match = allRowsContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/);
    const headerRows = (row1Match ? row1Match[0] : "") + (row2Match ? row2Match[0] : "");
    sheetXml = sheetXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${headerRows}${dataRowsXml}</sheetData>`
    );
  }

  const lastRow = validos.length + 2;
  sheetXml = sheetXml.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:AH${lastRow}"`);
  zip.file("xl/worksheets/sheet1.xml", sheetXml);

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `Layout_Carga_Benner_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { filename, totalValidos: validos.length, totalRejeitados: rejeitados.length, rejeitados };
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
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 }];
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
