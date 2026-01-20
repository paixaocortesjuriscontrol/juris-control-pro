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
  X,
  CalendarRange,
  Zap,
  Scale,
  Gavel,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, differenceInDays, addDays, parseISO, addWeeks, addMonths, isBefore, isAfter, subDays } from "date-fns";
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
type PeriodoRapido = "hoje" | "amanha" | "semana" | "proxima_semana" | "quinzena" | "mes" | "proximo_mes" | "trimestre" | "ano" | "vencidas" | "proximos_3_dias" | "proximos_5_dias" | "customizado" | "todas";

interface QuickDateOption {
  label: string;
  value: PeriodoRapido;
  icon?: React.ReactNode;
  description?: string;
}

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

// Quick date filter options for lawyers
const QUICK_DATE_OPTIONS: QuickDateOption[] = [
  { label: "Hoje", value: "hoje", description: "Tarefas para hoje" },
  { label: "Amanhã", value: "amanha", description: "Tarefas para amanhã" },
  { label: "Próx. 3 dias", value: "proximos_3_dias", description: "Urgentes dos próximos 3 dias" },
  { label: "Próx. 5 dias", value: "proximos_5_dias", description: "Próximos 5 dias úteis" },
  { label: "Esta semana", value: "semana", description: "Até domingo" },
  { label: "Próx. semana", value: "proxima_semana", description: "Semana que vem" },
  { label: "15 dias", value: "quinzena", description: "Próximas duas semanas" },
  { label: "Este mês", value: "mes", description: "Até fim do mês" },
  { label: "Próx. mês", value: "proximo_mes", description: "Mês que vem" },
  { label: "Trimestre", value: "trimestre", description: "Próximos 3 meses" },
  { label: "Este ano", value: "ano", description: "Até dezembro" },
  { label: "Vencidas", value: "vencidas", description: "Tarefas atrasadas" },
  { label: "Personalizado", value: "customizado", description: "Escolher datas" },
  { label: "Todas", value: "todas", description: "Sem filtro de data" },
];

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
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("todas");
  const [dataInicioFiltro, setDataInicioFiltro] = useState<Date | undefined>(undefined);
  const [dataFimFiltro, setDataFimFiltro] = useState<Date | undefined>(undefined);
  const [tiposFiltro, setTiposFiltro] = useState<string[]>(["tarefa", "tarefa_delegada", "evento", "prazo", "audiencia", "prazo_parcela", "parcelamento"]);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<string>("mais-antigas");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
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
    // IMPORTANTE: nesta tela, NÃO auto-aplicamos filtro de coordenação.
    // (Admin/coordenador deve iniciar em "Todas"; e para não-admin, a agenda não deve esconder
    // itens por coordenação automaticamente.)
    if (userCoordenacao && !coordenacaoAutoDetected) {
      setCoordenacaoAutoDetected(true);
    }
  }, [userCoordenacao, coordenacaoAutoDetected]);

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

  const membroIdsCoordenacao = useMemo(() => {
    if (!membros) return [];
    return [...new Set(membros.map(m => m.usuario_id).filter(Boolean))];
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
    
    // For lista view, use periodoRapido or custom dates
    const nowBrt = toZonedTime(new Date(), TIME_ZONE);
    const hojeBrtStart = startOfDay(nowBrt);

    // If custom dates are set
    if (periodoRapido === "customizado" && (dataInicioFiltro || dataFimFiltro)) {
      return { 
        start: dataInicioFiltro ? startOfDay(dataInicioFiltro) : undefined, 
        end: dataFimFiltro ? endOfDay(dataFimFiltro) : undefined 
      };
    }

    switch (periodoRapido) {
      case "hoje":
        return { start: hojeBrtStart, end: endOfDay(nowBrt) };
      case "amanha":
        const amanha = addDays(hojeBrtStart, 1);
        return { start: amanha, end: endOfDay(amanha) };
      case "proximos_3_dias":
        return { start: hojeBrtStart, end: endOfDay(addDays(hojeBrtStart, 3)) };
      case "proximos_5_dias":
        return { start: hojeBrtStart, end: endOfDay(addDays(hojeBrtStart, 5)) };
      case "semana":
        return { start: startOfWeek(hojeBrtStart, { weekStartsOn: 1 }), end: endOfWeek(hojeBrtStart, { weekStartsOn: 1 }) };
      case "proxima_semana":
        const inicioProxSemana = addWeeks(startOfWeek(hojeBrtStart, { weekStartsOn: 1 }), 1);
        return { start: inicioProxSemana, end: endOfWeek(inicioProxSemana, { weekStartsOn: 1 }) };
      case "quinzena":
        return { start: hojeBrtStart, end: endOfDay(addDays(hojeBrtStart, 15)) };
      case "mes":
        return { start: startOfMonth(hojeBrtStart), end: endOfMonth(hojeBrtStart) };
      case "proximo_mes":
        const inicioProxMes = addMonths(startOfMonth(hojeBrtStart), 1);
        return { start: inicioProxMes, end: endOfMonth(inicioProxMes) };
      case "trimestre":
        return { start: hojeBrtStart, end: endOfDay(addMonths(hojeBrtStart, 3)) };
      case "ano":
        return { start: hojeBrtStart, end: new Date(hojeBrtStart.getFullYear(), 11, 31, 23, 59, 59) };
      case "vencidas":
        return { start: new Date(2020, 0, 1), end: subDays(hojeBrtStart, 1) };
      case "todas":
      default:
        return { start: undefined, end: undefined };
    }
  }, [viewMode, selectedDate, periodoRapido, dataInicioFiltro, dataFimFiltro]);

  const responsavelIdsForAgenda = useMemo(() => {
    if (membrosFiltro.length > 0) return membrosFiltro;
    if (!user?.id) return undefined;

    if (!isAdminOrCoordinator) return [user.id];

    if (coordenacaoFiltro !== "todas") {
      return membroIdsCoordenacao.length > 0 ? membroIdsCoordenacao : undefined;
    }

    return undefined;
  }, [membrosFiltro, user?.id, isAdminOrCoordinator, coordenacaoFiltro, membroIdsCoordenacao]);

  // Build filters for agenda
  const shouldFetchAll = isAdminOrCoordinator && coordenacaoFiltro === "todas" && membrosFiltro.length === 0;
  
  const filters: AgendaUnificadaFilters = {
    tipos: tiposFiltro.length > 0 ? tiposFiltro : undefined,
    status: statusFiltro === "atrasado" ? "pendente" : statusFiltro,
    dataInicio: getDateRange.start,
    dataFim: getDateRange.end,
    responsavelIds: responsavelIdsForAgenda,
    coordenacaoId: coordenacaoFiltro !== "todas" ? coordenacaoFiltro : undefined,
    clienteId: clienteFiltro !== "todos" ? clienteFiltro : undefined,
    fetchAll: shouldFetchAll,
  };

  const { data: itensAgenda, isLoading } = useAgendaUnificada(filters);

  // Para o cenário "Todas Coordenações" (sem membro específico), os totalizadores devem
  // refletir exatamente o que está na lista (evita inconsistência de filtros/COUNT).
  const shouldUseClientSideStats = shouldFetchAll;
  const statsFromItems = useMemo(() => {
    if (!shouldUseClientSideStats) return null;
    if (!itensAgenda) return null;

    const total = itensAgenda.length;
    const concluidas = itensAgenda.filter(i => i.status === "concluido" || i.status === "cumprido").length;
    const atrasadas = itensAgenda.filter(i => i.is_atrasado).length;
    const pendentes = Math.max(
      0,
      itensAgenda.filter(i => i.status !== "concluido" && i.status !== "cumprido").length - atrasadas
    );

    return { total, pendentes, atrasadas, concluidas };
  }, [itensAgenda, shouldUseClientSideStats]);

  // Stats via COUNT - includes both TAREFAS and EVENTOS
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["agenda-stats-unified", coordenacaoFiltro, membrosFiltro, clienteFiltro, user?.id, isAdminOrCoordinator, membroIdsCoordenacao],
    queryFn: async () => {
      const hoje = format(toZonedTime(new Date(), TIME_ZONE), "yyyy-MM-dd");
      
      // Client filter: tasks without processo_id are excluded when a client is selected
      let processoIdsCliente: string[] | null = null;
      if (clienteFiltro !== "todos") {
        const { data: processosCliente, error: processosClienteError } = await supabase
          .from("processos")
          .select("id")
          .eq("cliente_id", clienteFiltro);

        if (processosClienteError) throw processosClienteError;
        processoIdsCliente = processosCliente?.map(p => p.id) || [];

        if (processoIdsCliente.length === 0) {
          return { total: 0, pendentes: 0, atrasadas: 0, concluidas: 0 };
        }
      }

      // Coordination filter: for Agenda, it must work even when tasks are not linked to a process.
      // So we restrict by members of the coordination (responsavel_id).
      let membroIdsCoord: string[] | null = null;
      if (coordenacaoFiltro !== "todas") {
        membroIdsCoord = membroIdsCoordenacao.length > 0 ? membroIdsCoordenacao : null;

        if (!membroIdsCoord || membroIdsCoord.length === 0) {
          return { total: 0, pendentes: 0, atrasadas: 0, concluidas: 0 };
        }
      }

      // ========= TAREFAS STATS =========
      // shouldFetchAll: admin/coordinator sees all when "todas" coordenações and no member filter
      const shouldFetchAllStats = isAdminOrCoordinator && coordenacaoFiltro === "todas" && membrosFiltro.length === 0;
      
      const buildTarefaQuery = () => {
        let q = supabase.from("tarefas").select("*", { count: "exact", head: true });

        if (processoIdsCliente !== null) {
          q = q.in("processo_id", processoIdsCliente);
        }

        // Admin/coordinator with "todas" coordenações: fetch ALL tarefas
        if (shouldFetchAllStats) {
          return q;
        }

        // When filtering by people
        if (membrosFiltro.length > 0) {
          const membrosFilter = membrosFiltro.join(',');
          if (user?.id && membrosFiltro.includes(user.id)) {
            q = q.or(`responsavel_id.in.(${membrosFilter}),criado_por.eq.${user.id}`);
          } else if (user?.id) {
            q = q.or(`responsavel_id.in.(${membrosFilter}),and(criado_por.eq.${user.id},responsavel_id.in.(${membrosFilter}))`);
          } else {
            q = q.in("responsavel_id", membrosFiltro);
          }
        } else if (!isAdminOrCoordinator && user?.id) {
          q = q.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
        } else if (isAdminOrCoordinator && membroIdsCoord && membroIdsCoord.length > 0) {
          q = q.in("responsavel_id", membroIdsCoord);
        }

        return q;
      };

      // ========= EVENTOS STATS =========
      // Get participations for coordination members or specific users
      let userIdsForEvents: string[] = [];
      
      if (!shouldFetchAllStats) {
        if (membrosFiltro.length > 0) {
          userIdsForEvents = membrosFiltro;
        } else if (!isAdminOrCoordinator && user?.id) {
          userIdsForEvents = [user.id];
        } else if (isAdminOrCoordinator && membroIdsCoord && membroIdsCoord.length > 0) {
          userIdsForEvents = membroIdsCoord;
        }
      }

      // Get event IDs where these users participate
      let eventosParticipante: string[] = [];
      if (!shouldFetchAllStats && userIdsForEvents.length > 0) {
        const { data: participacoes } = await supabase
          .from("participantes_evento")
          .select("evento_id")
          .in("usuario_id", userIdsForEvents);
        eventosParticipante = participacoes?.map(p => p.evento_id) || [];
      }

      const buildEventoQuery = (statusFilter?: string, dateFilter?: { field: string; op: 'lt'; value: string }) => {
        let q = supabase.from("eventos_agenda").select("*", { count: "exact", head: true });
        
        // Apply status filter
        if (statusFilter) {
          q = q.eq("status", statusFilter);
        }

        // Apply date filter
        if (dateFilter) {
          q = q.lt(dateFilter.field, dateFilter.value);
        }

        // Admin/coordinator with "todas" coordenações: fetch ALL eventos
        if (shouldFetchAllStats) {
          return q;
        }
        
        if (userIdsForEvents.length > 0) {
          if (eventosParticipante.length > 0) {
            q = q.or(`criado_por.in.(${userIdsForEvents.join(',')}),id.in.(${eventosParticipante.join(',')})`);
          } else {
            q = q.in("criado_por", userIdsForEvents);
          }
        } else if (user?.id) {
          q = q.or(`criado_por.eq.${user.id}`);
        }

        return q;
      };

      // Execute all queries in parallel
      const [
        tarefasTotalRes,
        tarefasPendentesRes,
        tarefasAtrasadasRes,
        tarefasConcluidasRes,
        eventosTotalRes,
        eventosPendentesRes,
        eventosAtrasadosRes,
        eventosConcluidosRes,
      ] = await Promise.all([
        buildTarefaQuery(),
        buildTarefaQuery().eq("status", "pendente"),
        buildTarefaQuery().eq("status", "pendente").lt("data_vencimento", hoje),
        buildTarefaQuery().eq("status", "cumprido"),
        buildEventoQuery(),
        buildEventoQuery("pendente"),
        buildEventoQuery("pendente", { field: "data_inicio", op: "lt", value: hoje }),
        buildEventoQuery("concluido"),
      ]);

      const tarefasTotal = tarefasTotalRes.count ?? 0;
      const tarefasPendentesTotal = tarefasPendentesRes.count ?? 0;
      const tarefasAtrasadas = tarefasAtrasadasRes.count ?? 0;
      const tarefasConcluidas = tarefasConcluidasRes.count ?? 0;

      const eventosTotal = eventosTotalRes.count ?? 0;
      const eventosPendentesTotal = eventosPendentesRes.count ?? 0;
      const eventosAtrasados = eventosAtrasadosRes.count ?? 0;
      const eventosConcluidos = eventosConcluidosRes.count ?? 0;

      const total = tarefasTotal + eventosTotal;
      const atrasadas = tarefasAtrasadas + eventosAtrasados;
      const concluidas = tarefasConcluidas + eventosConcluidos;
      // Pendentes = total de pendentes que NÃO estão atrasadas (garantindo >= 0)
      const pendentes = Math.max(0, (tarefasPendentesTotal + eventosPendentesTotal) - atrasadas);

      return { total, pendentes, atrasadas, concluidas };
    },
    enabled: !!user?.id && !roleLoading,
  });

  const statsDisplay = statsFromItems ?? stats;

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
    setPeriodoRapido("todas");
    setDataInicioFiltro(undefined);
    setDataFimFiltro(undefined);
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
    setPeriodoRapido("todas");
    setDataInicioFiltro(undefined);
    setDataFimFiltro(undefined);
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
                  <p className="text-xl sm:text-2xl font-bold">{statsDisplay?.total ?? 0}</p>
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
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{statsDisplay?.pendentes ?? 0}</p>
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
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{statsDisplay?.atrasadas ?? 0}</p>
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
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{statsDisplay?.concluidas ?? 0}</p>
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

                {/* Date Filter (lista view only) */}
                {viewMode === "lista" && (
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "gap-2 h-9 text-xs sm:text-sm min-w-[140px] justify-start",
                          periodoRapido !== "todas" && "border-primary text-primary"
                        )}
                      >
                        <CalendarRange className="w-4 h-4" />
                        {periodoRapido === "customizado" && dataInicioFiltro 
                          ? `${format(dataInicioFiltro, "dd/MM")}${dataFimFiltro ? ` - ${format(dataFimFiltro, "dd/MM")}` : ""}`
                          : QUICK_DATE_OPTIONS.find(o => o.value === periodoRapido)?.label || "Período"
                        }
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <CalendarRange className="w-4 h-4" />
                          Filtrar por Data
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Escolha um período rápido ou defina datas personalizadas
                        </p>
                      </div>
                      
                      {/* Quick options grid */}
                      <div className="p-3 border-b">
                        <div className="grid grid-cols-3 gap-1.5">
                          {QUICK_DATE_OPTIONS.filter(o => o.value !== "customizado").map((option) => (
                            <Button
                              key={option.value}
                              variant={periodoRapido === option.value ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "text-xs h-8 justify-start",
                                periodoRapido === option.value && "bg-primary text-primary-foreground"
                              )}
                              onClick={() => {
                                setPeriodoRapido(option.value);
                                if (option.value !== "customizado") {
                                  setDataInicioFiltro(undefined);
                                  setDataFimFiltro(undefined);
                                }
                                if (option.value !== "customizado") {
                                  setDatePopoverOpen(false);
                                }
                              }}
                            >
                              {option.value === "vencidas" && <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />}
                              {option.value === "proximos_3_dias" && <Zap className="w-3 h-3 mr-1 text-amber-500" />}
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Custom date range */}
                      <div className="p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Período Personalizado</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Data Início</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-9 text-xs",
                                    !dataInicioFiltro && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarDays className="mr-2 h-4 w-4" />
                                  {dataInicioFiltro ? format(dataInicioFiltro, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={dataInicioFiltro}
                                  onSelect={(date) => {
                                    setDataInicioFiltro(date);
                                    if (date) setPeriodoRapido("customizado");
                                  }}
                                  locale={ptBR}
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Data Fim</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-9 text-xs",
                                    !dataFimFiltro && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarDays className="mr-2 h-4 w-4" />
                                  {dataFimFiltro ? format(dataFimFiltro, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={dataFimFiltro}
                                  onSelect={(date) => {
                                    setDataFimFiltro(date);
                                    if (date) setPeriodoRapido("customizado");
                                  }}
                                  disabled={(date) => dataInicioFiltro ? isBefore(date, dataInicioFiltro) : false}
                                  locale={ptBR}
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-3 border-t flex justify-between">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setPeriodoRapido("todas");
                            setDataInicioFiltro(undefined);
                            setDataFimFiltro(undefined);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Limpar
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => setDatePopoverOpen(false)}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
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
                        className="pointer-events-auto"
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
        <div className="flex flex-col lg:flex-row gap-4 min-w-0">
          {/* Activities List */}
          <Card className={cn("transition-all", selectedItem ? "w-full lg:flex-1" : "w-full")}>
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
            <div className="w-full lg:w-[400px] shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-200px)] min-w-0">
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
