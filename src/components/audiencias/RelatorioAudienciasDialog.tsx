import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coordenacaoId?: string;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function RelatorioAudienciasDialog({ open, onOpenChange, coordenacaoId }: Props) {
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-audiencias", ano, mes, coordenacaoId],
    enabled: open,
    queryFn: async () => {
      const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString();
      const fim = new Date(Date.UTC(ano, mes, 1)).toISOString();
      let q = supabase
        .from("audiencias_detectadas")
        .select("id, status, criado_por, data_audiencia, coordenacao_id, audiencia_envolvidos(usuario_id)")
        .gte("data_audiencia", inicio)
        .lt("data_audiencia", fim);
      if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      const userIds = new Set<string>();
      for (const a of data ?? []) {
        if (a.criado_por) userIds.add(a.criado_por);
        for (const e of (a.audiencia_envolvidos ?? []) as any[]) if (e.usuario_id) userIds.add(e.usuario_id);
      }
      const { data: profiles } = await supabase
        .from("profiles").select("id, nome").in("id", Array.from(userIds));
      const nomeMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nome ?? "(sem nome)"]));

      const situacoes = new Set<string>();
      const linhas = new Map<string, Record<string, number>>();
      for (const a of data ?? []) {
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
      const situacoesArr = Array.from(situacoes).sort();
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
    XLSX.utils.book_append_sheet(wb, ws, `Audiências ${MESES[mes-1]}-${ano}`);
    XLSX.writeFile(wb, `relatorio-audiencias-${ano}-${String(mes).padStart(2,"0")}.xlsx`);
  }

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 3 + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Relatório de Audiências</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
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
      </DialogContent>
    </Dialog>
  );
}