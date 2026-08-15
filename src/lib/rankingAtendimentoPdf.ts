import jsPDF from "jspdf";
import { format } from "date-fns";

/** Cores institucionais do escritório (azul-marinho + dourado). */
const NAVY: [number, number, number] = [24, 37, 68];
const GOLD: [number, number, number] = [217, 162, 21];
const CINZA: [number, number, number] = [110, 110, 110];
const ZEBRA: [number, number, number] = [244, 246, 250];

export type ColunaPdf = { header: string; width: number; key: string; align?: "left" | "right" };

export function gerarRankingPdf(opts: {
  titulo: string;
  subtitulo: string;
  periodo: string;
  filtros: string;
  colunas: ColunaPdf[];
  linhas: Record<string, string | number>[];
  resumo?: { label: string; valor: string | number }[];
  nomeArquivo: string;
}) {
  const { titulo, subtitulo, periodo, filtros, colunas, linhas, resumo, nomeArquivo } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ml = 10;
  const rowH = 7;
  const headH = 8;

  const cabecalho = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 20, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 20, pageW, 1.2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(titulo, ml, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(230, 210, 160);
    doc.text(subtitulo, ml, 15);
    doc.text(`Período: ${periodo}`, pageW - ml, 9, { align: "right" });
    doc.text(filtros, pageW - ml, 15, { align: "right" });
  };

  const cabecalhoTabela = (y: number) => {
    doc.setFillColor(...NAVY);
    let x = ml;
    colunas.forEach((c) => {
      doc.rect(x, y, c.width, headH, "F");
      x += c.width;
    });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    x = ml;
    colunas.forEach((c) => {
      const tx = c.align === "right" ? x + c.width - 1.5 : x + 1.5;
      doc.text(c.header, tx, y + 5.5, { align: c.align === "right" ? "right" : "left" });
      x += c.width;
    });
    return y + headH;
  };

  cabecalho();
  let y = 26;

  if (resumo && resumo.length > 0) {
    const cardW = (pageW - ml * 2 - (resumo.length - 1) * 3) / resumo.length;
    let x = ml;
    resumo.forEach((r) => {
      doc.setDrawColor(220, 224, 232);
      doc.setFillColor(...ZEBRA);
      doc.roundedRect(x, y, cardW, 14, 1.5, 1.5, "FD");
      doc.setFontSize(6.5);
      doc.setTextColor(...CINZA);
      doc.setFont("helvetica", "normal");
      doc.text(r.label.toUpperCase(), x + 2.5, y + 5);
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(String(r.valor), x + 2.5, y + 11.5);
      x += cardW + 3;
    });
    y += 19;
  }

  y = cabecalhoTabela(y);

  linhas.forEach((linha, idx) => {
    if (y + rowH > pageH - 12) {
      doc.addPage();
      cabecalho();
      y = cabecalhoTabela(26);
    }
    if (idx % 2 === 0) {
      doc.setFillColor(...ZEBRA);
      let x = ml;
      colunas.forEach((c) => {
        doc.rect(x, y, c.width, rowH, "F");
        x += c.width;
      });
    }
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let x = ml;
    colunas.forEach((c) => {
      let valor = String(linha[c.key] ?? "-");
      const maxChars = Math.floor(c.width / 1.6);
      if (valor.length > maxChars) valor = valor.substring(0, maxChars - 1) + "…";
      const tx = c.align === "right" ? x + c.width - 1.5 : x + 1.5;
      doc.text(valor, tx, y + 4.8, { align: c.align === "right" ? "right" : "left" });
      x += c.width;
    });
    y += rowH;
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, ml, pageH - 5);
    doc.text(`Página ${i} de ${total}`, pageW - ml, pageH - 5, { align: "right" });
  }

  doc.save(`${nomeArquivo}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
