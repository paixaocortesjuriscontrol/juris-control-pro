import * as XLSX from "xlsx";

export type LinhaDjenAuto = {
  processo: string;
  dossie: string | null;
  equipe: string | null;
  data_distribuicao_real: string | null;
  pedidos?: string | null;
  centralizador: string | null;
  importado_djen_em: string | null;
  ja_existia_antes_djen: boolean | null;
};

export type SituacaoDjen = "todos" | "novos" | "ja_existiam";

/** DD/MM/AAAA de uma data (AAAA-MM-DD) ou instante, sempre em Brasília. */
export function fmtDataBr(v: string | null | undefined): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function filtrarSituacao(linhas: LinhaDjenAuto[], s: SituacaoDjen): LinhaDjenAuto[] {
  if (s === "novos") return linhas.filter((l) => l.ja_existia_antes_djen === false);
  if (s === "ja_existiam") return linhas.filter((l) => l.ja_existia_antes_djen === true);
  return linhas;
}

/** Linhas no layout do modelo enviado à Dra. Iara. */
export function linhasRelatorioIara(linhas: LinhaDjenAuto[]): (string)[][] {
  return [
    ["Processo", "Dossiê", "Equipe", "Data da Distribuição", "Pedidos", "CENTRALIZADOR"],
    ...linhas.map((l) => [
      l.processo,
      l.dossie || "",
      l.equipe || "",
      fmtDataBr(l.data_distribuicao_real),
      l.pedidos || "",
      l.centralizador || "",
    ]),
  ];
}

export function baixarRelatorioIara(linhas: LinhaDjenAuto[], nome: string) {
  const ws = XLSX.utils.aoa_to_sheet(linhasRelatorioIara(linhas));
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Distribuição TST");
  XLSX.writeFile(wb, nome);
}
