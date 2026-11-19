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
import { estadoListaAoAbrirResumo, grupoAgendaResponsabilidade, papelDoUsuario, type GrupoAgendaResponsabilidade, type PapelItem } from "@/lib/minhasResponsabilidades";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, LayoutList, Columns3, ListChecks, Rows3, FileSpreadsheet, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TratadoCheck, isItemRiscado, isItemConcluidoComSucesso } from "@/components/shared/TratadoCheck";
import { AnexoBadge } from "@/components/comum/AnexoBadge";
import { ComentarioBadge } from "@/components/comum/ComentarioBadge";
import { CobrancaBadge } from "@/components/comum/CobrancaBadge";
import { WorkflowBadge } from "@/components/comum/WorkflowBadge";
import { PublicacaoBadge } from "@/components/comum/PublicacaoBadge";
import { useItensDeWorkflow } from "@/hooks/useItensDeWorkflow";
import { tituloCobranca } from "@/hooks/useCobrancasItens";
import { autoriaComentarioItem } from "@/hooks/useItensComComentarios";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { exportarWorkflowsExcel } from "@/lib/exportWorkflowsExcel";
import { selecionarExecucoesExcel, REGRA_RESPONSAVEL } from "@/lib/workflowsResponsabilidade";

const fmtDataBRT = (iso?: string | null) => iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "—";
const TIPO_ROTULO: Record<string, string> = { PRAZO: "Prazo", TAREFA: "Tarefa", EVENTO: "Evento", AUDIENCIA: "Audiência", ATA: "Ata" };

const CAL_CORES: Record<string, string> = {
  evento: "bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 text-green-700 dark:text-green-300",
  tarefa: "bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  prazo: "bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300",
  audiencia: "bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
  ata: "bg-violet-50 dark:bg-violet-950/40 border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300",
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function FiltroSelect({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: { v: string; l: string }[]; valor: string; onChange: (v: any) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{rotulo}</span>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[180px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{opcoes.map((o) => <SelectItem key={o.v} value={o.v} className="text-sm">{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

/** Caixa de escolha compacta: rótulo e seletor na mesma linha, para caber na barra das abas. */
function FiltroInline({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: { v: string; l: string }[]; valor: string; onChange: (v: any) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{rotulo}</span>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{opcoes.map((o) => <SelectItem key={o.v} value={o.v} className="text-sm">{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

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
import { ProcessoVisaoGeralForm } from "@/components/processos/ProcessoVisaoGeralForm";
import { cn } from "@/lib/utils";
import { agruparAtividadesDaAgenda, chaveAtividade } from "@/lib/atividadesDaAgenda";
import { PainelFiltros, PAINEL_FILTROS_DEFAULT, type PainelFiltrosState } from "@/components/painel/PainelFiltros";
import { statusCasaSituacao } from "@/hooks/useSituacoesPainel";
import { useItensComComentarios, temComentarioItem } from "@/hooks/useItensComComentarios";
import { useItensDePublicacao } from "@/hooks/useItensDePublicacao";
import { useCobrancasItens, infoCobrancaItem } from "@/hooks/useCobrancasItens";
import { getItemRawId } from "@/hooks/useItensComAtividades";
import { isItemTratado } from "@/components/shared/TratadoCheck";
import { itemSemProcessoEPublicacao, itemVeioDePublicacao } from "@/lib/vinculoItem";
import { ItemCalendarioResponsabilidade } from "@/components/minhas-responsabilidades/ItemCalendarioResponsabilidade";
import { ListaDiaResponsabilidade } from "@/components/minhas-responsabilidades/ListaDiaResponsabilidade";
import { AcompanhamentoEspecialBadge } from "@/components/comum/AcompanhamentoEspecialBadge";
import { useProcessosAcompanhamento } from "@/hooks/useProcessosAcompanhamento";
import { itemEmAcompanhamentoEspecial } from "@/lib/acompanhamentoEspecialItem";

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
    queryKey: ["minhas-responsabilidades", "workflow-etapas-detalhe", etapa.workflows.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_etapas")
        .select("id, titulo, ordem, tipo_item, dias_previsto, dias_fatal, tipo_prazo, prioridade, regra_responsavel, responsavel_id, descricao, etapa_anterior_id, condicao")
        .eq("workflow_id", etapa.workflows.id).order("ordem");
      if (error) throw error;
      const etapas = data ?? [];
      const ids = etapas.map((e: any) => e.id);
      const [r, en] = ids.length ? await Promise.all([
        supabase.from("workflow_etapa_responsaveis").select("etapa_id, usuario_id").in("etapa_id", ids),
        supabase.from("workflow_etapa_envolvidos").select("etapa_id, usuario_id").in("etapa_id", ids),
      ]) : [{ data: [] }, { data: [] }] as any;
      const { data: exs } = await supabase.from("workflow_execucoes").select("id, processo_id, created_at, iniciado_por").eq("workflow_id", etapa.workflows.id).eq("status", "em_andamento").limit(500);
      const exIds = (exs ?? []).map((x: any) => x.id);
      const paradas: any[] = [];
      for (let k = 0; k < exIds.length; k += 100) {
        const { data: d } = await supabase.from("workflow_execucao_etapas").select("etapa_id, execucao_id, data_prevista_calculada, data_fatal_calculada").in("execucao_id", exIds.slice(k, k + 100)).eq("status", "materializada");
        paradas.push(...(d ?? []));
      }
      const procIds = [...new Set((exs ?? []).map((x: any) => x.processo_id).filter(Boolean))];
      const procs = new Map<string, string>();
      for (let k = 0; k < procIds.length; k += 100) {
        const { data: d } = await supabase.from("processos").select("id, numero").in("id", procIds.slice(k, k + 100));
        (d ?? []).forEach((p: any) => procs.set(p.id, p.numero));
      }
      const pessoas = [...new Set([...(r.data ?? []), ...(en.data ?? [])].map((x: any) => x.usuario_id).concat(etapas.map((e: any) => e.responsavel_id), (exs ?? []).map((x: any) => x.iniciado_por)).filter(Boolean))];
      const nomes = new Map<string, string>();
      for (let k = 0; k < pessoas.length; k += 100) {
        const { data: d } = await (supabase as any).from("profiles_basic").select("id, nome").in("id", pessoas.slice(k, k + 100));
        (d ?? []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      const listar = (rows: any[], id: string) => rows.filter((x) => x.etapa_id === id).map((x) => nomes.get(x.usuario_id)).filter(Boolean) as string[];
      const exMap = new Map((exs ?? []).map((x: any) => [x.id, x]));
      return etapas.map((e: any) => ({
        ...e,
        _resp: [...new Set([...(e.responsavel_id && nomes.get(e.responsavel_id) ? [nomes.get(e.responsavel_id)!] : []), ...listar(r.data ?? [], e.id)])],
        _env: listar(en.data ?? [], e.id),
        _anterior: etapas.find((x: any) => x.id === e.etapa_anterior_id)?.titulo ?? null,
        _fluxos: paradas.filter((p) => p.etapa_id === e.id).map((p) => {
          const ex: any = exMap.get(p.execucao_id);
          return { ...p, processo: ex?.processo_id ? procs.get(ex.processo_id) : null, inicio: ex?.created_at, iniciador: nomes.get(ex?.iniciado_por) };
        }),
      }));
    },
  });
  const Campo = ({ l, v }: { l: string; v: any }) => (
    <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div><div className="text-xs">{v || "—"}</div></div>
  );
  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-muted-foreground">{etapa.workflows.coordenacoes?.nome ?? ""}{!etapa.workflows.ativo && " · Desabilitado"}</div>
      <div className="text-sm">Você está na etapa <b>{etapa.ordem}: {etapa.titulo}</b> como <b>{etapa._papel === "responsavel" ? "responsável" : "envolvido"}</b>.</div>
      {q.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {(q.data ?? []).map((e: any) => {
        const tipo = String(e.tipo_item ?? "").toUpperCase();
        return (
          <div key={e.id} className={cn("rounded-md border p-3 space-y-2", e.id === etapa.id && "border-primary bg-muted/40")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa {e.ordem}</span>
              <span className="font-medium text-sm flex-1">{e.titulo}</span>
              {tipo && <span className={cn("px-1.5 py-0.5 rounded text-xs", CAL_CORES[tipo === "ATA" ? "ata" : tipo.toLowerCase()] ?? "bg-muted")}>{TIPO_ROTULO[tipo] ?? tipo}</span>}
              {e.id === etapa.id && <Badge>Sua etapa</Badge>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Campo l="Dias previstos" v={e.dias_previsto != null ? `${e.dias_previsto} dia(s)` : null} />
              <Campo l="Dias fatais" v={e.dias_fatal != null ? `${e.dias_fatal} dia(s)` : null} />
              <Campo l="Contagem" v={String(e.tipo_prazo).includes("uteis") ? "Dias úteis" : String(e.tipo_prazo).includes("corridos") ? "Dias corridos" : e.tipo_prazo} />
              <Campo l="Prioridade" v={e.prioridade ? String(e.prioridade).replace(/^./, (c: string) => c.toUpperCase()) : null} />
              <Campo l="Regra de responsável" v={REGRA_RESPONSAVEL[e.regra_responsavel]} />
              <Campo l="Depois de" v={e._anterior} />
              <Campo l="Responsáveis" v={e._resp.join(", ")} />
              <Campo l="Envolvidos" v={e._env.join(", ")} />
            </div>
            {e.descricao && <div className="text-xs whitespace-pre-wrap border-t pt-2"><span className="text-muted-foreground">Descrição: </span>{e.descricao}</div>}
            {e._fluxos.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fluxos parados nesta etapa ({e._fluxos.length})</div>
                {e._fluxos.map((f: any) => (
                  <div key={f.execucao_id} className="text-xs flex flex-wrap gap-x-3">
                    <b>{f.processo || "(sem processo)"}</b>
                    <span>Início: {fmtDataBRT(f.inicio)}{f.iniciador ? ` por ${f.iniciador}` : ""}</span>
                    <span>Limite: {f.data_prevista_calculada ? fmt(f.data_prevista_calculada) : "—"}</span>
                    <span>Fatal: {f.data_fatal_calculada ? fmt(f.data_fatal_calculada) : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
  const [diaSel, setDiaSel] = useState<Date | null>(null);
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
          const advogadoDe = new Set<string>();
          const envolvidoDe = new Set<string>();
          if ((fonte === "audiencias" || fonte === "eventos") && r.linhas.length) {
            // Confere nas listas de pessoas: só entra quem é responsável ou envolvido de fato.
            const ids = r.linhas.map((l: any) => l.id);
            const [tResp, cResp, tEnv, cEnv] = fonte === "audiencias"
              ? ["audiencias_advogados", "advogado_id", "audiencia_envolvidos", "audiencia_id"]
              : ["evento_responsaveis", "evento_id", "evento_envolvidos", "evento_id"];
            const colItem = fonte === "audiencias" ? "audiencia_id" : "evento_id";
            for (let k = 0; k < ids.length; k += 200) {
              const lote = ids.slice(k, k + 200);
              const [a, b] = await Promise.all([
                (supabase as any).from(tResp).select(colItem).eq(fonte === "audiencias" ? cResp : "usuario_id", uid).in(colItem, lote),
                (supabase as any).from(tEnv).select(cEnv).eq("usuario_id", uid).in(cEnv, lote),
              ]);
              (a.data ?? []).forEach((x: any) => advogadoDe.add(x[colItem]));
              (b.data ?? []).forEach((x: any) => envolvidoDe.add(x[cEnv]));
            }
          }
          for (const l of r.linhas) {
            let papel = papelDoUsuario(l, uid);
            if (!papel && (fonte === "audiencias" || fonte === "eventos")) {
              papel = advogadoDe.has(l.id) ? "responsavel" : envolvidoDe.has(l.id) ? "envolvido" : null;
            }
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
      const sel = "etapa_id, workflow_etapas:etapa_id(id, titulo, ordem, responsavel_id, tipo_item, dias_previsto, dias_fatal, regra_responsavel, workflows:workflow_id(id, nome, ativo, arquivado_em, coordenacao_id, coordenacoes:coordenacao_id(nome), workflow_etapas(count)))";
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

  const [wfBusca, setWfBusca] = useState("");
  const [wfPapel, setWfPapel] = useState<"todos" | PapelItem>("todos");
  const [gerandoWf, setGerandoWf] = useState(false);
  const wfIds = useMemo(() => [...new Set((workflows.data ?? []).map((e: any) => e.workflows.id))].sort(), [workflows.data]);
  const wfExecucoes = useQuery({
    queryKey: ["minhas-responsabilidades", "workflow-execucoes", uid, JSON.stringify(wfIds)],
    enabled: !!uid && !workflows.isLoading,
    queryFn: async () => {
      const sel = "*, workflow:workflows(id, nome, coordenacao:coordenacoes(id, nome))";
      const out: any[] = [];
      for (let i = 0; i < wfIds.length; i += 100) {
        const { data, error } = await supabase.from("workflow_execucoes").select(sel).in("workflow_id", wfIds.slice(i, i + 100)).order("created_at", { ascending: false }).limit(5000);
        if (error) throw error;
        out.push(...(data ?? []));
      }
      const { data: ini, error: e2 } = await supabase.from("workflow_execucoes").select(sel).eq("iniciado_por", uid).limit(5000);
      if (e2) throw e2;
      out.push(...(ini ?? []));
      const emAndamento = [...new Set(out.filter((x) => x.status === "em_andamento").map((x) => x.id))];
      const paradas: any[] = [];
      for (let i = 0; i < emAndamento.length; i += 100) {
        const { data, error } = await supabase.from("workflow_execucao_etapas").select("etapa_id, execucao_id").in("execucao_id", emAndamento.slice(i, i + 100)).eq("status", "materializada");
        if (error) throw error;
        paradas.push(...(data ?? []));
      }
      return { execucoes: out, paradas };
    },
  });
  const wfEtapaIds = useMemo(() => (workflows.data ?? []).map((e: any) => e.id).sort(), [workflows.data]);
  const wfPessoas = useQuery({
    queryKey: ["minhas-responsabilidades", "workflow-etapa-pessoas", JSON.stringify(wfEtapaIds)],
    enabled: wfEtapaIds.length > 0,
    queryFn: async () => {
      const resp: any[] = [], env: any[] = [];
      for (let i = 0; i < wfEtapaIds.length; i += 100) {
        const lote = wfEtapaIds.slice(i, i + 100);
        const [r, e] = await Promise.all([
          supabase.from("workflow_etapa_responsaveis").select("etapa_id, usuario_id").in("etapa_id", lote),
          supabase.from("workflow_etapa_envolvidos").select("etapa_id, usuario_id").in("etapa_id", lote),
        ]);
        if (r.error) throw r.error;
        if (e.error) throw e.error;
        resp.push(...(r.data ?? [])); env.push(...(e.data ?? []));
      }
      const fixos = (workflows.data ?? []).map((x: any) => x.responsavel_id).filter(Boolean);
      const ids = [...new Set([...resp, ...env].map((x) => x.usuario_id).concat(fixos))];
      const nomes = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await (supabase as any).from("profiles_basic").select("id, nome").in("id", ids.slice(i, i + 100));
        (data ?? []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      const porEtapa = (rows: any[]) => {
        const m = new Map<string, string[]>();
        rows.forEach((x) => { const n = nomes.get(x.usuario_id); if (n) m.set(x.etapa_id, [...(m.get(x.etapa_id) ?? []), n]); });
        return m;
      };
      return { resp: porEtapa(resp), env: porEtapa(env), nomes };
    },
  });
  const wfStats = useMemo(() => {
    const porWf = new Map<string, { andamento: number; ultima: string | null }>();
    const vistos = new Set<string>();
    (wfExecucoes.data?.execucoes ?? []).forEach((x: any) => {
      if (vistos.has(x.id)) return; vistos.add(x.id);
      const s = porWf.get(x.workflow_id) ?? { andamento: 0, ultima: null };
      if (x.status === "em_andamento") s.andamento++;
      if (!s.ultima || x.created_at > s.ultima) s.ultima = x.created_at;
      porWf.set(x.workflow_id, s);
    });
    const porEtapa = new Map<string, number>();
    (wfExecucoes.data?.paradas ?? []).forEach((p: any) => porEtapa.set(p.etapa_id, (porEtapa.get(p.etapa_id) ?? 0) + 1));
    return { porWf, porEtapa };
  }, [wfExecucoes.data]);
  const wfFiltrados = useMemo(() => {
    const t = wfBusca.trim().toLowerCase();
    return (workflows.data ?? []).filter((e: any) => (wfPapel === "todos" || e._papel === wfPapel) && (!t || `${e.workflows.nome} ${e.titulo}`.toLowerCase().includes(t)));
  }, [workflows.data, wfBusca, wfPapel]);
  const wfExcel = useMemo(() => selecionarExecucoesExcel(wfExecucoes.data?.execucoes ?? [], wfFiltrados.map((e: any) => e.workflows.id), uid, !wfBusca.trim() && wfPapel === "todos"), [wfExecucoes.data, wfFiltrados, uid, wfBusca, wfPapel]);
  const gerarExcelWf = async () => {
    setGerandoWf(true);
    try {
      const nomes: Record<string, string> = {};
      wfExcel.forEach((x: any) => { if (x.workflow?.coordenacao) nomes[x.workflow.coordenacao.id] = x.workflow.coordenacao.nome; });
      await exportarWorkflowsExcel(wfExcel, nomes, {});
    } catch (e: any) {
      toast.error("Erro ao gerar Excel: " + (e?.message || e));
    } finally { setGerandoWf(false); }
  };

  const brutos = atividades.data ?? [];
  const itensAgendaFmt = useMemo(() => brutos.map(paraItemAgenda), [brutos]);
  const { data: mapaComentarios } = useItensComComentarios(itensAgendaFmt as any);
  const { data: itensDePub, isPending: pubCarregando } = useItensDePublicacao(itensAgendaFmt as any, true);
  const { data: mapaCobrancas } = useCobrancasItens(itensAgendaFmt as any, "minhas");
  const { data: itensDeWorkflow = new Set<string>() } = useItensDeWorkflow(itensAgendaFmt as any);
  // Processos em Acompanhamento Especial entre os itens carregados: define onde
  // mostrar a bolinha vermelha "A".
  const { data: processosAcompanhados = new Set<string>() } = useProcessosAcompanhamento(itensAgendaFmt as any);
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
  // Os cartões resumem todos os tipos; os filtros da lista são limpos ao abrir um cartão.
  const contagemResumo = useMemo(() => {
    const c: Record<StatusFiltro, number> = { todos: 0, pendentes: 0, atrasadas: 0, cumpridas: 0, cancelados: 0 };
    itens.forEach((i) => {
      c.todos++;
      c[STATUS_PARA_FILTRO[classificarStatus(i)]]++;
    });
    return c;
  }, [itens]);

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
  const abrirResumo = (destino: "agenda" | "atividades", situacao: StatusFiltro = "todos") => {
    const proximo = estadoListaAoAbrirResumo(situacao);
    setFiltro(proximo.filtro);
    setTipo(proximo.tipo);
    setBusca(proximo.busca);
    setPf((atual) => ({ ...atual, atividadesSelecionadas: proximo.atividadesSelecionadas }));
    setAba(destino);
    if (destino === "agenda") setGrupoAgenda("hoje");
  };
  const resumo: { l: string; v: number; destaque?: boolean; ativo?: boolean; onClick: () => void }[] = [
    { l: "Hoje", v: qtdHoje, ativo: aba === "agenda" && grupoAgenda === "hoje", onClick: () => abrirResumo("agenda") },
    { l: "Atrasadas", v: contagemResumo.atrasadas, destaque: true, ativo: aba === "atividades" && filtro === "atrasadas", onClick: () => abrirResumo("atividades", "atrasadas") },
    { l: "Pendentes", v: contagemResumo.pendentes, ativo: aba === "atividades" && filtro === "pendentes", onClick: () => abrirResumo("atividades", "pendentes") },
    { l: "Cumpridas", v: contagemResumo.cumpridas, ativo: aba === "atividades" && filtro === "cumpridas", onClick: () => abrirResumo("atividades", "cumpridas") },
    { l: "Processos", v: (processos.data ?? []).filter((p) => p.status === "ativo").length, ativo: aba === "processos", onClick: () => setAba("processos") },
    { l: "Workflows", v: workflows.data?.length ?? 0, ativo: aba === "workflows", onClick: () => setAba("workflows") },
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
        {itemEmAcompanhamentoEspecial(i, processosAcompanhados) && <AcompanhamentoEspecialBadge />}
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

        <Tabs value={aba} onValueChange={setAba}>
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="atividades">Atividades ({itens.length})</TabsTrigger>
              <TabsTrigger value="processos">Processos ({processos.data?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="workflows">Workflows ({workflows.data?.length ?? 0})</TabsTrigger>
            </TabsList>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <PainelFiltros
                filtros={pf}
                onChange={setPf}
                ocultarResponsaveis
                atividadesOpcoes={atividadesOpcoes}
              />
              {isAdmin ? (
                <>
                  <FiltroInline rotulo="Coordenação" valor={coordSel}
                    onChange={(v: string) => setPf((st) => ({ ...st, verDeCoordenacao: v, verDeUsuario: "" }))}
                    opcoes={[{ v: "todas", l: "Todas" }, ...(coordenacoes.data ?? []).map((c: any) => ({ v: c.id, l: c.nome }))]} />
                  <FiltroInline rotulo="Ver como" valor={usuarioSel || "__eu"}
                    onChange={(v: string) => setPf((st) => ({ ...st, verDeUsuario: v === "__eu" ? "" : v }))}
                    opcoes={[{ v: "__eu", l: "Eu mesmo" }, ...(usuarios.data ?? []).filter((u: any) => u.id !== user?.id).map((u: any) => ({ v: u.id, l: u.nome }))]} />
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Mostrando as suas responsabilidades</span>
              )}
            </div>
          </div>

          <TabsContent value="agenda" className="space-y-3">
            <FiltroSelect rotulo="Mostrar" valor={grupoAgenda} onChange={setGrupoAgenda} opcoes={GRUPOS_AGENDA.map((g) => ({ v: g.v, l: `${g.l} (${agenda[g.v].length})` }))} />
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
            <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
              <FiltroSelect rotulo="Situação" valor={filtro} onChange={setFiltro} opcoes={FILTROS.map((f) => ({ v: f.v, l: `${f.l} (${contagem[f.v]})` }))} />
              <FiltroSelect rotulo="Tipo" valor={tipo} onChange={setTipo} opcoes={TIPOS.map((t) => ({ v: t, l: ROT_TIPO[t] }))} />
              {atividadesOpcoes.length > 0 && (
                <FiltroSelect rotulo="Atividade" valor={(pf.atividadesSelecionadas ?? [])[0] ?? "__todas"}
                  onChange={(v: string) => setPf((st) => ({ ...st, atividadesSelecionadas: v === "__todas" ? [] : [v] }))}
                  opcoes={[{ v: "__todas", l: "Todas" }, ...atividadesOpcoes.map((o) => ({ v: o.chave, l: `${o.nome} (${o.quantidade})` }))]} />
              )}
              <FiltroSelect rotulo="Período" valor={periodo} onChange={setPeriodo} opcoes={PERIODOS.map((p) => ({ v: p.v, l: p.l }))} />
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 pl-8 text-sm" placeholder="Buscar título, processo, parte ou observação..." value={busca} onChange={(e) => setBusca(e.target.value)} />
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
              <ListaAtividadesView
                embedded
                externalItems={filtrados.map(paraItemAgenda) as any}
                externalLoading={atividades.isLoading}
                onItemClick={setItemSel}
                processosAcompanhados={processosAcompanhados}
              />
            ) : modoVista === "kanban" ? (
              <KanbanItensAgenda itens={filtrados.map(paraItemAgenda) as any} onItemClick={(i: any) => setItemSel(i)} processosAcompanhados={processosAcompanhados} />
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
                      <div key={chave} role="button" title="Ver todas as atividades do dia" onClick={() => setDiaSel(dia)} className={cn("bg-background min-h-[90px] p-1 cursor-pointer hover:bg-muted/40", !isSameMonth(dia, mesCal) && "opacity-40")}>
                        <div className={cn("text-[11px] mb-0.5", isToday(dia) && "font-bold text-primary")}>{format(dia, "d")}</div>
                        <div className="space-y-0.5">
                          {doDia.slice(0, 5).map((raw: any) => {
                            const item: any = paraItemAgenda(raw);
                            const rid = getItemRawId(item.id);
                            const cancelado = ["cancelado", "cancelado_oculto"].includes(String(item.status ?? ""));
                            const sucesso = isItemConcluidoComSucesso(item);
                            const cob = infoCobrancaItem(mapaCobrancas as any, item);
                            const corKey = String(item.tipo_tarefa ?? "").toUpperCase().trim() === "ATA" ? "ata" : item.tipo;
                            return (
                              <button key={`${raw._fonte}:${raw.id}`} type="button" title={item.titulo} onClick={(e) => { e.stopPropagation(); setItemSel(item); }}
                                className={cn("w-full text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium flex items-center gap-0.5 text-left",
                                  cancelado ? "bg-muted border border-foreground/60 text-foreground"
                                    : sucesso ? "bg-emerald-700/20 border border-emerald-700 text-emerald-800 dark:text-emerald-300"
                                    : CAL_CORES[corKey] || "bg-muted border border-border text-muted-foreground")}>
                                {isItemTratado(item) ? <TratadoCheck tratado size={10} className="text-green-600 dark:text-green-400" /> : <FileText className="w-2.5 h-2.5 flex-shrink-0 opacity-90" />}
                                <span className={cn("truncate", (isItemRiscado(item) || cancelado) && "line-through")}>{item.titulo || "(sem título)"}</span>
                                {(item.anexos_count ?? 0) > 0 && <AnexoBadge className="w-3.5 h-3.5 ml-0.5" />}
                                {itensDeWorkflow.has(rid) && <WorkflowBadge className="w-3.5 h-3.5 text-[8px] ml-0.5" />}
                                {!!itensDePub?.has(rid) && <PublicacaoBadge className="w-3.5 h-3.5 text-[8px] ml-0.5" />}
                                {temComentarioItem(mapaComentarios as any, item) && <ComentarioBadge className="w-3.5 h-3.5 text-[8px] ml-0.5" autoria={autoriaComentarioItem(mapaComentarios as any, item)} />}
                                {itemEmAcompanhamentoEspecial(item, processosAcompanhados) && <AcompanhamentoEspecialBadge className="w-3.5 h-3.5 text-[8px] ml-0.5" />}
                                {cob && <CobrancaBadge simbolo={cob.simbolo} hoje={cob.hoje} title={tituloCobranca(cob)} className="w-3.5 h-3.5 text-[8px] ml-0.5" />}
                              </button>
                            );
                          })}
                          {doDia.length > 5 && <button type="button" onClick={(e) => { e.stopPropagation(); setDiaSel(dia); }} className="text-[10px] text-primary hover:underline">+{doDia.length - 5} mais</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>
            ) : modoVista === "projuris" ? (
              <ListaAtividadesProjuris itens={filtrados.map(paraItemAgenda) as any} onItemClick={(i: any) => setItemSel(i)} processosAcompanhados={processosAcompanhados} />
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={wfBusca} onChange={(ev) => setWfBusca(ev.target.value)} placeholder="Buscar workflow ou etapa" className="h-8 w-[240px] pl-7 text-sm" />
              </div>
              <FiltroInline rotulo="Papel" valor={wfPapel} onChange={setWfPapel}
                opcoes={[{ v: "todos", l: "Todos" }, { v: "responsavel", l: "Responsável" }, { v: "envolvido", l: "Envolvido" }]} />
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={gerarExcelWf} disabled={gerandoWf || wfExecucoes.isLoading || wfExcel.length === 0}>
                {gerandoWf || wfExecucoes.isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
                {gerandoWf ? "Gerando..." : `Gerar Excel (${wfExcel.length})`}
              </Button>
            </div>
            <Card><CardContent className="p-0 divide-y">
              {!workflows.isLoading && wfFiltrados.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhuma etapa de workflow.</div>}
              {wfFiltrados.map((e: any) => {
                const tipo = String(e.tipo_item ?? "").toUpperCase();
                const corTipo = CAL_CORES[tipo === "ATA" ? "ata" : tipo.toLowerCase()] ?? "bg-muted text-muted-foreground border";
                const total = e.workflows.workflow_etapas?.[0]?.count;
                const st = wfStats.porWf.get(e.workflows.id);
                const parados = wfStats.porEtapa.get(e.id) ?? 0;
                return (
                  <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-muted/50 flex flex-col gap-1" onClick={() => setEtapaSel(e)}>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium">{e.workflows.nome}</span>
                      <span className="text-sm flex-1">Etapa {e.ordem}{total ? ` de ${total}` : ""}: {e.titulo}</span>
                      <span className="text-xs text-muted-foreground">{e.workflows.coordenacoes?.nome ?? ""}</span>
                      {!e.workflows.ativo && <Badge variant="outline">Desabilitado</Badge>}
                      <Badge variant={e._papel === "responsavel" ? "default" : "outline"}>{e._papel === "responsavel" ? "Responsável" : "Envolvido"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-xs text-muted-foreground">
                      {tipo && <span className={`px-1.5 py-0.5 rounded ${corTipo}`}>{TIPO_ROTULO[tipo] ?? tipo}</span>}
                      <span>Previsto: {e.dias_previsto ?? "—"} dia(s)</span>
                      <span>Fatal: {e.dias_fatal ?? "—"} dia(s)</span>
                      <span>Responsável: {REGRA_RESPONSAVEL[e.regra_responsavel] ?? "—"}</span>
                      <span>Em andamento: <b className="text-foreground">{st?.andamento ?? 0}</b></span>
                      <span>Nesta etapa agora: <b className="text-foreground">{parados}</b></span>
                      <span>Último início: {fmtDataBRT(st?.ultima)}</span>
                    </div>
                    {(() => {
                      const fixo = e.responsavel_id ? wfPessoas.data?.nomes.get(e.responsavel_id) : null;
                      const resp = [...new Set([...(fixo ? [fixo] : []), ...(wfPessoas.data?.resp.get(e.id) ?? [])])];
                      const env = wfPessoas.data?.env.get(e.id) ?? [];
                      return (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span><span className="text-muted-foreground">Responsáveis:</span> <b>{resp.length ? resp.join(", ") : wfPessoas.isLoading ? "carregando..." : "—"}</b></span>
                          {env.length > 0 && <span><span className="text-muted-foreground">Envolvidos:</span> {env.join(", ")}</span>}
                        </div>
                      );
                    })()}
                  </button>
                );
              })}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <ListaDiaResponsabilidade
        dia={diaSel}
        itens={diaSel ? filtrados.filter((i: any) => String(i.data_fatal ?? i.data_vencimento ?? i.data_inicio ?? "").slice(0, 10) === format(diaSel, "yyyy-MM-dd")).map(paraItemAgenda) : []}
        onClose={() => setDiaSel(null)}
        onAbrirItem={(item) => setItemSel(item)}
        classeCor={(item: any) => {
          const cancelado = ["cancelado", "cancelado_oculto"].includes(String(item.status ?? ""));
          if (cancelado) return "bg-muted border-foreground/60";
          if (isItemConcluidoComSucesso(item)) return "bg-emerald-700/10 border-emerald-700";
          const corKey = String(item.tipo_tarefa ?? "").toUpperCase().trim() === "ATA" ? "ata" : item.tipo;
          return CAL_CORES[corKey] || "bg-muted border-border";
        }}
        renderMarcas={(item: any) => {
          const rid = getItemRawId(item.id);
          const cob = infoCobrancaItem(mapaCobrancas as any, item);
          return (<>
            {isItemTratado(item) && <TratadoCheck tratado size={12} className="text-green-600 dark:text-green-400" />}
            {(item.anexos_count ?? 0) > 0 && <AnexoBadge className="w-4 h-4" />}
            {itensDeWorkflow.has(rid) && <WorkflowBadge className="w-4 h-4 text-[9px]" />}
            {!!itensDePub?.has(rid) && <PublicacaoBadge className="w-4 h-4 text-[9px]" />}
            {temComentarioItem(mapaComentarios as any, item) && <ComentarioBadge className="w-4 h-4 text-[9px]" autoria={autoriaComentarioItem(mapaComentarios as any, item)} />}
            {itemEmAcompanhamentoEspecial(item, processosAcompanhados) && <AcompanhamentoEspecialBadge className="w-4 h-4 text-[9px]" />}
            {cob && <CobrancaBadge simbolo={cob.simbolo} hoje={cob.hoje} title={tituloCobranca(cob)} className="w-4 h-4 text-[9px]" />}
          </>);
        }}
      />

      <ItemCalendarioResponsabilidade
        item={itemSel}
        onClose={() => setItemSel(null)}
        onUpdate={async () => {
          await queryClient.invalidateQueries({ queryKey: ["minhas-responsabilidades"] });
        }}
        onItemChange={(itemAtualizado) => {
          setItemSel((atual) => atual?.id === itemAtualizado.id ? itemAtualizado : atual);
        }}
      />

      <ItemDrawer
        open={!!procSel}
        onOpenChange={(o) => !o && setProcSel(null)}
        titulo={procSel?.clientes?.nome || "Resumo do processo"}
        processoId={procSel?.id ?? null}
        processoNumero={procSel?.numero ?? null}
      >
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
