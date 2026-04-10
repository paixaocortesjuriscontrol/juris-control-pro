import jsPDF from "jspdf";
import { DadoBenner } from "@/hooks/useDadosBenner";
import { format } from "date-fns";

export function gerarPdfBenner(dados: DadoBenner[], filtroLabel: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 10;
  const marginTop = 20;
  const rowHeight = 7;
  const headerHeight = 8;

  // Column definitions
  const cols = [
    { header: "Dossiê", width: 45, key: "dossie" },
    { header: "Nº Processo", width: 50, key: "processo" },
    { header: "Tribunal", width: 18, key: "tribunal" },
    { header: "Turma", width: 30, key: "turma" },
    { header: "Relator", width: 55, key: "relator" },
    { header: "Situação", width: 45, key: "situacao_processo" },
    { header: "Status", width: 25, key: "status" },
    { header: "Criado em", width: 22, key: "created_at" },
  ];

  const statusLabels: Record<string, string> = {
    rascunho: "Rascunho",
    pronto_envio: "Pronto",
    planilhado: "Planilhado",
    enviado: "Enviado",
  };

  const drawHeader = (y: number): number => {
    doc.setFillColor(41, 65, 122);
    let x = marginLeft;
    cols.forEach((col) => {
      doc.rect(x, y, col.width, headerHeight, "F");
      x += col.width;
    });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    x = marginLeft;
    cols.forEach((col) => {
      doc.text(col.header, x + 1.5, y + 5.5);
      x += col.width;
    });

    return y + headerHeight;
  };

  const addTitleAndHeader = (pageNum: number) => {
    // Title
    doc.setTextColor(41, 65, 122);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Dados Benner - Relatório", marginLeft, 10);

    // Filter and date info
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Filtro: ${filtroLabel} | Total: ${dados.length} registro(s) | Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, marginLeft, 15);

    return drawHeader(marginTop);
  };

  let y = addTitleAndHeader(1);
  let currentPage = 1;

  dados.forEach((d, idx) => {
    if (y + rowHeight > pageHeight - 10) {
      doc.addPage();
      currentPage++;
      y = addTitleAndHeader(currentPage);
    }

    // Alternate row background
    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      let x = marginLeft;
      cols.forEach((col) => {
        doc.rect(x, y, col.width, rowHeight, "F");
        x += col.width;
      });
    }

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");

    let x = marginLeft;
    cols.forEach((col) => {
      let value = "";
      if (col.key === "created_at") {
        try { value = format(new Date(d.created_at), "dd/MM/yyyy"); } catch { value = "-"; }
      } else if (col.key === "status") {
        value = statusLabels[d.status] || d.status;
      } else if (col.key === "situacao_processo") {
        value = (d as any).situacao_processo || "-";
      } else {
        value = (d as any)[col.key] || "-";
      }

      // Truncate text to fit column
      const maxChars = Math.floor(col.width / 1.8);
      if (value.length > maxChars) value = value.substring(0, maxChars - 1) + "…";

      doc.text(value, x + 1.5, y + 5);
      x += col.width;
    });

    y += rowHeight;
  });

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 5);
  }

  doc.save(`dados_benner_${filtroLabel.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
