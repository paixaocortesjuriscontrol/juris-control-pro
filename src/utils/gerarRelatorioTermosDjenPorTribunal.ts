import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";

interface GerarRelatorioParams {
  monitoramentos: MonitoramentoDjen[];
  filtrosDescricao?: string[];
  tituloCoordenacao?: string;
  incluirInativos?: boolean;
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

const TIPO_ORDEM: Record<string, number> = {
  parte: 1,
  advogado: 2,
  "palavra-chave": 3,
  processo: 4,
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
  incluirInativos = false,
}: GerarRelatorioParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const agora = new Date();

  // Filtra inativos quando não solicitados explicitamente
  const fonte = incluirInativos ? monitoramentos : monitoramentos.filter((m) => m.ativo);

  // Agrupa por tribunal — um termo pode aparecer em vários tribunais
  const grupos = new Map<string, MonitoramentoDjen[]>();
  for (const m of fonte) {
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
    doc.text("Termos DJEN por Tribunal — referência para comunica.pje", 15, 14);
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
  doc.text("Termos DJEN por Tribunal", pageWidth / 2, cursorY, { align: "center" });
  cursorY += 7;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subtitulo = tituloCoordenacao
    ? `${tituloCoordenacao} • Emitido em ${formatarData(agora)}`
    : `Emitido em ${formatarData(agora)}`;
  doc.text(subtitulo, pageWidth / 2, cursorY, { align: "center" });
  cursorY += 5;
  doc.setFontSize(8.5);
  doc.text(
    incluirInativos
      ? "Inclui termos pausados (marcados como Inativo)."
      : "Apenas termos ativos. Use a sigla do tribunal para localizar a seção.",
    pageWidth / 2,
    cursorY,
    { align: "center" },
  );
  cursorY += 8;

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

  // Índice compacto: sigla — N termos
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Índice de tribunais", 15, cursorY);
  cursorY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const indiceItems = tribunaisOrdenados.map((t) => {
    const lista = grupos.get(t) || [];
    const label = t === SEM_TRIBUNAL ? "Sem tribunal (todos)" : t;
    return `${label} — ${lista.length}`;
  });
  const colCount = 5;
  const colWidth = (pageWidth - 30) / colCount;
  const lineH = 5;
  indiceItems.forEach((txt, i) => {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    doc.text(txt, 15 + col * colWidth, cursorY + row * lineH);
  });

  // Uma seção por tribunal, cada uma em página nova
  for (const tribunal of tribunaisOrdenados) {
    const todosDoTrib = (grupos.get(tribunal) || []).slice().sort((a, b) => {
      const ta = TIPO_ORDEM[a.tipo || ""] || 99;
      const tb = TIPO_ORDEM[b.tipo || ""] || 99;
      if (ta !== tb) return ta - tb;
      const va = (a.termo_busca || a.descricao || "").trim().toLowerCase();
      const vb = (b.termo_busca || b.descricao || "").trim().toLowerCase();
      return va.localeCompare(vb, "pt-BR");
    });
    const ativos = todosDoTrib.filter((m) => m.ativo);
    const inativos = todosDoTrib.filter((m) => !m.ativo);

    doc.addPage();
    drawHeaderFooter(doc.getNumberOfPages());

    const titulo = tribunal === SEM_TRIBUNAL ? "Sem tribunal definido" : tribunal;
    let y = 28;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(titulo, 15, y);
    if (tribunal !== SEM_TRIBUNAL) {
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.setFont("helvetica", "normal");
      doc.text("Use estes termos no comunica.pje filtrando por este tribunal", 15, y + 6);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.setFont("helvetica", "normal");
      doc.text("Estes termos são aplicados a todos os tribunais.", 15, y + 6);
    }
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${ativos.length} termo(s) ativo(s)${inativos.length && incluirInativos ? ` • ${inativos.length} inativo(s)` : ""}`,
      15,
      y + 11,
    );
    y += 16;

    const buildBody = (rows: MonitoramentoDjen[]) =>
      rows.map((d) => {
        const exclusoes = asArray(d.exclusoes);
        const termosOr = asArray(d.termos_or);
        const tipoLabel = TIPO_LABEL[d.tipo || ""] || d.tipo || "—";
        const concomitante = (d.condicao_concomitante || "").trim();
        const refLines: string[] = [];
        if (termosOr.length) refLines.push(`OR: ${termosOr.join(" | ")}`);
        if (concomitante) refLines.push(`Concomitante: ${concomitante}`);
        if (exclusoes.length) refLines.push(`Excluir: ${exclusoes.join(", ")}`);
        if (d.oab) refLines.push(`OAB: ${d.oab}${d.uf ? "/" + d.uf : ""}`);
        return [
          (d.termo_busca || "—").trim(),
          tipoLabel,
          (d.descricao || "—").trim(),
          refLines.length ? refLines.join("\n") : "—",
        ];
      });

    const tableOptions = {
      margin: { left: 10, right: 10, top: 22, bottom: 15 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2.2,
        textColor: TEXT_DARK,
        lineColor: BORDER,
        lineWidth: 0.2,
        valign: "top" as const,
        overflow: "linebreak" as const,
      },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, fontSize: 9.5, halign: "center" as const },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 95, fontStyle: "bold" as const, fontSize: 10 },
        1: { cellWidth: 28, halign: "center" as const },
        2: { cellWidth: 70 },
        3: { cellWidth: "auto" as const, fontSize: 8 },
      },
      didDrawPage: () => drawHeaderFooter(doc.getNumberOfPages()),
    };

    autoTable(doc, {
      startY: y,
      head: [["Termo de busca", "Tipo", "Descrição", "Refinamentos"]],
      body: buildBody(ativos),
      ...tableOptions,
    });

    if (incluirInativos && inativos.length > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY || y;
      doc.setTextColor(...SLATE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Termos pausados", 15, lastY + 8);
      autoTable(doc, {
        startY: lastY + 11,
        head: [["Termo de busca", "Tipo", "Descrição", "Refinamentos"]],
        body: buildBody(inativos),
        ...tableOptions,
        styles: { ...tableOptions.styles, textColor: [120, 120, 120] as [number, number, number] },
      });
    }
  }

  const fileName = `Termos_DJEN_PorTribunal_${(tituloCoordenacao || "Relatorio")
    .replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "")
    .replace(/\s+/g, "_")}_${agora.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}