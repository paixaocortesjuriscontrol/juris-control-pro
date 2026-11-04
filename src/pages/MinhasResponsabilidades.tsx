import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lerFonteAgendaPorTipo } from "@/lib/agendaRpc";
import type { FonteAgenda } from "@/lib/agendaModoBusca";
import { classificarStatus, STATUS_PARA_FILTRO, type StatusFiltro } from "@/lib/statusItemEquipe";
import { papelDoUsuario, type PapelItem } from "@/lib/minhasResponsabilidades";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Periodo = "mes" | "trimestre" | "ano";
const PERIODOS: { v: Periodo; l: string }[] = [
  { v: "mes", l: "Este mês" },
  { v: "trimestre", l: "Mês passado a próximo" },
  { v: "ano", l: "12 meses" },
];
const FONTES: FonteAgenda[] = ["tarefas", "eventos", "audiencias"];
const FILTROS: { v: StatusFiltro; l: string }[] = [
  { v: "todos", l: "Todas" },
  { v: "pendentes", l: "Pendentes" },
  { v: "atrasadas", l: "Atrasadas" },
  { v: "cumpridas", l: "Cumpridas" },
  { v: "cancelados", l: "Canceladas" },
];
const TIPOS = ["todos", "tarefa", "prazo", "evento", "audiencia"] as const;
const ROT_TIPO: Record<string, string> = { todos: "Todos", tarefa: "Tarefa", prazo: "Prazo", evento: "Evento", audiencia: "Audiência" };

function tipoDoItem(fonte: FonteAgenda, i: any): string {
  if (fonte === "audiencias") return "audiencia";
  const t = String(i.tipo_tarefa ?? i.tipo ?? "").toUpperCase();
  if (t.startsWith("PRAZO")) return "prazo";
  if (t.startsWith("AUDI")) return "audiencia";
  if (fonte === "eventos" || t === "EVENTO") return "evento";
  return "tarefa";
}

const fmt = (raw?: string | null) => {
  if (!raw) return "—";
  try { return format(parseISO(raw), "dd/MM/yyyy"); } catch { return raw; }
};

export default function MinhasResponsabilidades() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [coordSel, setCoordSel] = useState<string>("todas");
  const [usuarioSel, setUsuarioSel] = useState<string>("");
  const uid = (isAdmin && usuarioSel) || user?.id || "";

  const coordenacoes = useQuery({
    queryKey: ["minhas-resp", "coords"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const usuarios = useQuery({
    queryKey: ["minhas-resp", "usuarios", coordSel],
    enabled: isAdmin,
    queryFn: async () => {
      let ids: string[] | null = null;
      if (coordSel !== "todas") {
        const { data, error } = await supabase.from("membros_coordenacao").select("usuario_id").eq("coordenacao_id", coordSel);
        if (error) throw error;
        ids = [...new Set((data ?? []).map((m) => m.usuario_id))];
        if (!ids.length) return [];
      }
      let q = (supabase as any).from("profiles_basic").select("id, nome").order("nome").limit(1000);
      if (ids) q = q.in("id", ids);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [buscaProc, setBuscaProc] = useState("");
  const [statusProc, setStatusProc] = useState("todos");

  const atividades = useQuery({
    queryKey: ["minhas-responsabilidades", "atividades", uid, periodo],
    enabled: !!uid,
    queryFn: async () => {
      const hoje = new Date();
      const dataInicio = startOfMonth(periodo === "mes" ? hoje : periodo === "trimestre" ? subMonths(hoje, 1) : subMonths(hoje, 6));
      const dataFim = endOfMonth(periodo === "mes" ? hoje : periodo === "trimestre" ? addMonths(hoje, 1) : addMonths(hoje, 5));
      const saida: any[] = [];
      for (const fonte of FONTES) {
        let offset = 0;
        for (let i = 0; i < 20; i++) {
          const r = await lerFonteAgendaPorTipo({ modo: "pessoal", usuario: uid }, fonte, { dataInicio, dataFim }, offset, 500);
          for (const l of r.linhas) {
            const papel = papelDoUsuario(l, uid);
            if (papel) saida.push({ ...l, _fonte: fonte, _papel: papel, _tipo: tipoDoItem(fonte, l) });
          }
          if (!r.temMais) break;
          offset += 500;
        }
      }
      const vistos = new Set<string>();
      return saida.filter((x) => {
        const k = `${x._fonte}:${x.id}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
    },
  });

  const processos = useQuery({
    queryKey: ["minhas-responsabilidades", "processos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const out: any[] = [];
      for (let p = 0; p < 50; p++) {
        const { data, error } = await supabase
          .from("processos_responsaveis")
          .select("processo_id, papel, processos:processo_id(id, numero, assunto, status, cliente_id, clientes:cliente_id(nome))")
          .eq("usuario_id", uid)
          .neq("ativo", false)
          .range(p * 1000, p * 1000 + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if ((data ?? []).length < 1000) break;
      }
      const m = new Map<string, any>();
      out.forEach((r: any) => r.processos && m.set(r.processos.id, r.processos));
      return [...m.values()];
    },
  });

  const workflows = useQuery({
    queryKey: ["minhas-responsabilidades", "workflows", uid],
    enabled: !!uid,
    queryFn: async () => {
      const sel = "etapa_id, workflow_etapas:etapa_id(id, titulo, ordem, workflows:workflow_id(id, nome, ativo, arquivado_em, coordenacoes:coordenacao_id(nome)))";
      const [r, e] = await Promise.all([
        supabase.from("workflow_etapa_responsaveis").select(sel).eq("usuario_id", uid),
        supabase.from("workflow_etapa_envolvidos").select(sel).eq("usuario_id", uid),
      ]);
      if (r.error) throw r.error;
      if (e.error) throw e.error;
      const m = new Map<string, any>();
      const add = (rows: any[], papel: PapelItem) =>
        rows.forEach((x) => {
          const et = x.workflow_etapas;
          if (!et?.workflows || et.workflows.arquivado_em) return;
          if (!m.has(et.id)) m.set(et.id, { ...et, _papel: papel });
        });
      add(r.data ?? [], "responsavel");
      add(e.data ?? [], "envolvido");
      return [...m.values()].sort((a, b) => a.workflows.nome.localeCompare(b.workflows.nome) || a.ordem - b.ordem);
    },
  });

  const itens = atividades.data ?? [];
  const contagem = useMemo(() => {
    const c: Record<StatusFiltro, number> = { todos: 0, pendentes: 0, atrasadas: 0, cumpridas: 0, cancelados: 0 };
    itens.forEach((i) => {
      if (tipo !== "todos" && i._tipo !== tipo) return;
      c.todos++;
      c[STATUS_PARA_FILTRO[classificarStatus(i)]]++;
    });
    return c;
  }, [itens, tipo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => tipo === "todos" || i._tipo === tipo)
      .filter((i) => filtro === "todos" || STATUS_PARA_FILTRO[classificarStatus(i)] === filtro)
      .filter((i) => !q || [i.titulo, i.processo?.numero, i.processo?.assunto].some((v) => String(v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => String(a.data_fatal ?? a.data_vencimento ?? a.data_inicio ?? "").localeCompare(String(b.data_fatal ?? b.data_vencimento ?? b.data_inicio ?? "")));
  }, [itens, tipo, filtro, busca]);

  const procs = useMemo(() => {
    const q = buscaProc.trim().toLowerCase();
    return (processos.data ?? [])
      .filter((p) => statusProc === "todos" || p.status === statusProc)
      .filter((p) => !q || [p.numero, p.assunto, p.clientes?.nome].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [processos.data, buscaProc, statusProc]);
  const statusDisponiveis = useMemo(
    () => ["todos", ...new Set((processos.data ?? []).map((p) => p.status).filter(Boolean))],
    [processos.data],
  );

  const resumo = [
    { l: "Pendentes", v: contagem.pendentes },
    { l: "Atrasadas", v: contagem.atrasadas, destaque: true },
    { l: "Processos ativos", v: (processos.data ?? []).filter((p) => p.status === "ativo").length },
    { l: "Etapas de workflow", v: workflows.data?.length ?? 0 },
  ];

  const carregando = (q: { isLoading: boolean }) =>
    q.isLoading ? <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div> : null;

  return (
    <MainLayout title="Minhas responsabilidades" subtitle="Tudo que está com você: atividades, processos e workflows">
      <div className="space-y-4">
        {isAdmin && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Ver responsabilidades de:</span>
            <Select value={coordSel} onValueChange={(v) => { setCoordSel(v); setUsuarioSel(""); }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Coordenação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {(coordenacoes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={usuarioSel || "eu"} onValueChange={(v) => setUsuarioSel(v === "eu" ? "" : v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eu">Eu mesmo</SelectItem>
                {(usuarios.data ?? []).filter((u) => u.id !== user?.id).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {resumo.map((r) => (
            <Card key={r.l}><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{r.l}</div>
              <div className={cn("text-2xl font-semibold", r.destaque && r.v > 0 && "text-destructive")}>{r.v}</div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="atividades">
          <TabsList>
            <TabsTrigger value="atividades">Atividades ({itens.length})</TabsTrigger>
            <TabsTrigger value="processos">Processos ({processos.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="workflows">Workflows ({workflows.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <Button key={f.v} size="sm" variant={filtro === f.v ? "default" : "outline"} onClick={() => setFiltro(f.v)}>
                  {f.l} ({contagem[f.v]})
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {TIPOS.map((t) => (
                <Button key={t} size="sm" variant={tipo === t ? "default" : "outline"} onClick={() => setTipo(t)}>{ROT_TIPO[t]}</Button>
              ))}
              {PERIODOS.map((p) => (
                <Button key={p.v} size="sm" variant={periodo === p.v ? "default" : "outline"} onClick={() => setPeriodo(p.v)}>{p.l}</Button>
              ))}
              <Input className="max-w-xs" placeholder="Buscar por título ou processo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {carregando(atividades)}
            {atividades.error && <div className="text-destructive text-sm">Não foi possível carregar: {(atividades.error as Error).message}</div>}
            <Card><CardContent className="p-0 divide-y">
              {!atividades.isLoading && filtrados.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhuma atividade.</div>}
              {filtrados.map((i) => {
                const st = classificarStatus(i);
                const riscado = ["cancelado", "protocolado", "baixado"].includes(String(i.status ?? ""));
                return (
                  <button
                    key={`${i._fonte}:${i.id}`}
                    className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap items-center gap-2"
                    onClick={() => i.processo_id && navigate(`/processos/${i.processo_id}`)}
                  >
                    <Badge variant="outline">{ROT_TIPO[i._tipo]}</Badge>
                    <span className={cn("font-medium flex-1 min-w-[200px]", riscado && "line-through", st === "cumprida" && !riscado && "text-primary")}>{i.titulo || "(sem título)"}</span>
                    {i.processo?.numero && <span className="text-xs text-muted-foreground">{i.processo.numero}</span>}
                    <span className="text-xs">{fmt(i.data_fatal ?? i.data_vencimento ?? i.data_inicio)}</span>
                    <Badge variant={st === "atrasada" ? "destructive" : "secondary"}>{st === "pendente" ? "Pendente" : st === "atrasada" ? "Atrasada" : st === "cumprida" ? "Cumprida" : "Cancelada"}</Badge>
                    <Badge variant={i._papel === "responsavel" ? "default" : "outline"}>{i._papel === "responsavel" ? "Responsável" : "Envolvido"}</Badge>
                  </button>
                );
              })}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="processos" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              {statusDisponiveis.map((s) => (
                <Button key={s} size="sm" variant={statusProc === s ? "default" : "outline"} onClick={() => setStatusProc(s)} className="capitalize">
                  {s === "todos" ? "Todos" : s.replace(/_/g, " ")}
                </Button>
              ))}
              <Input className="max-w-xs" placeholder="Buscar por número, assunto ou cliente..." value={buscaProc} onChange={(e) => setBuscaProc(e.target.value)} />
            </div>
            {carregando(processos)}
            <Card><CardContent className="p-0 divide-y">
              {!processos.isLoading && procs.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhum processo.</div>}
              {procs.slice(0, 500).map((p) => (
                <button key={p.id} className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap gap-2 items-center" onClick={() => navigate(`/processos/${p.id}`)}>
                  <span className="font-medium">{p.numero || "(sem número)"}</span>
                  <span className="text-sm text-muted-foreground flex-1">{p.clientes?.nome ?? ""}{p.assunto ? ` — ${p.assunto}` : ""}</span>
                  <Badge variant="secondary" className="capitalize">{String(p.status ?? "").replace(/_/g, " ")}</Badge>
                </button>
              ))}
              {procs.length > 500 && <div className="p-3 text-xs text-muted-foreground">Mostrando 500 de {procs.length}. Use a busca para encontrar os demais.</div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="workflows">
            {carregando(workflows)}
            <Card><CardContent className="p-0 divide-y">
              {!workflows.isLoading && (workflows.data ?? []).length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhuma etapa de workflow.</div>}
              {(workflows.data ?? []).map((e) => (
                <button key={e.id} className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap gap-2 items-center" onClick={() => navigate(`/workflow?id=${e.workflows.id}`)}>
                  <span className="font-medium">{e.workflows.nome}</span>
                  <span className="text-sm flex-1">Etapa {e.ordem}: {e.titulo}</span>
                  <span className="text-xs text-muted-foreground">{e.workflows.coordenacoes?.nome ?? ""}</span>
                  {!e.workflows.ativo && <Badge variant="outline">Desabilitado</Badge>}
                  <Badge variant={e._papel === "responsavel" ? "default" : "outline"}>{e._papel === "responsavel" ? "Responsável" : "Envolvido"}</Badge>
                </button>
              ))}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
