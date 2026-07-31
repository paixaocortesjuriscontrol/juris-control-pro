import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { LinhaAjuste } from "@/lib/ajustarChanceReclamanteTst";

const fmtDate = (d: string | null): string => {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(dt.getTime())) return "";
  return format(dt, "dd/MM/yyyy");
};

export function gerarRelatorioAjusteChance(linhas: LinhaAjuste[]): { blob: Blob; filename: string } {
  const agora = format(new Date(), "dd/MM/yyyy HH:mm");
  const rows = linhas.map((l) => ({
    Processo: l.processo,
    Dossiê: l.dossie,
    Equipe: l.equipe,
    "Data Distribuição": fmtDate(l.data_distribuicao),
    Relator: l.relator,
    Turma: l.turma,
    Matéria: l.materia,
    "Chance Turma": `${l.chance_turma_antes} → ${l.chance_turma_depois}`,
    "Chance Relator": `${l.chance_relator_antes} → ${l.chance_relator_depois}`,
    "Chance Êxito": l.chance_exito,
    "Alterado em": agora,
  }));

  const header = [
    "Processo",
    "Dossiê",
    "Equipe",
    "Data Distribuição",
    "Relator",
    "Turma",
    "Matéria",
    "Chance Turma",
    "Chance Relator",
    "Chance Êxito",
    "Alterado em",
  ];

  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws["!cols"] = [
    { wch: 26 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 32 },
    { wch: 14 }, { wch: 45 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alterados");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `Ajuste_Chance_Turma_Relator_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  return { blob, filename };
}