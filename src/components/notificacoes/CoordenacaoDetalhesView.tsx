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

  // Handlers para navegação segura
  const handleNavigateProcesso = (processoId: string | null | undefined, tab?: string) => {
    if (!processoId) {
      console.warn("ID do processo não disponível");
      return;
    }
    const url = tab ? `/processos/${processoId}?tab=${tab}` : `/processos/${processoId}`;
    navigate(url);
  };

  // Handler específico para DJEN que precisa buscar processo_id pelo número
  const handleNavigateDjen = async (processoNumero: string | null | undefined) => {
    if (!processoNumero) {
      console.warn("Número do processo não disponível");
      return;
    }
    // Buscar o processo pelo número
    const { data: processo } = await supabase
      .from("processos")
      .select("id")
      .eq("numero", processoNumero)
      .maybeSingle();
    
    if (processo?.id) {
      navigate(`/processos/${processo.id}?tab=publicacoes`);
    } else {
      console.warn("Processo não encontrado:", processoNumero);
    }
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
          // Redistribuições navegam para o processo com aba redistribuicoes
          return (
            <div 
              key={r.id} 
              className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
              onClick={() => handleNavigateProcesso(r.processo_id, "redistribuicoes")}
            >
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
          // Audiências navegam para o processo com aba audiencias
          <div 
            key={a.id} 
            className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
            onClick={() => handleNavigateProcesso(a.processo?.id || a.processo_id, "audiencias")}
          >
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
          // Intimações navegam para o processo com aba intimacoes
          <div 
            key={i.id} 
            className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
            onClick={() => handleNavigateProcesso(i.processo?.id || i.processo_id, "intimacoes")}
          >
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
          // Tarefas navegam para o processo com aba tarefas
          <div 
            key={t.id} 
            className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
            onClick={() => handleNavigateProcesso(t.processo?.id, "tarefas")}
          >
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
          // DJEN navega para o processo com aba publicacoes (usa processo_numero pois não tem processo_id)
          <div 
            key={p.id} 
            className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
            onClick={() => handleNavigateDjen(p.processo_numero)}
          >
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
          // Andamentos navegam para o processo com aba andamentos
          <div 
            key={a.id} 
            className="p-2 border-b hover:bg-accent/50 cursor-pointer" 
            onClick={() => handleNavigateProcesso(a.processo?.id || a.processo_id, "andamentos")}
          >
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

      {/* Botões Quadrados com Totalizadores */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <Button
          variant={activeSection === "redistribuicoes" ? "default" : "outline"}
          onClick={() => toggleSection("redistribuicoes")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <RefreshCw className="h-6 w-6 text-cyan-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Redistrib.</span>
          {stats.redistribuicoes > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-cyan-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.redistribuicoes}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "audiencias" ? "default" : "outline"}
          onClick={() => toggleSection("audiencias")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Gavel className="h-6 w-6 text-indigo-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Audiências</span>
          {stats.audiencias > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-indigo-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.audiencias}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "intimacoes" ? "default" : "outline"}
          onClick={() => toggleSection("intimacoes")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <FileWarning className="h-6 w-6 text-orange-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Intimações</span>
          {stats.intimacoes > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-orange-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.intimacoes}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "tarefas" ? "default" : "outline"}
          onClick={() => toggleSection("tarefas")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <ListTodo className="h-6 w-6 text-green-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Tarefas</span>
          {stats.tarefas > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-green-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.tarefas}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "prazos" ? "default" : "outline"}
          onClick={() => toggleSection("prazos")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Clock className="h-6 w-6 text-red-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Prazos</span>
          {stats.prazos > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-red-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.prazos}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "djen" ? "default" : "outline"}
          onClick={() => toggleSection("djen")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Newspaper className="h-6 w-6 text-blue-600" />
          <span className="text-[10px] font-medium text-center leading-tight">DJEN</span>
          {stats.djen > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-blue-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.djen}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "distribuicoes" ? "default" : "outline"}
          onClick={() => toggleSection("distribuicoes")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Scale className="h-6 w-6 text-purple-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Distribuições</span>
          {stats.distribuicoes > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-purple-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.distribuicoes}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "alertas360" ? "default" : "outline"}
          onClick={() => toggleSection("alertas360")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Radar className="h-6 w-6 text-amber-600" />
          <span className="text-[10px] font-medium text-center leading-tight">360°</span>
          {stats.alertas360 > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-amber-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.alertas360}
            </Badge>
          )}
        </Button>

        <Button
          variant={activeSection === "andamentos" ? "default" : "outline"}
          onClick={() => toggleSection("andamentos")}
          className="flex flex-col items-center justify-center h-20 p-2 relative gap-1"
        >
          <Activity className="h-6 w-6 text-violet-600" />
          <span className="text-[10px] font-medium text-center leading-tight">Andamentos</span>
          {stats.andamentos > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-violet-600 text-white h-5 min-w-5 flex items-center justify-center text-xs px-1">
              {stats.andamentos}
            </Badge>
          )}
        </Button>
      </div>

      {/* Botão "Ver Tudo" */}
      {activeSection !== "all" && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setActiveSection("all")}
            className="w-full max-w-md"
          >
            Ver Tudo ({total} alertas)
          </Button>
        </div>
      )}

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
