import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Building2,
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
import { format, isAfter, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DashboardCoordenacoes } from "@/components/notificacoes/DashboardCoordenacoes";
import { CoordenacaoDetalhesView } from "@/components/notificacoes/CoordenacaoDetalhesView";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export default function Notificacoes() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  // Central de Notificações
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(() => startOfDay(new Date()));
  
  // View expandida de coordenação
  const [selectedCoordDetalhes, setSelectedCoordDetalhes] = useState<{ id: string; nome: string } | null>(null);
  
  

  // Buscar coordenações onde o usuário é membro
  const { data: minhasCoordenacoes = [] } = useQuery({
    queryKey: ["minhas-coordenacoes-notif", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return data?.map(m => m.coordenacao_id) || [];
    },
    enabled: !!user?.id,
  });

  // Helper para verificar se uma coordenação pertence ao usuário
  const pertenceAoUsuario = useMemo(() => {
    return (coordId: string | null | undefined) => {
      if (!coordId) return false;
      if (isAdmin) return true; // Admin vê tudo
      return minhasCoordenacoes.includes(coordId);
    };
  }, [isAdmin, minhasCoordenacoes]);

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
      const mon = monitoramentosDjen.find(m => m.id === p.monitoramento_id);
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(mon?.coordenacao_id)) return false;
      if (coordenacaoId !== "todas") {
        if (mon?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      // Usar created_at (data da captura) para filtro de período
      if (!matchesPeriodo(p.created_at)) return false;
      return true;
    });
  }, [publicacoesNaoLidas, coordenacaoId, monitoramentosDjen, matchesSearch, matchesPeriodo, pertenceAoUsuario]);

  // Filter distributions by coordination
  const distribuicoesPendentes = distribuicoesEncontradas.filter(d => 
    statusFilter === "todas" || d.status === 'pendente'
  );
  const distribuicoesFiltradas = useMemo(() => {
    return distribuicoesPendentes.filter(d => {
      const coordId = (d as any).monitoramento?.coordenacao_id;
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(coordId)) return false;
      if (coordenacaoId !== "todas") {
        if (coordId !== coordenacaoId) return false;
      }
      if (!matchesSearch(d.numero_processo) && !matchesSearch(d.polo_ativo) && !matchesSearch(d.polo_passivo)) return false;
      if (!matchesPeriodo(d.data_distribuicao)) return false;
      return true;
    });
  }, [distribuicoesPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim, pertenceAoUsuario]);

  // Filter alerts by coordination
  const alertasPendentes = alertas.filter(a => 
    statusFilter === "todas" || a.status === 'pendente'
  );
  const alertasFiltrados = useMemo(() => {
    return alertasPendentes.filter(a => {
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(a.processo?.coordenacao_id)) return false;
      if (coordenacaoId !== "todas" && a.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.termo_encontrado) && !matchesSearch(a.processo?.numero)) return false;
      if (!matchesPeriodo(a.created_at)) return false;
      if (!matchesPrioridade(a.prioridade)) return false;
      return true;
    });
  }, [alertasPendentes, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter, pertenceAoUsuario]);

  // Redistribuições filtradas por período
  const redistribuicoesFiltradas = useMemo(() => {
    return redistribuicoesData.filter(r => {
      // Filtrar por coordenações do usuário (via nome)
      const coord = coordenacoes.find(c => c.nome === r.coordenacao_nome);
      if (!pertenceAoUsuario(coord?.id)) return false;
      if (coordenacaoId !== "todas") {
        if (!coord || coord.id !== coordenacaoId) return false;
      }
      if (!matchesSearch(r.processo_numero)) return false;
      return true;
    });
  }, [redistribuicoesData, coordenacaoId, coordenacoes, searchQuery, pertenceAoUsuario]);

  // Filter prazos by coordination
  const prazosFiltrados = useMemo(() => {
    const basePrazos = statusFilter === "todas" ? prazosPendentes : prazosUrgentes;
    return basePrazos.filter(p => {
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(p.processo?.coordenacao_id)) return false;
      if (coordenacaoId !== "todas" && p.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(p.titulo) && !matchesSearch(p.processo?.numero)) return false;
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesPrioridade(p.prioridade)) return false;
      return true;
    });
  }, [prazosPendentes, prazosUrgentes, statusFilter, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter, pertenceAoUsuario]);

  // Filter notificacoes by coordination
  const notificacoesFiltradas = useMemo(() => {
    const baseNotifs = statusFilter === "todas" ? notificacoes : naoLidas;
    return baseNotifs.filter(n => {
      const processoId = n.dados?.processo_id;
      const alertaRelacionado = alertas.find(a => a.processo_id === processoId);
      // Filtrar por coordenações do usuário
      if (alertaRelacionado && !pertenceAoUsuario(alertaRelacionado?.processo?.coordenacao_id)) return false;
      if (coordenacaoId !== "todas") {
        if (!processoId) return false;
        if (alertaRelacionado?.processo?.coordenacao_id !== coordenacaoId) return false;
      }
      if (!matchesSearch(n.titulo) && !matchesSearch(n.mensagem)) return false;
      if (!matchesPeriodo(n.created_at)) return false;
      return true;
    });
  }, [notificacoes, naoLidas, statusFilter, coordenacaoId, alertas, searchQuery, periodoInicio, periodoFim, pertenceAoUsuario]);

  // Filter tarefas by coordination
  const tarefasFiltradas = useMemo(() => {
    return tarefasPendentesData.filter(t => {
      const coordId = (t.processo as any)?.coordenacao_id;
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(coordId)) return false;
      if (coordenacaoId !== "todas" && coordId !== coordenacaoId) return false;
      if (!matchesSearch(t.titulo) && !matchesSearch((t.processo as any)?.numero)) return false;
      if (!matchesPeriodo(t.data_vencimento)) return false;
      if (!matchesPrioridade(t.prioridade)) return false;
      return true;
    });
  }, [tarefasPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim, prioridadeFilter, pertenceAoUsuario]);

  // Filter audiencias by coordination
  const audienciasFiltradas = useMemo(() => {
    return audienciasPendentesData.filter(a => {
      const coordId = (a.processo as any)?.coordenacao_id;
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(coordId)) return false;
      if (coordenacaoId !== "todas" && coordId !== coordenacaoId) return false;
      if (!matchesSearch(a.processo_numero) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo_audiencia)) return false;
      if (!matchesPeriodo(a.data_audiencia)) return false;
      return true;
    });
  }, [audienciasPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim, pertenceAoUsuario]);

  // Filter intimacoes by coordination
  const intimacoesFiltradas = useMemo(() => {
    return intimacoesPendentesData.filter(i => {
      const coordId = (i.processo as any)?.coordenacao_id;
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(coordId)) return false;
      if (coordenacaoId !== "todas" && coordId !== coordenacaoId) return false;
      if (!matchesSearch(i.processo_numero) && !matchesSearch((i.processo as any)?.numero) && !matchesSearch(i.tipo_intimacao)) return false;
      if (!matchesPeriodo(i.data_intimacao)) return false;
      return true;
    });
  }, [intimacoesPendentesData, coordenacaoId, searchQuery, periodoInicio, periodoFim, pertenceAoUsuario]);

  // Filter andamentos by coordination
  const andamentosFiltrados = useMemo(() => {
    return andamentosData.filter(a => {
      const coordId = (a.processo as any)?.coordenacao_id;
      // Filtrar por coordenações do usuário
      if (!pertenceAoUsuario(coordId)) return false;
      if (coordenacaoId !== "todas" && coordId !== coordenacaoId) return false;
      if (!matchesSearch(a.descricao) && !matchesSearch((a.processo as any)?.numero) && !matchesSearch(a.tipo)) return false;
      return true;
    });
  }, [andamentosData, coordenacaoId, searchQuery]);

  // Stats - recalculated based on filtered data
  const stats = useMemo(() => {
    const djen = publicacoesFiltradas.length;
    const distribuicoes = distribuicoesFiltradas.length;
    const alertas360 = alertasFiltrados.length;
    const redistribuicoes = redistribuicoesFiltradas.length;
    const prazos = prazosFiltrados.length;
    const tarefas = tarefasFiltradas.length;
    const audiencias = audienciasFiltradas.length;
    const intimacoes = intimacoesFiltradas.length;
    const andamentos = andamentosFiltrados.length;
    
    // Total sem duplicar notificações (que são reflexo dos demais alertas)
    const total = djen + distribuicoes + alertas360 + redistribuicoes + prazos + tarefas + audiencias + intimacoes + andamentos;
    
    return {
      djen,
      distribuicoes,
      alertas360,
      redistribuicoes,
      prazos,
      notificacoes: notificacoesFiltradas.length,
      tarefas,
      audiencias,
      intimacoes,
      andamentos,
      total,
      filteredTotal: total
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

  const handleSelectCoordenacao = (id: string) => {
    setCoordenacaoId(id);
  };

  const handleOpenDetalhes = (coord: { id: string; nome: string }) => {
    setSelectedCoordDetalhes(coord);
  };

  // Se tem uma coordenação selecionada para detalhes, mostrar view expandida
  if (selectedCoordDetalhes) {
    return (
      <MainLayout title="Central de Notificações" subtitle={`Detalhes de ${selectedCoordDetalhes.nome}`}>
        <CoordenacaoDetalhesView
          coordenacaoId={selectedCoordDetalhes.id}
          coordenacaoNome={selectedCoordDetalhes.nome}
          onBack={() => setSelectedCoordDetalhes(null)}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
        />
      </MainLayout>
    );
  }

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
              {stats.filteredTotal} alerta{stats.filteredTotal !== 1 ? "s" : ""} encontrado{stats.filteredTotal !== 1 ? "s" : ""}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1">
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>


      {/* Dashboard de Coordenações */}
      <DashboardCoordenacoes 
        onSelectCoordenacao={handleSelectCoordenacao}
        onOpenDetalhes={handleOpenDetalhes}
        selectedCoordenacaoId={coordenacaoId}
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />

    </MainLayout>
  );
}
