import * as XLSX from "xlsx-js-style";

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
  ws["!cols"] = [{ wch: 48 }, { wch: 16 }, { wch: 16 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];
  if (filtrosResumo.length > 0) {
    ws["!merges"].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 2 } });
  }

  // Paleta institucional (azul escuro / azul claro)
  const NAVY = "1E3A8A";   // azul escuro
  const NAVY_DARK = "0F1F4B";
  const LIGHT = "DBEAFE";  // azul claro
  const BORDER = "94A3B8";
  const WHITE = "FFFFFF";

  const border = {
    top: { style: "thin", color: { rgb: BORDER } },
    bottom: { style: "thin", color: { rgb: BORDER } },
    left: { style: "thin", color: { rgb: BORDER } },
    right: { style: "thin", color: { rgb: BORDER } },
  } as any;

  const setStyle = (ref: string, style: any) => {
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = style;
  };

  // Título
  setStyle("A1", {
    font: { bold: true, sz: 16, color: { rgb: WHITE } },
    fill: { patternType: "solid", fgColor: { rgb: NAVY_DARK } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 28 };

  // Subtítulos (período / gerado / filtros)
  const subtitleStyle = {
    font: { italic: true, sz: 10, color: { rgb: NAVY_DARK } },
    fill: { patternType: "solid", fgColor: { rgb: LIGHT } },
    alignment: { horizontal: "center" },
  };
  setStyle("A2", subtitleStyle);
  setStyle("A3", subtitleStyle);
  if (filtrosResumo.length > 0) setStyle("A4", subtitleStyle);

  // Cabeçalho principais
  const headerRowIdx = filtrosResumo.length > 0 ? 6 : 5; // 1-based
  const headerStyle = {
    font: { bold: true, color: { rgb: WHITE }, sz: 11 },
    fill: { patternType: "solid", fgColor: { rgb: NAVY } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
  };
  ["A", "B", "C"].forEach((col) => setStyle(`${col}${headerRowIdx}`, headerStyle));
  ws["!rows"][headerRowIdx - 1] = { hpt: 22 };

  // Linhas principais (zebra)
  const bodyBase = {
    font: { sz: 11, color: { rgb: NAVY_DARK } },
    border,
  };
  for (let i = 0; i < principais.length; i++) {
    const row = headerRowIdx + 1 + i;
    const zebra = i % 2 === 0
      ? { patternType: "solid", fgColor: { rgb: "F1F5FB" } }
      : { patternType: "solid", fgColor: { rgb: WHITE } };
    setStyle(`A${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "left" } });
    setStyle(`B${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "right" } });
    setStyle(`C${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "right" } });
  }

  // Linha Total
  const totalRow = headerRowIdx + 1 + principais.length;
  const totalStyle = {
    font: { bold: true, color: { rgb: WHITE }, sz: 12 },
    fill: { patternType: "solid", fgColor: { rgb: NAVY } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
  };
  ["A", "B", "C"].forEach((col) =>
    setStyle(`${col}${totalRow}`, {
      ...totalStyle,
      alignment: { horizontal: col === "A" ? "left" : "right", vertical: "center" },
    }),
  );
  ws["!rows"][totalRow - 1] = { hpt: 22 };

  // Transversais
  if (transversais.length > 0) {
    const tHeader = totalRow + 2; // blank row + header
    ["A", "B", "C"].forEach((col) => setStyle(`${col}${tHeader}`, headerStyle));
    ws["!rows"][tHeader - 1] = { hpt: 22 };
    for (let i = 0; i < transversais.length; i++) {
      const row = tHeader + 1 + i;
      const zebra = i % 2 === 0
        ? { patternType: "solid", fgColor: { rgb: "F1F5FB" } }
        : { patternType: "solid", fgColor: { rgb: WHITE } };
      setStyle(`A${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "left" } });
      setStyle(`B${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "right" } });
      setStyle(`C${row}`, { ...bodyBase, fill: zebra, alignment: { horizontal: "right" } });
    }
  }

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