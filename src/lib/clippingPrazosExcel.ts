/** Exportação do Clipping — Controle de Prazos no modelo da Paixão Côrtes. */
import ExcelJS from "exceljs";

export interface ClippingPub {
  id: string;
  data_publicacao?: string | null;
  data_disponibilizacao?: string | null;
  processo_numero?: string | null;
  tribunal?: string | null;
  orgao?: string | null;
  tipo_comunicacao?: string | null;
  meio?: string | null;
  polo_ativo?: string | null;
  polo_passivo?: string | null;
  partes_json?: any;
  advogados_json?: any;
  monitoramento_descricao?: string | null;
  monitoramento_termo?: string | null;
  monitoramento_tipo?: string | null;
  coordenacao_nome?: string | null;
  lida?: boolean | null;
  conteudo?: string | null;
  uf?: string | null;
  [k: string]: any;
}

const MAX_CELULA = 32000;
const VINHO = "602826";
const AMARELO_CLARO = "FFFFE5";
const BRANCO = "FFFFFF";
const PRETO = "000000";
const FONTE = "Calibri";
const TAM = 9;

const cap = (v: any) => {
  const s = String(v ?? "");
  return s.length > MAX_CELULA ? `${s.slice(0, MAX_CELULA)} […texto truncado]` : s;
};

const nomes = (arr: any): string =>
  Array.isArray(arr)
    ? arr.map((x: any) => (typeof x === "string" ? x : x?.nome || x?.name || "")).filter(Boolean).join("; ")
    : "";

const toDate = (v?: string | null): Date | null => {
  if (!v) return null;
  const ymd = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

const REGIAO_UF: Record<string, string> = {
  "1": "RJ", "2": "SP", "3": "MG", "4": "RS", "5": "BA", "6": "PE", "7": "CE",
  "8": "PA", "9": "PR", "10": "DF", "11": "AM", "12": "SC", "13": "PB",
  "14": "RO", "15": "SP", "16": "MA", "17": "ES", "18": "GO", "19": "AL",
  "20": "SE", "21": "RN", "22": "PI", "23": "MT", "24": "MS",
};

const ufDaPub = (pub: ClippingPub): string => {
  if (pub.uf) return String(pub.uf).toUpperCase();
  const trib = String(pub.tribunal || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const trt = trib.match(/^TRT(\d{1,2})$/);
  if (trt) return REGIAO_UF[String(Number(trt[1]))] || "";
  const tj = trib.match(/^(TJ|TRE)([A-Z]{2})$/);
  return tj ? tj[2] : "";
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: PRETO } },
  bottom: { style: "thin", color: { argb: PRETO } },
  left: { style: "thin", color: { argb: PRETO } },
  right: { style: "thin", color: { argb: PRETO } },
};

const aplicarCelula = (cell: ExcelJS.Cell, bold = false) => {
  cell.font = { name: FONTE, size: TAM, bold, color: { argb: PRETO } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = thinBorder;
};

/** Gera uma imagem nítida da marca para manter o cabeçalho igual ao modelo. */
const gerarLogoBase64 = (): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 150;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.scale(2, 2);
  ctx.strokeStyle = `#${VINHO}`;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 13, 39, 47);
  ctx.beginPath();
  ctx.moveTo(15, 53); ctx.lineTo(15, 22); ctx.lineTo(39, 22); ctx.lineTo(39, 31);
  ctx.lineTo(24, 31); ctx.lineTo(24, 52); ctx.lineTo(47, 52);
  ctx.stroke();

  ctx.fillStyle = "#423438";
  ctx.font = "25px Georgia, serif";
  ctx.fillText("PAIXÃO CÔRTES", 60, 39);
  ctx.font = "8px Arial, sans-serif";
  const subtitulo = "A D V O G A D O S";
  ctx.fillText(subtitulo, 112, 55);
  return canvas.toDataURL("image/png").split(",")[1] || "";
};

const baixar = async (wb: ExcelJS.Workbook, filename: string) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function gerarClippingPrazosExcel(
  pubs: ClippingPub[],
  comentariosPorPub: Map<string, Array<{ autor: string; comentario: string; created_at: string }>>,
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Juris Control — Paixão Côrtes Advogados";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  wb.calcProperties.forceFullCalc = true;
  wb.calcProperties.calcMode = "auto";

  const ws = wb.addWorksheet("GERAL", { views: [{ state: "frozen", ySplit: 6 }] });
  const headers = [
    "PUBLICAÇÃO", "PROCESSO", "RECLAMANTE", "PROVIDÊNCIA", "PRAZO\n(DIAS)",
    "PRAZO FATAL", "STATUS ATUAL", "CLIENTE/\nPOPULAÇÃO", "UF",
    "RESPONSÁVEL", "OBSERVAÇÃO", "DEP. RECURSAL OU JUDICIAL", "CUSTAS",
  ];
  const widths = [10, 25, 29, 31, 8, 11, 13, 16, 5, 17, 25, 14, 15];
  widths.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  [13.5, 25, 25, 8, 20, 34].forEach((height, i) => { ws.getRow(i + 1).height = height; });

  ws.mergeCells("A2:B3");
  const logo = gerarLogoBase64();
  if (logo) {
    const logoId = wb.addImage({ base64: logo, extension: "png" });
    ws.addImage(logoId, { tl: { col: 0.08, row: 1.08 }, ext: { width: 245, height: 53 } });
  }

  ws.getCell("C2").value = "Hoje:";
  ws.getCell("C2").font = { name: FONTE, size: TAM, color: { argb: PRETO } };
  ws.getCell("C2").alignment = { horizontal: "right", vertical: "middle" };
  ws.mergeCells("D2:E2");
  ws.mergeCells("D3:E3");
  ws.getCell("D2").value = { formula: "TODAY()" };
  ws.getCell("D2").numFmt = "dd/mm/yyyy";
  ws.getCell("D3").value = { formula: "WEEKDAY(D2,1)" };
  ws.getCell("D3").numFmt = "dddd";
  ["D2", "D3"].forEach((ref) => {
    const cell = ws.getCell(ref);
    aplicarCelula(cell, true);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMARELO_CLARO } };
  });

  ws.mergeCells("A5:M5");
  ws.getCell("A5").value = "CLIPPING - CONTROLE DE PRAZOS";
  ws.getCell("A5").font = { name: FONTE, size: TAM, bold: true, color: { argb: BRANCO } };
  ws.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
  ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("A5").border = thinBorder;

  const headerRow = ws.getRow(6);
  headerRow.values = headers;
  headerRow.eachCell((cell) => {
    cell.font = { name: FONTE, size: TAM, bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });

  pubs.forEach((pub, index) => {
    const rowNumber = index + 7;
    const comentarios = (comentariosPorPub.get(pub.id) || [])
      .map((c) => `${c.autor}: ${c.comentario}`)
      .join(" | ");
    const observacao = [pub.tribunal, pub.orgao, comentarios].filter(Boolean).join(" — ");
    const row = ws.getRow(rowNumber);
    row.height = 30;
    row.values = [
      toDate(pub.data_disponibilizacao || pub.data_publicacao),
      cap(pub.processo_numero || ""),
      cap(pub.polo_ativo || nomes(pub.partes_json)),
      cap(pub.tipo_comunicacao || ""),
      null,
      { formula: `IF(OR(A${rowNumber}="",E${rowNumber}=""),"",WORKDAY(A${rowNumber},E${rowNumber}))` },
      { formula: `IF(F${rowNumber}="","",IF(F${rowNumber}=$D$2,"VENCE HOJE",IF(F${rowNumber}<$D$2,"VENCIDO","NO PRAZO")))` },
      cap(pub.monitoramento_descricao || pub.monitoramento_termo || ""),
      ufDaPub(pub),
      cap(pub.coordenacao_nome || ""),
      cap(observacao),
      null,
      null,
    ];
    row.eachCell({ includeEmpty: true }, (cell) => aplicarCelula(cell, cell.col === 7));
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(5).numFmt = "0";
    row.getCell(6).numFmt = "dd/mm/yyyy";
  });

  if (pubs.length > 0) {
    ws.dataValidations.add(`E7:E${pubs.length + 6}`, {
      type: "whole",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Prazo inválido",
      error: "Informe a quantidade de dias como número inteiro.",
    });
  }
  ws.autoFilter = { from: "A6", to: `M${Math.max(6, pubs.length + 6)}` };

  const dados = wb.addWorksheet("DADOS", { views: [{ state: "frozen", ySplit: 1 }] });
  const dadosHeaders = [
    "#", "Data publicação", "Data disponibilização", "Nº do processo", "Tribunal", "UF",
    "Órgão / Vara", "Tipo de comunicação", "Meio", "Polo ativo", "Polo passivo", "Advogados",
    "Monitoramento", "Tipo do monitoramento", "Coordenação", "Lida", "Comentários", "Conteúdo integral",
  ];
  dados.addRow(dadosHeaders);
  dados.getRow(1).height = 34;
  dados.getRow(1).eachCell((cell) => {
    cell.font = { name: FONTE, size: TAM, bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINHO } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });
  [5, 14, 18, 26, 12, 5, 30, 24, 12, 34, 34, 34, 28, 16, 22, 8, 40, 120]
    .forEach((width, i) => { dados.getColumn(i + 1).width = width; });

  pubs.forEach((pub, index) => {
    const conteudo = String(pub.conteudo || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const row = dados.addRow([
      index + 1,
      toDate(pub.data_publicacao),
      toDate(pub.data_disponibilizacao),
      cap(pub.processo_numero || ""),
      cap(pub.tribunal || ""),
      ufDaPub(pub),
      cap(pub.orgao || ""),
      cap(pub.tipo_comunicacao || ""),
      cap(pub.meio || ""),
      cap(pub.polo_ativo || nomes(pub.partes_json)),
      cap(pub.polo_passivo || ""),
      cap(nomes(pub.advogados_json)),
      cap(pub.monitoramento_descricao || pub.monitoramento_termo || ""),
      cap(pub.monitoramento_tipo || ""),
      cap(pub.coordenacao_nome || ""),
      pub.lida ? "Sim" : "Não",
      cap((comentariosPorPub.get(pub.id) || []).map((c) => `${c.autor}: ${c.comentario}`).join(" | ")),
      cap(conteudo),
    ]);
    row.height = 30;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONTE, size: TAM, color: { argb: PRETO } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder;
    });
    row.getCell(2).numFmt = "dd/mm/yyyy";
    row.getCell(3).numFmt = "dd/mm/yyyy";
  });
  dados.autoFilter = { from: "A1", to: `R${Math.max(1, pubs.length + 1)}` };

  await baixar(wb, filename);
}