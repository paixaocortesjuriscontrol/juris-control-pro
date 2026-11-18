import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

const STATUS: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const AZUL = "FF1F3864";
const fmtBRT = (iso: string) => {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
};

async function emLotes<T>(ids: string[], fn: (lote: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await fn(ids.slice(i, i + 100))));
  return out;
}

/** Conta ocorrências por chave, ordenando da maior para a menor quantidade. */
export function contarPor(valores: string[]): [string, number][] {
  const m = new Map<string, number>();
  valores.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export async function exportarWorkflowsExcel(
  execucoes: any[],
  coordNomes: Record<string, string>,
  periodo: { inicio?: string; fim?: string },
) {
  const ordenadas = [...execucoes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const procIds = Array.from(new Set(ordenadas.map((e) => e.processo_id).filter(Boolean)));
  const userIds = Array.from(new Set(ordenadas.map((e) => e.iniciado_por).filter(Boolean)));
  const procs = await emLotes(procIds, async (l) =>
    (await supabase.from("processos").select("id, numero_processo").in("id", l)).data ?? []);
  const users = await emLotes(userIds, async (l) =>
    (await supabase.from("profiles_basic").select("id, nome").in("id", l)).data ?? []);
  const procMap = new Map(procs.map((p: any) => [p.id, p.numero_processo]));
  const userMap = new Map(users.map((u: any) => [u.id, u.nome]));

  const linhas = ordenadas.map((e, i) => [
    i + 1,
    fmtBRT(e.created_at),
    e.workflow?.nome ?? "",
    procMap.get(e.processo_id) ?? "",
    e.iniciado_por ? userMap.get(e.iniciado_por) ?? "" : "Sistema",
    e.workflow?.coordenacao?.nome ?? coordNomes[e.coordenacao_id] ?? "",
    STATUS[e.status] ?? e.status,
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Workflows");
  const borda = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as any;
  const cab = (c: ExcelJS.Cell) => {
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borda;
  };
  const corpo = (c: ExcelJS.Cell) => {
    c.font = { name: "Calibri", size: 11 };
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = borda;
  };
  const de = periodo.inicio ? fmtBRT(`${periodo.inicio}T00:00:00-03:00`) : ordenadas[0] ? fmtBRT(ordenadas[0].created_at) : "";
  const ate = periodo.fim ? fmtBRT(`${periodo.fim}T23:59:00-03:00`) : fmtBRT(new Date().toISOString());
  ws.addRow([`Workflows gerados de ${de} a ${ate} (BRT) — ${linhas.length} registros`]);
  ws.mergeCells("A1:G1");
  cab(ws.getCell("A1"));
  const h = ws.addRow(["#", "Criado em", "Workflow", "Processo", "Iniciado por", "Coordenação", "Situação"]);
  h.eachCell(cab);
  linhas.forEach((l) => ws.addRow(l).eachCell({ includeEmpty: true }, corpo));
  [5.7, 17.7, 45.7, 28.7, 24.7, 30.7, 16.7].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.autoFilter = { from: "A2", to: `G${linhas.length + 2}` };

  const rs = wb.addWorksheet("Resumo");
  const bloco = (titulo: string, dados: [string, number][]) => {
    rs.addRow([titulo, "Qtd"]).eachCell(cab);
    dados.forEach((d) => rs.addRow(d).eachCell(corpo));
  };
  bloco("Iniciado por", contarPor(linhas.map((l) => String(l[4]))));
  rs.addRow([]); rs.addRow([]);
  bloco("Workflow", contarPor(linhas.map((l) => String(l[2]))));
  rs.getColumn(1).width = 50.7;
  rs.getColumn(2).width = 8.7;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const d = (s?: string) => (s ? s.split("-").reverse().slice(0, 2).join("-") : "");
  const nome = periodo.inicio || periodo.fim
    ? `Workflows_${[d(periodo.inicio), d(periodo.fim)].filter(Boolean).join("_")}_${(periodo.fim || periodo.inicio)!.slice(0, 4)}.xlsx`
    : "Workflows.xlsx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
