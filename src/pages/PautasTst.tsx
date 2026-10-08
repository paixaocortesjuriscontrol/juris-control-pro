import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, Download, Gavel, Monitor, Users, AlertCircle, ChevronLeft, ChevronRight, Lightbulb, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PautaTst, PautaTstInsert } from "@/hooks/usePautasTst";
import { PautasTstForm } from "@/components/pautas-tst/PautasTstForm";
import { PautasTstImport } from "@/components/pautas-tst/PautasTstImport";
import { exportarPautas, nomeAbaSemana, segundaDaSemana } from "@/lib/pautasSemanaExport";
import { cn } from "@/lib/utils";

const COORD_RENATA = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";
const hojeIso = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const br = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const addDias = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtCnj = (d: string) => `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...((data as T[]) || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function corDecisao(d?: string | null) {
  const s = (d || "").toUpperCase();
  if (!s) return "bg-muted text-muted-foreground";
  if (/NAO PROVIDO|NÃO PROVIDO|NEGADO|NAO CONHEC|NÃO CONHEC/.test(s)) return "bg-destructive/15 text-destructive";
  if (/PROVIDO|CONHECIDO|FAVOR/.test(s)) return "bg-primary/15 text-primary";
  if (/ADIAD|RETIRAD|VISTA/.test(s)) return "bg-accent text-accent-foreground";
  return "bg-secondary text-secondary-foreground";
}

export default function PautasTstPage() {
  const [semanas, setSemanas] = useState<{ ini: string; aba: string | null }[]>([]);
  const [semana, setSemana] = useState<string>(segundaDaSemana(hojeIso()));
  const [dados, setDados] = useState<PautaTst[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<PautaTst | null>(null);
  const [novo, setNovo] = useState<Partial<PautaTst> | null>(null);
  const [busca, setBusca] = useState("");
  const [fRelator, setFRelator] = useState("__all__");
  const [fOrgao, setFOrgao] = useState("__all__");
  const [fAdv, setFAdv] = useState("__all__");
  const [fDecisao, setFDecisao] = useState("__all__");
  const [sugestoes, setSugestoes] = useState<{ processo: string; data: string | null; benner: any }[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [expIni, setExpIni] = useState("");
  const [expFim, setExpFim] = useState("");
  const [exportando, setExportando] = useState(false);

  const carregarSemanas = useCallback(async () => {
    const rows = await fetchAll<{ semana_inicio: string | null; aba_origem: string | null }>((a, b) =>
      supabase.from("pautas_tst" as any).select("semana_inicio, aba_origem").not("semana_inicio", "is", null).range(a, b),
    );
    const map = new Map<string, string | null>();
    rows.forEach((r) => r.semana_inicio && !map.has(r.semana_inicio) && map.set(r.semana_inicio, r.aba_origem));
    const atual = segundaDaSemana(hojeIso());
    if (!map.has(atual)) map.set(atual, null);
    setSemanas([...map.entries()].map(([ini, aba]) => ({ ini, aba })).sort((x, y) => y.ini.localeCompare(x.ini)));
  }, []);

  const carregarSemana = useCallback(async () => {
    setLoading(true);
    try {
      const fim = addDias(semana, 6);
      const rows = await fetchAll<PautaTst>((a, b) =>
        supabase
          .from("pautas_tst" as any)
          .select("*")
          .or(`semana_inicio.eq.${semana},and(semana_inicio.is.null,data_julgamento.gte.${semana},data_julgamento.lte.${fim})`)
          .order("data_julgamento", { ascending: true, nullsFirst: false })
          .order("horario", { ascending: true })
          .range(a, b),
      );
      setDados(rows);
      // Sugestões: pautas do DEJT publicadas para processos da Distribuição TST e ainda sem pauta cadastrada
      const { data: dejt } = await supabase
        .from("publicacoes_djen" as any)
        .select("processo_numero, data_publicacao")
        .eq("fonte", "dejt-pdf")
        .eq("tipo_publicacao", "pauta")
        .gte("data_publicacao", addDias(semana, -10))
        .lte("data_publicacao", fim)
        .limit(1000);
      const jaTem = new Set(rows.map((r) => r.processo_digits || String(r.processo_numero || "").replace(/\D/g, "")));
      const cand = new Map<string, string | null>();
      ((dejt as any[]) || []).forEach((p) => {
        const d = String(p.processo_numero || "").replace(/\D/g, "");
        if (d.length === 20 && !jaTem.has(d) && !cand.has(d)) cand.set(d, p.data_publicacao);
      });
      const lista = [...cand.keys()];
      const sug: { processo: string; data: string | null; benner: any }[] = [];
      for (let i = 0; i < lista.length; i += 100) {
        const { data: bs } = await supabase
          .from("dados_benner" as any)
          .select("id, processo, dossie, equipe, reclamante, reclamada, relator, turma, coordenacao_id")
          .in("processo", lista.slice(i, i + 100).map(fmtCnj))
          .not("aba_origem", "is", null);
        ((bs as any[]) || []).forEach((b) => {
          const d = String(b.processo).replace(/\D/g, "");
          if (!sug.some((s) => s.processo === d)) sug.push({ processo: d, data: cand.get(d) || null, benner: b });
        });
      }
      setSugestoes(sug);
    } catch (e: any) {
      toast.error("Erro ao carregar pautas: " + e.message);
    }
    setLoading(false);
  }, [semana]);

  useEffect(() => { carregarSemanas(); }, [carregarSemanas]);
  useEffect(() => { carregarSemana(); }, [carregarSemana]);

  const opcoes = (k: keyof PautaTst) => [...new Set(dados.map((d) => (d[k] as string) || "").filter(Boolean))].sort();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dados.filter((d) =>
      (fRelator === "__all__" || d.relator === fRelator) &&
      (fOrgao === "__all__" || d.orgao === fOrgao) &&
      (fAdv === "__all__" || d.advogado_interno === fAdv) &&
      (fDecisao === "__all__" || (fDecisao === "__sem__" ? !d.decisao : d.decisao === fDecisao)) &&
      (!q || [d.processo_numero, d.dossie, d.reclamante, d.relator].some((v) => String(v || "").toLowerCase().includes(q))),
    );
  }, [dados, busca, fRelator, fOrgao, fAdv, fDecisao]);

  const stats = useMemo(() => {
    const m = (s: string | null) => (s || "").toUpperCase();
    return {
      total: dados.length,
      virtual: dados.filter((d) => /VIRTUAL/.test(m(d.modalidade))).length,
      presencial: dados.filter((d) => /TELE|PRESENC|HIBRID|HÍBRID/.test(m(d.modalidade))).length,
      semDecisao: dados.filter((d) => !d.decisao).length,
    };
  }, [dados]);

  const abaAtual = semanas.find((s) => s.ini === semana)?.aba || nomeAbaSemana(semana, semanas.filter((s) => s.ini <= semana).length);
  const idx = semanas.findIndex((s) => s.ini === semana);

  const salvar = async (dado: PautaTstInsert, id?: string) => {
    const payload: any = { ...dado };
    if (!id) {
      payload.semana_inicio = payload.semana_inicio || (payload.data_julgamento ? segundaDaSemana(payload.data_julgamento) : semana);
      payload.aba_origem = payload.aba_origem || abaAtual;
      payload.coordenacao_id = payload.coordenacao_id || COORD_RENATA;
    }
    const q = id
      ? supabase.from("pautas_tst" as any).update(payload).eq("id", id).select("id")
      : supabase.from("pautas_tst" as any).insert(payload).select("id");
    const { data, error } = await q;
    if (error || !data || (data as any[]).length === 0) {
      toast.error("Erro ao salvar: " + (error?.message || "sem permissão"));
      return false;
    }
    toast.success(id ? "Pauta atualizada" : "Pauta cadastrada");
    await Promise.all([carregarSemana(), carregarSemanas()]);
    return true;
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta pauta?")) return;
    const { error } = await supabase.from("pautas_tst" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pauta excluída");
    await carregarSemana();
  };

  const exportarSemana = () => {
    if (!dados.length) return toast.error("Nenhuma pauta nesta semana");
    exportarPautas([{ aba: abaAtual.slice(0, 31), pautas: dados }], `Pautas_de_julgamento_${abaAtual.replace(/[^\w.-]+/g, "_")}.xlsx`);
  };

  const exportarPeriodo = async () => {
    if (!expIni || !expFim) return toast.error("Informe o período");
    setExportando(true);
    try {
      const ini = segundaDaSemana(expIni), fim = segundaDaSemana(expFim);
      const rows = await fetchAll<PautaTst>((a, b) =>
        supabase.from("pautas_tst" as any).select("*").gte("semana_inicio", ini).lte("semana_inicio", fim).order("semana_inicio").range(a, b),
      );
      const grupos = new Map<string, PautaTst[]>();
      rows.forEach((r) => {
        const k = r.semana_inicio as string;
        grupos.set(k, [...(grupos.get(k) || []), r]);
      });
      if (!grupos.size) { toast.error("Nenhuma pauta no período"); return; }
      const usados = new Set<string>();
      exportarPautas(
        [...grupos.entries()].sort().map(([k, p]) => {
          let aba = (p.find((x) => x.aba_origem && /\d+\. \d{2}\.\d{2} a/.test(x.aba_origem))?.aba_origem || nomeAbaSemana(k, 1)).slice(0, 31);
          while (usados.has(aba)) aba = (aba + "_").slice(-31);
          usados.add(aba);
          return { aba, pautas: p };
        }),
        `Pautas_de_julgamento_${br(expIni).replace(/\//g, "-")}_a_${br(expFim).replace(/\//g, "-")}.xlsx`,
      );
      setExportOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExportando(false);
    }
  };

  const confirmarSugestao = (s: { processo: string; data: string | null; benner: any }) => {
    setNovo({
      processo_numero: fmtCnj(s.processo),
      dossie: s.benner.dossie, equipe: s.benner.equipe, reclamante: s.benner.reclamante,
      reclamada: s.benner.reclamada, relator: s.benner.relator, orgao: s.benner.turma,
      dados_benner_id: s.benner.id,
    });
  };

  const formAberto = editando || novo;

  return (
    <MainLayout title="Pautas de Julgamento">
      {formAberto && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <Gavel className="w-5 h-5 text-primary" />
            <div>
              <div className="font-semibold text-foreground">{editando ? "Editar pauta" : "Nova pauta"}</div>
              <div className="text-xs text-muted-foreground">{abaAtual}</div>
            </div>
          </div>
          <PautasTstForm
            dado={(editando || (novo as PautaTst)) ?? null}
            onSave={(d) => salvar(d, editando?.id)}
            onCancel={() => { setEditando(null); setNovo(null); }}
          />
        </div>
      )}

      {!formAberto && (
      <div className="space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Gavel className="w-6 h-6 text-primary" /> Pautas de Julgamento TST</h1>
            <p className="text-sm text-muted-foreground">Planilha semanal enviada ao Santander — Coordenação Dra. Renata Oficial</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" disabled={idx < 0 || idx >= semanas.length - 1} onClick={() => setSemana(semanas[idx + 1].ini)}><ChevronLeft className="w-4 h-4" /></Button>
            <Select value={semana} onValueChange={setSemana}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {semanas.map((s) => (
                  <SelectItem key={s.ini} value={s.ini}>{s.aba || `Semana de ${br(s.ini)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={idx <= 0} onClick={() => setSemana(semanas[idx - 1].ini)}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={exportarSemana}><Download className="w-4 h-4 mr-2" /> Exportar semana</Button>
            <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="w-4 h-4 mr-2" /> Exportar período</Button>
            <PautasTstImport onImported={() => { carregarSemana(); carregarSemanas(); }} />
            <Button onClick={() => setNovo({ data_julgamento: null })}><Plus className="w-4 h-4 mr-2" /> Nova pauta</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: "Pautas na semana", v: stats.total, i: Gavel, f: "__all__" },
            { l: "Virtual", v: stats.virtual, i: Monitor },
            { l: "Telepresencial / híbrido", v: stats.presencial, i: Users },
            { l: "Sem decisão", v: stats.semDecisao, i: AlertCircle, f: "__sem__" },
          ].map((c) => (
            <Card key={c.l} className={cn("transition-colors", c.f && "cursor-pointer hover:border-primary")} onClick={() => c.f && setFDecisao(c.f)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{c.l}</div>
                  <div className="text-2xl font-bold text-foreground">{c.v}</div>
                </div>
                <c.i className="w-6 h-6 text-primary/70" />
              </CardContent>
            </Card>
          ))}
        </div>

        {sugestoes.length > 0 && (
          <Card className="border-primary/40">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium text-foreground"><Lightbulb className="w-4 h-4 text-primary" /> Sugestões da semana (pautas do DEJT de processos da Distribuição TST)</div>
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((s) => (
                  <Button key={s.processo} variant="secondary" size="sm" onClick={() => confirmarSugestao(s)}>
                    <Plus className="w-3 h-3 mr-1" /> {fmtCnj(s.processo)} <span className="ml-2 text-xs text-muted-foreground">publ. {br(s.data)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Processo, dossiê, reclamante…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {[
            ["Relator", fRelator, setFRelator, opcoes("relator")],
            ["Órgão", fOrgao, setFOrgao, opcoes("orgao")],
            ["Advogado", fAdv, setFAdv, opcoes("advogado_interno")],
          ].map(([l, v, setV, ops]: any) => (
            <Select key={l} value={v} onValueChange={setV}>
              <SelectTrigger className="w-48"><SelectValue placeholder={l} /></SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="__all__">{l}: todos</SelectItem>
                {ops.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          <Select value={fDecisao} onValueChange={setFDecisao}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="__all__">Decisão: todas</SelectItem>
              <SelectItem value="__sem__">Sem decisão</SelectItem>
              {opcoes("decisao").map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{filtrados.length} de {dados.length}</span>
        </div>

        <div className="border border-border rounded-lg overflow-auto max-h-[calc(100vh-22rem)] bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Reclamante</TableHead>
                <TableHead>Advogado</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Nenhuma pauta nesta semana</TableCell></TableRow>
              ) : filtrados.map((d) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell className="text-sm whitespace-nowrap">{br(d.data_julgamento)}</TableCell>
                  <TableCell className="text-sm">{d.horario || "—"}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{d.processo_numero || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{d.dossie || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{d.reclamante || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">{d.advogado_interno || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[140px] truncate">{d.orgao || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{d.relator || "—"}</TableCell>
                  <TableCell>{d.modalidade ? <Badge variant="outline" className="text-xs">{d.modalidade}</Badge> : "—"}</TableCell>
                  <TableCell><span className={cn("text-xs px-2 py-0.5 rounded-md inline-block max-w-[180px] truncate", corDecisao(d.decisao))}>{d.decisao || "Sem decisão"}</span></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => excluir(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exportar período (uma aba por semana)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>De</Label><Input type="date" value={expIni} onChange={(e) => setExpIni(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={expFim} onChange={(e) => setExpFim(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={exportarPeriodo} disabled={exportando}>{exportando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
