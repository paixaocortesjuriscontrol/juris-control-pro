import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";

interface GerarRelatorioParams {
  monitoramentos: MonitoramentoDjen[];
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

const SEM_TRIBUNAL = "__SEM_TRIBUNAL__";

function formatarData(d: Date) {
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function asArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

function ordenarTribunais(siglas: string[]): string[] {
  // TST primeiro, depois STF/STJ, depois TRT/TRF/TJ por número, depois resto alfabético
  const peso = (s: string) => {
    if (s === SEM_TRIBUNAL) return 99999;
    if (s === "TST") return 1;
    if (s === "STF") return 2;
    if (s === "STJ") return 3;
    const m = s.match(/^(TRT|TRF)(\d+)$/);
    if (m) return (m[1] === "TRT" ? 100 : 200) + parseInt(m[2], 10);
    if (s.startsWith("TJ")) return 1000 + s.charCodeAt(2);
    return 5000;
  };
  return [...siglas].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

export function gerarRelatorioTermosDjenPorTribunal({
  monitoramentos,
  filtrosDescricao = [],
  tituloCoordenacao,
}: GerarRelatorioParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const agora = new Date();

  // Agrupa por tribunal — um termo pode aparecer em vários tribunais
  const grupos = new Map<string, MonitoramentoDjen[]>();
  for (const m of monitoramentos) {
    const tribs = asArray(m.tribunais);
    if (tribs.length === 0) {
      const arr = grupos.get(SEM_TRIBUNAL) || [];
      arr.push(m);
      grupos.set(SEM_TRIBUNAL, arr);
    } else {
      for (const t of tribs) {
        const key = t.toUpperCase();
        const arr = grupos.get(key) || [];
        arr.push(m);
        grupos.set(key, arr);
      }
    }
  }

  const tribunaisOrdenados = ordenarTribunais(Array.from(grupos.keys()));

  const drawHeaderFooter = (pageNumber: number) => {
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
    doc.text("Relatório de Termos DJEN — por Tribunal", 15, 14);
    doc.text(formatarData(agora), pageWidth - 15, 11, { align: "right" });

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    doc.setTextColor(...SLATE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Documento confidencial — uso interno", 15, pageHeight - 7);
    doc.text(`Página ${pageNumber}`, pageWidth - 15, pageHeight - 7, { align: "right" });
  };

  // Capa
  let cursorY = 28;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Termos DJEN por Tribunal", pageWidth / 2, cursorY, { align: "center" });
  cursorY += 7;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subtitulo = tituloCoordenacao
    ? `${tituloCoordenacao} • Emitido em ${formatarData(agora)}`
    : `Emitido em ${formatarData(agora)}`;
  doc.text(subtitulo, pageWidth / 2, cursorY, { align: "center" });
  cursorY += 10;

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

  // Resumo: termos por tribunal
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo por tribunal", 15, cursorY);
  cursorY += 4;

  autoTable(doc, {
    startY: cursorY,
    head: [["Tribunal", "Termos", "Ativos", "Inativos"]],
    body: tribunaisOrdenados.map((t) => {
      const lista = grupos.get(t) || [];
      const ativos = lista.filter((m) => m.ativo).length;
      const inativos = lista.length - ativos;
      const label = t === SEM_TRIBUNAL ? "Sem tribunal definido (todos)" : t;
      return [label, String(lista.length), String(ativos), String(inativos)];
    }),
    margin: { left: 15, right: 15, top: 22, bottom: 15 },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.6,
      textColor: TEXT_DARK,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center" },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 30, halign: "center" },
    },
    didDrawPage: () => drawHeaderFooter(doc.getNumberOfPages()),
  });

  // Uma seção por tribunal, cada uma em página nova
  for (const tribunal of tribunaisOrdenados) {
    const lista = (grupos.get(tribunal) || []).slice().sort((a, b) => {
      const da = (a.descricao || "").trim().toLowerCase();
      const db = (b.descricao || "").trim().toLowerCase();
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db, "pt-BR");
    });

    doc.addPage();
    drawHeaderFooter(doc.getNumberOfPages());

    const titulo = tribunal === SEM_TRIBUNAL ? "Sem tribunal definido (aplica a todos)" : tribunal;
    let y = 28;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, 15, y);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const ativos = lista.filter((m) => m.ativo).length;
    doc.text(`${lista.length} termo(s) — ${ativos} ativo(s) / ${lista.length - ativos} inativo(s)`, 15, y + 5);
    y += 10;

    const body = lista.map((d) => {
      const exclusoes = asArray(d.exclusoes);
      const termosOr = asArray(d.termos_or);
      const tipoLabel = TIPO_LABEL[d.tipo || ""] || d.tipo || "—";
      const oabFmt = d.oab ? `${d.oab}${d.uf ? "/" + d.uf : ""}` : "—";
      const concomitante = (d.condicao_concomitante || "").trim() || "—";
      return [
        (d.descricao || "—").trim(),
        tipoLabel,
        (d.termo_busca || "—").trim(),
        termosOr.length ? termosOr.join(" | ") : "—",
        concomitante,
        exclusoes.length ? exclusoes.join(", ") : "—",
        oabFmt,
        d.ativo ? "Ativo" : "Inativo",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[
        "Descrição",
        "Tipo",
        "Termo de busca",
        "Termos OR",
        "Cond. concomitante",
        "Exclusões",
        "OAB/UF",
        "Status",
      ]],
      body,
      margin: { left: 10, right: 10, top: 22, bottom: 15 },
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: TEXT_DARK,
        lineColor: BORDER,
        lineWidth: 0.2,
        valign: "top",
        overflow: "linebreak",
      },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold" },
        1: { cellWidth: 22 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
        4: { cellWidth: 38 },
        5: { cellWidth: 45 },
        6: { cellWidth: 22 },
        7: { cellWidth: "auto", halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          const row = lista[data.row.index];
          if (row && !row.ativo) {
            if (data.column.index === 0 || data.column.index === 2 || data.column.index === 7) {
              data.cell.styles.textColor = [185, 28, 28];
            }
          }
        }
      },
      didDrawPage: () => drawHeaderFooter(doc.getNumberOfPages()),
    });
  }

  const fileName = `Termos_DJEN_PorTribunal_${(tituloCoordenacao || "Relatorio")
    .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "")
    .replace(/\s+/g, "_")}_${agora.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}