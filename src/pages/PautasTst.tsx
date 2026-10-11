import { useEffect, useMemo, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { carregarMembrosRenata, importarProcessoDaPauta } from "@/lib/pautasAcoes";
import { RefreshCw, FolderInput, FolderCheck, X, ShieldAlert, UserPlus, UserMinus } from "lucide-react";

const COORD_RENATA = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";
const PRIMEIRA_SEMANA = "2026-02-02";
const numSemana = (ini: string) => {
  const base = new Date(PRIMEIRA_SEMANA + "T12:00:00").getTime();
  const n = Math.round((new Date(ini + "T12:00:00").getTime() - base) / (7 * 864e5)) + 1;
  return n > 0 ? n : 1;
};
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
  const [distMap, setDistMap] = useState<Record<string, string>>({});
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
  const [fModal, setFModal] = useState("__all__");
  const [fResp, setFResp] = useState("__all__");
  const [fSit, setFSit] = useState("__all__");
  const [fCad, setFCad] = useState("__all__");
  const [dIni, setDIni] = useState("");
  const [dFim, setDFim] = useState("");
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([]);
  const [respMap, setRespMap] = useState<Record<string, string[]>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [buscandoAuto, setBuscandoAuto] = useState(false);
  const [foraIntervalo, setForaIntervalo] = useState<string[]>([]);
  const [reorganizando, setReorganizando] = useState(false);
  const [emLote, setEmLote] = useState(false);
  const [acesso, setAcesso] = useState<boolean | null>(null);
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole() as any;

  useEffect(() => {
    if (!user?.id || roleLoading) return;
    if (isAdmin) { setAcesso(true); return; }
    const sb: any = supabase;
    sb.from("membros_coordenacao").select("id").eq("user_id", user.id).eq("coordenacao_id", COORD_RENATA).limit(1)
      .then(({ data }: any) => setAcesso(!!data?.length));
  }, [user?.id, isAdmin, roleLoading]);
  useEffect(() => { carregarMembrosRenata().then(setMembros); }, []);

  const carregarSemanas = useCallback(async () => {
    const rows = await fetchAll<{ semana_inicio: string | null; aba_origem: string | null }>((a, b) =>
      supabase.from("pautas_tst" as any).select("semana_inicio, aba_origem").not("semana_inicio", "is", null).range(a, b),
    );
    const map = new Map<string, string | null>();
    rows.forEach((r) => r.semana_inicio && !map.has(r.semana_inicio) && map.set(r.semana_inicio, r.aba_origem));
    const atual = segundaDaSemana(hojeIso());
    if (!map.has(atual)) map.set(atual, null);
    setSemanas([...map.entries()].map(([ini, aba]) => ({
      ini,
      aba: nomeAbaSemana(ini, numSemana(ini)),
    })).sort((x, y) => y.ini.localeCompare(x.ini)));
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
      setSel(new Set());
      setForaIntervalo(rows.filter((r) => r.data_julgamento && (r.data_julgamento < semana || r.data_julgamento > fim)).map((r) => r.id));
      const rm: Record<string, string[]> = {};
      const ids = rows.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 300) {
        const { data: rr } = await supabase.from("pautas_tst_responsaveis" as any).select("pauta_id, user_id").in("pauta_id", ids.slice(i, i + 300));
        ((rr as any[]) || []).forEach((x) => { (rm[x.pauta_id] ||= []).push(x.user_id); });
      }
      setRespMap(rm);
      const bm: Record<string, string> = {};
      const bids = Array.from(new Set(rows.map((r: any) => r.dados_benner_id).filter(Boolean)));
      for (let i = 0; i < bids.length; i += 300) {
        const { data: bb } = await supabase.from("dados_benner" as any).select("id, status").in("id", bids.slice(i, i + 300));
        ((bb as any[]) || []).forEach((x) => { bm[x.id] = x.status || ""; });
      }
      setDistMap(bm);
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
      (fModal === "__all__" || d.modalidade === fModal) &&
      (fResp === "__all__" || (fResp === "__sem__" ? !(respMap[d.id]?.length) : respMap[d.id]?.includes(fResp))) &&
      (fSit === "__all__" || ((d as any).status_avaliacao || "avaliada") === fSit) &&
      (fCad === "__all__" || (fCad === "sim" ? !!d.processo_id : !d.processo_id)) &&
      (!dIni || (d.data_julgamento || "") >= dIni) &&
      (!dFim || (d.data_julgamento || "9999") <= dFim) &&
      (!q || [d.processo_numero, d.dossie, d.reclamante, d.reclamada, d.relator].some((v) => String(v || "").toLowerCase().includes(q))),
    );
  }, [dados, busca, fRelator, fOrgao, fAdv, fDecisao, fModal, fResp, fSit, fCad, dIni, dFim, respMap]);

  const limparFiltros = () => {
    setBusca(""); setFRelator("__all__"); setFOrgao("__all__"); setFAdv("__all__"); setFDecisao("__all__");
    setFModal("__all__"); setFResp("__all__"); setFSit("__all__"); setFCad("__all__"); setDIni(""); setDFim("");
  };

  const salvarCampo = async (id: string, campo: string, valor: any) => {
    const { data, error } = await supabase.from("pautas_tst" as any).update({ [campo]: valor }).eq("id", id).select("id");
    if (error || !data?.length) { toast.error("Erro ao salvar: " + (error?.message || "sem permissão")); return false; }
    setDados((prev) => prev.map((p) => (p.id === id ? ({ ...p, [campo]: valor } as any) : p)));
    return true;
  };

  const buscarAgora = async () => {
    setBuscandoAuto(true);
    const { data, error } = await supabase.rpc("buscar_pautas_tst_agora" as any);
    setBuscandoAuto(false);
    if (error) return toast.error(error.message);
    toast.success(`${data || 0} pauta(s) nova(s) separada(s) das publicações`);
    await Promise.all([carregarSemanas(), carregarSemana()]);
  };

  const reorganizarFora = async () => {
    if (!foraIntervalo.length) return;
    setReorganizando(true);
    try {
      const alvos = dados.filter((d) => foraIntervalo.includes(d.id) && d.data_julgamento);
      for (const p of alvos) {
        const { data, error } = await supabase
          .from("pautas_tst" as any)
          .update({ semana_inicio: segundaDaSemana(p.data_julgamento as string) })
          .eq("id", p.id)
          .select("id");
        if (error || !data?.length) throw new Error(error?.message || "sem permissão para reorganizar");
      }
      toast.success(`${alvos.length} pauta(s) movida(s) para a semana correta`);
      setForaIntervalo([]);
      await Promise.all([carregarSemanas(), carregarSemana()]);
    } catch (e: any) {
      toast.error("Erro ao reorganizar: " + e.message);
    }
    setReorganizando(false);
  };

  const atribuirLote = async (uid: string) => {
    const ids = [...sel].filter((id) => !respMap[id]?.includes(uid));
    if (!ids.length) return toast.info("Já atribuído");
    const { error } = await supabase.from("pautas_tst_responsaveis" as any).insert(ids.map((pauta_id) => ({ pauta_id, user_id: uid })));
    if (error) return toast.error(error.message);
    toast.success(`Responsável atribuído a ${ids.length} pauta(s)`);
    await carregarSemana();
  };

  const removerLote = async (uid: string) => {
    const ids = [...sel].filter((id) => respMap[id]?.includes(uid));
    if (!ids.length) return toast.info("Nenhuma das selecionadas tem esse responsável");
    const { data, error } = await supabase
      .from("pautas_tst_responsaveis" as any).delete().in("pauta_id", ids).eq("user_id", uid).select("id");
    if (error || !data?.length) return toast.error("Erro ao retirar: " + (error?.message || "sem permissão"));
    toast.success(`Responsável retirado de ${data.length} pauta(s)`);
    await carregarSemana();
  };

  const alternarResponsavel = async (pautaId: string, uid: string, atribuido: boolean) => {
    const atual = respMap[pautaId] || [];
    const novo = atribuido ? atual.filter((x) => x !== uid) : [...atual, uid];
    setRespMap((p) => ({ ...p, [pautaId]: novo }));
    const q = atribuido
      ? supabase.from("pautas_tst_responsaveis" as any).delete().eq("pauta_id", pautaId).eq("user_id", uid).select("id")
      : supabase.from("pautas_tst_responsaveis" as any).insert({ pauta_id: pautaId, user_id: uid }).select("id");
    const { data, error } = await q;
    if (error || !data?.length) {
      setRespMap((p) => ({ ...p, [pautaId]: atual }));
      toast.error("Erro ao atualizar responsável: " + ((error as any)?.message || "sem permissão"));
    }
  };

  const importarLote = async () => {
    const alvo = dados.filter((d) => sel.has(d.id) && !d.processo_id);
    if (!alvo.length) return toast.info("Todas as selecionadas já estão em Processos e Casos");
    setEmLote(true);
    let novos = 0, ligados = 0, falhas = 0;
    for (const p of alvo) {
      try { const r = await importarProcessoDaPauta(p); r.novo ? novos++ : ligados++; } catch { falhas++; }
    }
    setEmLote(false);
    toast.success(`${novos} cadastrado(s) com Judit, ${ligados} ligado(s) a fichas existentes${falhas ? `, ${falhas} com erro` : ""}`);
    await carregarSemana();
  };

  const stats = useMemo(() => {
    const m = (s: string | null) => (s || "").toUpperCase();
    return {
      total: dados.length,
      virtual: dados.filter((d) => /VIRTUAL/.test(m(d.modalidade))).length,
      presencial: dados.filter((d) => /TELE|PRESENC|HIBRID|HÍBRID/.test(m(d.modalidade))).length,
      semDecisao: dados.filter((d) => !d.decisao).length,
      aAvaliar: dados.filter((d) => (d as any).status_avaliacao === "a_avaliar").length,
    };
  }, [dados]);

  const abaAtual = semanas.find((s) => s.ini === semana)?.aba || nomeAbaSemana(semana, numSemana(semana));
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
      {acesso && formAberto && (
          <PautasTstForm
            dado={(editando || (novo as PautaTst)) ?? null}
            subtitulo={abaAtual}
            onSave={(d) => salvar(d, editando?.id)}
            onSaveField={salvarCampo}
            onCancel={() => { setEditando(null); setNovo(null); carregarSemana(); }}
          />
      )}

      {acesso === false && (
        <div className="py-20 text-center text-muted-foreground space-y-2">
          <ShieldAlert className="w-10 h-10 mx-auto" />
          <div className="font-medium text-foreground">Sem acesso</div>
          <div className="text-sm">Esta tela é exclusiva da Coordenação Dra. Renata Oficial.</div>
        </div>
      )}
      {acesso && !formAberto && (
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
            <Button variant="outline" onClick={buscarAgora} disabled={buscandoAuto}>
              {buscandoAuto ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Buscar pautas agora
            </Button>
            <PautasTstImport onImported={() => { carregarSemana(); carregarSemanas(); }} />
            <Button onClick={() => setNovo({ data_julgamento: null })}><Plus className="w-4 h-4 mr-2" /> Nova pauta</Button>
          </div>
        </div>

        {foraIntervalo.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span><strong>{foraIntervalo.length}</strong> pauta(s) desta semana têm data de julgamento fora do intervalo da semana.</span>
            </div>
            <Button size="sm" variant="outline" onClick={reorganizarFora} disabled={reorganizando}>
              {reorganizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Reorganizar para a semana correta
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: "Pautas na semana", v: stats.total, i: Gavel, f: "__all__" },
            { l: "Virtual", v: stats.virtual, i: Monitor },
            { l: "Telepresencial / híbrido", v: stats.presencial, i: Users },
            { l: "Sem decisão", v: stats.semDecisao, i: AlertCircle, f: "__sem__" },
            { l: "A avaliar", v: stats.aAvaliar, i: Lightbulb, s: "a_avaliar" },
          ].map((c: any) => (
            <Card key={c.l} className={cn("transition-colors", (c.f || c.s) && "cursor-pointer hover:border-primary")} onClick={() => { if (c.f) setFDecisao(c.f); if (c.s) setFSit(c.s); }}>
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
          <Select value={fModal} onValueChange={setFModal}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Modalidade: todas</SelectItem>
              {opcoes("modalidade").map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fResp} onValueChange={setFResp}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="__all__">Responsável: todos</SelectItem>
              <SelectItem value="__sem__">Sem responsável</SelectItem>
              {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSit} onValueChange={setFSit}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Situação: todas</SelectItem>
              <SelectItem value="a_avaliar">A avaliar</SelectItem>
              <SelectItem value="avaliada">Avaliada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fCad} onValueChange={setFCad}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Processos e Casos: todos</SelectItem>
              <SelectItem value="sim">Já cadastrado</SelectItem>
              <SelectItem value="nao">Não cadastrado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            Julgamento <Input type="date" className="w-36" value={dIni} onChange={(e) => setDIni(e.target.value)} /> a
            <Input type="date" className="w-36" value={dFim} onChange={(e) => setDFim(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" onClick={limparFiltros}><X className="w-4 h-4 mr-1" /> Limpar filtros</Button>
          <span className="text-sm text-muted-foreground ml-auto">{filtrados.length} de {dados.length}</span>
        </div>

        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
            <span className="text-sm font-medium">{sel.size} selecionada(s)</span>
            <Select value="" onValueChange={atribuirLote}>
              <SelectTrigger className="w-56 h-8"><UserPlus className="w-4 h-4 mr-1" /><SelectValue placeholder="Atribuir responsável" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={importarLote} disabled={emLote}>
              {emLote ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FolderInput className="w-4 h-4 mr-1" />} Importar processos (Judit)
            </Button>
            <Select value="" onValueChange={removerLote}>
              <SelectTrigger className="w-56 h-8"><UserMinus className="w-4 h-4 mr-1" /><SelectValue placeholder="Retirar responsável" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar seleção</Button>
          </div>
        )}

        <div className="border border-border rounded-lg overflow-auto max-h-[calc(100vh-22rem)] bg-card">
          <Table className="table-fixed w-full">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={filtrados.length > 0 && filtrados.every((d) => sel.has(d.id))}
                    onCheckedChange={(v) => setSel(v ? new Set(filtrados.map((d) => d.id)) : new Set())} />
                </TableHead>
                <TableHead className="w-[110px]">Data / Hora</TableHead>
                <TableHead className="w-[26%]">Processo / Dossiê</TableHead>
                <TableHead>Reclamante / Advogado</TableHead>
                <TableHead>Órgão / Relator</TableHead>
                <TableHead className="w-[150px]">Modalidade / Decisão</TableHead>
                <TableHead className="w-[120px]">Responsáveis</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma pauta nesta semana</TableCell></TableRow>
              ) : filtrados.map((d) => (
                <TableRow key={d.id} title={foraIntervalo.includes(d.id) ? "Data de julgamento fora do intervalo desta semana" : undefined} className={cn("cursor-pointer align-top hover:bg-muted/50", foraIntervalo.includes(d.id) ? "bg-amber-500/15 hover:bg-amber-500/25 border-l-2 border-l-amber-500" : (d as any).status_avaliacao === "a_avaliar" && "bg-primary/5")} onClick={() => setEditando(d)}>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={sel.has(d.id)} onCheckedChange={(v) => { const n = new Set(sel); v ? n.add(d.id) : n.delete(d.id); setSel(n); }} />
                  </TableCell>
                  <TableCell className="text-sm py-2">
                    <div className="whitespace-nowrap">{br(d.data_julgamento)}</div>
                    <div className="text-xs text-muted-foreground">{d.horario || "—"}
                      {foraIntervalo.includes(d.id) && <Badge className="ml-1 text-[10px] px-1 bg-amber-500/25 text-amber-700 dark:text-amber-300">Fora</Badge>}
                      {(d as any).status_avaliacao === "a_avaliar" && <Badge variant="destructive" className="ml-1 text-[10px] px-1">Nova</Badge>}</div>
                  </TableCell>
                  <TableCell className="py-2 min-w-0">
                    <div className="font-mono text-xs flex flex-wrap items-center gap-1 break-all">
                      {d.processo_id ? <FolderCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Cadastrado em Processos e Casos" /> : <FolderInput className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="Não cadastrado" />}
                      {(d as any).dados_benner_id && (() => {
                        const st = distMap[(d as any).dados_benner_id] || "";
                        const rot = ({ rascunho: "Rascunho", planilhado: "Planilhado", pronto_envio: "Pronto para envio" } as Record<string, string>)[st] || st || "Sem situação";
                        return (
                          <span title={`Já está na Distribuição TST — situação: ${rot}`} className="inline-flex items-center gap-0.5 rounded bg-accent px-1 text-[10px] font-sans text-accent-foreground">
                            <ShieldAlert className="w-3 h-3" />TST · {rot}
                          </span>
                        );
                      })()}
                      <span>{d.processo_numero || "—"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{d.dossie || "—"}</div>
                  </TableCell>
                  <TableCell className="py-2 min-w-0">
                    <div className="text-sm truncate" title={d.reclamante || ""}>{d.reclamante || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate" title={d.advogado_interno || ""}>{d.advogado_interno || "—"}</div>
                  </TableCell>
                  <TableCell className="py-2 min-w-0">
                    <div className="text-sm truncate">{d.orgao || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate" title={d.relator || ""}>{d.relator || "—"}</div>
                  </TableCell>
                  <TableCell className="py-2 min-w-0">
                    <div>{d.modalidade ? <Badge variant="outline" className="text-xs">{d.modalidade}</Badge> : "—"}</div>
                    <span title={d.decisao || ""} className={cn("mt-1 text-xs px-2 py-0.5 rounded-md inline-block max-w-full truncate", corDecisao(d.decisao))}>{d.decisao || "Sem decisão"}</span>
                  </TableCell>
                  <TableCell className="text-xs py-2" onClick={(e) => e.stopPropagation()}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          title="Clique para colocar ou retirar responsáveis"
                          className="inline-flex max-w-full items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-left hover:bg-muted"
                        >
                          <UserPlus className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {(respMap[d.id] || []).map((u) => membros.find((m) => m.id === u)?.nome?.split(" ")[0]).filter(Boolean).join(", ") || "Definir"}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">Responsáveis</div>
                        <div className="max-h-64 space-y-0.5 overflow-auto">
                          {membros.map((m) => {
                            const on = (respMap[d.id] || []).includes(m.id);
                            return (
                              <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                                <Checkbox checked={on} onCheckedChange={() => alternarResponsavel(d.id, m.id, on)} />
                                <span className="truncate">{m.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-0.5">
                      {(d as any).dados_benner_id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir na Distribuição TST" asChild>
                          <a href={`/distribuicao-tst?editId=${(d as any).dados_benner_id}`} target="_blank" rel="noreferrer"><Gavel className="w-4 h-4" /></a>
                        </Button>
                      )}
                      {d.processo_id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver processo completo (Processos e Casos)" asChild>
                          <a href={`/processos/${d.processo_id}`} target="_blank" rel="noreferrer"><FolderCheck className="w-4 h-4" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir" onClick={() => excluir(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

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
