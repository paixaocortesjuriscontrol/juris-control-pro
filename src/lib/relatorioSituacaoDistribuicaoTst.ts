import * as XLSX from "xlsx";

export interface SituacaoRow {
  situacao: string;
  quantidade: number;
  transversal?: boolean;
}

export interface GerarRelatorioSituacaoInput {
  linhas: SituacaoRow[];
  total: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  filtrosResumo?: string[];
}

const fmt = (d: string | null): string => {
  if (!d) return "—";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    if (Number.isNaN(dt.getTime())) return "—";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${dt.getFullYear()}`;
  } catch {
    return "—";
  }
};

export function gerarRelatorioSituacaoExcel(
  input: GerarRelatorioSituacaoInput,
): { blob: Blob; filename: string } {
  const { linhas, total, periodoInicio, periodoFim, filtrosResumo = [] } = input;

  const aoa: any[][] = [];
  aoa.push(["Relatório Total por Situação - Distribuição TST"]);
  aoa.push([`Período: ${fmt(periodoInicio)} a ${fmt(periodoFim)}`]);
  aoa.push([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
  if (filtrosResumo.length > 0) {
    aoa.push([`Filtros: ${filtrosResumo.join(" | ")}`]);
  }
  aoa.push([]);
  aoa.push(["Situação", "Quantidade", "% do Total"]);

  const principais = linhas.filter((l) => !l.transversal);
  const transversais = linhas.filter((l) => l.transversal);

  principais.forEach((l) => {
    const pct = total > 0 ? (l.quantidade / total) * 100 : 0;
    aoa.push([l.situacao, l.quantidade, `${pct.toFixed(1)}%`]);
  });
  aoa.push(["Total", total, "100,0%"]);

  if (transversais.length > 0) {
    aoa.push([]);
    aoa.push(["Cortes transversais (não somam ao total)", "Quantidade", "% do Total"]);
    transversais.forEach((l) => {
      const pct = total > 0 ? (l.quantidade / total) * 100 : 0;
      aoa.push([l.situacao, l.quantidade, `${pct.toFixed(1)}%`]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];
  if (filtrosResumo.length > 0) {
    ws["!merges"].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 2 } });
  }

  // Formatação básica (negrito) via cellStyle nativo
  const bold = { font: { bold: true } } as any;
  const headerRow = filtrosResumo.length > 0 ? 5 : 4;
  const titleCell = ws["A1"];
  if (titleCell) titleCell.s = { font: { bold: true, sz: 14 } };
  ["A", "B", "C"].forEach((col) => {
    const ref = `${col}${headerRow + 1}`;
    if (ws[ref]) ws[ref].s = bold;
  });
  const totalRow = headerRow + 1 + principais.length + 1;
  ["A", "B", "C"].forEach((col) => {
    const ref = `${col}${totalRow}`;
    if (ws[ref]) ws[ref].s = bold;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Total por Situação");

  const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `total-por-situacao-tst-${ts}.xlsx`;

  return { blob, filename };
}