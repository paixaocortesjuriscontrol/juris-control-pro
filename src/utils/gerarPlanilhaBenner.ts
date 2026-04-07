import JSZip from "jszip";
import { format } from "date-fns";
import { DadoBenner } from "@/hooks/useDadosBenner";

/**
 * Generates an XLSX file from Dados Benner records using the original template
 * to preserve exact formatting, fonts, colors, alignments and headers.
 */
export async function gerarPlanilhaBenner(dados: DadoBenner[]): Promise<string> {
  // Fetch template
  const response = await fetch("/templates/layout_carga_benner_template.xlsx");
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  // Read shared strings
  const ssXml = await zip.file("xl/sharedStrings.xml")!.async("string");
  // Parse existing shared strings
  const ssMatch = ssXml.match(/<sst[^>]*>([\s\S]*)<\/sst>/);
  const existingSiBlocks = ssMatch ? ssMatch[1] : "";
  // Count existing strings
  const existingCount = (existingSiBlocks.match(/<si>/g) || []).length;

  // Build data values and track new shared strings
  const newStrings: string[] = [];
  const stringIndexMap = new Map<string, number>();

  function getStringIndex(val: string): number {
    if (stringIndexMap.has(val)) return stringIndexMap.get(val)!;
    const idx = existingCount + newStrings.length;
    newStrings.push(val);
    stringIndexMap.set(val, idx);
    return idx;
  }

  // Build data rows XML
  // Template layout: A=Dossiê, B=Tribunal, C=Tipo Recurso, D=Data Distribuição,
  // E=Turma, F=Relator, G=Análise, H=Risco Mídia, I=Risco, J=Provas Digitais,
  // K=Data Julgamento?, L=Data Julgamento, M=Horário, N=Tipo Julgamento,
  // O=Matéria Honra, P=Entrega Memoriais, Q=Sustentação Oral,
  // R=Sem Transcendência, S=Não Conhecido, T=Conhecido Provido, U=Conhecido Não Provido,
  // V=Outra, W=Observações, X=Ganhamos, Y=Perdemos, Z=Processo Baixado,
  // AA=Recorrente, AB=Turma Favorável, AC=Turma Desfavorável,
  // AD=Relator Favorável, AE=Relator Desfavorável,
  // AF=Bem Aparelhado, AG=Mal Aparelhado, AH=Chance Êxito
  const colLetters = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q",
    "R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH"
  ];

  let dataRowsXml = "";
  dados.forEach((d, idx) => {
    const rowNum = idx + 3; // Data starts at row 3
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
      // Cols A-F (indices 0-5) use style s="5" (centered), rest use default
      const style = colIdx <= 5 ? ' s="5"' : "";
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

  // Update sheet XML - replace data rows (keep rows 1-2)
  let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  
  // Remove all rows after row 2 and insert new data rows
  // Find the sheetData block
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (sheetDataMatch) {
    const allRowsContent = sheetDataMatch[1];
    // Keep only rows 1 and 2
    const row1Match = allRowsContent.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
    const row2Match = allRowsContent.match(/<row r="2"[^>]*>[\s\S]*?<\/row>/);
    const headerRows = (row1Match ? row1Match[0] : "") + (row2Match ? row2Match[0] : "");
    
    sheetXml = sheetXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${headerRows}${dataRowsXml}</sheetData>`
    );
  }

  // Update dimension
  const lastRow = dados.length + 2;
  sheetXml = sheetXml.replace(
    /<dimension ref="[^"]*"/,
    `<dimension ref="A1:AH${lastRow}"`
  );

  zip.file("xl/worksheets/sheet1.xml", sheetXml);

  // Generate file
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `Layout_Carga_Benner_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return filename;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
