import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lerFonteAgendaPorTipo } from "@/lib/agendaRpc";
import type { FonteAgenda } from "@/lib/agendaModoBusca";
import { classificarStatus, STATUS_PARA_FILTRO, type StatusFiltro } from "@/lib/statusItemEquipe";
import { grupoAgendaResponsabilidade, papelDoUsuario, type GrupoAgendaResponsabilidade, type PapelItem } from "@/lib/minhasResponsabilidades";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, LayoutList, Columns3, ListChecks, Rows3, FileSpreadsheet, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

function Segmento({ opcoes, valor, onChange }: { opcoes: { v: string; l: string }[]; valor: string; onChange: (v: any) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
      {opcoes.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn("h-6 px-2 rounded text-xs whitespace-nowrap transition-colors", valor === o.v ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
import ListaAtividadesView from "@/components/lista/ListaAtividadesView";
import { KanbanItensAgenda } from "@/components/painel/KanbanItensAgenda";
import { ListaAtividadesProjuris } from "@/components/painel/ListaAtividadesProjuris";
import { useQueryClient } from "@tanstack/react-query";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { ProcessoItensLateral } from "@/components/processos/ProcessoItensLateral";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { ProcessoVisaoGeralForm } from "@/components/processos/ProcessoVisaoGeralForm";
import { cn } from "@/lib/utils";
import { agruparAtividadesDaAgenda, chaveAtividade } from "@/lib/atividadesDaAgenda";
import { AtividadesDaAgendaChips } from "@/components/painel/AtividadesDaAgendaChips";
import { PainelFiltros, PAINEL_FILTROS_DEFAULT, type PainelFiltrosState } from "@/components/painel/PainelFiltros";
import { statusCasaSituacao } from "@/hooks/useSituacoesPainel";
import { useItensComComentarios, temComentarioItem } from "@/hooks/useItensComComentarios";
import { useItensDePublicacao } from "@/hooks/useItensDePublicacao";
import { useCobrancasItens, infoCobrancaItem } from "@/hooks/useCobrancasItens";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import { isItemTratado } from "@/components/shared/TratadoCheck";
import { itemSemProcessoEPublicacao, itemVeioDePublicacao } from "@/lib/vinculoItem";

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
const GRUPOS_AGENDA = [
  { v: "atrasadas", l: "Atrasadas" },
  { v: "hoje", l: "Hoje" },
  { v: "futuras", l: "Futura" },
] as const;

function tipoDoItem(fonte: FonteAgenda, i: any): string {
  if (fonte === "audiencias") return "audiencia";
  const t = String(i.tipo_tarefa ?? i.tipo ?? "").toUpperCase();
  if (t.startsWith("PRAZO")) return "prazo";
  if (t.startsWith("AUDI")) return "audiencia";
  if (fonte === "eventos" || t === "EVENTO") return "evento";
  return "tarefa";
}

/** Converte a linha da busca pessoal no formato que o painel da agenda reconhece. */
function paraItemAgenda(i: any): any {
  const isAud = i._fonte === "audiencias";
  return {
    ...i,
    id: isAud ? `audiencia-det-${i.id}` : i.id,
    tipo: isAud ? "audiencia" : i._tipo,
    origem: i._fonte === "tarefas" ? "tarefa" : "evento",
    // A busca pessoal devolve "origem" do cadastro (projuris, analise_djen...);
    // guardamos à parte porque "origem" acima identifica a fonte do item.
    origem_registro: i.origem ?? null,
    responsaveis_ids: Array.isArray(i.responsaveis) ? i.responsaveis : [],
    participantes: (Array.isArray(i.envolvidos) ? i.envolvidos : []).map((u: string) => ({ usuario_id: u })),
    data_inicio: i.data_inicio ?? i.data_audiencia ?? i.data_vencimento ?? i.data_fatal ?? i.data ?? null,
  };
}

function ProcessoPainel({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["minhas-responsabilidades", "processo", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("processos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;
  if (!q.data) return <div className="p-6 text-sm text-muted-foreground">Processo não encontrado.</div>;
  return <ProcessoVisaoGeralForm processo={q.data} />;
}

function WorkflowPainel({ etapa }: { etapa: any }) {
  const q = useQuery({
    queryKey: ["minhas-responsabilidades", "workflow-etapas", etapa.workflows.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_etapas").select("id, titulo, ordem, tipo_item, dias_previsto").eq("workflow_id", etapa.workflows.id).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-muted-foreground">{etapa.workflows.coordenacoes?.nome ?? ""}{!etapa.workflows.ativo && " · Desabilitado"}</div>
      <div className="text-sm">Você está na etapa <b>{etapa.ordem}: {etapa.titulo}</b> como <b>{etapa._papel === "responsavel" ? "responsável" : "envolvido"}</b>.</div>
      <div className="divide-y rounded-md border">
        {(q.data ?? []).map((e) => (
          <div key={e.id} className={cn("p-2 text-sm flex gap-2", e.id === etapa.id && "bg-muted font-medium")}>
            <span className="w-8 text-muted-foreground">{e.ordem}</span>
            <span className="flex-1">{e.titulo}</span>
            <span className="text-xs text-muted-foreground">{e.tipo_item} · {e.dias_previsto}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const fmt = (raw?: string | null) => {
  if (!raw) return "—";
  try { return format(parseISO(raw), "dd/MM/yyyy"); } catch { return raw; }
};

export default function MinhasResponsabilidades() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const chaveFiltros = `minhas-resp:filtros:${user?.id ?? ""}`;
  const [pf, setPf] = useState<PainelFiltrosState>(() => {
    try {
      const salvo = localStorage.getItem(`minhas-resp:filtros:${user?.id ?? ""}`);
      return salvo ? { ...PAINEL_FILTROS_DEFAULT, ...JSON.parse(salvo) } : PAINEL_FILTROS_DEFAULT;
    } catch { return PAINEL_FILTROS_DEFAULT; }
  });
  useEffect(() => {
    try { localStorage.setItem(chaveFiltros, JSON.stringify(pf)); } catch { /* sem espaço */ }
  }, [chaveFiltros, JSON.stringify(pf)]);
  const [modoVista, setModoVista] = useState<"lista" | "simples" | "kanban" | "projuris" | "calendario">(
    () => (localStorage.getItem("minhas-resp:vista") as any) || "lista",
  );
  useEffect(() => { localStorage.setItem("minhas-resp:vista", modoVista); }, [modoVista]);
  const [mesCal, setMesCal] = useState(() => startOfMonth(new Date()));
  const coordSel = pf.verDeCoordenacao ?? "todas";
  const usuarioSel = isAdmin ? pf.verDeUsuario ?? "" : "";
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
  const queryClient = useQueryClient();
  const [itemSel, setItemSel] = useState<any | null>(null);
  const [procSel, setProcSel] = useState<any | null>(null);
  const [etapaSel, setEtapaSel] = useState<any | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [buscaProc, setBuscaProc] = useState("");
  const [statusProc, setStatusProc] = useState("todos");
  const [grupoAgenda, setGrupoAgenda] = useState<Exclude<GrupoAgendaResponsabilidade, null>>("hoje");

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
          let advogadoDe = new Set<string>();
          if (fonte === "audiencias" && r.linhas.length) {
            // A busca pessoal de audiências não traz a lista de advogados/envolvidos:
            // ela já vem filtrada pela pessoa; aqui só separamos responsável x envolvido.
            const ids = r.linhas.map((l: any) => l.id);
            for (let k = 0; k < ids.length; k += 200) {
              const { data } = await supabase.from("audiencias_advogados").select("audiencia_id").eq("advogado_id", uid).in("audiencia_id", ids.slice(k, k + 200));
              (data ?? []).forEach((x: any) => advogadoDe.add(x.audiencia_id));
            }
          }
          for (const l of r.linhas) {
            let papel = papelDoUsuario(l, uid);
            if (!papel && fonte === "audiencias") papel = advogadoDe.has(l.id) ? "responsavel" : "envolvido";
            if (!papel && fonte === "eventos") papel = l.criado_por === uid ? "responsavel" : "envolvido";
            if (!papel) continue;
            const extra = fonte === "audiencias"
              ? {
                  titulo: l.titulo || l.tipo_audiencia || "Audiência",
                  data_inicio: l.data_audiencia,
                  processo: l.processo ?? (l.processo_numero ? { id: l.processo_id, numero: l.processo_numero } : null),
                }
              : {};
            saida.push({ ...l, ...extra, _fonte: fonte, _papel: papel, _tipo: tipoDoItem(fonte, l) });
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

  const brutos = atividades.data ?? [];
  const itensAgendaFmt = useMemo(() => brutos.map(paraItemAgenda), [brutos]);
  const { data: mapaComentarios } = useItensComComentarios(itensAgendaFmt as any);
  const { data: itensDePub, isPending: pubCarregando } = useItensDePublicacao(itensAgendaFmt as any, true);
  const { data: mapaCobrancas } = useCobrancasItens(itensAgendaFmt as any, "minhas");
  const itens = useMemo(() => brutos.filter((raw, idx) => {
    const item: any = itensAgendaFmt[idx];
    if (pf.classificacoes.length > 0) {
      const t = raw._tipo === "tarefa" && String(raw.tipo_tarefa ?? "").toUpperCase() === "ATA" ? "ata" : raw._tipo;
      if (!pf.classificacoes.includes(t)) return false;
    }
    const rawId = getItemRawId(String(item.id));
    const origem = pf.origemPublicacao ?? "todas";
    // Enquanto os vínculos não chegam, não dá para separar a origem: esconde.
    if ((origem !== "todas" || pf.semVinculo) && pubCarregando && brutos.length > 0) return false;
    const dePub = itemVeioDePublicacao(item, !!itensDePub?.has(rawId));
    if (origem !== "todas" && (origem === "com" ? !dePub : dePub)) return false;
    if (pf.semVinculo && !itemSemProcessoEPublicacao(item, dePub)) return false;
    if (pf.comentarios !== "todas") {
      const tem = temComentarioItem(mapaComentarios as any, item);
      if (pf.comentarios === "com" ? !tem : tem) return false;
    }
    if (pf.cobrancas !== "todas") {
      const hoje = !!infoCobrancaItem(mapaCobrancas as any, item)?.hoje;
      if (pf.cobrancas === "hoje" ? !hoje : hoje) return false;
    }
    if (pf.statusGroup !== "todas") {
      const cancel = ["cancelado", "cancelado_oculto"].includes(String(item.status ?? ""));
      const concl = isItemTratado(item);
      if (pf.statusGroup === "a_concluir" && (concl || cancel)) return false;
      if (pf.statusGroup === "concluidas" && !concl) return false;
      if (pf.statusGroup === "canceladas" && !cancel) return false;
    }
    if (pf.situacoes.length > 0 && !pf.situacoes.some((v) => statusCasaSituacao(item.status, v))) return false;
    if (pf.souResponsavel && !pf.estouEnvolvido && raw._papel !== "responsavel") return false;
    if (pf.estouEnvolvido && !pf.souResponsavel && raw._papel !== "envolvido") return false;
    if (pf.responsavelIds.length > 0) {
      const ids = new Set<string>([item.responsavel_id, ...(item.responsaveis_ids ?? []), ...((item.participantes ?? []).map((p: any) => p.usuario_id))].filter(Boolean));
      if (!pf.responsavelIds.some((id) => ids.has(id))) return false;
    }
    if (pf.periodoInicio || pf.periodoFim) {
      let d: string | undefined;
      if (pf.periodoPorPublicacao) d = item.data_publicacao_origem ?? itensDePub?.get(rawId) ?? undefined;
      else if (pf.dataFatal && !pf.dataPrevista) d = raw.data_fatal ?? raw.data_vencimento ?? item.data_inicio;
      else d = raw.data_vencimento ?? raw.data_fatal ?? item.data_inicio;
      const dd = String(d ?? "").slice(0, 10);
      if (!dd) return false;
      if (pf.periodoInicio && dd < pf.periodoInicio) return false;
      if (pf.periodoFim && dd > pf.periodoFim) return false;
    }
    return true;
  }), [brutos, itensAgendaFmt, pf, itensDePub, pubCarregando, mapaComentarios, mapaCobrancas]);
  const contagem = useMemo(() => {
    const c: Record<StatusFiltro, number> = { todos: 0, pendentes: 0, atrasadas: 0, cumpridas: 0, cancelados: 0 };
    itens.forEach((i) => {
      if (tipo !== "todos" && i._tipo !== tipo) return;
      c.todos++;
      c[STATUS_PARA_FILTRO[classificarStatus(i)]]++;
    });
    return c;
  }, [itens, tipo]);

  const atividadesOpcoes = useMemo(
    () => agruparAtividadesDaAgenda(itens.filter((i) => tipo === "todos" || i._tipo === tipo).map((i: any) => ({ ...i, tipo: i._tipo }))),
    [itens, tipo],
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const sel = pf.atividadesSelecionadas ?? [];
    return itens
      .filter((i: any) => { if (sel.length === 0) return true; const a = chaveAtividade({ ...i, tipo: i._tipo }); return !!a && sel.includes(a.chave); })
      .filter((i) => tipo === "todos" || i._tipo === tipo)
      .filter((i) => filtro === "todos" || STATUS_PARA_FILTRO[classificarStatus(i)] === filtro)
      .filter((i) => !q || [i.titulo, i.processo?.numero, i.processo_numero, i.processo?.assunto, i.observacoes, i.descricao, i.partes_ativas, i.partes_passivas].some((v) => String(v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => String(a.data_fatal ?? a.data_vencimento ?? a.data_inicio ?? "").localeCompare(String(b.data_fatal ?? b.data_vencimento ?? b.data_inicio ?? "")));
  }, [itens, tipo, filtro, busca, pf.atividadesSelecionadas]);

  const agenda = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const grupos: Record<Exclude<GrupoAgendaResponsabilidade, null>, any[]> = { atrasadas: [], hoje: [], futuras: [] };
    filtrados.forEach((item) => {
      const grupo = grupoAgendaResponsabilidade(item, hoje);
      if (grupo) grupos[grupo].push(item);
    });
    return grupos;
  }, [filtrados]);

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

  const [aba, setAba] = useState("atividades");
  const hojeStr = format(new Date(), "yyyy-MM-dd");
  const qtdHoje = itens.filter((i) => grupoAgendaResponsabilidade(i, hojeStr) === "hoje").length;
  const resumo: { l: string; v: number; destaque?: boolean; ativo?: boolean; onClick: () => void }[] = [
    { l: "Hoje", v: qtdHoje, ativo: aba === "agenda" && grupoAgenda === "hoje", onClick: () => { setAba("agenda"); setGrupoAgenda("hoje"); } },
    { l: "Atrasadas", v: contagem.atrasadas, destaque: true, ativo: aba === "atividades" && filtro === "atrasadas", onClick: () => { setAba("atividades"); setFiltro("atrasadas"); } },
    { l: "Pendentes", v: contagem.pendentes, ativo: aba === "atividades" && filtro === "pendentes", onClick: () => { setAba("atividades"); setFiltro("pendentes"); } },
    { l: "Cumpridas", v: contagem.cumpridas, ativo: aba === "atividades" && filtro === "cumpridas", onClick: () => { setAba("atividades"); setFiltro("cumpridas"); } },
    { l: "Processos ativos", v: (processos.data ?? []).filter((p) => p.status === "ativo").length, ativo: aba === "processos", onClick: () => setAba("processos") },
    { l: "Etapas de workflow", v: workflows.data?.length ?? 0, ativo: aba === "workflows", onClick: () => setAba("workflows") },
  ];

  const exportarExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Minhas responsabilidades");
    ws.columns = [
      { header: "TIPO", width: 12 }, { header: "TÍTULO", width: 50 }, { header: "PROCESSO", width: 28 },
      { header: "DATA PREVISTA", width: 15 }, { header: "DATA FATAL", width: 15 }, { header: "SITUAÇÃO", width: 16 },
      { header: "MEU PAPEL", width: 14 }, { header: "OBSERVAÇÃO", width: 60 },
    ];
    filtrados.forEach((i: any) => ws.addRow([
      ROT_TIPO[i._tipo] ?? i._tipo, i.titulo ?? "", i.processo?.numero ?? i.processo_numero ?? "",
      fmt(i.data_vencimento ?? i.data_inicio), fmt(i.data_fatal), String(i.status ?? "").replace(/_/g, " "),
      i._papel === "responsavel" ? "Responsável" : "Envolvido", String(i.observacoes ?? i.descricao ?? "").replace(/<[^>]+>/g, ""),
    ]));
    ws.eachRow((row, n) => row.eachCell((c) => {
      c.font = { name: "Calibri", size: 11, bold: n === 1 };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }));
    ws.autoFilter = { from: "A1", to: "H1" };
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `Minhas_responsabilidades_${format(new Date(), "dd-MM-yyyy")}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const carregando = (q: { isLoading: boolean }) =>
    q.isLoading ? <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div> : null;

  const renderLinhaItem = (i: any) => {
    const st = classificarStatus(i);
    const riscado = ["cancelado", "protocolado", "baixado"].includes(String(i.status ?? ""));
    return (
      <button
        key={`${i._fonte}:${i.id}`}
        className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap items-center gap-2"
        onClick={() => setItemSel(paraItemAgenda(i))}
      >
        <Badge variant="outline">{ROT_TIPO[i._tipo]}</Badge>
        <span className={cn("font-medium flex-1 min-w-[200px]", riscado && "line-through", st === "cumprida" && !riscado && "text-primary")}>{i.titulo || "(sem título)"}</span>
        {i.processo?.numero && <span className="text-xs text-muted-foreground">{i.processo.numero}</span>}
        <span className="text-xs">{fmt(i.data_fatal ?? i.data_vencimento ?? i.data_inicio)}</span>
        <Badge variant={st === "atrasada" ? "destructive" : "secondary"}>{st === "pendente" ? "Pendente" : st === "atrasada" ? "Atrasada" : st === "cumprida" ? "Cumprida" : "Cancelada"}</Badge>
        <Badge variant={i._papel === "responsavel" ? "default" : "outline"}>{i._papel === "responsavel" ? "Responsável" : "Envolvido"}</Badge>
      </button>
    );
  };

  return (
    <MainLayout title="Minhas responsabilidades" subtitle="Tudo que está com você: atividades, processos e workflows">
      <div className="space-y-3">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {resumo.map((r) => (
            <button key={r.l} type="button" onClick={r.onClick} className="text-left">
              <Card className={cn("transition-colors hover:border-primary/60", r.ativo && "border-primary ring-1 ring-primary")}><CardContent className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{r.l}</div>
                <div className={cn("text-lg font-semibold", r.destaque && r.v > 0 && "text-destructive")}>{r.v}</div>
              </CardContent></Card>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <PainelFiltros
            filtros={pf}
            onChange={setPf}
            ocultarResponsaveis
            atividadesOpcoes={atividadesOpcoes}
            escopoPessoa={isAdmin ? { coordenacoes: coordenacoes.data ?? [], usuarios: (usuarios.data ?? []).filter((u) => u.id !== user?.id) } : undefined}
          />
          <span className="text-[11px] text-muted-foreground ml-auto">
            {isAdmin && usuarioSel
              ? `Vendo as responsabilidades de ${(usuarios.data ?? []).find((u) => u.id === usuarioSel)?.nome ?? "outra pessoa"}`
              : "Mostrando as suas responsabilidades"}
          </span>
        </div>
        {(atividadesOpcoes?.length ?? 0) > 0 && <div className="flex items-start gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground pt-1 whitespace-nowrap">Atividades:</span>
          <AtividadesDaAgendaChips compacto opcoes={atividadesOpcoes} selecionadas={pf.atividadesSelecionadas ?? []} onChange={(v) => setPf((s) => ({ ...s, atividadesSelecionadas: v }))} />
        </div>}
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="atividades">Atividades ({itens.length})</TabsTrigger>
            <TabsTrigger value="processos">Processos ({processos.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="workflows">Workflows ({workflows.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="space-y-3">
            <Segmento valor={grupoAgenda} onChange={setGrupoAgenda} opcoes={GRUPOS_AGENDA.map((g) => ({ v: g.v, l: `${g.l} (${agenda[g.v].length})` }))} />
            {carregando(atividades)}
            {atividades.error && <div className="text-destructive text-sm">Não foi possível carregar: {(atividades.error as Error).message}</div>}
            <Card><CardContent className="p-0 divide-y">
              {!atividades.isLoading && agenda[grupoAgenda].length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">Nenhuma atividade nesta visão.</div>
              )}
              {agenda[grupoAgenda].map(renderLinhaItem)}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="atividades" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
              <Segmento valor={filtro} onChange={setFiltro} opcoes={FILTROS.map((f) => ({ v: f.v, l: `${f.l} (${contagem[f.v]})` }))} />
              <Segmento valor={tipo} onChange={setTipo} opcoes={TIPOS.map((t) => ({ v: t, l: ROT_TIPO[t] }))} />
              <Segmento valor={periodo} onChange={setPeriodo} opcoes={PERIODOS.map((p) => ({ v: p.v, l: p.l }))} />
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-7 pl-7 text-xs" placeholder="Buscar título, processo, parte ou observação..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-xs text-muted-foreground"><b className="text-foreground">{filtrados.length}</b> de {brutos.length} itens filtrados</span>
              <div className="flex flex-wrap items-center gap-1">
                {([
                  ["lista", "Lista", LayoutList],
                  ["simples", "Compacta", Rows3],
                  ["kanban", "Kanban", Columns3],
                  ["calendario", "Calendário", CalendarDays],
                  ["projuris", "Atividades", ListChecks],
                ] as const).map(([v, l, Icon]) => (
                  <Button key={v} size="sm" variant={modoVista === v ? "default" : "ghost"} className="h-7 px-2 text-xs gap-1" onClick={() => setModoVista(v)}>
                    <Icon className="h-3.5 w-3.5" />{l}
                  </Button>
                ))}
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={exportarExcel} disabled={!filtrados.length}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                </Button>
              </div>
            </div>
            {carregando(atividades)}
            {atividades.error && <div className="text-destructive text-sm">Não foi possível carregar: {(atividades.error as Error).message}</div>}
            {modoVista === "lista" ? (
              <ListaAtividadesView embedded externalItems={filtrados.map(paraItemAgenda) as any} externalLoading={atividades.isLoading} />
            ) : modoVista === "kanban" ? (
              <KanbanItensAgenda itens={filtrados.map(paraItemAgenda) as any} onItemClick={(i: any) => setItemSel(i)} />
            ) : modoVista === "calendario" ? (
              <Card><CardContent className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMesCal((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm font-semibold capitalize">{format(mesCal, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMesCal((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden text-xs">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="bg-muted p-1 text-center font-medium">{d}</div>)}
                  {eachDayOfInterval({ start: startOfWeek(startOfMonth(mesCal)), end: endOfWeek(endOfMonth(mesCal)) }).map((dia) => {
                    const chave = format(dia, "yyyy-MM-dd");
                    const doDia = filtrados.filter((i: any) => String(i.data_fatal ?? i.data_vencimento ?? i.data_inicio ?? "").slice(0, 10) === chave);
                    return (
                      <div key={chave} className={cn("bg-background min-h-[90px] p-1", !isSameMonth(dia, mesCal) && "opacity-40")}>
                        <div className={cn("text-[11px] mb-0.5", isToday(dia) && "font-bold text-primary")}>{format(dia, "d")}</div>
                        <div className="space-y-0.5">
                          {doDia.slice(0, 4).map((i: any) => {
                            const st = classificarStatus(i);
                            return (
                              <button key={`${i._fonte}:${i.id}`} type="button" title={i.titulo} onClick={() => setItemSel(paraItemAgenda(i))}
                                className={cn("block w-full truncate rounded px-1 text-left text-[11px] border",
                                  st === "atrasada" ? "border-destructive/40 bg-destructive/10" : st === "cumprida" ? "border-primary/40 bg-primary/10" : "bg-muted/60",
                                  ["cancelado", "protocolado", "baixado"].includes(String(i.status ?? "")) && "line-through")}>
                                <b>{ROT_TIPO[i._tipo]?.charAt(0)}</b> {i.titulo || "(sem título)"}
                              </button>
                            );
                          })}
                          {doDia.length > 4 && <div className="text-[10px] text-muted-foreground">+{doDia.length - 4} mais</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>
            ) : modoVista === "projuris" ? (
              <ListaAtividadesProjuris itens={filtrados.map(paraItemAgenda) as any} onItemClick={(i: any) => setItemSel(i)} />
            ) : (
              <Card><CardContent className="p-0 divide-y">
                {!atividades.isLoading && filtrados.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhuma atividade.</div>}
                {filtrados.map(renderLinhaItem)}
              </CardContent></Card>
            )}
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
                <button key={p.id} className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap gap-2 items-center" onClick={() => setProcSel(p)}>
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
                <button key={e.id} className="w-full text-left p-3 hover:bg-muted/50 flex flex-wrap gap-2 items-center" onClick={() => setEtapaSel(e)}>
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

      <ItemDrawer open={!!itemSel} onOpenChange={(o) => !o && setItemSel(null)} titulo={itemSel?.titulo || "Detalhe do item"} subtitulo={itemSel?.processo?.numero ?? null}>
        {itemSel && (
          <div className="flex flex-col h-full">
            {itemSel.processo_id && (
              <div className="p-2 border-b flex justify-end">
                <Button size="sm" variant="outline" onClick={() => window.open(`/processos/${itemSel.processo_id}`, "_blank", "noopener")}><ExternalLink className="w-4 h-4 mr-1" />Abrir processo</Button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
              <EdicaoItemPanel
                key={itemSel.id}
                item={itemSel}
                hideHeader
                onClose={() => setItemSel(null)}
                onUpdate={() => { queryClient.invalidateQueries({ queryKey: ["minhas-responsabilidades"] }); }}
              />
            </div>
          </div>
        )}
      </ItemDrawer>

      <ItemDrawer open={!!procSel} onOpenChange={(o) => !o && setProcSel(null)} titulo={procSel?.clientes?.nome || "Resumo do processo"} subtitulo={procSel?.numero ?? null}>
        {procSel && (
          <ProcessoItensLateral
            key={procSel.id}
            processoId={procSel.id}
            processoNumero={procSel.numero || ""}
            hideHeader
            onClose={() => setProcSel(null)}
            onNavigate={(id) => window.open(`/processos/${id}`, "_blank", "noopener")}
          />
        )}
      </ItemDrawer>

      <ItemDrawer open={!!etapaSel} onOpenChange={(o) => !o && setEtapaSel(null)} titulo={etapaSel?.workflows?.nome || "Workflow"} subtitulo={null}>
        {etapaSel && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b flex justify-end">
              <Button size="sm" onClick={() => navigate(`/workflow?id=${etapaSel.workflows.id}`)}><ExternalLink className="w-4 h-4 mr-1" />Abrir workflow</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto"><WorkflowPainel etapa={etapaSel} /></div>
          </div>
        )}
      </ItemDrawer>
    </MainLayout>
  );
}
