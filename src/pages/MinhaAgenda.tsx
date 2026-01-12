import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  ChevronDown,
  CalendarDays,
  List,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Tag,
  MapPin,
  Coins,
  Briefcase,
  Eye,
  ListChecks,
  Send,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, differenceInDays, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { useAgendaUnificada, useUpdateItemAgenda, useDeleteItemAgenda, ItemAgendaUnificado, AgendaUnificadaFilters } from "@/hooks/useAgendaUnificada";
import { useUpdateEvento, useDeleteEvento, EventoAgenda } from "@/hooks/useEventosAgenda";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { TarefaAgendaPanel } from "@/components/agenda/TarefaAgendaPanel";
import { AcoesEmLoteDialog } from "@/components/delegacao/AcoesEmLoteDialog";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "lista" | "dia" | "semana" | "mes";
type StatusFiltro = "todas" | "pendente" | "concluido" | "atrasado";
type PeriodoFiltro = "hoje" | "semana" | "quinzena" | "mes" | "todas";

const TIME_ZONE = "America/Sao_Paulo";

const TIPO_CORES: Record<string, string> = {
  evento: "bg-blue-500",
  tarefa: "bg-amber-500",
  tarefa_delegada: "bg-orange-500",
  prazo: "bg-red-500",
  audiencia: "bg-purple-500",
  prazo_parcela: "bg-emerald-500",
  parcelamento: "bg-teal-500",
};

const TIPO_LABELS: Record<string, string> = {
  evento: "EVENTO",
  tarefa: "TAREFA",
  tarefa_delegada: "DELEGADA",
  prazo: "PRAZO",
  audiencia: "AUDIÊNCIA",
  prazo_parcela: "PARCELA",
  parcelamento: "PARCELAMENTO",
};

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: "bg-slate-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  urgente: "bg-red-600",
};

const periodoFiltroLabel: Record<PeriodoFiltro, string> = {
  hoje: "Hoje",
  semana: "Semana",
  quinzena: "15 dias",
  mes: "Mês",
  todas: "Todas",
};

export default function MinhaAgenda() {
  const { user } = useAuth();
  const { isAdminOrCoordinator, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Filter state
  const [search, setSearch] = useState("");
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("todas");
  const [membrosFiltro, setMembrosFiltro] = useState<string[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todas");
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("todas");
  const [tiposFiltro, setTiposFiltro] = useState<string[]>(["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "prazo_parcela", "parcelamento"]);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<string>("mais-antigas");
  
  // Dialog/Panel state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [selectedParcelamento, setSelectedParcelamento] = useState<EventoAgenda | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; origem: "evento" | "tarefa" } | null>(null);
  
  // Batch selection
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [acoesLoteOpen, setAcoesLoteOpen] = useState(false);
  
  // Popover states
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [pessoasPopoverOpen, setPessoasPopoverOpen] = useState(false);
  const [coordenacaoAutoDetected, setCoordenacaoAutoDetected] = useState(false);
  const [membrosAutoDetected, setMembrosAutoDetected] = useState(false);

  const updateEvento = useUpdateEvento();
  const deleteEvento = useDeleteEvento();
  const updateItemAgenda = useUpdateItemAgenda();
  const deleteItemAgenda = useDeleteItemAgenda();

  // Auto-detect user's coordination
  const { data: userCoordenacao } = useQuery({
    queryKey: ["user-coordenacao", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });

  // Auto-set coordination when detected
  useEffect(() => {
    if (userCoordenacao && !coordenacaoAutoDetected && isAdminOrCoordinator) {
      setCoordenacaoFiltro(userCoordenacao);
      setCoordenacaoAutoDetected(true);
    }
  }, [userCoordenacao, coordenacaoAutoDetected, isAdminOrCoordinator]);

  // Auto-filter by logged user when not admin
  useEffect(() => {
    if (user?.id && membrosFiltro.length === 0 && !isAdminOrCoordinator && !membrosAutoDetected) {
      setMembrosFiltro([user.id]);
      setMembrosAutoDetected(true);
    }
  }, [user?.id, isAdminOrCoordinator, membrosFiltro.length, membrosAutoDetected]);

  // If role becomes admin/coordinator, undo the auto-filter (so totals  list are not restricted to only the logged user)
  useEffect(() => {
    if (
      isAdminOrCoordinator &&
      user?.id &&
      membrosAutoDetected &&
      membrosFiltro.length === 1 &&
      membrosFiltro[0] === user.id
    ) {
      setMembrosFiltro([]);
      setMembrosAutoDetected(false);
    }
  }, [isAdminOrCoordinator, user?.id, membrosAutoDetected, membrosFiltro]);

  // Fetch coordenações
  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch membros based on selected coordination
  const { data: membros } = useQuery({
    queryKey: ["membros-agenda", coordenacaoFiltro],
    queryFn: async () => {
      let query = supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario_id,
          cargo,
          coordenacao_id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
        `);

      if (coordenacaoFiltro !== "todas") {
        query = query.eq("coordenacao_id", coordenacaoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome")
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Unique membros for filter
  const membrosUnicos = useMemo(() => {
    if (!membros) return [];
    const uniqueMap = new Map();
    membros.forEach(m => {
      if (m.usuario?.id && !uniqueMap.has(m.usuario.id)) {
        uniqueMap.set(m.usuario.id, m.usuario);
      }
    });
    return Array.from(uniqueMap.values());
  }, [membros]);

  // Calculate date range based on view mode and period filter
  const getDateRange = useMemo(() => {
    // For calendar views (dia, semana, mes), use selectedDate
    if (viewMode !== "lista") {
      switch (viewMode) {
        case "dia":
          return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
        case "semana":
          return { start: startOfWeek(selectedDate, { locale: ptBR }), end: endOfWeek(selectedDate, { locale: ptBR }) };
        case "mes":
          return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
      }
    }
    
    // For lista view, use periodoFiltro
    const nowBrt = toZonedTime(new Date(), TIME_ZONE);
    const hojeBrtStart = startOfDay(nowBrt);

    switch (periodoFiltro) {
      case "hoje":
        return { start: hojeBrtStart, end: endOfDay(nowBrt) };
      case "semana":
        return { start: startOfWeek(hojeBrtStart, { weekStartsOn: 1 }), end: endOfWeek(hojeBrtStart, { weekStartsOn: 1 }) };
      case "quinzena":
        return { start: hojeBrtStart, end: endOfDay(addDays(hojeBrtStart, 15)) };
      case "mes":
        return { start: startOfMonth(hojeBrtStart), end: endOfMonth(hojeBrtStart) };
      case "todas":
      default:
        return { start: undefined, end: undefined };
    }
  }, [viewMode, selectedDate, periodoFiltro]);

  // Build filters for agenda
  const filters: AgendaUnificadaFilters = {
    tipos: tiposFiltro.length > 0 ? tiposFiltro : undefined,
    status: statusFiltro === "atrasado" ? "pendente" : statusFiltro,
    dataInicio: getDateRange.start,
    dataFim: getDateRange.end,
    responsavelIds: membrosFiltro.length > 0 ? membrosFiltro : (isAdminOrCoordinator ? undefined : user?.id ? [user.id] : undefined),
    coordenacaoId: coordenacaoFiltro !== "todas" ? coordenacaoFiltro : undefined,
    clienteId: clienteFiltro !== "todos" ? clienteFiltro : undefined,
  };

  const { data: itensAgenda, isLoading } = useAgendaUnificada(filters);

  // Stats via COUNT
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["agenda-stats-unified", coordenacaoFiltro, membrosFiltro, clienteFiltro, user?.id, isAdminOrCoordinator],
    queryFn: async () => {
      const hoje = format(toZonedTime(new Date(), TIME_ZONE), "yyyy-MM-dd");
      
      // If coordination is selected, get process IDs for that coordination
      let processoIds: string[] | null = null;
      if (coordenacaoFiltro !== "todas") {
        const { data: processos } = await supabase
          .from("processos")
          .select("id")
          .eq("coordenacao_id", coordenacaoFiltro);
        processoIds = processos?.map(p => p.id) || [];
      }

      // If client is selected, filter process IDs further
      if (clienteFiltro !== "todos") {
        const { data: processos } = await supabase
          .from("processos")
          .select("id")
          .eq("cliente_id", clienteFiltro);
        const clienteProcessoIds = processos?.map(p => p.id) || [];
        if (processoIds) {
          processoIds = processoIds.filter(id => clienteProcessoIds.includes(id));
        } else {
          processoIds = clienteProcessoIds;
        }
      }

      const buildQuery = () => {
        let q = supabase.from("tarefas").select("*", { count: "exact", head: true });

        // Filter by process coordination/client if applicable
        if (processoIds !== null) {
          if (processoIds.length === 0) {
            // No processes match the filter - but we still want to count tasks without process
            // that match other criteria (responsavel/criador)
          } else {
            q = q.in("processo_id", processoIds);
          }
        }

        // When filtering by people
        if (membrosFiltro.length > 0) {
          if (membrosFiltro.length === 1 && user?.id && membrosFiltro[0] === user.id) {
            q = q.or(`responsavel_id.in.(${user.id}),criado_por.eq.${user.id}`);
          } else {
            q = q.in("responsavel_id", membrosFiltro);
          }
        } else if (!isAdminOrCoordinator && user?.id) {
          q = q.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
        }
        // For admin/coordinator without member filter, don't restrict by responsavel
        // (already filtered by processo_id if coordination is selected)

        return q;
      };

      const [totalRes, pendentesTotalRes, atrasadasRes, concluidasRes] = await Promise.all([
        buildQuery(),
        buildQuery().eq("status", "pendente"),
        buildQuery().eq("status", "pendente").lt("data_vencimento", hoje),
        buildQuery().eq("status", "cumprido"),
      ]);

      const total = totalRes.count ?? 0;
      const pendentesTotal = pendentesTotalRes.count ?? 0;
      const atrasadas = atrasadasRes.count ?? 0;
      const concluidas = concluidasRes.count ?? 0;
      const pendentes = pendentesTotal - atrasadas;

      return { total, pendentes, atrasadas, concluidas };
    },
    enabled: !!user?.id && !roleLoading,
  });

  // Filter and sort items
  const itensFiltrados = useMemo(() => {
    if (!itensAgenda) return [];
    
    let result = itensAgenda;
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item =>
        item.titulo?.toLowerCase().includes(searchLower) ||
        item.descricao?.toLowerCase().includes(searchLower) ||
        item.processo?.numero?.toLowerCase().includes(searchLower) ||
        item.responsavel?.nome?.toLowerCase().includes(searchLower)
      );
    }
    
    // Atrasado filter
    if (statusFiltro === "atrasado") {
      result = result.filter(item => item.is_atrasado);
    }
    
    // Prioridade filter
    if (prioridadeFiltro !== "todas") {
      result = result.filter(item => item.prioridade === prioridadeFiltro);
    }
    
    // Sort
    if (ordenacao === "mais-recentes") {
      result = [...result].sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());
    } else if (ordenacao === "prioridade") {
      const prioridadeOrdem = { urgente: 0, alta: 1, media: 2, baixa: 3 };
      result = [...result].sort((a, b) => 
        (prioridadeOrdem[a.prioridade as keyof typeof prioridadeOrdem] ?? 4) - 
        (prioridadeOrdem[b.prioridade as keyof typeof prioridadeOrdem] ?? 4)
      );
    }
    
    return result;
  }, [itensAgenda, search, statusFiltro, prioridadeFiltro, ordenacao]);

  // Handlers
  const clearAllFilters = () => {
    setSearch("");
    setStatusFiltro("todas");
    setPrioridadeFiltro("todas");
    setPeriodoFiltro("todas");
    setOrdenacao("mais-antigas");
    setTiposFiltro(["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "prazo_parcela", "parcelamento"]);
    if (isAdminOrCoordinator) {
      setCoordenacaoFiltro(userCoordenacao || "todas");
      setMembrosFiltro([]);
    }
  };

  const handleOpenItem = (item: ItemAgendaUnificado) => {
    setSelectedItem(item);
  };

  const handleEditItem = (item: ItemAgendaUnificado) => {
    if (item.tipo === "parcelamento") {
      setSelectedParcelamento(item as unknown as EventoAgenda);
      setParcelasDialogOpen(true);
    } else if (item.origem === "evento") {
      setSelectedEvento(item as unknown as EventoAgenda);
      setDialogOpen(true);
    } else {
      setSelectedItem(item);
    }
  };

  const handleDeleteItem = (id: string, origem: "evento" | "tarefa") => {
    setItemToDelete({ id, origem });
    setDeleteDialogOpen(true);
  };

  const handleDeleteFromList = async (id: string, origem: "evento" | "tarefa") => {
    try {
      if (origem === "tarefa") {
        await supabase.from("tarefas").delete().eq("id", id);
      } else {
        await supabase.from("eventos_agenda").delete().eq("id", id);
      }
      queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-stats-unified"] });
    } catch (error) {
      console.error("Erro ao excluir:", error);
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await handleDeleteFromList(itemToDelete.id, itemToDelete.origem);
    }
  };

  const handleConcluirItem = async (item: ItemAgendaUnificado) => {
    await updateItemAgenda.mutateAsync({
      id: item.id,
      origem: item.origem,
      status: item.status === "concluido" || item.status === "cumprido" ? "pendente" : "concluido",
      concluido_em: item.status === "concluido" || item.status === "cumprido" ? null : new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["agenda-stats-unified"] });
  };

  const toggleTipo = (tipo: string) => {
    setTiposFiltro(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const togglePessoa = (id: string) => {
    setMembrosFiltro(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === itensFiltrados.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(itensFiltrados.filter(i => i.origem === "tarefa").map(a => a.id));
    }
  };

  const handleStatClick = (stat: StatusFiltro) => {
    setStatusFiltro(stat);
    setPrioridadeFiltro("todas");
    setPeriodoFiltro("todas");
    setSearch("");
  };

  const renderItemCard = (item: ItemAgendaUnificado) => {
    const dataItem = toZonedTime(new Date(item.data_inicio), TIME_ZONE);
    const dataFim = item.data_fim ? toZonedTime(new Date(item.data_fim), TIME_ZONE) : null;
    const isHoje = isToday(dataItem);
    const isSelected = selectedItem?.id === item.id;
    const isItemSelected = selectedItems.includes(item.id);
    
    return (
      <div
        key={item.id}
        className={cn(
          "flex gap-3 p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors",
          item.status === "concluido" && "opacity-60",
          item.is_atrasado && "border-l-4 border-l-destructive",
          isSelected && "bg-muted/80"
        )}
        onClick={() => handleOpenItem(item)}
      >
        {/* Checkbox for batch selection (only tarefas) */}
        {item.origem === "tarefa" && (
          <div className="pt-1">
            <Checkbox
              checked={isItemSelected}
              onCheckedChange={() => toggleSelectItem(item.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className={cn("w-1.5 rounded-full shrink-0", TIPO_CORES[item.tipo] || "bg-gray-400")} />
        
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Status Badge */}
                {item.status === "concluido" || item.status === "cumprido" ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Concluído
                  </Badge>
                ) : item.is_atrasado ? (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Atrasado
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente
                  </Badge>
                )}
                
                {/* Tipo Badge */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-medium",
                    item.tipo === "audiencia" && "border-purple-500 text-purple-600",
                    item.tipo === "prazo" && "border-red-500 text-red-600",
                    item.tipo === "tarefa" && "border-amber-500 text-amber-600",
                    item.tipo === "tarefa_delegada" && "border-orange-500 text-orange-600",
                    item.tipo === "evento" && "border-blue-500 text-blue-600"
                  )}
                >
                  {TIPO_LABELS[item.tipo] || item.tipo.toUpperCase()}
                </Badge>
                
                {/* Prioridade */}
                {item.prioridade && (
                  <Badge className={cn("text-xs text-white", PRIORIDADE_CORES[item.prioridade] || "bg-gray-500")}>
                    {item.prioridade.charAt(0).toUpperCase() + item.prioridade.slice(1)}
                  </Badge>
                )}
              </div>
              
              <h3 className={cn(
                "font-medium text-sm line-clamp-2",
                (item.status === "concluido" || item.status === "cumprido") && "line-through text-muted-foreground"
              )}>
                {item.titulo || "Sem título"}
              </h3>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenItem(item);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>

          {/* Process info */}
          {item.processo && (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{item.processo.numero}</span>
            </div>
          )}

          {/* Description */}
          {item.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.descricao}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {isHoje ? "Hoje" : format(dataItem, "dd/MM/yy", { locale: ptBR })}
                {!item.dia_inteiro && ` ${format(dataItem, "HH:mm")}`}
              </span>
              
              {item.responsavel && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {item.responsavel.nome}
                </span>
              )}
              
              {item.local && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.local}
                </span>
              )}
            </div>
            
            {item.dias_restantes !== undefined && item.status !== "concluido" && item.status !== "cumprido" && (
              <span className={cn(
                "text-xs font-medium",
                item.dias_restantes < 0 && "text-destructive",
                item.dias_restantes === 0 && "text-orange-500",
                item.dias_restantes > 0 && item.dias_restantes <= 3 && "text-yellow-600"
              )}>
                {item.dias_restantes < 0 
                  ? `${Math.abs(item.dias_restantes)} dias atrasado`
                  : item.dias_restantes === 0 
                    ? "Vence hoje"
                    : `${item.dias_restantes} dias restantes`
                }
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (roleLoading) {
    return (
      <MainLayout title="Agenda">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Agenda" subtitle="Gerencie tarefas, eventos, prazos e audiências">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nova Atividade
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/nova-tarefa")}>
                <ListChecks className="w-4 h-4 mr-2" />
                Nova Tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedEvento(null); setDialogOpen(true); }}>
                <CalendarDays className="w-4 h-4 mr-2" />
                Novo Evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setParcelasDialogOpen(true)}>
                <Coins className="w-4 h-4 mr-2" />
                Gerar Parcelas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card
            className={cn(
              "cursor-pointer hover:border-primary/50 transition-colors",
              statusFiltro === "todas" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => handleStatClick("todas")}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate">Total</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats?.total ?? 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card
            className={cn(
              "cursor-pointer hover:border-blue-500/50 transition-colors",
              statusFiltro === "pendente" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => handleStatClick("pendente")}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate">Pendentes</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.pendentes ?? 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card
            className={cn(
              "cursor-pointer hover:border-red-500/50 transition-colors",
              statusFiltro === "atrasado" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => handleStatClick("atrasado")}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate">Atrasadas</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{stats?.atrasadas ?? 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card
            className={cn(
              "cursor-pointer hover:border-green-500/50 transition-colors",
              statusFiltro === "concluido" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => handleStatClick("concluido")}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate">Concluídas</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.concluidas ?? 0}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {/* View Mode */}
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <SelectTrigger className="w-full sm:w-32 text-xs sm:text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lista">
                      <div className="flex items-center gap-2">
                        <List className="w-4 h-4" />
                        Lista
                      </div>
                    </SelectItem>
                    <SelectItem value="dia">Por dia</SelectItem>
                    <SelectItem value="semana">Por semana</SelectItem>
                    <SelectItem value="mes">Por mês</SelectItem>
                  </SelectContent>
                </Select>

                {/* Coordination Filter (admins only) */}
                {isAdminOrCoordinator && (
                  <Select value={coordenacaoFiltro} onValueChange={(v) => { setCoordenacaoFiltro(v); setMembrosFiltro([]); }}>
                    <SelectTrigger className="w-full sm:w-[280px] text-xs sm:text-sm h-9">
                      <SelectValue placeholder="Coordenação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas Coordenações</SelectItem>
                      {coordenacoes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Members Filter (admins only) */}
                {isAdminOrCoordinator && (
                  <Popover open={pessoasPopoverOpen} onOpenChange={setPessoasPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 h-9 text-xs sm:text-sm">
                        <Users className="w-4 h-4" />
                        {membrosFiltro.length > 0 ? `${membrosFiltro.length} membros` : "Membros"}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="space-y-4">
                        <div className="font-medium">Membros</div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {membrosUnicos.map((usuario) => (
                            <div key={usuario.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`filter-user-${usuario.id}`}
                                checked={membrosFiltro.includes(usuario.id)}
                                onCheckedChange={() => togglePessoa(usuario.id)}
                              />
                              <Label htmlFor={`filter-user-${usuario.id}`} className="cursor-pointer text-sm">
                                {usuario.nome}
                              </Label>
                            </div>
                          ))}
                          {membrosUnicos.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Nenhum membro disponível
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button variant="ghost" size="sm" onClick={() => setMembrosFiltro([])}>
                            Limpar
                          </Button>
                          <Button size="sm" onClick={() => setPessoasPopoverOpen(false)}>
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Period Filter (lista view only) */}
                {viewMode === "lista" && (
                  <Select value={periodoFiltro} onValueChange={(v) => setPeriodoFiltro(v as PeriodoFiltro)}>
                    <SelectTrigger className="w-full sm:w-[130px] text-xs sm:text-sm h-9">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="semana">Semana</SelectItem>
                      <SelectItem value="quinzena">15 dias</SelectItem>
                      <SelectItem value="mes">Mês</SelectItem>
                      <SelectItem value="todas">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Date Picker for calendar views */}
                {viewMode !== "lista" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 h-9 text-xs sm:text-sm">
                        <CalendarDays className="w-4 h-4" />
                        {format(selectedDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* Prioridade */}
                <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
                  <SelectTrigger className="w-full sm:w-[130px] text-xs sm:text-sm h-9">
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

                {/* Ordenação */}
                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger className="w-full sm:w-[150px] text-xs sm:text-sm h-9">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mais-antigas">Mais antigas</SelectItem>
                    <SelectItem value="mais-recentes">Mais recentes</SelectItem>
                    <SelectItem value="prioridade">Prioridade</SelectItem>
                  </SelectContent>
                </Select>

                {/* Tipos Filter */}
                <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 h-9 text-xs sm:text-sm">
                      <Tag className="w-4 h-4" />
                      Tipos
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <div className="space-y-4">
                      <div className="font-medium">Exibir</div>
                      <div className="space-y-2">
                        {["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "prazo_parcela", "parcelamento"].map((tipo) => (
                          <div key={tipo} className="flex items-center gap-2">
                            <Checkbox
                              id={`tipo-${tipo}`}
                              checked={tiposFiltro.includes(tipo)}
                              onCheckedChange={() => toggleTipo(tipo)}
                            />
                            <Label htmlFor={`tipo-${tipo}`} className="cursor-pointer capitalize text-sm">
                              {TIPO_LABELS[tipo] || tipo}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="ghost" size="sm" onClick={() => setTiposFiltro(["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "prazo_parcela", "parcelamento"])}>
                          Todos
                        </Button>
                        <Button size="sm" onClick={() => setFilterPopoverOpen(false)}>
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Cliente Filter */}
                <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
                  <SelectTrigger className="w-full sm:w-[180px] text-xs sm:text-sm h-9">
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos clientes</SelectItem>
                    {clientes?.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters & Batch Actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusFiltro !== "todas" && (
                    <Badge variant="outline" className="text-xs">
                      Status: {statusFiltro === "atrasado" ? "Atrasadas" : statusFiltro === "pendente" ? "Pendentes" : "Concluídas"}
                    </Badge>
                  )}
                  {prioridadeFiltro !== "todas" && (
                    <Badge variant="outline" className="text-xs">
                      Prioridade: {prioridadeFiltro}
                    </Badge>
                  )}
                  {(statusFiltro !== "todas" || prioridadeFiltro !== "todas" || search) && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAllFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>

                {selectedItems.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="text-primary"
                    onClick={() => setAcoesLoteOpen(true)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Ações em lote ({selectedItems.length})
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Header for calendar views */}
        {viewMode !== "lista" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">
              {viewMode === "dia" && format(selectedDate, "'Hoje •' dd/MM/yyyy", { locale: ptBR })}
              {viewMode === "semana" && getDateRange.start && getDateRange.end && `Semana de ${format(getDateRange.start, "dd/MM")} a ${format(getDateRange.end, "dd/MM/yyyy")}`}
              {viewMode === "mes" && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <span className="text-sm">
              Mostrando {itensFiltrados.length} atividades
            </span>
          </div>
        )}

        {/* Main Content Area with Side Panel */}
        <div className="flex gap-4">
          {/* Activities List */}
          <Card className={cn("transition-all", selectedItem ? "flex-1" : "w-full")}>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  Atividades
                  <Badge variant="secondary" className="text-xs">{itensFiltrados.length}</Badge>
                </CardTitle>
                <div className="hidden sm:flex items-center gap-2">
                  <Checkbox 
                    checked={selectedItems.length === itensFiltrados.filter(i => i.origem === "tarefa").length && itensFiltrados.filter(i => i.origem === "tarefa").length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Selecionar todas</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : itensFiltrados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma atividade encontrada</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => { setSelectedEvento(null); setDialogOpen(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar evento
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-480px)] min-h-[300px]">
                  <div className="divide-y">
                    {itensFiltrados.map(renderItemCard)}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Side Panel for Details */}
          {selectedItem && (
            <div className="w-[400px] shrink-0 sticky top-4 max-h-[calc(100vh-200px)]">
              <TarefaAgendaPanel
                tarefa={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
                  queryClient.invalidateQueries({ queryKey: ["agenda-stats-unified"] });
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <EventoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        evento={selectedEvento}
      />

      <GerarParcelasDialog
        open={parcelasDialogOpen}
        onOpenChange={(open) => {
          setParcelasDialogOpen(open);
          if (!open) setSelectedParcelamento(null);
        }}
        evento={selectedParcelamento}
      />

      <AcoesEmLoteDialog
        open={acoesLoteOpen}
        onOpenChange={setAcoesLoteOpen}
        selectedIds={selectedItems}
        onSuccess={() => {
          setSelectedItems([]);
          queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] });
          queryClient.invalidateQueries({ queryKey: ["agenda-stats-unified"] });
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
