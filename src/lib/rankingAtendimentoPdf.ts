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

/* ============================================================
 * Relatório completo (todas as abas) com gráficos nativos
 * ============================================================ */

const PALETA: [number, number, number][] = [
  [24, 37, 68], // navy
  [31, 169, 113], // verde
  [242, 84, 91], // vermelho
  [59, 154, 225], // azul
  [217, 162, 21], // dourado
];

export type SerieGrafico = { nome: string; cor?: [number, number, number] };

export type SecaoPdf = {
  titulo: string;
  subtitulo?: string;
  notas?: string[];
  resumo?: { label: string; valor: string | number }[];
  grafico?: {
    titulo: string;
    categorias: string[];
    series: { nome: string; valores: number[]; cor?: [number, number, number] }[];
  };
  colunas: ColunaPdf[];
  linhas: Record<string, string | number>[];
};

export function gerarRankingPdfCompleto(opts: {
  titulo: string;
  periodo: string;
  filtros: string;
  secoes: SecaoPdf[];
  nomeArquivo: string;
}) {
  const { titulo, periodo, filtros, secoes, nomeArquivo } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ml = 10;
  const rowH = 6.6;
  const headH = 8;

  const cabecalho = (secao: string) => {
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
    doc.text(secao, ml, 15);
    doc.text(`Período: ${periodo}`, pageW - ml, 9, { align: "right" });
    doc.text(filtros, pageW - ml, 15, { align: "right" });
  };

  const desenharCabecalhoTabela = (colunas: ColunaPdf[], y: number) => {
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

  const desenharGrafico = (
    g: NonNullable<SecaoPdf["grafico"]>,
    y: number,
    largura: number,
    altura: number
  ) => {
    const eixoEsq = ml + 14;
    const base = y + altura - 14;
    const topo = y + 8;
    const areaW = largura - 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(g.titulo, ml, y + 4);

    const maxValor = Math.max(1, ...g.series.flatMap((s) => s.valores.map((v) => Number(v) || 0)));
    const escala = (topo < base ? base - topo : 1) / maxValor;

    // grades + rótulos do eixo Y
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    for (let i = 0; i <= 4; i++) {
      const valor = (maxValor / 4) * i;
      const gy = base - valor * escala;
      doc.setDrawColor(226, 230, 238);
      doc.line(eixoEsq, gy, eixoEsq + areaW, gy);
      doc.setTextColor(...CINZA);
      doc.text(String(Math.round(valor)), eixoEsq - 2, gy + 1.5, { align: "right" });
    }

    const nGrupos = Math.max(1, g.categorias.length);
    const grupoW = areaW / nGrupos;
    const barW = Math.max(1.2, (grupoW * 0.7) / g.series.length);

    g.categorias.forEach((cat, gi) => {
      const gx = eixoEsq + grupoW * gi + (grupoW - barW * g.series.length) / 2;
      g.series.forEach((s, si) => {
        const valor = Number(s.valores[gi]) || 0;
        const h = valor * escala;
        const cor = s.cor || PALETA[si % PALETA.length];
        doc.setFillColor(...cor);
        if (h > 0) doc.rect(gx + barW * si, base - h, barW, h, "F");
      });
      doc.setFontSize(5.5);
      doc.setTextColor(70, 70, 70);
      const label = cat.length > 14 ? cat.substring(0, 13) + "…" : cat;
      doc.text(label, eixoEsq + grupoW * gi + grupoW / 2, base + 4, { align: "center" });
    });

    doc.setDrawColor(180, 186, 196);
    doc.line(eixoEsq, base, eixoEsq + areaW, base);

    // legenda
    let lx = eixoEsq;
    const ly = base + 9;
    doc.setFontSize(6.5);
    g.series.forEach((s, si) => {
      const cor = s.cor || PALETA[si % PALETA.length];
      doc.setFillColor(...cor);
      doc.rect(lx, ly - 2.2, 3, 3, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(s.nome, lx + 4.2, ly);
      lx += 4.2 + doc.getTextWidth(s.nome) + 6;
    });

    return y + altura;
  };

  secoes.forEach((secao, si) => {
    if (si > 0) doc.addPage();
    cabecalho(secao.titulo);
    let y = 26;

    if (secao.subtitulo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...CINZA);
      doc.text(secao.subtitulo, ml, y);
      y += 5;
    }

    if (secao.resumo?.length) {
      const cardW = (pageW - ml * 2 - (secao.resumo.length - 1) * 3) / secao.resumo.length;
      let x = ml;
      secao.resumo.forEach((r) => {
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
      y += 18;
    }

    if (secao.grafico && secao.grafico.categorias.length > 0) {
      y = desenharGrafico(secao.grafico, y, pageW - ml * 2, 62) + 4;
    }

    if (secao.notas?.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.8);
      doc.setTextColor(...CINZA);
      secao.notas.forEach((n) => {
        doc.text(n, ml, y);
        y += 3.4;
      });
      y += 2;
    }

    y = desenharCabecalhoTabela(secao.colunas, y);

    secao.linhas.forEach((linha, idx) => {
      if (y + rowH > pageH - 12) {
        doc.addPage();
        cabecalho(secao.titulo);
        y = desenharCabecalhoTabela(secao.colunas, 26);
      }
      if (idx % 2 === 0) {
        doc.setFillColor(...ZEBRA);
        let x = ml;
        secao.colunas.forEach((c) => {
          doc.rect(x, y, c.width, rowH, "F");
          x += c.width;
        });
      }
      doc.setTextColor(35, 35, 35);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      let x = ml;
      secao.colunas.forEach((c) => {
        let valor = String(linha[c.key] ?? "-");
        const maxChars = Math.floor(c.width / 1.6);
        if (valor.length > maxChars) valor = valor.substring(0, maxChars - 1) + "…";
        const tx = c.align === "right" ? x + c.width - 1.5 : x + 1.5;
        doc.text(valor, tx, y + 4.6, { align: c.align === "right" ? "right" : "left" });
        x += c.width;
      });
      y += rowH;
    });
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
