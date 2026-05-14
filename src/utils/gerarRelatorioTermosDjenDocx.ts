import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, PageOrientation,
} from "docx";
import type { MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";

interface GerarRelatorioParams {
  monitoramentos: MonitoramentoDjen[];
  coordNomeMap: Map<string, string>;
  filtrosDescricao?: string[];
  tituloCoordenacao?: string;
}

const NAVY = "1A2A47";
const GOLD = "C9A961";
const SLATE = "64748B";
const ROW_ALT = "F1F5F9";
const BORDER = "CBD5E1";
const TEXT_DARK = "1E293B";

const TIPO_LABEL: Record<string, string> = {
  parte: "Parte",
  "palavra-chave": "Palavra-chave",
  advogado: "Advogado",
  processo: "Processo",
};

function formatarData(d: Date) {
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function asArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: NAVY, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 16, font: "Arial" })],
    })],
  });
}

function bodyCell(text: string, width: number, opts: { bold?: boolean; color?: string; fill?: string } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text: text || "—", bold: opts.bold, color: opts.color || TEXT_DARK, size: 15, font: "Arial" })],
    })],
  });
}

export async function gerarRelatorioTermosDjenDocx({
  monitoramentos, coordNomeMap, filtrosDescricao = [], tituloCoordenacao,
}: GerarRelatorioParams) {
  const agora = new Date();

  const dados = [...monitoramentos].sort((a, b) => {
    const da = (a.descricao || "").trim().toLowerCase();
    const db = (b.descricao || "").trim().toLowerCase();
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db, "pt-BR");
  });

  const total = dados.length;
  const ativos = dados.filter((d) => d.ativo).length;
  const inativos = total - ativos;
  const tipos: Record<string, number> = {};
  dados.forEach((d) => {
    const t = d.tipo || "—";
    tipos[t] = (tipos[t] || 0) + 1;
  });

  // Landscape A4: ~15840 dxa width - margins 720*2 = ~14400 content width
  const contentWidth = 14400;
  const colWidths = [2200, 1100, 1900, 1700, 1600, 1600, 1100, 3200];
  // sum = 14400

  const headers = ["Descrição", "Tipo", "Termo de busca", "Termos OR", "Cond. concomitante", "Exclusões", "OAB/UF", "Tribunais"];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, colWidths[i])),
  });

  const bodyRows = dados.map((d, idx) => {
    const tribs = asArray(d.tribunais);
    const exclusoes = asArray(d.exclusoes);
    const termosOr = asArray(d.termos_or);
    const tipoLabel = TIPO_LABEL[d.tipo || ""] || d.tipo || "—";
    const oabFmt = d.oab ? `${d.oab}${d.uf ? "/" + d.uf : ""}` : "—";
    const concomitante = (d.condicao_concomitante || "").trim() || "—";
    const fill = idx % 2 === 1 ? ROW_ALT : undefined;
    const inativo = !d.ativo;
    const inativoColor = inativo ? "B91C1C" : undefined;

    const cells = [
      bodyCell((d.descricao || "—").trim(), colWidths[0], { bold: true, color: inativoColor, fill }),
      bodyCell(tipoLabel, colWidths[1], { fill }),
      bodyCell((d.termo_busca || "—").trim(), colWidths[2], { color: inativoColor, fill }),
      bodyCell(termosOr.length ? termosOr.join(" | ") : "—", colWidths[3], { fill }),
      bodyCell(concomitante, colWidths[4], { fill }),
      bodyCell(exclusoes.length ? exclusoes.join(", ") : "—", colWidths[5], { fill }),
      bodyCell(oabFmt, colWidths[6], { fill }),
      bodyCell(tribs.length ? tribs.join(", ") : "Todos", colWidths[7], { fill }),
    ];
    return new TableRow({ children: cells });
  });

  const tabela = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });

  // Cards de totalizadores como tabela 1x4
  const tiposStr = Object.entries(tipos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join("  ");
  const cardW = Math.floor(contentWidth / 4);
  const cardsTable = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [cardW, cardW, cardW, contentWidth - cardW * 3],
    rows: [new TableRow({
      children: [
        cardCell("Termos no relatório", String(total), NAVY, cardW),
        cardCell("Ativos", String(ativos), "16A34A", cardW),
        cardCell("Inativos", String(inativos), "94A3B8", cardW),
        cardCell("Tipos", tiposStr || "—", NAVY, contentWidth - cardW * 3, true),
      ],
    })],
  });

  const filtrosBlock: Paragraph[] = [];
  if (filtrosDescricao.length > 0) {
    filtrosBlock.push(new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: "Filtros aplicados", bold: true, color: NAVY, size: 18, font: "Arial" })],
    }));
    filtrosDescricao.forEach((f) => {
      filtrosBlock.push(new Paragraph({
        children: [new TextRun({ text: `• ${f}`, color: TEXT_DARK, size: 17, font: "Arial" })],
      }));
    });
  }

  const subtitulo = tituloCoordenacao
    ? `${tituloCoordenacao} • Emitido em ${formatarData(agora)}`
    : `Emitido em ${formatarData(agora)}`;

  const doc = new Document({
    creator: "Juris Control",
    title: "Relatório de Termos DJEN",
    styles: {
      default: { document: { run: { font: "Arial", size: 18 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Relatório de Termos DJEN", bold: true, color: NAVY, size: 36, font: "Arial" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: subtitulo, color: SLATE, size: 18, font: "Arial" })],
        }),
        ...filtrosBlock,
        new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun("")] }),
        cardsTable,
        new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun("")] }),
        tabela,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Termos_DJEN_${(tituloCoordenacao || "Relatorio")
    .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "")
    .replace(/\s+/g, "_")}_${agora.toISOString().slice(0, 10)}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cardCell(label: string, value: string, color: string, width: number, small = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: value, bold: true, color, size: small ? 16 : 28, font: "Arial" })],
      }),
      new Paragraph({
        children: [new TextRun({ text: label, color: SLATE, size: 14, font: "Arial" })],
      }),
    ],
  });
}
