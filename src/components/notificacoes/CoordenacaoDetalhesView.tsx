import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  FileWarning,
  Gavel,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Newspaper,
  Radar,
  RefreshCw,
  Scale,
  Settings,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useConfigAlertasCoordenacao } from "@/hooks/useConfigAlertasCoordenacao";
import { ConfigAlertasCoordenacaoDialog } from "./ConfigAlertasCoordenacaoDialog";
import { cn } from "@/lib/utils";
import { startOfDay, parseISO, isBefore, isAfter, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Props {
  coordenacaoId: string;
  coordenacaoNome: string;
  onBack: () => void;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}

export function CoordenacaoDetalhesView({
  coordenacaoId,
  coordenacaoNome,
  onBack,
  periodoInicio: periodoInicioExterno,
  periodoFim: periodoFimExterno,
  statusFilter = "pendente",
  searchQuery = "",
}: Props) {
  const navigate = useNavigate();
  
  // Estado local para filtros de data (inicializa com valores externos)
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(periodoInicioExterno);
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(periodoFimExterno);
  
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { prazosUrgentes } = useNotificacoes();
  const { configs } = useConfigAlertasCoordenacao();
  
  // Usar mesmo hook que o dashboard para consistência nos números
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
    coordenacaoId: coordenacaoId,
  });
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  // activeSection agora pode ser 'all' para mostrar todas, ou uma seção específica, ou null
  const [activeSection, setActiveSection] = useState<string>("all");

  const matchesPeriodo = useMemo(() => {
    return (dateStr: string | null | undefined) => {
      if (!dateStr) return true;
      if (!periodoInicio && !periodoFim) return true;
      try {
        const date = startOfDay(parseISO(dateStr));
        if (periodoInicio && isBefore(date, startOfDay(periodoInicio))) return false;
        if (periodoFim && isAfter(date, startOfDay(periodoFim))) return false;
        return true;
      } catch {
        return true;
      }
    };
  }, [periodoInicio, periodoFim]);

  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id, titulo, descricao, status, data_vencimento, data_fatal, prioridade, tipo_tarefa,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome),
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id, polo_ativo, polo_passivo)
        `)
        .order("data_vencimento", { ascending: true });

      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((t: any) => {
        if (t.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(t.data_vencimento)) return false;
        return true;
      });
    },
  });

  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id, processo_numero, data_audiencia, hora, hora_brasilia, tipo_audiencia, 
          local_audiencia, status, polo_ativo, advogado, preposto, terceirizado,
          testemunhas, observacoes, resumo_objeto, contexto,
          processo:processos!audiencias_detectadas_processo_id_fkey(id, numero, coordenacao_id, polo_ativo, polo_passivo, vara)
        `)
        .order("data_audiencia", { ascending: true });

      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((a: any) => {
        if (a.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(a.data_audiencia)) return false;
        return true;
      });
    },
  });

  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id, processo_numero, data_intimacao, tipo_intimacao, prazo_dias, data_limite, 
          status, descricao, contexto, prioridade,
          processo:processos!intimacoes_detectadas_processo_id_fkey(id, numero, coordenacao_id, polo_ativo, polo_passivo)
        `)
        .order("data_limite", { ascending: true });

      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((i: any) => {
        if (i.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(i.data_intimacao)) return false;
        return true;
      });
    },
  });

  const { data: andamentosData = [] } = useQuery({
    queryKey: ["andamentos-coordenacao-detalhes", coordenacaoId, periodoInicio, periodoFim],
    queryFn: async () => {
      const inicioDia = periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined;
      const fimDiaMaisUm = periodoFim ? format(new Date(periodoFim.getTime() + 86400000), "yyyy-MM-dd") : undefined;

      let query = supabase
        .from("movimentacoes")
        .select(`
          id, descricao, data_movimentacao, created_at, tipo, fonte,
          processo:processos!movimentacoes_processo_id_fkey(id, numero, coordenacao_id, polo_ativo)
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false });

      if (inicioDia) query = query.gte("created_at", inicioDia);
      if (fimDiaMaisUm) query = query.lt("created_at", fimDiaMaisUm);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((a: any) => a.processo?.coordenacao_id === coordenacaoId);
    },
  });

  const monIds = monitoramentosDjen.filter(m => m.coordenacao_id === coordenacaoId).map(m => m.id);
  const publicacoesFiltradas = publicacoes.filter(p => {
    if (!monIds.includes(p.monitoramento_id)) return false;
    if (statusFilter !== "todas" && p.lida) return false;
    if (!matchesPeriodo(p.created_at)) return false;
    if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
    return true;
  });

  const distribuicoesFiltradas = distribuicoesEncontradas.filter(d => {
    if ((d as any).monitoramento?.coordenacao_id !== coordenacaoId) return false;
    if (statusFilter !== "todas" && d.status !== 'pendente') return false;
    if (!matchesPeriodo(d.data_distribuicao)) return false;
    if (!matchesSearch(d.numero_processo)) return false;
    return true;
  });

  const alertasFiltrados = alertas.filter(a => {
    if (a.processo?.coordenacao_id !== coordenacaoId) return false;
    if (statusFilter !== "todas" && a.status !== 'pendente') return false;
    if (!matchesPeriodo(a.created_at)) return false;
    if (!matchesSearch(a.termo_encontrado)) return false;
    return true;
  });

  // Redistribuições já vêm filtradas pelo hook, só aplica filtro de busca
  const redistribuicoesFiltradas = redistribuicoesData.filter((r) => matchesSearch(r.processo_numero));

  const config = configs.find(c => c.coordenacao_id === coordenacaoId);

  const stats = {
    redistribuicoes: redistribuicoesFiltradas.length,
    audiencias: audienciasPendentes.length,
    intimacoes: intimacoesPendentes.length,
    tarefas: tarefasPendentes.length,
    prazos: prazosUrgentes.filter(p => p.processo?.coordenacao_id === coordenacaoId && matchesPeriodo(p.data_vencimento)).length,
    djen: publicacoesFiltradas.length,
    distribuicoes: distribuicoesFiltradas.length,
    alertas360: alertasFiltrados.length,
    andamentos: andamentosData.length,
  };
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const getPrioridadeColor = (prioridade: string | null | undefined) => {
    switch (prioridade) {
      case 'urgente': return 'bg-destructive text-destructive-foreground';
      case 'alta': return 'bg-orange-500 text-white';
      case 'media': return 'bg-amber-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Toggle section or set active
  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? "all" : section);
  };

  // Unified list rendering
  const renderFullList = () => {
    const sectionConfig: Record<string, { title: string; icon: any; color: string; items: any[]; renderItem: (item: any) => React.ReactNode }> = {
      redistribuicoes: {
        title: "Redistribuições",
        icon: RefreshCw,
        color: "cyan",
        items: redistribuicoesFiltradas,
        renderItem: (r) => {
          return (
            <div key={r.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => r.processo_id && navigate(`/processo/${r.processo_id}`)}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.processo_numero || "N/A"}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className="text-muted-foreground line-through">{r.vara_antiga}</span>
                    <span>→</span>
                    <span className="font-medium text-cyan-600">{r.vara_nova}</span>
                  </div>
                  {r.advogado_nome && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> {r.advogado_nome}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{format(new Date(r.data_redistribuicao), "dd/MM HH:mm")}</span>
              </div>
            </div>
          );
        },
      },
      audiencias: {
        title: "Audiências",
        icon: Gavel,
        color: "indigo",
        items: audienciasPendentes,
        renderItem: (a: any) => (
          <div key={a.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => a.processo?.id && navigate(`/processo/${a.processo.id}`)}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{a.tipo_audiencia || "Audiência"}</p>
                  <Badge variant="outline" className="text-[10px] h-4">{a.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.processo_numero || a.processo?.numero}</p>
                <p className="text-xs text-muted-foreground">{a.polo_ativo || a.processo?.polo_ativo}</p>
                {a.local_audiencia && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {a.local_audiencia}
                  </p>
                )}
                {a.advogado && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {a.advogado}
                  </p>
                )}
              </div>
              <div className="text-right space-y-0.5">
                {a.data_audiencia && (
                  <Badge className="bg-indigo-600 text-white text-[10px] h-4">{format(new Date(a.data_audiencia), "dd/MM/yy")}</Badge>
                )}
                {(a.hora || a.hora_brasilia) && <p className="text-xs font-medium">{a.hora || a.hora_brasilia}</p>}
              </div>
            </div>
          </div>
        ),
      },
      intimacoes: {
        title: "Intimações",
        icon: FileWarning,
        color: "orange",
        items: intimacoesPendentes,
        renderItem: (i: any) => (
          <div key={i.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => i.processo?.id && navigate(`/processo/${i.processo.id}`)}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{i.tipo_intimacao || "Intimação"}</p>
                  {i.prazo_dias && <Badge variant="outline" className="text-[10px] h-4">{i.prazo_dias} dias</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{i.processo_numero || i.processo?.numero}</p>
                <p className="text-xs text-muted-foreground">{i.processo?.polo_ativo}</p>
                {i.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{i.descricao}</p>}
              </div>
              <div className="text-right">
                {i.data_limite && (
                  <Badge className="bg-orange-600 text-white text-[10px] h-4">Limite: {format(new Date(i.data_limite), "dd/MM/yy")}</Badge>
                )}
              </div>
            </div>
          </div>
        ),
      },
      tarefas: {
        title: "Tarefas",
        icon: ListTodo,
        color: "green",
        items: tarefasPendentes,
        renderItem: (t: any) => (
          <div key={t.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => navigate(`/processo/${t.processo?.id}`)}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{t.titulo}</p>
                  <Badge className={cn("text-[10px] h-4", getPrioridadeColor(t.prioridade))}>{t.prioridade}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.processo?.numero}</p>
                {t.responsavel?.nome && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> {t.responsavel.nome}
                  </p>
                )}
              </div>
              <div className="text-right">
                {t.data_vencimento && <span className="text-xs text-muted-foreground">{format(new Date(t.data_vencimento), "dd/MM/yy")}</span>}
              </div>
            </div>
          </div>
        ),
      },
      djen: {
        title: "Publicações DJEN",
        icon: Newspaper,
        color: "blue",
        items: publicacoesFiltradas,
        renderItem: (p: any) => (
          <div key={p.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => navigate(`/analise-djen`)}>
            <p className="font-medium text-sm">{p.processo_numero || "Sem número"}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{p.conteudo}</p>
            <span className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "dd/MM HH:mm")}</span>
          </div>
        ),
      },
      andamentos: {
        title: "Andamentos",
        icon: Activity,
        color: "violet",
        items: andamentosData,
        renderItem: (a: any) => (
          <div key={a.id} className="p-2 border-b hover:bg-accent/50 cursor-pointer" onClick={() => a.processo?.id && navigate(`/processo/${a.processo.id}`)}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-2">{a.descricao}</p>
                <p className="text-xs text-muted-foreground">{a.processo?.numero}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(a.data_movimentacao), "dd/MM")}</span>
            </div>
          </div>
        ),
      },
    };

    // Seções a renderizar
    const sectionsToRender = activeSection === "all" 
      ? Object.keys(sectionConfig).filter(key => sectionConfig[key].items.length > 0)
      : activeSection && sectionConfig[activeSection]?.items.length > 0 
        ? [activeSection] 
        : [];

    if (sectionsToRender.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          Nenhum registro encontrado para o período selecionado.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
        {sectionsToRender.map(sectionKey => {
          const cfg = sectionConfig[sectionKey];
          const Icon = cfg.icon;
          const colorClasses: Record<string, string> = {
            cyan: "bg-cyan-600/10 border-cyan-600/30 text-cyan-700",
            indigo: "bg-indigo-600/10 border-indigo-600/30 text-indigo-700",
            orange: "bg-orange-600/10 border-orange-600/30 text-orange-700",
            green: "bg-green-600/10 border-green-600/30 text-green-700",
            blue: "bg-blue-600/10 border-blue-600/30 text-blue-700",
            violet: "bg-violet-600/10 border-violet-600/30 text-violet-700",
          };

          return (
            <Card key={sectionKey} className="overflow-hidden">
              <CardHeader className={cn("py-1.5 px-3 border-b", colorClasses[cfg.color])}>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {cfg.title} ({cfg.items.length})
                  </span>
                  {activeSection !== "all" && (
                    <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setActiveSection("all")}>
                      Ver todos
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[250px]">
                {cfg.items.map(cfg.renderItem)}
              </ScrollArea>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-card rounded-lg border p-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{coordenacaoNome}</h2>
          <Badge variant={total === 0 ? "secondary" : "destructive"} className="text-xs">
            {total} pendências
          </Badge>
        </div>
        
        {/* Filtros de data inline */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 gap-1 text-xs px-2", periodoInicio && "bg-primary/10")}>
                <CalendarDays className="w-3 h-3" />
                De: {periodoInicio ? format(periodoInicio, "dd/MM/yy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={periodoInicio} onSelect={setPeriodoInicio} locale={ptBR} className="p-2 pointer-events-auto" />
              <div className="p-2 border-t flex justify-between">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoInicio(startOfDay(new Date()))}>Hoje</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoInicio(undefined)}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 gap-1 text-xs px-2", periodoFim && "bg-primary/10")}>
                <CalendarDays className="w-3 h-3" />
                Até: {periodoFim ? format(periodoFim, "dd/MM/yy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={periodoFim} onSelect={setPeriodoFim} locale={ptBR} className="p-2 pointer-events-auto" />
              <div className="p-2 border-t flex justify-between">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoFim(startOfDay(new Date()))}>Hoje</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoFim(undefined)}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          {config?.email_habilitado && (
            <Badge variant="outline" className="gap-1 h-7 text-xs px-2">
              <Mail className="h-3 w-3 text-blue-500" /> Email
            </Badge>
          )}
          {config?.whatsapp_habilitado && (
            <Badge variant="outline" className="gap-1 h-7 text-xs px-2">
              <MessageCircle className="h-3 w-3 text-green-500" /> WhatsApp
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setConfigDialogOpen(true)}>
            <Settings className="h-3 w-3 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Stats Summary - clicáveis */}
      <div className="flex flex-wrap gap-1">
        {stats.redistribuicoes > 0 && (
          <button onClick={() => toggleSection("redistribuicoes")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-600/10 border border-cyan-600/20 hover:bg-cyan-600/20 transition-colors", activeSection === "redistribuicoes" && "ring-2 ring-cyan-600")}>
            <RefreshCw className="h-3 w-3 text-cyan-600" />
            <span className="text-xs font-semibold text-cyan-600">{stats.redistribuicoes} Redist.</span>
          </button>
        )}
        {stats.audiencias > 0 && (
          <button onClick={() => toggleSection("audiencias")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600/10 border border-indigo-600/20 hover:bg-indigo-600/20 transition-colors", activeSection === "audiencias" && "ring-2 ring-indigo-600")}>
            <Gavel className="h-3 w-3 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-600">{stats.audiencias} Audiências</span>
          </button>
        )}
        {stats.intimacoes > 0 && (
          <button onClick={() => toggleSection("intimacoes")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-orange-600/10 border border-orange-600/20 hover:bg-orange-600/20 transition-colors", activeSection === "intimacoes" && "ring-2 ring-orange-600")}>
            <FileWarning className="h-3 w-3 text-orange-600" />
            <span className="text-xs font-semibold text-orange-600">{stats.intimacoes} Intimações</span>
          </button>
        )}
        {stats.tarefas > 0 && (
          <button onClick={() => toggleSection("tarefas")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-green-600/10 border border-green-600/20 hover:bg-green-600/20 transition-colors", activeSection === "tarefas" && "ring-2 ring-green-600")}>
            <ListTodo className="h-3 w-3 text-green-600" />
            <span className="text-xs font-semibold text-green-600">{stats.tarefas} Tarefas</span>
          </button>
        )}
        {stats.prazos > 0 && (
          <button className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600/10 border border-red-600/20">
            <Clock className="h-3 w-3 text-red-600" />
            <span className="text-xs font-semibold text-red-600">{stats.prazos} Prazos</span>
          </button>
        )}
        {stats.djen > 0 && (
          <button onClick={() => toggleSection("djen")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600/10 border border-blue-600/20 hover:bg-blue-600/20 transition-colors", activeSection === "djen" && "ring-2 ring-blue-600")}>
            <Newspaper className="h-3 w-3 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600">{stats.djen} DJEN</span>
          </button>
        )}
        {stats.distribuicoes > 0 && (
          <button className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-600/10 border border-purple-600/20">
            <Scale className="h-3 w-3 text-purple-600" />
            <span className="text-xs font-semibold text-purple-600">{stats.distribuicoes} Distrib.</span>
          </button>
        )}
        {stats.alertas360 > 0 && (
          <button className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600/10 border border-amber-600/20">
            <Radar className="h-3 w-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-600">{stats.alertas360} Alertas 360°</span>
          </button>
        )}
        {stats.andamentos > 0 && (
          <button onClick={() => toggleSection("andamentos")} className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-violet-600/10 border border-violet-600/20 hover:bg-violet-600/20 transition-colors", activeSection === "andamentos" && "ring-2 ring-violet-600")}>
            <Activity className="h-3 w-3 text-violet-600" />
            <span className="text-xs font-semibold text-violet-600">{stats.andamentos} Andamentos</span>
          </button>
        )}
      </div>

      {/* Lista completa da seção selecionada */}
      {renderFullList()}

      <ConfigAlertasCoordenacaoDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        coordenacaoId={coordenacaoId}
        coordenacaoNome={coordenacaoNome}
      />
    </div>
  );
}
