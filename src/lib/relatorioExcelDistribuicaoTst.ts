import { supabase } from "@/integrations/supabase/client";
import { DistribuicaoTstFilters, fetchAllDistribuicaoTstIds } from "@/hooks/useDistribuicoesTst";
import { loadResponsaveisMap } from "@/hooks/useDistribuicaoResponsaveis";
import * as XLSX from "xlsx";

const BATCH = 500;

const statusEnvioLabel = (s: string | null): string => {
  if (!s) return "—";
  const map: Record<string, string> = {
    delegada: "Delegada",
    em_andamento: "Em andamento",
    finalizada: "Finalizada",
  };
  return map[s] || s;
};

const fmtDate = (d: string | null): string => {
  if (!d) return "";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    if (Number.isNaN(dt.getTime())) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "";
  }
};

export interface GerarRelatorioExcelOptions {
  filters: DistribuicaoTstFilters;
  selectedIds?: Set<string>;
  onProgress?: (current: number, total: number) => void;
}

export async function gerarRelatorioExcelDistribuicaoTst(opts: GerarRelatorioExcelOptions): Promise<{ blob: Blob; filename: string; total: number; semProcessoDossie: number }> {
  const { filters, selectedIds, onProgress } = opts;

  let ids: string[];
  if (selectedIds && selectedIds.size > 0) {
    ids = Array.from(selectedIds);
  } else {
    ids = await fetchAllDistribuicaoTstIds(filters);
  }

  // Carrega situações de envio carga (id -> nome)
  const { data: situacoesData } = await supabase
    .from("situacoes_envio_carga" as any)
    .select("id, nome");
  const situacoesMap = new Map<string, string>();
  ((situacoesData as any[]) || []).forEach((s: any) => situacoesMap.set(s.id, s.nome));

  type Row = {
    Processo: string;
    Dossiê: string;
    Equipe: string;
    "Data da Distribuição": string;
    Responsável: string;
    "Situação do Processo": string;
    "Status do Envio": string;
    "Em Análise": string;
    "Situação Carga Santander": string;
    Observação: string;
  };

  const rows: Row[] = [];
  let semProcessoDossie = 0;
  const ordemData = new Map<string, number>();

  const dataOrdenavel = (d: string | null): number => {
    if (!d) return Number.MAX_SAFE_INTEGER;
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    return Number.isNaN(dt.getTime()) ? Number.MAX_SAFE_INTEGER : dt.getTime();
  };

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);

    const { data: bennerRows, error } = await supabase
      .from("dados_benner" as any)
      .select("id, processo, dossie, equipe, data_distribuicao_real, data_distribuicao_planilha, situacao_processo, status_distribuicao, em_analise, situacao_envio_carga_id")
      .in("id", batch);
    if (error) throw new Error(error.message);

    const respMap = await loadResponsaveisMap(batch);

    ((bennerRows as any[]) || []).forEach((b: any) => {
      const resps = respMap.get(b.id) || [];
      const processo = b.processo || "";
      const dossie = b.dossie || "";
      const semAmbos = !processo && !dossie;
      if (semAmbos) semProcessoDossie++;
      ordemData.set(String(rows.length), dataOrdenavel(b.data_distribuicao_real || b.data_distribuicao_planilha));
      rows.push({
        Processo: processo,
        Dossiê: dossie,
        Equipe: b.equipe || "",
        "Data da Distribuição": fmtDate(b.data_distribuicao_real || b.data_distribuicao_planilha),
        Responsável: resps.map((r) => r.nome).join(", "),
        "Situação do Processo": b.situacao_processo || "",
        "Status do Envio": statusEnvioLabel(b.status_distribuicao),
        "Em Análise": b.em_analise ? "Sim" : "Não",
        "Situação Carga Santander": b.situacao_envio_carga_id ? (situacoesMap.get(b.situacao_envio_carga_id) || "") : "",
        Observação: semAmbos ? "Sem processo/dossiê cadastrado na base" : "",
      });
    });

    onProgress?.(Math.min(i + BATCH, ids.length), ids.length);
  }

  // Ordenação obrigatória: Data da Distribuição, da menor para a maior
  const rowsComOrdem = rows.map((r, i) => ({ r, k: ordemData.get(String(i)) ?? Number.MAX_SAFE_INTEGER }));
  rowsComOrdem.sort((a, b) => (a.k - b.k) || a.r.Processo.localeCompare(b.r.Processo, "pt-BR"));
  rows.length = 0;
  rows.push(...rowsComOrdem.map((x) => x.r));

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Processo",
      "Dossiê",
      "Equipe",
      "Data da Distribuição",
      "Responsável",
      "Situação do Processo",
      "Status do Envio",
      "Em Análise",
      "Situação Carga Santander",
      "Observação",
    ],
  });
  ws["!cols"] = [
    { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 30 },
    { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Distribuição TST");

  const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `relatorio-distribuicao-tst-${ts}.xlsx`;

  return { blob, filename, total: rows.length, semProcessoDossie };
}