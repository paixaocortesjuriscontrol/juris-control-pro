import ExcelJS from "exceljs";

const AZUL = "FF1F3864";
const CINZA = "FFF2F2F2";
const BORDA = "FFBFBFBF";

export interface RelatorioAtividadesOpts {
  linhas: Record<string, any>[];
  periodoLabel: string;
  tiposLabel: string;
  geradoPor?: string;
  nomeArquivo: string;
}

const borda = () => {
  const s = { style: "thin" as const, color: { argb: BORDA } };
  return { top: s, left: s, bottom: s, right: s };
};

export async function gerarRelatorioAtividadesExcel(o: RelatorioAtividadesOpts) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Juris Control";
  wb.created = new Date();
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const colunas = Object.keys(o.linhas[0] ?? {});

  // ===== Resumo =====
  const rs = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  rs.columns = [{ width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  rs.mergeCells("A1:E1");
  rs.getCell("A1").value = "Relatório de Atividades";
  rs.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  rs.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  rs.getCell("A1").alignment = { vertical: "middle" };
  rs.getRow(1).height = 30;
  const info: [string, string][] = [
    ["Período", o.periodoLabel],
    ["Tipos", o.tiposLabel],
    ["Gerado em", `${geradoEm} (Brasília)`],
    ...(o.geradoPor ? ([["Gerado por", o.geradoPor]] as [string, string][]) : []),
    ["Total de atividades", String(o.linhas.length)],
  ];
  info.forEach(([k, v], i) => {
    const r = rs.getRow(3 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { name: "Arial", bold: true };
    rs.mergeCells(3 + i, 2, 3 + i, 5);
    r.getCell(2).value = v;
    r.getCell(2).font = { name: "Arial" };
  });

  // Tabela tipo x situação
  const status = Array.from(new Set(o.linhas.map((l) => String(l.Situação ?? "")))).sort();
  const tipos = Array.from(new Set(o.linhas.map((l) => String(l.Tipo ?? "")))).sort();
  const ini = 4 + info.length;
  const header = ["Tipo", ...status, "Total"];
  rs.columns = header.map((_, i) => ({ width: i === 0 ? 32 : 16 }));
  const hr = rs.getRow(ini);
  header.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h || "(sem situação)";
    c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borda();
  });
  tipos.forEach((t, ti) => {
    const r = rs.getRow(ini + 1 + ti);
    r.getCell(1).value = t;
    status.forEach((s, si) => {
      r.getCell(2 + si).value = o.linhas.filter((l) => l.Tipo === t && String(l.Situação ?? "") === s).length;
    });
    r.getCell(2 + status.length).value = o.linhas.filter((l) => l.Tipo === t).length;
    for (let i = 1; i <= header.length; i++) {
      const c = r.getCell(i);
      c.border = borda();
      c.font = { name: "Arial", bold: i === header.length };
      if (i > 1) c.alignment = { horizontal: "center" };
      if (ti % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
    }
  });
  const tr = rs.getRow(ini + 1 + tipos.length);
  tr.getCell(1).value = "Total";
  status.forEach((s, si) => {
    tr.getCell(2 + si).value = o.linhas.filter((l) => String(l.Situação ?? "") === s).length;
  });
  tr.getCell(2 + status.length).value = o.linhas.length;
  for (let i = 1; i <= header.length; i++) {
    const c = tr.getCell(i);
    c.font = { name: "Arial", bold: true };
    c.border = borda();
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    if (i > 1) c.alignment = { horizontal: "center" };
  }

  // ===== Atividades =====
  const ws = wb.addWorksheet("Atividades", {
    views: [{ state: "frozen", ySplit: 3, xSplit: 0 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.mergeCells(1, 1, 1, Math.max(colunas.length, 1));
  ws.getCell("A1").value = `Relatório de Atividades — ${o.periodoLabel} — ${o.tiposLabel}`;
  ws.getCell("A1").font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  ws.getRow(1).height = 24;
  ws.getCell("A2").value = `Gerado em ${geradoEm} (Brasília) · ${o.linhas.length} atividade(s)`;
  ws.getCell("A2").font = { name: "Arial", italic: true, size: 9, color: { argb: "FF595959" } };

  const largura = (k: string) =>
    /Título|Local|Reclamante|Reclamada|Cliente|Responsáveis|Envolvidos|Etiquetas|Coordenação|Testemunhas|Polo/.test(k)
      ? 32
      : /Processo/.test(k)
        ? 26
        : 14;
  ws.columns = colunas.map((k) => ({ key: k, width: largura(k) }));
  const h = ws.getRow(3);
  colunas.forEach((k, i) => {
    const c = h.getCell(i + 1);
    c.value = k;
    c.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borda();
  });
  h.height = 30;
  o.linhas.forEach((l, idx) => {
    const r = ws.addRow(colunas.map((k) => l[k] ?? ""));
    r.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: "Arial", size: 9 };
      c.alignment = { vertical: "top", wrapText: true };
      c.border = borda();
      if (idx % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
    });
  });
  if (colunas.length) {
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + o.linhas.length, column: colunas.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = o.nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
