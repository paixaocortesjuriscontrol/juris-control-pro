import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Newspaper, 
  Scale, 
  RefreshCw, 
  Radar,
  Eye,
  CheckCheck,
  Filter,
  TrendingUp,
  Building2,
  Settings,
  LayoutDashboard,
  ListTodo,
  Gavel,
  FileWarning,
  Search,
  X,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { formatDistanceToNow, format, isAfter, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DashboardCoordenacoes } from "@/components/notificacoes/DashboardCoordenacoes";

export default function Notificacoes() {
  // Central de Notificações
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(undefined);
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(undefined);
  
  // Toggle filters for each type
  const [showDjen, setShowDjen] = useState(true);
  const [showDistribuicoes, setShowDistribuicoes] = useState(true);
  const [showAlertas360, setShowAlertas360] = useState(true);
  const [showRedistribuicoes, setShowRedistribuicoes] = useState(true);
  const [showPrazos, setShowPrazos] = useState(true);
  const [showTarefas, setShowTarefas] = useState(true);
  const [showAudiencias, setShowAudiencias] = useState(true);
  const [showIntimacoes, setShowIntimacoes] = useState(true);
  
  const navigate = useNavigate();

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { 
    notificacoes, 
    naoLidas, 
    prazosPendentes,
    prazosUrgentes,
    marcarComoLida, 
    marcarTodasComoLidas,
    excluirNotificacao 
  } = useNotificacoes();
  
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes();

  // Buscar tarefas pendentes
  const { data: tarefasPendentesData = [] } = useQuery({
    queryKey: ["tarefas-pendentes-notificacoes", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          data_vencimento,
          prioridade,
          processo:processos!tarefas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_vencimento", { ascending: true });
      
      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar audiências pendentes
  const { data: audienciasPendentesData = [] } = useQuery({
    queryKey: ["audiencias-pendentes-notificacoes", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id,
          processo_numero,
          data_audiencia,
          hora,
          tipo_audiencia,
          status,
          processo:processos!audiencias_detectadas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_audiencia", { ascending: true });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar intimações pendentes
  const { data: intimacoesPendentesData = [] } = useQuery({
    queryKey: ["intimacoes-pendentes-notificacoes", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id,
          processo_numero,
          data_intimacao,
          tipo_intimacao,
          status,
          processo:processos!intimacoes_detectadas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_intimacao", { ascending: true });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter helper functions - usando useMemo para garantir reatividade
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

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

  const matchesPrioridade = useMemo(() => {
    return (prioridade: string | null | undefined) => {
      if (prioridadeFilter === "todas") return true;
      return prioridade === prioridadeFilter;
    };
  }, [prioridadeFilter]);

  // Filter DJEN publications by coordination and filters
  const publicacoesNaoLidas = publicacoes.filter(p => statusFilter === "todas" || !p.lida);
  const publicacoesFiltradas = useMemo(() => {
    return publicacoesNaoLidas.filter(p => {
      if (coordenacaoId !== "todas") {
        const mon = monitoramentosDjen.find(m => m.id === p.monitoramento_id);
        if (mon?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      if (!matchesPeriodo(p.data_publicacao)) return false;
      return true;
    });
  }, [publicacoesNaoLidas, coordenacaoId, monitoramentosDjen, searchQuery, periodoInicio, periodoFim]);

  // Filter distributions by coordination
  const distribuicoesPendentes = distribuicoesEncontradas.filter(d => 
    statusFilter === "todas" || d.status === 'pendente'
  );
  const distribuicoesFiltradas = useMemo(() => {
    return distribuicoesPendentes.filter(d => {
      if (coordenacaoId !== "todas") {
        if ((d as any).monitoramento?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(d.numero_processo) && !matchesSearch(d.polo_ativo) && !matchesSearch(d.polo_passivo)) return false;
      if (!matchesPeriodo(d.data_distribuicao)) return false;
      return true;
    });
  }, [distribuicoesPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Filter alerts by coordination
  const alertasPendentes = alertas.filter(a => 
    statusFilter === "todas" || a.status === 'pendente'
  );
  const alertasFiltrados = useMemo(() => {
    return alertasPendentes.filter(a => {
      if (coordenacaoId !== "todas" && a.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.termo_encontrado) && !matchesSearch(a.processo?.numero)) return false;
      if (!matchesPeriodo(a.created_at)) return false;
      if (!matchesPrioridade(a.prioridade)) return false;
      return true;
    });
  }, [alertasPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter]);

  // Redistribuições recentes
  const redistribuicoesRecentes = redistribuicoesData.slice(0, 50);
  const redistribuicoesFiltradas = useMemo(() => {
    return redistribuicoesRecentes.filter(r => {
      if (coordenacaoId !== "todas") {
        const coord = coordenacoes.find(c => c.id === coordenacaoId);
        if (!coord || r.coordenacao_nome !== coord.nome) return false;
      }
      if (!matchesSearch(r.processo_numero)) return false;
      if (!matchesPeriodo(r.data_redistribuicao)) return false;
      return true;
    });
  }, [redistribuicoesRecentes, coordenacaoId, coordenacoes, searchQuery, periodoInicio, periodoFim]);

  // Filter prazos by coordination
  const prazosFiltrados = useMemo(() => {
    const basePrazos = statusFilter === "todas" ? prazosPendentes : prazosUrgentes;
    return basePrazos.filter(p => {
      if (coordenacaoId !== "todas" && p.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(p.titulo) && !matchesSearch(p.processo?.numero)) return false;
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesPrioridade(p.prioridade)) return false;
      return true;
    });
  }, [prazosPendentes, prazosUrgentes, statusFilter, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter]);

  // Filter notificacoes by coordination
  const notificacoesFiltradas = useMemo(() => {
    const baseNotifs = statusFilter === "todas" ? notificacoes : naoLidas;
    return baseNotifs.filter(n => {
      if (coordenacaoId !== "todas") {
        const processoId = n.dados?.processo_id;
        if (!processoId) return false;
        const alertaRelacionado = alertas.find(a => a.processo_id === processoId);
        if (alertaRelacionado?.processo?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(n.titulo) && !matchesSearch(n.mensagem)) return false;
      if (!matchesPeriodo(n.created_at)) return false;
      return true;
    });
  }, [notificacoes, naoLidas, statusFilter, coordenacaoId, alertas, searchQuery, periodoInicio, periodoFim]);

  // Filter tarefas by coordination
  const tarefasFiltradas = useMemo(() => {
    return tarefasPendentesData.filter(t => {
      if (coordenacaoId !== "todas" && (t.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(t.titulo) && !matchesSearch((t.processo as any)?.numero)) return false;
      if (!matchesPeriodo(t.data_vencimento)) return false;
      if (!matchesPrioridade(t.prioridade)) return false;
      return true;
    });
  }, [tarefasPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter]);

  // Filter audiencias by coordination
  const audienciasFiltradas = useMemo(() => {
    return audienciasPendentesData.filter(a => {
      if (coordenacaoId !== "todas" && (a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.processo_numero) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo_audiencia)) return false;
      if (!matchesPeriodo(a.data_audiencia)) return false;
      return true;
    });
  }, [audienciasPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Filter intimacoes by coordination
  const intimacoesFiltradas = useMemo(() => {
    return intimacoesPendentesData.filter(i => {
      if (coordenacaoId !== "todas" && (i.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(i.processo_numero) && !matchesSearch((i.processo as any)?.numero) && !matchesSearch(i.tipo_intimacao)) return false;
      if (!matchesPeriodo(i.data_intimacao)) return false;
      return true;
    });
  }, [intimacoesPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim]);

  // Stats - recalculated based on toggle filters
  const stats = useMemo(() => {
    const djen = showDjen ? publicacoesFiltradas.length : 0;
    const distribuicoes = showDistribuicoes ? distribuicoesFiltradas.length : 0;
    const alertas360 = showAlertas360 ? alertasFiltrados.length : 0;
    const redistribuicoes = showRedistribuicoes ? redistribuicoesFiltradas.length : 0;
    const prazos = showPrazos ? prazosFiltrados.length : 0;
    const notifs = notificacoesFiltradas.length;
    const tarefas = showTarefas ? tarefasFiltradas.length : 0;
    const audiencias = showAudiencias ? audienciasFiltradas.length : 0;
    const intimacoes = showIntimacoes ? intimacoesFiltradas.length : 0;
    
    return {
      djen: publicacoesFiltradas.length,
      distribuicoes: distribuicoesFiltradas.length,
      alertas360: alertasFiltrados.length,
      redistribuicoes: redistribuicoesFiltradas.length,
      prazos: prazosFiltrados.length,
      notificacoes: notificacoesFiltradas.length,
      tarefas: tarefasFiltradas.length,
      audiencias: audienciasFiltradas.length,
      intimacoes: intimacoesFiltradas.length,
      total: djen + distribuicoes + alertas360 + redistribuicoes + prazos + notifs + tarefas + audiencias + intimacoes,
      filteredTotal: djen + distribuicoes + alertas360 + redistribuicoes + prazos + tarefas + audiencias + intimacoes
    };
  }, [
    publicacoesFiltradas, distribuicoesFiltradas, alertasFiltrados, redistribuicoesFiltradas,
    prazosFiltrados, notificacoesFiltradas, tarefasFiltradas, audienciasFiltradas, intimacoesFiltradas,
    showDjen, showDistribuicoes, showAlertas360, showRedistribuicoes, showPrazos, showTarefas, showAudiencias, showIntimacoes
  ]);

  const hasActiveFilters = searchQuery || prioridadeFilter !== "todas" || statusFilter !== "pendente" || 
    periodoInicio || periodoFim || coordenacaoId !== "todas" ||
    !showDjen || !showDistribuicoes || !showAlertas360 || !showRedistribuicoes || 
    !showPrazos || !showTarefas || !showAudiencias || !showIntimacoes;

  const clearAllFilters = () => {
    setSearchQuery("");
    setPrioridadeFilter("todas");
    setStatusFilter("pendente");
    setPeriodoInicio(undefined);
    setPeriodoFim(undefined);
    setCoordenacaoId("todas");
    setShowDjen(true);
    setShowDistribuicoes(true);
    setShowAlertas360(true);
    setShowRedistribuicoes(true);
    setShowPrazos(true);
    setShowTarefas(true);
    setShowAudiencias(true);
    setShowIntimacoes(true);
  };

  const getIconByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return <Newspaper className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getColorByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'warning': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'success': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'bg-red-500/10 text-red-500';
      case 'alta': return 'bg-orange-500/10 text-orange-500';
      case 'media': return 'bg-amber-500/10 text-amber-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleSelectCoordenacao = (id: string) => {
    setCoordenacaoId(id);
    setActiveTab("todos");
  };

  return (
    <MainLayout title="Central de Notificações" subtitle={`${stats.filteredTotal} alertas encontrados`}>
      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6 animate-fade-in">
        <div className="flex flex-col gap-4">
          {/* Search Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por processo, termo, título..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Second Row - Coordination & Period */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
              <SelectTrigger className="w-full sm:w-64">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2", periodoInicio && "bg-primary/10")}>
                  <CalendarDays className="w-4 h-4" />
                  {periodoInicio ? (
                    <>
                      {format(periodoInicio, "dd/MM")}
                      {periodoFim && ` - ${format(periodoFim, "dd/MM")}`}
                    </>
                  ) : (
                    "Período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Selecione o período</p>
                </div>
                <div className="flex gap-2 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">De</p>
                    <Calendar
                      mode="single"
                      selected={periodoInicio}
                      onSelect={setPeriodoInicio}
                      locale={ptBR}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Até</p>
                    <Calendar
                      mode="single"
                      selected={periodoFim}
                      onSelect={setPeriodoFim}
                      locale={ptBR}
                    />
                  </div>
                </div>
                <div className="p-3 border-t flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setPeriodoInicio(undefined); setPeriodoFim(undefined); }}>
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Results counter chip */}
            <Badge variant="outline" className="h-8 px-3 text-xs font-medium bg-primary/10 border-primary/30 text-primary">
              {stats.filteredTotal} alerta{stats.filteredTotal !== 1 ? "s" : ""} encontrado{stats.filteredTotal !== 1 ? "s" : ""}
            </Badge>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs">
                <X className="w-3 h-3 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Toggle Filters Row */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showDjen && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              )}
              onClick={() => setShowDjen(prev => !prev)}
            >
              <Newspaper className="w-3.5 h-3.5" />
              DJEN
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showDjen && "bg-blue-500 text-white")}>
                {stats.djen}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showDistribuicoes && "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
              )}
              onClick={() => setShowDistribuicoes(prev => !prev)}
            >
              <Scale className="w-3.5 h-3.5" />
              Distribuições
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showDistribuicoes && "bg-purple-500 text-white")}>
                {stats.distribuicoes}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showAlertas360 && "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              )}
              onClick={() => setShowAlertas360(prev => !prev)}
            >
              <Radar className="w-3.5 h-3.5" />
              Alertas 360°
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showAlertas360 && "bg-amber-500 text-white")}>
                {stats.alertas360}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showRedistribuicoes && "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600"
              )}
              onClick={() => setShowRedistribuicoes(prev => !prev)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Redistrib.
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showRedistribuicoes && "bg-cyan-500 text-white")}>
                {stats.redistribuicoes}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showPrazos && "bg-red-600 hover:bg-red-700 text-white border-red-600"
              )}
              onClick={() => setShowPrazos(prev => !prev)}
            >
              <Clock className="w-3.5 h-3.5" />
              Prazos
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showPrazos && "bg-red-500 text-white")}>
                {stats.prazos}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showTarefas && "bg-green-600 hover:bg-green-700 text-white border-green-600"
              )}
              onClick={() => setShowTarefas(prev => !prev)}
            >
              <ListTodo className="w-3.5 h-3.5" />
              Tarefas
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showTarefas && "bg-green-500 text-white")}>
                {stats.tarefas}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showAudiencias && "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
              )}
              onClick={() => setShowAudiencias(prev => !prev)}
            >
              <Gavel className="w-3.5 h-3.5" />
              Audiências
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showAudiencias && "bg-indigo-500 text-white")}>
                {stats.audiencias}
              </Badge>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                showIntimacoes && "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
              )}
              onClick={() => setShowIntimacoes(prev => !prev)}
            >
              <FileWarning className="w-3.5 h-3.5" />
              Intimações
              <Badge variant="secondary" className={cn("ml-1 px-1.5 text-[10px]", showIntimacoes && "bg-orange-500 text-white")}>
                {stats.intimacoes}
              </Badge>
            </Button>
          </div>
        </div>
      </div>

      {naoLidas.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => marcarTodasComoLidas.mutate()}
            disabled={marcarTodasComoLidas.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {/* Cards de resumo por tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "dashboard" && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab("dashboard")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <LayoutDashboard className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium">Dashboard</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "djen" && "ring-2 ring-blue-500"
          )}
          onClick={() => setActiveTab("djen")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Newspaper className="w-4 h-4 text-blue-500" />
              </div>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-xs px-1.5">
                {stats.djen}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">DJEN</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "distribuicoes" && "ring-2 ring-purple-500"
          )}
          onClick={() => setActiveTab("distribuicoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Scale className="w-4 h-4 text-purple-500" />
              </div>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 text-xs px-1.5">
                {stats.distribuicoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Distribuições</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "alertas360" && "ring-2 ring-amber-500"
          )}
          onClick={() => setActiveTab("alertas360")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Radar className="w-4 h-4 text-amber-500" />
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs px-1.5">
                {stats.alertas360}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Alertas 360°</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "redistribuicoes" && "ring-2 ring-cyan-500"
          )}
          onClick={() => setActiveTab("redistribuicoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                <RefreshCw className="w-4 h-4 text-cyan-500" />
              </div>
              <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-500 text-xs px-1.5">
                {stats.redistribuicoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Redistrib.</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "prazos" && "ring-2 ring-red-500"
          )}
          onClick={() => setActiveTab("prazos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <Badge variant="secondary" className="bg-red-500/10 text-red-500 text-xs px-1.5">
                {stats.prazos}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Prazos</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "tarefas" && "ring-2 ring-green-500"
          )}
          onClick={() => setActiveTab("tarefas")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <ListTodo className="w-4 h-4 text-green-500" />
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs px-1.5">
                {stats.tarefas}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Tarefas</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "audiencias" && "ring-2 ring-indigo-500"
          )}
          onClick={() => setActiveTab("audiencias")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <Gavel className="w-4 h-4 text-indigo-500" />
              </div>
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 text-xs px-1.5">
                {stats.audiencias}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Audiências</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "intimacoes" && "ring-2 ring-orange-500"
          )}
          onClick={() => setActiveTab("intimacoes")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <FileWarning className="w-4 h-4 text-orange-500" />
              </div>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-xs px-1.5">
                {stats.intimacoes}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Intimações</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "todos" && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab("todos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs px-1.5">
                {stats.total}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Área de conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-background gap-1">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="todos" className="data-[state=active]:bg-background">
            Todos
          </TabsTrigger>
          <TabsTrigger value="djen" className="data-[state=active]:bg-background">
            DJEN
          </TabsTrigger>
          <TabsTrigger value="distribuicoes" className="data-[state=active]:bg-background">
            Distribuições
          </TabsTrigger>
          <TabsTrigger value="alertas360" className="data-[state=active]:bg-background">
            Alertas 360°
          </TabsTrigger>
          <TabsTrigger value="redistribuicoes" className="data-[state=active]:bg-background">
            Redistribuições
          </TabsTrigger>
          <TabsTrigger value="prazos" className="data-[state=active]:bg-background">
            Prazos
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="data-[state=active]:bg-background">
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="audiencias" className="data-[state=active]:bg-background">
            Audiências
          </TabsTrigger>
          <TabsTrigger value="intimacoes" className="data-[state=active]:bg-background">
            Intimações
          </TabsTrigger>
        </TabsList>

        {/* Dashboard por Coordenação */}
        <TabsContent value="dashboard" className="space-y-4">
          <DashboardCoordenacoes 
            onSelectCoordenacao={handleSelectCoordenacao}
            selectedCoordenacaoId={coordenacaoId}
            periodoInicio={periodoInicio}
            periodoFim={periodoFim}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
          />
        </TabsContent>

        {/* Todos */}
        <TabsContent value="todos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DJEN resumido */}
            {stats.djen > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-blue-500" />
                    Publicações DJEN ({stats.djen})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {publicacoesFiltradas.slice(0, 5).map((pub) => {
                      const processoDisplay = pub.processo_numero || (() => {
                        const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                        return match ? match[1] : null;
                      })();
                      return (
                        <div key={pub.id} className="py-2 border-b last:border-0">
                          <p className="text-sm font-medium truncate">{processoDisplay || 'Publicação DJEN'}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{pub.conteudo?.substring(0, 100)}...</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pub.data_publicacao && formatDistanceToNow(new Date(pub.data_publicacao), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      );
                    })}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("djen")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Alertas 360 resumido */}
            {stats.alertas360 > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radar className="w-4 h-4 text-amber-500" />
                    Alertas 360° ({stats.alertas360})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {alertasFiltrados.slice(0, 5).map((alerta) => (
                      <div key={alerta.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge className={getPrioridadeColor(alerta.prioridade)} variant="outline">
                            {alerta.prioridade}
                          </Badge>
                          <span className="text-sm font-medium truncate">{alerta.termo_encontrado}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Processo: {alerta.processo?.numero}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("alertas360")}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Prazos urgentes */}
            {stats.prazos > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    Prazos Urgentes ({stats.prazos})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {prazosFiltrados.slice(0, 5).map((prazo) => (
                      <div key={prazo.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{prazo.titulo}</p>
                          <Badge 
                            variant={prazo.is_atrasado ? "destructive" : "outline"}
                            className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                          >
                            {prazo.is_atrasado ? 'Atrasado' : `${prazo.dias_restantes}d`}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Processo: {prazo.processo?.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate('/prazos')}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Distribuições resumido */}
            {stats.distribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-500" />
                    Distribuições ({stats.distribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {distribuicoesFiltradas.slice(0, 5).map((dist) => (
                      <div key={dist.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{dist.numero_processo}</p>
                        <p className="text-xs text-muted-foreground">{dist.classe || 'Sem classe'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dist.tribunal || 'Tribunal não informado'}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("distribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Redistribuições resumido */}
            {stats.redistribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-cyan-500" />
                    Redistribuições ({stats.redistribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {redistribuicoesFiltradas.slice(0, 5).map((red) => (
                      <div key={red.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{red.processo_numero}</p>
                        <p className="text-xs text-muted-foreground">{red.vara_antiga} → {red.vara_nova}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("redistribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Notificações do sistema */}
            {notificacoesFiltradas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Notificações ({notificacoesFiltradas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {notificacoesFiltradas.slice(0, 5).map((notif) => (
                      <div 
                        key={notif.id} 
                        className="py-2 border-b last:border-0 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                        onClick={() => {
                          marcarComoLida.mutate(notif.id);
                          if (notif.link) {
                            navigate(notif.link);
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1 rounded", getColorByType(notif.tipo))}>
                              {getIconByType(notif.tipo)}
                            </div>
                            <p className="text-sm font-medium">{notif.titulo}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.mensagem}</p>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => marcarTodasComoLidas.mutate()}>
                    Marcar todas como lidas
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {stats.total === 0 && (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold">Tudo em dia!</h3>
                <p className="text-muted-foreground">Não há notificações ou alertas pendentes.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DJEN */}
        <TabsContent value="djen">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-blue-500" />
                Publicações DJEN não lidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {publicacoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma publicação pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {publicacoesFiltradas.map((pub) => {
                      const monitoramento = monitoramentosDjen.find(m => m.id === pub.monitoramento_id);
                      const processoDisplay = pub.processo_numero || (() => {
                        const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                        return match ? match[1] : null;
                      })();
                      return (
                        <Card key={pub.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                                    {monitoramento?.termo_busca || 'Monitoramento'}
                                  </Badge>
                                  {pub.fonte && (
                                    <Badge variant="secondary">{pub.fonte}</Badge>
                                  )}
                                </div>
                                <p className="font-medium">{processoDisplay || 'Publicação DJEN'}</p>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                                  {pub.conteudo}
                                </p>
                                {(pub as any).resumo_ia && (
                                  <div className="mt-2 p-2 bg-primary/5 rounded text-sm">
                                    <strong>Resumo IA:</strong> {(pub as any).resumo_ia}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {pub.data_publicacao && format(new Date(pub.data_publicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate('/analise-djen')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Analisar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribuições */}
        <TabsContent value="distribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-500" />
                Distribuições Encontradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma distribuição pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {distribuicoesFiltradas.map((dist) => (
                      <Card key={dist.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{dist.numero_processo}</p>
                              <p className="text-sm text-muted-foreground">{dist.classe}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Polo ativo:</span>
                                  <p className="truncate">{dist.polo_ativo || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Polo passivo:</span>
                                  <p className="truncate">{dist.polo_passivo || '-'}</p>
                                </div>
                              </div>
                              {dist.tribunal && (
                                <Badge variant="secondary" className="mt-2">{dist.tribunal}</Badge>
                              )}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-distribuicao')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas 360 */}
        <TabsContent value="alertas360">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-amber-500" />
                Alertas de Monitoramento 360°
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertasFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum alerta pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {alertasFiltrados.map((alerta) => (
                      <Card key={alerta.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getPrioridadeColor(alerta.prioridade)}>
                                  {alerta.prioridade.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="font-medium">Termo: {alerta.termo_encontrado}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {alerta.processo?.numero}
                              </p>
                              {alerta.contexto && (
                                <p className="text-sm mt-2 p-2 bg-muted rounded line-clamp-2">
                                  {alerta.contexto}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-360')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redistribuições */}
        <TabsContent value="redistribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-500" />
                Redistribuições Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redistribuicoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma redistribuição recente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {redistribuicoesFiltradas.map((red) => (
                      <Card key={red.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{red.processo_numero}</p>
                              <p className="text-sm text-muted-foreground">
                                {red.vara_antiga} → {red.vara_nova}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/redistribuicoes')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prazos */}
        <TabsContent value="prazos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Prazos Urgentes (próximos 3 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prazosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum prazo urgente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {prazosFiltrados.map((prazo) => (
                      <Card key={prazo.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant={prazo.is_atrasado ? "destructive" : "outline"}
                                  className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                                >
                                  {prazo.is_atrasado ? 'ATRASADO' : `${prazo.dias_restantes} dias`}
                                </Badge>
                              </div>
                              <p className="font-medium">{prazo.titulo}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {prazo.processo?.numero}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Vencimento: {format(new Date(prazo.data_vencimento), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/prazos')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tarefas */}
        <TabsContent value="tarefas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-green-500" />
                Tarefas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tarefasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tarefa pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {tarefasFiltradas.map((tarefa) => (
                      <Card key={tarefa.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getPrioridadeColor(tarefa.prioridade)}>
                                  {tarefa.prioridade.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="font-medium">{tarefa.titulo}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {(tarefa.processo as any)?.numero || '-'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Vencimento: {format(new Date(tarefa.data_vencimento), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/minha-agenda')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audiências */}
        <TabsContent value="audiencias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-500" />
                Audiências Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audienciasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma audiência pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {audienciasFiltradas.map((audiencia) => (
                      <Card key={audiencia.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500">
                                  {audiencia.tipo_audiencia || 'Audiência'}
                                </Badge>
                              </div>
                              <p className="font-medium">{audiencia.processo_numero || (audiencia.processo as any)?.numero}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {audiencia.data_audiencia && format(new Date(audiencia.data_audiencia), "dd/MM/yyyy")}
                                {audiencia.hora && ` às ${audiencia.hora}`}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/painel-audiencias')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intimações */}
        <TabsContent value="intimacoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-500" />
                Intimações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intimacoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma intimação pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {intimacoesFiltradas.map((intimacao) => (
                      <Card key={intimacao.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                                  {intimacao.tipo_intimacao || 'Intimação'}
                                </Badge>
                              </div>
                              <p className="font-medium">{intimacao.processo_numero || (intimacao.processo as any)?.numero}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {intimacao.data_intimacao && format(new Date(intimacao.data_intimacao), "dd/MM/yyyy")}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/painel-intimacoes')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
