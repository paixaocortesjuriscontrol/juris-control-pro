import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters } from "@/hooks/useDistribuicoesTst";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ParteRow {
  nome: string;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  is_advogado: boolean | null;
}

export interface ProcessoRelatorio {
  id: string;
  processo: string;
  dossie: string | null;
  turma: string | null;
  relator: string | null;
  data_distribuicao: string | null;
  recorrente: string | null;
  partes: ParteRow[];
}

const FETCH_SIZE = 1000;
const PARTES_BATCH = 100;

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

const formatDocumento = (doc: string | null, tipo: string | null): string => {
  if (!doc) return "—";
  const digits = doc.replace(/\D/g, "");
  // CPF: 11 dígitos -> 000.000.000-00
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  // CNPJ: 14 dígitos -> 00.000.000/0000-00
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  // Tenta inferir pelo tipo_pessoa quando tamanho irregular
  const t = (tipo || "").toLowerCase();
  if (digits.length > 11 && digits.length < 14 && (t.includes("juridic") || t.includes("pj"))) {
    return digits.padStart(14, "0").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length > 0 && digits.length < 11 && (t.includes("fisic") || t.includes("pf"))) {
    return digits.padStart(11, "0").replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return doc;
};

const normalizePolo = (polo: string | null): "Ativo" | "Passivo" | "Outro" => {
  if (!polo) return "Outro";
  const p = polo.toLowerCase();
  if (p.startsWith("activ") || p.includes("ativ")) return "Ativo";
  if (p.startsWith("passiv")) return "Passivo";
  return "Outro";
};

/**
 * Busca todos os IDs de dados_benner que correspondem aos filtros da tela.
 */
export async function fetchAllFilteredBennerIds(filters: DistribuicaoTstFilters): Promise<string[]> {
  const hasResp = filters.responsavelIds && filters.responsavelIds.length > 0;
  const baseSelect = hasResp
    ? "id, dados_benner_responsaveis!inner(usuario_id)"
    : "id";

  const buildQuery = () => {
    let q = supabase
      .from("dados_benner" as any)
      .select(baseSelect)
      .not("aba_origem", "is", null)
      .order("created_at", { ascending: false });

    if (hasResp) q = q.in("dados_benner_responsaveis.usuario_id", filters.responsavelIds!);
    if (filters.aba_origem && filters.aba_origem !== "todas") q = q.eq("aba_origem", filters.aba_origem);
    if (filters.benner === "sim") q = q.eq("benner_atualizado", true);
    else if (filters.benner === "nao") q = q.or("benner_atualizado.is.null,benner_atualizado.eq.false");
    if (filters.dossieStatus === "preenchido") q = q.not("dossie", "is", null).neq("dossie", "");
    else if (filters.dossieStatus === "nao_preenchido") q = q.or("dossie.is.null,dossie.eq.");
    else if (filters.dossieStatus === "valido") q = q.like("dossie", "__.__.___.______%/__");
    else if (filters.dossieStatus === "invalido")
      q = q.not("dossie", "is", null).neq("dossie", "").not("dossie", "like", "__.__.___.______%/__");
    if (filters.judit === "sim") q = q.eq("judit_preenchido", true);
    else if (filters.judit === "nao") q = q.or("judit_preenchido.is.null,judit_preenchido.eq.false");
    if (filters.processo) q = q.ilike("processo", `%${filters.processo}%`);
    if (filters.dossie) q = q.ilike("dossie", `%${filters.dossie}%`);
    if (filters.turma) q = q.ilike("turma", `%${filters.turma}%`);
    if (filters.relator) q = q.ilike("relator", `%${filters.relator}%`);
    if (filters.parte) q = q.ilike("recorrente", `%${filters.parte}%`);
    if (filters.mesAno && filters.mesAno !== "todos") {
      const start = `${filters.mesAno}-01`;
      const [y, m] = filters.mesAno.split("-").map(Number);
      const nextMonth =
        m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("data_distribuicao_planilha", start).lt("data_distribuicao_planilha", nextMonth);
    }
    if (filters.dataInicio) q = q.gte("data_distribuicao_planilha", filters.dataInicio);
    if (filters.dataFim) q = q.lte("data_distribuicao_planilha", filters.dataFim);
    return q;
  };

  const allIds: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + FETCH_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data as any[]) || [];
    allIds.push(...rows.map((r) => r.id));
    if (rows.length < FETCH_SIZE) break;
    offset += FETCH_SIZE;
  }
  return allIds;
}

/**
 * Busca dados de processos + partes por lotes.
 */
export async function fetchProcessosComPartes(
  ids: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<ProcessoRelatorio[]> {
  const result: ProcessoRelatorio[] = [];

  for (let i = 0; i < ids.length; i += PARTES_BATCH) {
    const batch = ids.slice(i, i + PARTES_BATCH);

    const { data: bennerRows, error: bennerErr } = await supabase
      .from("dados_benner" as any)
      .select("id, processo, dossie, turma, relator, data_distribuicao_real, data_distribuicao_planilha, recorrente")
      .in("id", batch);
    if (bennerErr) throw new Error(bennerErr.message);

    const { data: partesRows, error: partesErr } = await supabase
      .from("partes_processo_benner" as any)
      .select("dados_benner_id, nome, documento, tipo_pessoa, polo, is_advogado")
      .in("dados_benner_id", batch);
    if (partesErr) throw new Error(partesErr.message);

    const partesMap = new Map<string, ParteRow[]>();
    ((partesRows as any[]) || []).forEach((p: any) => {
      const arr = partesMap.get(p.dados_benner_id) || [];
      arr.push({
        nome: p.nome,
        documento: p.documento,
        tipo_pessoa: p.tipo_pessoa,
        polo: p.polo,
        is_advogado: p.is_advogado,
      });
      partesMap.set(p.dados_benner_id, arr);
    });

    ((bennerRows as any[]) || []).forEach((b: any) => {
      result.push({
        id: b.id,
        processo: b.processo || "",
        dossie: b.dossie,
        turma: b.turma,
        relator: b.relator,
        data_distribuicao: b.data_distribuicao_real || b.data_distribuicao_planilha,
        recorrente: b.recorrente,
        partes: partesMap.get(b.id) || [],
      });
    });

    onProgress?.(Math.min(i + PARTES_BATCH, ids.length), ids.length);
  }

  // Ordenar por processo
  result.sort((a, b) => a.processo.localeCompare(b.processo));
  return result;
}

/**
 * Gera o PDF profissional.
 */
export function gerarRelatorioPartesPdf(
  processos: ProcessoRelatorio[],
  filtrosResumo: string[],
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Cabeçalho da capa
  doc.setFillColor(30, 58, 95); // azul institucional
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Partes - Distribuição TST", marginX, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    marginX,
    22,
  );
  doc.text(`Total de processos: ${processos.length}`, marginX, 28);

  // Resumo de filtros
  doc.setTextColor(0, 0, 0);
  let y = 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Filtros aplicados", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (filtrosResumo.length === 0) {
    doc.text("Nenhum filtro aplicado (todos os registros).", marginX, y);
    y += 5;
  } else {
    filtrosResumo.forEach((f) => {
      doc.text(`• ${f}`, marginX, y);
      y += 4.5;
    });
  }
  y += 4;

  // Linha divisória
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  const ensureSpace = (need: number) => {
    if (y + need > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  processos.forEach((proc, idx) => {
    ensureSpace(30);

    // Faixa do cabeçalho do processo
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y - 4, pageWidth - marginX * 2, 8, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(
      `${idx + 1}. Processo: ${proc.processo || "—"}`,
      marginX + 2,
      y + 1.5,
    );
    y += 7;

    // Metadados do processo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const meta = [
      `Dossiê: ${proc.dossie || "—"}`,
      `Turma: ${proc.turma || "—"}`,
      `Relator: ${proc.relator || "—"}`,
      `Distribuição: ${formatDate(proc.data_distribuicao)}`,
    ];
    const half = pageWidth / 2;
    doc.text(meta[0], marginX + 2, y + 3);
    doc.text(meta[1], half + 2, y + 3);
    y += 5;
    doc.text(meta[2], marginX + 2, y + 3);
    doc.text(meta[3], half + 2, y + 3);
    y += 7;

    // Partes
    const partes = (proc.partes || []).filter((p) => p.nome && !p.is_advogado);
    const ativos = partes.filter((p) => normalizePolo(p.polo) === "Ativo");
    const passivos = partes.filter((p) => normalizePolo(p.polo) === "Passivo");
    const outros = partes.filter((p) => normalizePolo(p.polo) === "Outro");

    if (partes.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("Sem partes cadastradas (Judit não preenchido).", marginX + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 6;
    } else {
      const buildBody = (arr: ParteRow[]) =>
        arr.map((p) => [
          p.nome || "—",
          p.tipo_pessoa || "—",
          formatDocumento(p.documento, p.tipo_pessoa),
        ]);

      const renderTable = (titulo: string, arr: ParteRow[], headColor: [number, number, number]) => {
        if (arr.length === 0) return;
        ensureSpace(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(headColor[0], headColor[1], headColor[2]);
        doc.text(titulo, marginX + 2, y);
        doc.setTextColor(0, 0, 0);
        y += 1.5;
        autoTable(doc, {
          startY: y + 1,
          head: [["Nome", "Tipo", "Documento"]],
          body: buildBody(arr),
          theme: "grid",
          margin: { left: marginX, right: marginX },
          styles: { fontSize: 8.5, cellPadding: 1.5, overflow: "linebreak" },
          headStyles: {
            fillColor: headColor,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8.5,
          },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 45 },
            2: { cellWidth: 37 },
          },
          didDrawPage: () => {
            // se autotable mudou de página, sincronizar y
          },
        });
        // @ts-ignore
        y = (doc as any).lastAutoTable.finalY + 4;
      };

      renderTable("Polo Ativo", ativos, [22, 101, 52]); // verde
      renderTable("Polo Passivo", passivos, [153, 27, 27]); // vermelho
      renderTable("Outros", outros, [71, 85, 105]); // cinza
    }

    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 4;
  });

  // Rodapé com numeração
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: "right" },
    );
    doc.text(
      "Distribuição TST — Relatório de Partes",
      marginX,
      pageHeight - 8,
    );
  }

  return doc.output("blob");
}

export function buildFiltrosResumo(filters: DistribuicaoTstFilters, extras: { responsaveisLabel?: string } = {}): string[] {
  const out: string[] = [];
  if (filters.aba_origem && filters.aba_origem !== "todas") out.push(`Aba origem: ${filters.aba_origem}`);
  if (filters.mesAno && filters.mesAno !== "todos") out.push(`Mês/Ano: ${filters.mesAno}`);
  if (filters.dataInicio) out.push(`Data início: ${filters.dataInicio}`);
  if (filters.dataFim) out.push(`Data fim: ${filters.dataFim}`);
  if (filters.processo) out.push(`Processo contém: ${filters.processo}`);
  if (filters.dossie) out.push(`Dossiê contém: ${filters.dossie}`);
  if (filters.turma) out.push(`Turma contém: ${filters.turma}`);
  if (filters.relator) out.push(`Relator contém: ${filters.relator}`);
  if (filters.parte) out.push(`Parte contém: ${filters.parte}`);
  if (filters.benner && filters.benner !== "todos") out.push(`Benner: ${filters.benner}`);
  if (filters.judit && filters.judit !== "todos") out.push(`Judit: ${filters.judit}`);
  if (filters.dossieStatus && filters.dossieStatus !== "todos") out.push(`Dossiê status: ${filters.dossieStatus}`);
  if (extras.responsaveisLabel) out.push(`Responsáveis: ${extras.responsaveisLabel}`);
  return out;
}
