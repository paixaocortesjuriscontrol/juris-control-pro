import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { dataHoraBrt } from "@/utils/date";

export interface AuditoriaPdfRow {
  created_at: string;
  usuarioNome: string;
  usuarioEmail: string;
  tipo_item: string | null;
  titulo: string;
  acao: string;
  origem: string;
  processo: string;
  campos: { campo: string; de: any; para: any }[];
}

export interface AuditoriaPdfParams {
  coordenacaoNome: string;
  periodo: string;
  tipoLabel: string;
  usuarioLabel: string;
  rows: AuditoriaPdfRow[];
  labelCampo: (campo: string) => string;
  formatValor: (v: any) => string;
}

const CAMPOS_DESTAQUE = [
  "responsavel_id",
  "responsaveis",
  "envolvidos",
  "status",
  "situacao",
];

const isDestaque = (campo: string) => CAMPOS_DESTAQUE.includes(campo);

/** Gera o PDF de auditoria da coordenação (todas as alterações do período). */
export function gerarRelatorioAuditoriaPdf({
  coordenacaoNome,
  periodo,
  tipoLabel,
  usuarioLabel,
  rows,
  labelCampo,
  formatValor,
}: AuditoriaPdfParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text("Relatório de Auditoria da Coordenação", 40, 40);
  doc.setFontSize(10);
  doc.text(`Coordenação: ${coordenacaoNome}`, 40, 58);
  doc.text(`Período: ${periodo}`, 40, 72);
  doc.text(`Tipo de item: ${tipoLabel}    Usuário: ${usuarioLabel}`, 40, 86);
  doc.text(`Gerado em: ${dataHoraBrt(new Date())} (BRT)`, larguraPagina - 40, 40, { align: "right" });

  // Resumo
  const porUsuario = new Map<string, number>();
  const porCampo = new Map<string, number>();
  for (const r of rows) {
    porUsuario.set(r.usuarioNome, (porUsuario.get(r.usuarioNome) ?? 0) + 1);
    for (const c of r.campos) {
      const k = labelCampo(c.campo);
      porCampo.set(k, (porCampo.get(k) ?? 0) + 1);
    }
  }
  const topUsuarios = Array.from(porUsuario.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([n, q]) => `${n} (${q})`)
    .join("  ·  ");
  const topCampos = Array.from(porCampo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([n, q]) => `${n} (${q})`)
    .join("  ·  ");

  autoTable(doc, {
    startY: 100,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      ["Total de alterações", String(rows.length)],
      ["Por usuário", topUsuarios || "—"],
      ["Campos mais alterados", topCampos || "—"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
  });

  // Agrupamento por dia (mais recentes primeiro)
  const porDia = new Map<string, AuditoriaPdfRow[]>();
  for (const r of rows) {
    const dia = dataHoraBrt(r.created_at).slice(0, 10);
    const arr = porDia.get(dia) ?? [];
    arr.push(r);
    porDia.set(dia, arr);
  }

  let primeiro = true;
  for (const [dia, itens] of porDia.entries()) {
    const anterior = (doc as any).lastAutoTable?.finalY ?? 100;
    if (!primeiro) doc.addPage();
    const yInicio = primeiro ? anterior + 24 : 40;
    doc.setFontSize(11);
    doc.text(`${dia} — ${itens.length} alteração(ões)`, 40, yInicio);
    primeiro = false;

    const body: any[] = [];
    for (const r of itens) {
      const alteracoes =
        r.campos.length > 0
          ? r.campos
              .map(
                (c) =>
                  `${isDestaque(c.campo) ? "» " : ""}${labelCampo(c.campo)}: ${formatValor(c.de)} -> ${formatValor(
                    c.para,
                  )}`,
              )
              .join("\n")
          : r.acao === "criar"
            ? "Registro criado."
            : r.acao === "deletar"
              ? "Registro excluído."
              : "—";
      body.push([
        dataHoraBrt(r.created_at),
        `${r.usuarioNome}${r.usuarioEmail ? `\n${r.usuarioEmail}` : ""}`,
        `${r.titulo}${r.tipo_item ? `\n(${r.tipo_item})` : ""}${r.processo ? `\n${r.processo}` : ""}`,
        r.acao,
        alteracoes,
        r.origem,
      ]);
    }

    autoTable(doc, {
      startY: yInicio + 10,
      head: [["Data/Hora (BRT)", "Autor", "Item", "Ação", "O que mudou", "Origem"]],
      body,
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [30, 64, 124], textColor: 255, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 78 },
        1: { cellWidth: 110 },
        2: { cellWidth: 150 },
        3: { cellWidth: 55 },
        4: { cellWidth: 300 },
        5: { cellWidth: 90 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const txt = Array.isArray(data.cell.raw) ? data.cell.raw.join("") : String(data.cell.raw ?? "");
          if (txt.includes("» ")) {
            data.cell.styles.textColor = [176, 32, 32];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${total}`, larguraPagina - 40, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }

  const slug = coordenacaoNome.normalize("NFD").replace(/[^\w]+/g, "_").slice(0, 40);
  doc.save(`AUDITORIA_${slug || "COORDENACAO"}_${periodo.replace(/[^\d]+/g, "-")}.pdf`);
}