import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";

interface GerarRelatorioParams {
  monitoramentos: MonitoramentoDjen[];
  coordNomeMap: Map<string, string>;
  filtrosDescricao?: string[];
  tituloCoordenacao?: string;
}

const NAVY: [number, number, number] = [26, 42, 71];
const GOLD: [number, number, number] = [201, 169, 97];
const SLATE: [number, number, number] = [100, 116, 139];
const ROW_ALT: [number, number, number] = [241, 245, 249];
const BORDER: [number, number, number] = [203, 213, 225];
const TEXT_DARK: [number, number, number] = [30, 41, 59];

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
  return String(v)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function gerarRelatorioTermosDjen({
  monitoramentos,
  coordNomeMap,
  filtrosDescricao = [],
  tituloCoordenacao,
}: GerarRelatorioParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const agora = new Date();

  // Ordenar por descrição (alfabeticamente, sem descrição no final)
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

  const drawHeaderFooter = (pageNumber: number) => {
    // Header bar
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 18, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 18, pageWidth, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("JURIS CONTROL", 15, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Relatório de Termos de Monitoramento DJEN", 15, 14);
    doc.text(formatarData(agora), pageWidth - 15, 11, { align: "right" });

    // Footer
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    doc.setTextColor(...SLATE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Documento confidencial — uso interno", 15, pageHeight - 7);
    doc.text(`Página ${pageNumber}`, pageWidth - 15, pageHeight - 7, { align: "right" });
  };

  // Título principal
  let cursorY = 28;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Termos DJEN", pageWidth / 2, cursorY, { align: "center" });
  cursorY += 7;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subtitulo = tituloCoordenacao
    ? `${tituloCoordenacao} • Emitido em ${formatarData(agora)}`
    : `Emitido em ${formatarData(agora)}`;
  doc.text(subtitulo, pageWidth / 2, cursorY, { align: "center" });
  cursorY += 10;

  // Filtros aplicados
  if (filtrosDescricao.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(15, cursorY, pageWidth - 30, 12 + filtrosDescricao.length * 4.5, 1.5, 1.5, "FD");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Filtros aplicados", 19, cursorY + 5);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    filtrosDescricao.forEach((f, i) => {
      doc.text(`• ${f}`, 19, cursorY + 10 + i * 4.5);
    });
    cursorY += 12 + filtrosDescricao.length * 4.5 + 4;
  }

  // Cards de totalizadores
  const cardW = (pageWidth - 30 - 9) / 4;
  const cardH = 20;
  const cards = [
    { label: "Termos no relatório", value: String(total), color: NAVY },
    { label: "Ativos", value: String(ativos), color: [22, 163, 74] as [number, number, number] },
    { label: "Inativos", value: String(inativos), color: [148, 163, 184] as [number, number, number] },
    {
      label: "Tipos",
      value: Object.entries(tipos)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${v} ${k}`)
        .join("  "),
      color: NAVY,
      small: true,
    },
  ];
  cards.forEach((c, i) => {
    const x = 15 + i * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, cursorY, cardW, cardH, 1.5, 1.5, "FD");
    doc.setTextColor(...c.color);
    doc.setFont("helvetica", "bold");
    if (c.small) {
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(c.value, cardW - 4);
      doc.text(lines, x + 2, cursorY + 7);
    } else {
      doc.setFontSize(16);
      doc.text(c.value, x + 3, cursorY + 10);
    }
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(c.label, x + 3, cursorY + cardH - 3);
  });
  cursorY += cardH + 6;

  // Ficha detalhada por termo (uma sub-tabela por monitoramento, mostrando TODOS os atributos)
  dados.forEach((d, idx) => {
    const tribs = asArray(d.tribunais);
    const tribsUfs = asArray(d.tribunais_ufs);
    const exclusoes = asArray(d.exclusoes);
    const termosOr = asArray(d.termos_or);
    const coordNome = d.coordenacao_id ? coordNomeMap.get(d.coordenacao_id) || "—" : "—";
    const tipoLabel = TIPO_LABEL[d.tipo || ""] || d.tipo || "—";
    const oabFmt = d.oab ? `${d.oab}${d.uf ? "/" + d.uf : ""}` : "—";
    const statusLabel = d.ativo ? "Ativo" : "Inativo";
    const buscarParteLabel =
      d.buscar_parte === true ? "Sim" : d.buscar_parte === false ? "Não" : "—";
    const concomitante = (d.condicao_concomitante || "").trim() || "—";

    const titulo = `${idx + 1}. ${(d.descricao || d.termo_busca || "Sem descrição").trim()}`;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: 15, right: 15, top: 22, bottom: 18 },
      head: [
        [
          {
            content: `${titulo}    [${tipoLabel}]    •    ${statusLabel}`,
            colSpan: 2,
            styles: {
              fillColor: NAVY,
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9.5,
              halign: "left",
              cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
            },
          },
        ],
      ],
      body: [
        ["Descrição", (d.descricao || "—").trim()],
        ["Tipo", tipoLabel],
        ["Termo de busca", (d.termo_busca || "—").trim()],
        ["Termos alternativos (OR)", termosOr.length ? termosOr.join("  |  ") : "—"],
        ["Condição concomitante", concomitante],
        ["Exclusões (não conter)", exclusoes.length ? exclusoes.join(", ") : "—"],
        ["OAB / UF", oabFmt],
        ["Buscar também como parte", buscarParteLabel],
        ["Tribunais", tribs.length ? tribs.join(", ") : "Todos"],
        ["UFs dos tribunais", tribsUfs.length ? tribsUfs.join(", ") : "Todas"],
        ["Coordenação", coordNome],
        ["Status", statusLabel],
      ],
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2,
        textColor: TEXT_DARK,
        lineColor: BORDER,
        lineWidth: 0.2,
        valign: "top",
        overflow: "linebreak",
      },
      columnStyles: {
        0: {
          cellWidth: 50,
          fontStyle: "bold",
          fillColor: [248, 250, 252],
          textColor: NAVY,
        },
        1: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      didDrawPage: () => {
        drawHeaderFooter(doc.getNumberOfPages());
      },
    });

    // @ts-ignore — lastAutoTable é injetado pelo plugin
    cursorY = (doc as any).lastAutoTable.finalY + 5;

    // Quebra de página se faltar espaço para próxima ficha
    if (cursorY > pageHeight - 40 && idx < dados.length - 1) {
      doc.addPage();
      cursorY = 28;
    }
  });

  const fileName = `Termos_DJEN_${(tituloCoordenacao || "Relatorio")
    .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "")
    .replace(/\s+/g, "_")}_${agora.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}