import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  FileText,
  Activity,
  Download,
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
import { CoordenacaoDetalhesView } from "@/components/notificacoes/CoordenacaoDetalhesView";
import { GerarRelatorioPdfDialog } from "@/components/notificacoes/GerarRelatorioPdfDialog";

export default function Notificacoes() {
  // Central de Notificações
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  
  
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
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });

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

  // Buscar andamentos (movimentações) recentes - excluindo redistribuições
  const { data: andamentosData = [] } = useQuery({
    queryKey: ["andamentos-notificacoes", periodoInicio, periodoFim],
    queryFn: async () => {
      console.log("🔍 [Andamentos] Buscando andamentos (sem redistribuições)...");
      let query = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          data_movimentacao,
          created_at,
          tipo,
          fonte,
          processo:processos!movimentacoes_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false });
      
      // Filtrar por período usando created_at (data da captura), não data_movimentacao
      if (periodoInicio) {
        query = query.gte("created_at", format(periodoInicio, "yyyy-MM-dd"));
      }
      if (periodoFim) {
        // Adiciona 1 dia para incluir todo o dia final
        const fimMaisUmDia = new Date(periodoFim);
        fimMaisUmDia.setDate(fimMaisUmDia.getDate() + 1);
        query = query.lt("created_at", format(fimMaisUmDia, "yyyy-MM-dd"));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      console.log("✅ [Andamentos] Total encontrado:", data?.length || 0);
      console.log("📋 [Andamentos] Tipos únicos:", [...new Set(data?.map((d: any) => d.tipo) || [])]);
      const redistCount = data?.filter((d: any) => d.tipo === "Redistribuição").length || 0;
      if (redistCount > 0) {
        console.error("❌ [Andamentos] ERRO: Redistribuições encontradas:", redistCount);
      }
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

  // Filter DJEN publications by coordination and filters - usando created_at (data da captura)
  const publicacoesNaoLidas = publicacoes.filter(p => statusFilter === "todas" || !p.lida);
  const publicacoesFiltradas = useMemo(() => {
    return publicacoesNaoLidas.filter(p => {
      if (coordenacaoId !== "todas") {
        const mon = monitoramentosDjen.find(m => m.id === p.monitoramento_id);
        if (mon?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      // Usar created_at (data da captura) para filtro de período
      if (!matchesPeriodo(p.created_at)) return false;
      return true;
    });
  }, [publicacoesNaoLidas, coordenacaoId, monitoramentosDjen, matchesSearch, matchesPeriodo]);

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

  // Redistribuições filtradas por período
  const redistribuicoesFiltradas = useMemo(() => {
    return redistribuicoesData.filter(r => {
      if (coordenacaoId !== "todas") {
        const coord = coordenacoes.find(c => c.id === coordenacaoId);
        if (!coord || r.coordenacao_nome !== coord.nome) return false;
      }
      if (!matchesSearch(r.processo_numero)) return false;
      return true;
    });
  }, [redistribuicoesData, coordenacaoId, coordenacoes, searchQuery]);

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

  // Filter andamentos by coordination
  const andamentosFiltrados = useMemo(() => {
    return andamentosData.filter(a => {
      if (coordenacaoId !== "todas" && (a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.descricao) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo)) return false;
      return true;
    });
  }, [andamentosData, coordenacaoId, searchQuery]);

  // Stats - valores reais para os cards
  const stats = useMemo(() => {
    const djenReal = publicacoesFiltradas.length;
    const distribuicoesReal = distribuicoesFiltradas.length;
    const alertas360Real = alertasFiltrados.length;
    const redistribuicoesReal = redistribuicoesFiltradas.length;
    const prazosReal = prazosFiltrados.length;
    const notifsReal = notificacoesFiltradas.length;
    const tarefasReal = tarefasFiltradas.length;
    const audienciasReal = audienciasFiltradas.length;
    const intimacoesReal = intimacoesFiltradas.length;
    const andamentosReal = andamentosFiltrados.length;
    
    const totalReal = djenReal + distribuicoesReal + alertas360Real + redistribuicoesReal + 
                      prazosReal + tarefasReal + audienciasReal + intimacoesReal + andamentosReal;
    
    return {
      djen: djenReal,
      distribuicoes: distribuicoesReal,
      alertas360: alertas360Real,
      redistribuicoes: redistribuicoesReal,
      prazos: prazosReal,
      notificacoes: notifsReal,
      tarefas: tarefasReal,
      audiencias: audienciasReal,
      intimacoes: intimacoesReal,
      andamentos: andamentosReal,
      total: totalReal,
    };
  }, [
    publicacoesFiltradas, distribuicoesFiltradas, alertasFiltrados, redistribuicoesFiltradas,
    prazosFiltrados, notificacoesFiltradas, tarefasFiltradas, audienciasFiltradas, intimacoesFiltradas, andamentosFiltrados
  ]);

  const hoje = startOfDay(new Date());
  const hasActiveFilters = searchQuery || prioridadeFilter !== "todas" || statusFilter !== "pendente" || 
    (periodoInicio && periodoInicio.getTime() !== hoje.getTime()) || 
    (periodoFim && periodoFim.getTime() !== hoje.getTime()) || 
    coordenacaoId !== "todas";

  const clearAllFilters = () => {
    setSearchQuery("");
    setPrioridadeFilter("todas");
    setStatusFilter("pendente");
    setPeriodoInicio(startOfDay(new Date()));
    setPeriodoFim(startOfDay(new Date()));
    setCoordenacaoId("todas");
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

  const handleSelectCoordenacao = (id: string, category?: string) => {
    setCoordenacaoId(id);
    setFilterCategory(category);
    setActiveTab("detalhes");
  };

  const handleBackToDashboard = () => {
    setCoordenacaoId("todas");
    setFilterCategory(undefined);
    setActiveTab("dashboard");
  };

  return (
    <MainLayout title="Central de Notificações" subtitle={`${stats.total} alertas encontrados`}>
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

          {/* Second Row - Coordination, Member & Period */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Period Filters */}
            <div className="flex gap-1">
              <Button
                variant={periodoInicio?.getTime() === startOfDay(new Date()).getTime() && periodoFim?.getTime() === startOfDay(new Date()).getTime() ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => {
                  setPeriodoInicio(startOfDay(new Date()));
                  setPeriodoFim(startOfDay(new Date()));
                }}
              >
                Hoje
              </Button>
              <Button
                variant={!periodoInicio && !periodoFim ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => {
                  setPeriodoInicio(undefined);
                  setPeriodoFim(undefined);
                }}
              >
                Tudo
              </Button>
            </div>

            {/* Period Filters - Data Início */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2 w-full sm:w-auto", periodoInicio && "bg-primary/10")}>
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">De:</span>
                  {periodoInicio ? format(periodoInicio, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Data Início</p>
                </div>
                <Calendar
                  mode="single"
                  selected={periodoInicio}
                  onSelect={setPeriodoInicio}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
                <div className="p-3 border-t flex justify-between gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoInicio(startOfDay(new Date()))}
                  >
                    Hoje
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoInicio(undefined)}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Period Filters - Data Fim */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2 w-full sm:w-auto", periodoFim && "bg-primary/10")}>
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Até:</span>
                  {periodoFim ? format(periodoFim, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Data Fim</p>
                </div>
                <Calendar
                  mode="single"
                  selected={periodoFim}
                  onSelect={setPeriodoFim}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  initialFocus
                />
                <div className="p-3 border-t flex justify-between gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoFim(startOfDay(new Date()))}
                  >
                    Hoje
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPeriodoFim(undefined)}
                  >
                    Limpar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Results counter chip */}
            <Badge variant="outline" className="h-8 px-3 text-xs font-medium bg-primary/10 border-primary/30 text-primary">
              {stats.total} alerta{stats.total !== 1 ? "s" : ""} encontrado{stats.total !== 1 ? "s" : ""}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1">
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>

            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setPdfDialogOpen(true)} 
              className="h-8 text-xs gap-1 bg-gold hover:bg-gold/90 text-navy-deep"
            >
              <Download className="w-3 h-3" />
              Relatório PDF
            </Button>
          </div>

        </div>
      </div>


      {/* Cards de resumo por tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-3 mb-6">
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
            activeTab === "andamentos" && "ring-2 ring-violet-600"
          )}
          onClick={() => setActiveTab("andamentos")}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="p-1.5 rounded-lg bg-violet-600/10">
                <Activity className="w-4 h-4 text-violet-600" />
              </div>
              <Badge variant="secondary" className="bg-violet-600/10 text-violet-600 text-xs px-1.5">
                {stats.andamentos}
              </Badge>
            </div>
            <p className="mt-2 text-xs font-medium">Andamentos</p>
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

        {/* Detalhes da Coordenação */}
        <TabsContent value="detalhes" className="space-y-4">
          {coordenacaoId !== "todas" && (
            <CoordenacaoDetalhesView
              coordenacaoId={coordenacaoId}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              statusFilter={statusFilter}
              searchQuery={searchQuery}
              filterCategory={filterCategory}
              onBack={handleBackToDashboard}
              onClearCategory={() => setFilterCategory(undefined)}
            />
          )}
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
                  <div className="space-y-2">
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
                  </div>
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
                  <div className="space-y-2">
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
                  </div>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
                  </div>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {distribuicoesFiltradas.slice(0, 5).map((dist) => (
                      <div key={dist.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{dist.numero_processo}</p>
                        <p className="text-xs text-muted-foreground">{dist.classe || 'Sem classe'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dist.tribunal || 'Tribunal não informado'}
                        </p>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {redistribuicoesFiltradas.slice(0, 5).map((red) => (
                      <div key={red.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{red.processo_numero}</p>
                        <p className="text-xs text-muted-foreground">{red.vara_antiga} → {red.vara_nova}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
                  </div>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Andamentos */}
        <TabsContent value="andamentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-600" />
                Andamentos Recentes ({stats.andamentos})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {andamentosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum andamento encontrado no período
                </div>
              ) : (
                  <div className="space-y-3">
                    {andamentosFiltrados.map((andamento) => {
                      const coordId = (andamento.processo as any)?.coordenacao_id;
                      const coord = coordenacoes.find(c => c.id === coordId);
                      return (
                        <Card key={andamento.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge variant="outline" className="bg-violet-600/10 text-violet-600">
                                    {andamento.tipo || 'Movimentação'}
                                  </Badge>
                                  {andamento.fonte && (
                                    <Badge variant="secondary" className="text-xs">
                                      {andamento.fonte}
                                    </Badge>
                                  )}
                                  {coord && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {coord.nome}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium line-clamp-2">{andamento.descricao}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Processo: {(andamento.processo as any)?.numero || '-'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Capturado: {(andamento as any).created_at && format(new Date((andamento as any).created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                              {(andamento.processo as any)?.id && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate(`/processos/${(andamento.processo as any).id}`)}
                                >
                                  Ver processo
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para gerar PDF */}
      <GerarRelatorioPdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        statusFilter={statusFilter}
      />
    </MainLayout>
  );
}
