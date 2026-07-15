import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import * as XLSX from "xlsx";

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
        .select("id, status, criado_por, data_audiencia, coordenacao_id, audiencia_envolvidos(usuario_id)")
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

      const dataFiltrada = (data ?? []).filter((a: any) => {
        if (mes === "todos" || !a.data_audiencia) return true;
        const m = new Date(a.data_audiencia).getUTCMonth() + 1;
        return m === (mes as number);
      });

      const userIds = new Set<string>();
      for (const a of dataFiltrada) {
        if (a.criado_por) userIds.add(a.criado_por);
        for (const e of (a.audiencia_envolvidos ?? []) as any[]) if (e.usuario_id) userIds.add(e.usuario_id);
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
        if (a.criado_por) users.add(a.criado_por);
        for (const e of (a.audiencia_envolvidos ?? []) as any[]) if (e.usuario_id) users.add(e.usuario_id);
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
      return { situacoes: situacoesArr, rows };
    },
  });

  const totaisPorSitu = useMemo(() => {
    const tot: Record<string, number> = {};
    for (const r of data?.rows ?? []) for (const s of data?.situacoes ?? []) tot[s] = (tot[s] ?? 0) + (r.contagens[s] ?? 0);
    return tot;
  }, [data]);

  function exportar() {
    if (!data) return;
    const header = ["Usuário", ...data.situacoes, "Total"];
    const body = data.rows.map((r) => [r.usuario, ...data.situacoes.map((s) => r.contagens[s] ?? 0), r.total]);
    const totalGeral = data.rows.reduce((a, r) => a + r.total, 0);
    const footer = ["TOTAL", ...data.situacoes.map((s) => totaisPorSitu[s] ?? 0), totalGeral];
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, footer]);
    const wb = XLSX.utils.book_new();
    const sufMes = mes === "todos" ? "Todos" : MESES[(mes as number) - 1];
    const sufAno = ano === "todos" ? "Todos" : String(ano);
    XLSX.utils.book_append_sheet(wb, ws, `Audiências ${sufMes}-${sufAno}`.slice(0, 31));
    XLSX.writeFile(wb, `relatorio-audiencias-${sufAno}-${mes === "todos" ? "todos" : String(mes).padStart(2,"0")}.xlsx`);
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
                  <td className="px-3 py-2">TOTAL</td>
                  {data.situacoes.map((s) => <td key={s} className="text-right px-3 py-2">{totaisPorSitu[s] ?? 0}</td>)}
                  <td className="text-right px-3 py-2">{data.rows.reduce((a, r) => a + r.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
    </div>
  );
}