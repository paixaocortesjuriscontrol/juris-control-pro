import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import ExcelJS from "exceljs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coordenacaoId?: string;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SITUACOES_FIXAS = ["pendente","confirmado","reagendado","tratado","cancelado","ignorado"] as const;
const TODOS = "__todos__";

export function RelatorioAudienciasDialog({ open, onOpenChange, coordenacaoId }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState<number | "todos">(hoje.getFullYear());
  const [mes, setMes] = useState<number | "todos">(hoje.getMonth() + 1);
  const { coordenacoes, unicaCoordenacaoId, precisaSelecionar } = useCoordenacoesDoUsuario();
  const [coordSel, setCoordSel] = useState<string>("__todas__");

  // Coordenação efetiva aplicada nos filtros
  const coordenacaoFiltro = coordenacaoId
    ?? (precisaSelecionar ? (coordSel === "__todas__" ? undefined : coordSel) : (unicaCoordenacaoId ?? undefined));

  useEffect(() => {
    // Reset ao abrir
    if (open) setCoordSel("__todas__");
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-audiencias", ano, mes, coordenacaoFiltro],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("audiencias_detectadas")
        .select("id, status, criado_por, data_audiencia, coordenacao_id, audiencia_envolvidos(usuario_id), audiencias_advogados(advogado_id)")
        ;
      if (ano !== "todos" && mes !== "todos") {
        const inicio = new Date(Date.UTC(ano as number, (mes as number) - 1, 1)).toISOString();
        const fim = new Date(Date.UTC(ano as number, mes as number, 1)).toISOString();
        q = q.gte("data_audiencia", inicio).lt("data_audiencia", fim);
      } else if (ano !== "todos") {
        const inicio = new Date(Date.UTC(ano as number, 0, 1)).toISOString();
        const fim = new Date(Date.UTC((ano as number) + 1, 0, 1)).toISOString();
        q = q.gte("data_audiencia", inicio).lt("data_audiencia", fim);
      } else if (mes !== "todos") {
        // Todos os anos, mês específico: aplica filtro por extract em memória
        // (query traz tudo e filtra abaixo)
      }
      if (coordenacaoFiltro) q = q.eq("coordenacao_id", coordenacaoFiltro);
      const { data, error } = await q.limit(20000);
      if (error) throw error;

      // ===== Audiências registradas como TAREFAS (tipo_tarefa = "Audiência") =====
      // Importações (Astrea/Projuris) gravam audiências na tabela `tarefas`.
      // O calendário já as exibe como audiência, então o relatório precisa contá-las.
      let qt = supabase
        .from("tarefas")
        .select("id, status, criado_por, responsavel_id, data_vencimento, coordenacao_id")
        .ilike("tipo_tarefa", "audi%")
        .not("data_vencimento", "is", null);
      if (ano !== "todos" && mes !== "todos") {
        const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
        const fimD = new Date(Date.UTC(ano as number, mes as number, 1));
        const fim = fimD.toISOString().slice(0, 10);
        qt = qt.gte("data_vencimento", ini).lt("data_vencimento", fim);
      } else if (ano !== "todos") {
        qt = qt.gte("data_vencimento", `${ano}-01-01`).lt("data_vencimento", `${(ano as number) + 1}-01-01`);
      }
      if (coordenacaoFiltro) qt = qt.eq("coordenacao_id", coordenacaoFiltro);
      const { data: tarefasAud, error: errT } = await qt.limit(20000);
      if (errT) throw errT;

      const tarefaIds = (tarefasAud ?? []).map((t: any) => t.id);
      const respPorTarefa = new Map<string, Set<string>>();
      for (let i = 0; i < tarefaIds.length; i += 500) {
        const slice = tarefaIds.slice(i, i + 500);
        const [{ data: resp }, { data: env }] = await Promise.all([
          supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id").in("tarefa_id", slice),
          supabase.from("tarefa_envolvidos").select("tarefa_id, usuario_id").in("tarefa_id", slice),
        ]);
        for (const r of [...(resp ?? []), ...(env ?? [])] as any[]) {
          if (!r.usuario_id) continue;
          if (!respPorTarefa.has(r.tarefa_id)) respPorTarefa.set(r.tarefa_id, new Set());
          respPorTarefa.get(r.tarefa_id)!.add(r.usuario_id);
        }
      }

      const mapStatusTarefa = (s?: string | null) => {
        const v = (s ?? "pendente").toString().toLowerCase();
        if (v === "cumprido" || v === "concluido" || v === "concluído") return "tratado";
        return v;
      };

      const tarefasComoAudiencias = (tarefasAud ?? []).map((t: any) => ({
        id: t.id,
        status: mapStatusTarefa(t.status),
        criado_por: t.criado_por,
        data_audiencia: t.data_vencimento,
        audiencia_envolvidos: [
          ...Array.from(respPorTarefa.get(t.id) ?? []).map((u) => ({ usuario_id: u })),
          ...(t.responsavel_id ? [{ usuario_id: t.responsavel_id }] : []),
        ],
        audiencias_advogados: [],
      }));

      const registros = [...((data ?? []) as any[]), ...tarefasComoAudiencias];

      const dataFiltrada = registros.filter((a: any) => {
        if (mes === "todos" || !a.data_audiencia) return true;
        const m = Number(String(a.data_audiencia).slice(5, 7));
        return m === (mes as number);
      });

      const userIds = new Set<string>();
      for (const a of dataFiltrada) {
        if (a.criado_por) userIds.add(a.criado_por);
        for (const e of (a.audiencia_envolvidos ?? []) as any[]) if (e.usuario_id) userIds.add(e.usuario_id);
        for (const r of (a.audiencias_advogados ?? []) as any[]) if (r.advogado_id) userIds.add(r.advogado_id);
      }
      const { data: profiles } = await supabase
        .from("profiles").select("id, nome").in("id", Array.from(userIds));
      const nomeMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nome ?? "(sem nome)"]));

      const situacoes = new Set<string>(SITUACOES_FIXAS);
      const linhas = new Map<string, Record<string, number>>();
      for (const a of dataFiltrada) {
        const situ = (a.status ?? "pendente").toString();
        situacoes.add(situ);
        const users = new Set<string>();
        for (const e of (a.audiencia_envolvidos ?? []) as any[]) if (e.usuario_id) users.add(e.usuario_id);
        for (const r of (a.audiencias_advogados ?? []) as any[]) if (r.advogado_id) users.add(r.advogado_id);
        if (users.size === 0 && a.criado_por) users.add(a.criado_por);
        if (users.size === 0) users.add("__sem_responsavel__");
        for (const uid of users) {
          if (!linhas.has(uid)) linhas.set(uid, {});
          linhas.get(uid)![situ] = (linhas.get(uid)![situ] ?? 0) + 1;
        }
      }
      const fixSet = new Set<string>(SITUACOES_FIXAS);
      const extras = Array.from(situacoes).filter((s) => !fixSet.has(s)).sort();
      const situacoesArr = [...SITUACOES_FIXAS, ...extras];
      const rows = Array.from(linhas.entries()).map(([uid, cnts]) => {
        const total = Object.values(cnts).reduce((a, b) => a + b, 0);
        return {
          usuario: uid === "__sem_responsavel__" ? "(sem responsável)" : (nomeMap.get(uid) ?? uid),
          contagens: cnts,
          total,
        };
      }).sort((a, b) => b.total - a.total);

      // Totais reais (contagem única por audiência — não soma linhas por usuário,
      // pois uma audiência com vários responsáveis aparece em várias linhas)
      const totaisSitu: Record<string, number> = {};
      for (const a of dataFiltrada) {
        const situ = (a.status ?? "pendente").toString();
        totaisSitu[situ] = (totaisSitu[situ] ?? 0) + 1;
      }
      return { situacoes: situacoesArr, rows, totaisSitu, totalAudiencias: dataFiltrada.length };
    },
  });

  const totaisPorSitu = useMemo(() => data?.totaisSitu ?? {}, [data]);
  const totalGeralAudiencias = data?.totalAudiencias ?? 0;

  async function exportar() {
    if (!data) return;
    const sufMes = mes === "todos" ? "Todos" : MESES[(mes as number) - 1];
    const sufAno = ano === "todos" ? "Todos" : String(ano);

    const wb = new ExcelJS.Workbook();
    wb.creator = "JurisControl";
    wb.created = new Date();
    const ws = wb.addWorksheet(`Audiências ${sufMes}-${sufAno}`.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    const cols = ["Usuário", ...data.situacoes, "Total"];
    const totalCols = cols.length;

    // Título mesclado
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `RELATÓRIO DE AUDIÊNCIAS — ${sufMes} / ${sufAno}`;
    titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    ws.getRow(1).height = 28;

    // Linha em branco (visual)
    ws.getRow(2).height = 4;

    // Cabeçalho
    const headerRow = ws.getRow(3);
    headerRow.values = cols;
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C5282" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
    // Capitaliza cabeçalhos de situação
    for (let c = 2; c <= totalCols; c++) {
      const v = headerRow.getCell(c).value as string;
      if (typeof v === "string") headerRow.getCell(c).value = v.charAt(0).toUpperCase() + v.slice(1);
    }

    // Corpo
    data.rows.forEach((r, idx) => {
      const rowNum = 4 + idx;
      const row = ws.getRow(rowNum);
      row.values = [r.usuario, ...data.situacoes.map((s) => r.contagens[s] ?? 0), r.total];
      const zebra = idx % 2 === 0 ? "FFF7FAFC" : "FFFFFFFF";
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: "Calibri", size: 11, color: { argb: "FF1A202C" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = {
          horizontal: colNum === 1 ? "left" : "center",
          vertical: "middle",
        };
        if (colNum === totalCols) {
          cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1A202C" } };
        }
      });
      row.height = 20;
    });

    // Rodapé TOTAL
    const totalRowNum = 4 + data.rows.length;
    const totalGeral = data.totalAudiencias;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.values = ["TOTAL (audiências únicas)", ...data.situacoes.map((s) => totaisPorSitu[s] ?? 0), totalGeral];
    totalRow.height = 24;
    totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    // Larguras
    ws.getColumn(1).width = 34;
    for (let c = 2; c <= totalCols; c++) ws.getColumn(c).width = 14;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-audiencias-${sufAno}-${mes === "todos" ? "todos" : String(mes).padStart(2, "0")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 3 + i);

  if (!open) return null;

  return (
    <div className="border rounded-lg bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Relatório de Audiências</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
          <Select value={mes === "todos" ? TODOS : String(mes)} onValueChange={(v) => setMes(v === TODOS ? "todos" : Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os meses</SelectItem>
              {MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano === "todos" ? TODOS : String(ano)} onValueChange={(v) => setAno(v === TODOS ? "todos" : Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          {!coordenacaoId && precisaSelecionar && (
            <Select value={coordSel} onValueChange={setCoordSel}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Coordenação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas as coordenações</SelectItem>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportar} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : !data || data.rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Sem audiências no período.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Usuário</th>
                  {data.situacoes.map((s) => <th key={s} className="text-right px-3 py-2 font-semibold capitalize">{s}</th>)}
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.usuario} className="border-t">
                    <td className="px-3 py-2">{r.usuario}</td>
                    {data.situacoes.map((s) => <td key={s} className="text-right px-3 py-2">{r.contagens[s] ?? 0}</td>)}
                    <td className="text-right px-3 py-2 font-semibold">{r.total}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/50 font-semibold">
                  <td className="px-3 py-2">TOTAL (audiências únicas)</td>
                  {data.situacoes.map((s) => <td key={s} className="text-right px-3 py-2">{totaisPorSitu[s] ?? 0}</td>)}
                  <td className="text-right px-3 py-2">{totalGeralAudiencias}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
    </div>
  );
}