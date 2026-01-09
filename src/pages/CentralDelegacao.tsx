import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, differenceInDays, isBefore, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { 
  Plus,
  Search,
  ListChecks,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { TarefaDetalhesDialog } from "@/components/delegacao/TarefaDetalhesDialog";
import { AcoesEmLoteDialog } from "@/components/delegacao/AcoesEmLoteDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TipoAtividade = "todos" | "tarefas" | "audiencias" | "compromissos";
type StatusFiltro = "todos" | "pendente" | "cumprido" | "atrasado";
type PeriodoFiltro = "hoje" | "semana" | "quinzena" | "mes" | "todas";

const statusFiltroLabel: Record<StatusFiltro, string> = {
  todos: "Todas",
  pendente: "Pendentes",
  cumprido: "Concluídas",
  atrasado: "Atrasadas",
};

const periodoFiltroLabel: Record<PeriodoFiltro, string> = {
  hoje: "Hoje",
  semana: "Semana",
  quinzena: "15 dias",
  mes: "Mês",
  todas: "Todas",
};

const prioridadeFiltroLabel: Record<string, string> = {
  todas: "Todas",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const ordenacaoLabel: Record<string, string> = {
  "mais-antigas": "Mais antigas",
  "mais-recentes": "Mais recentes",
  prioridade: "Prioridade",
};

export default function CentralDelegacao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdminOrCoordinator, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const TIME_ZONE = "America/Sao_Paulo";
  
  // State
  const [search, setSearch] = useState("");
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [membroId, setMembroId] = useState<string>("todos");
  const [tipoAtividade, setTipoAtividade] = useState<TipoAtividade>("todos");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("todas");
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>("todas");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [acoesLoteOpen, setAcoesLoteOpen] = useState(false);
  const [ordenacao, setOrdenacao] = useState<string>("mais-antigas");
  const [coordenacaoAutoDetected, setCoordenacaoAutoDetected] = useState(false);

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
      if (error) {
        console.error("Error fetching user coordination:", error);
        return null;
      }
      return data?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });

  // Auto-set coordination when detected
  useEffect(() => {
    if (userCoordenacao && !coordenacaoAutoDetected) {
      setCoordenacaoId(userCoordenacao);
      setCoordenacaoAutoDetected(true);
    }
  }, [userCoordenacao, coordenacaoAutoDetected]);

  const clearAllFilters = () => {
    setSearch("");
    setStatusFiltro("todos");
    setPrioridadeFiltro("todas");
    setPeriodoFiltro("hoje");
    setOrdenacao("mais-antigas");

    if (isAdminOrCoordinator) {
      setCoordenacaoId(userCoordenacao || "todas");
      setMembroId("todos");
    }
  };

  // Fetch coordenações
  const { data: coordenacoes, isLoading: loadingCoord } = useQuery({
    queryKey: ["coordenacoes-delegacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area, coordenador_id")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch membros based on selected coordination
  const { data: membros } = useQuery({
    queryKey: ["membros-delegacao", coordenacaoId],
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

      if (coordenacaoId !== "todas") {
        query = query.eq("coordenacao_id", coordenacaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate date range for period filter (sempre por DATA em Horário de Brasília)
  // Motivo: quando o banco devolve datas sem horário (YYYY-MM-DD), o JS interpreta como UTC 00:00,
  // o que "puxa" para o dia anterior em BRT (ex: 2026-01-09T00:00Z = 08/01 21:00 BRT).
  // Então aqui comparamos por "data" (yyyy-MM-dd) em BRT.
  const getDateRange = useMemo(() => {
    const nowBrt = toZonedTime(new Date(), TIME_ZONE);
    const hojeBrtStart = startOfDay(nowBrt);

    let inicioBrt: Date;
    let fimBrt: Date;

    switch (periodoFiltro) {
      case "hoje":
        inicioBrt = hojeBrtStart;
        fimBrt = endOfDay(nowBrt);
        break;

      case "semana":
        // Semana corrente (segunda a domingo)
        inicioBrt = startOfWeek(hojeBrtStart, { weekStartsOn: 1 });
        fimBrt = endOfWeek(hojeBrtStart, { weekStartsOn: 1 });
        break;

      case "quinzena":
        // Próximos 15 dias a partir de hoje
        inicioBrt = hojeBrtStart;
        fimBrt = endOfDay(addDays(hojeBrtStart, 15));
        break;

      case "mes":
        // Mês inteiro (do dia 1 ao último dia do mês corrente)
        inicioBrt = startOfMonth(hojeBrtStart);
        fimBrt = endOfMonth(hojeBrtStart);
        break;

      case "todas":
      default:
        return null;
    }

    const range = {
      inicio: format(inicioBrt, "yyyy-MM-dd"),
      fim: format(fimBrt, "yyyy-MM-dd"),
    };

    console.log(`[CentralDelegacao] periodo=${periodoFiltro} range(BRT) ${range.inicio}..${range.fim}`);
    return range;
  }, [TIME_ZONE, periodoFiltro]);

  // Fetch atividades (tarefas/prazos + eventos)
  const { data: atividades, isLoading: loadingAtividades } = useQuery({
    queryKey: ["atividades-delegacao", coordenacaoId, membroId, tipoAtividade, statusFiltro, prioridadeFiltro, periodoFiltro, ordenacao, membros, user?.id, isAdminOrCoordinator],
    queryFn: async () => {
      // Se uma coordenação está selecionada, pegar os IDs dos membros dela
      const membrosDaCoordenacao = coordenacaoId !== "todas" && membros
        ? membros.map((m) => m.usuario_id)
        : null;

      // Fetch tarefas
      let tarefasQuery = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          data_fatal,
          prioridade,
          status,
          tipo_tarefa,
          created_at,
          criado_por,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome, email),
          processo:processos!tarefas_processo_id_fkey(id, numero, polo_ativo, coordenacao_id, cliente:clientes!processos_cliente_id_fkey(id, nome))
        `);

      // Aplicar filtro de responsável baseado em role
      if (membroId !== "todos") {
        // Filtro específico por membro selecionado no dropdown
        tarefasQuery = tarefasQuery.eq("responsavel_id", membroId);
      } else if (!isAdminOrCoordinator && user?.id) {
        // Usuário comum: ver apenas suas próprias tarefas
        tarefasQuery = tarefasQuery.eq("responsavel_id", user.id);
      } else if (isAdminOrCoordinator && coordenacaoId !== "todas" && membrosDaCoordenacao && membrosDaCoordenacao.length > 0) {
        // Admin/Coordenador com coordenação específica selecionada: filtrar por membros dessa coordenação
        tarefasQuery = tarefasQuery.in("responsavel_id", membrosDaCoordenacao);
      }
      // Se isAdminOrCoordinator e coordenacaoId === "todas", não aplica filtro - mostra todas as tarefas que o RLS permite

      if (statusFiltro === "pendente" || statusFiltro === "atrasado") {
        // Atrasado = pendente com data_vencimento < hoje (filtrado após busca)
        tarefasQuery = tarefasQuery.eq("status", "pendente");
      } else if (statusFiltro === "cumprido") {
        tarefasQuery = tarefasQuery.eq("status", "cumprido");
      }

      if (prioridadeFiltro !== "todas" && ["baixa", "media", "alta", "urgente"].includes(prioridadeFiltro)) {
        tarefasQuery = tarefasQuery.eq("prioridade", prioridadeFiltro as "baixa" | "media" | "alta" | "urgente");
      }

      // Ordenação
      if (ordenacao === "mais-antigas") {
        tarefasQuery = tarefasQuery.order("data_vencimento", { ascending: true, nullsFirst: false });
      } else if (ordenacao === "mais-recentes") {
        tarefasQuery = tarefasQuery.order("data_vencimento", { ascending: false });
      } else if (ordenacao === "prioridade") {
        tarefasQuery = tarefasQuery.order("prioridade", { ascending: false });
      }

      // Supabase/PostgREST costuma limitar 1000 linhas por request; buscamos em páginas via range.
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 20; // até 20k registros
      const tarefasAll: any[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: pageData, error: pageError } = await tarefasQuery.range(from, to);
        if (pageError) throw pageError;

        tarefasAll.push(...(pageData || []));

        if (!pageData || pageData.length < PAGE_SIZE) break;
      }

      const tarefas = tarefasAll;

      // Apply period filter on data_vencimento OR data_fatal (comparação por DATA em BRT)
      let filteredByPeriod = tarefas || [];
      if (getDateRange) {
        const inicio = getDateRange.inicio;
        const fim = getDateRange.fim;

        const normalizeToBrtDateStr = (value?: string | null) => {
          if (!value) return null;
          // Se vier timestamp, normaliza para data em BRT
          if (value.includes("T")) {
            return format(toZonedTime(new Date(value), TIME_ZONE), "yyyy-MM-dd");
          }
          // Se vier só data (YYYY-MM-DD), já está no formato correto
          return value.slice(0, 10);
        };

        filteredByPeriod = filteredByPeriod.filter((t: any) => {
          const vencStr = normalizeToBrtDateStr(t.data_vencimento);
          const fatalStr = normalizeToBrtDateStr(t.data_fatal);

          const vencNoPeriodo = !!vencStr && vencStr >= inicio && vencStr <= fim;
          const fatalNoPeriodo = !!fatalStr && fatalStr >= inicio && fatalStr <= fim;

          return vencNoPeriodo || fatalNoPeriodo;
        });
      }

      // Importante:
      // Quando uma coordenação é selecionada, a query já filtra por responsáveis que são membros
      // dessa coordenação (via `membrosDaCoordenacao`).
      // Portanto, NÃO filtramos novamente por `processo.coordenacao_id` aqui, pois isso pode
      // esconder tarefas do membro vinculadas a processos de outras coordenações.

      // Mark atrasados (por DATA em BRT)
      const hojeBrtStr = format(toZonedTime(new Date(), TIME_ZONE), "yyyy-MM-dd");
      const tarefasProcessadas = filteredByPeriod.map((p: any) => {
        const vencStr = p.data_vencimento
          ? (p.data_vencimento.includes("T")
              ? format(toZonedTime(new Date(p.data_vencimento), TIME_ZONE), "yyyy-MM-dd")
              : p.data_vencimento.slice(0, 10))
          : null;

        const isAtrasado = !!vencStr && vencStr < hojeBrtStr && p.status !== "cumprido";
        return {
          ...p,
          tipo: "tarefa" as const,
          isAtrasado,
        };
      });

      // Filter atrasados if needed
      if (statusFiltro === "atrasado") {
        return tarefasProcessadas.filter((p: any) => p.isAtrasado);
      }

      return tarefasProcessadas;
    },
  });

  // Stats via COUNT no banco (sem limite de registros)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["tarefas-stats-delegacao", coordenacaoId, membros, user?.id, isAdminOrCoordinator],
    queryFn: async () => {
      // Get members IDs for the selected coordination
      let membroIds: string[] | null = null;
      
      if (coordenacaoId !== "todas") {
        const { data: membrosCoordenacao } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id")
          .eq("coordenacao_id", coordenacaoId);
        
        membroIds = membrosCoordenacao?.map(m => m.usuario_id) || [];
        
        // Se coordenação não tem membros, retornar zeros
        if (membroIds.length === 0) {
          return {
            total: 0,
            pendentes: 0,
            atrasadas: 0,
            concluidas: 0,
          };
        }
      }

      // Helper to build base query with filters
      const buildQuery = () => {
        let q = supabase.from("tarefas").select("*", { count: "exact", head: true });
        
        if (!isAdminOrCoordinator && user?.id) {
          q = q.eq("responsavel_id", user.id);
        } else if (isAdminOrCoordinator && coordenacaoId !== "todas" && membroIds && membroIds.length > 0) {
          q = q.in("responsavel_id", membroIds);
        }
        
        return q;
      };

      const hoje = format(toZonedTime(new Date(), TIME_ZONE), "yyyy-MM-dd");

      // Executar todas as queries em paralelo
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

      // Pendentes = pendentesTotal - atrasadas
      const pendentes = pendentesTotal - atrasadas;

      return {
        total,
        pendentes,
        atrasadas,
        concluidas,
      };
    },
    enabled: !!user?.id,
  });

  // Filtered atividades
  const atividadesFiltradas = useMemo(() => {
    if (!atividades) return [];
    return atividades.filter(a => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        a.titulo?.toLowerCase().includes(searchLower) ||
        a.descricao?.toLowerCase().includes(searchLower) ||
        a.processo?.numero?.toLowerCase().includes(searchLower) ||
        a.responsavel?.nome?.toLowerCase().includes(searchLower)
      );
    });
  }, [atividades, search]);

  const selectedTarefa = useMemo(() => {
    if (!selectedTarefaId || !atividades) return null;
    return atividades.find(a => a.id === selectedTarefaId) || null;
  }, [selectedTarefaId, atividades]);

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

  // Handlers
  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === atividadesFiltradas.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(atividadesFiltradas.map(a => a.id));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const classes: Record<string, string> = {
      urgente: "bg-red-500/10 text-red-600 border-red-200",
      alta: "bg-orange-500/10 text-orange-600 border-orange-200",
      media: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
      baixa: "bg-green-500/10 text-green-600 border-green-200",
    };
    const labels: Record<string, string> = {
      urgente: "Urgente",
      alta: "Alta",
      media: "Média",
      baixa: "Baixa",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", classes[prioridade] || "")}>
        {labels[prioridade] || prioridade}
      </Badge>
    );
  };

  const getStatusBadge = (tarefa: any) => {
    if (tarefa.status === "cumprido") {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Concluído
        </Badge>
      );
    }
    if (tarefa.isAtrasado) {
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Atrasada
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getDiasRestantes = (tarefa: any) => {
    if (!tarefa.data_vencimento) return null;

    const todayBrtStr = format(toZonedTime(new Date(), TIME_ZONE), "yyyy-MM-dd");
    const dueBrtStr = tarefa.data_vencimento.includes("T")
      ? format(toZonedTime(new Date(tarefa.data_vencimento), TIME_ZONE), "yyyy-MM-dd")
      : tarefa.data_vencimento.slice(0, 10);

    const dias = differenceInDays(parseISO(dueBrtStr), parseISO(todayBrtStr));

    if (dias < 0) return <span className="text-red-500 font-medium">{Math.abs(dias)} dias atrasado</span>;
    if (dias === 0) return <span className="text-orange-500 font-medium">Vence hoje</span>;
    if (dias <= 3) return <span className="text-yellow-600 font-medium">{dias} dias restantes</span>;
    return <span className="text-muted-foreground">{dias} dias restantes</span>;
  };

  if (roleLoading) {
    return (
      <MainLayout title="Central de Delegação">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Central de Delegação" subtitle="Gerencie e delegue atividades para sua equipe">
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Central de Delegação
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdminOrCoordinator 
                ? "Gerencie e delegue atividades para sua equipe"
                : "Visualize suas tarefas delegadas"}
            </p>
          </div>
          {isAdminOrCoordinator && (
            <div className="flex items-center gap-2">
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
                  <DropdownMenuItem onClick={() => setNovoCompromissoOpen(true)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Novo Compromisso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card
            className={cn(
              "cursor-pointer hover:border-primary/50 transition-colors",
              statusFiltro === "todos" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => { setStatusFiltro("todos"); setPrioridadeFiltro("todas"); setPeriodoFiltro("todas"); setSearch(""); }}
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
            onClick={() => { setStatusFiltro("pendente"); setPrioridadeFiltro("todas"); setPeriodoFiltro("todas"); setSearch(""); }}
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
            onClick={() => { setStatusFiltro("atrasado"); setPrioridadeFiltro("todas"); setPeriodoFiltro("todas"); setSearch(""); }}
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
              statusFiltro === "cumprido" && "border-primary ring-1 ring-primary"
            )}
            onClick={() => { setStatusFiltro("cumprido"); setPrioridadeFiltro("todas"); setPeriodoFiltro("todas"); setSearch(""); }}
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

        {/* Filters Bar */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
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
                {/* Filtros de coordenação e membro só para admin/coordenador */}
                {isAdminOrCoordinator && (
                  <>
                    <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
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

                    <Select value={membroId} onValueChange={setMembroId}>
                      <SelectTrigger className="w-full sm:w-[180px] text-xs sm:text-sm h-9">
                        <SelectValue placeholder="Responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos Membros</SelectItem>
                        {membrosUnicos.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  </>
                )}

                {/* Period filter for regular users too */}
                {!isAdminOrCoordinator && (
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

                <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
                  <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm h-9">
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
              </div>
            </div>

            {(search.trim() ||
              statusFiltro !== "todos" ||
              prioridadeFiltro !== "todas" ||
              periodoFiltro !== "hoje" ||
              ordenacao !== "mais-antigas" ||
              (isAdminOrCoordinator && (coordenacaoId !== "todas" || membroId !== "todos"))) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {search.trim() && (
                  <Badge variant="outline" className="text-xs max-w-full">
                    Busca: <span className="truncate">{search}</span>
                  </Badge>
                )}

                {isAdminOrCoordinator && coordenacaoId !== "todas" && (
                  <Badge variant="outline" className="text-xs max-w-full">
                    Coord.: {coordenacoes?.find((c) => c.id === coordenacaoId)?.nome || "Selecionada"}
                  </Badge>
                )}

                {isAdminOrCoordinator && membroId !== "todos" && (
                  <Badge variant="outline" className="text-xs max-w-full">
                    Resp.: {membrosUnicos.find((m) => m.id === membroId)?.nome || "Selecionado"}
                  </Badge>
                )}

                {statusFiltro !== "todos" && (
                  <Badge variant="outline" className="text-xs">
                    Status: {statusFiltroLabel[statusFiltro]}
                  </Badge>
                )}

                {prioridadeFiltro !== "todas" && (
                  <Badge variant="outline" className="text-xs">
                    Prioridade: {prioridadeFiltroLabel[prioridadeFiltro] || prioridadeFiltro}
                  </Badge>
                )}

                {periodoFiltro !== "hoje" && (
                  <Badge variant="outline" className="text-xs">
                    Período: {periodoFiltroLabel[periodoFiltro]}
                  </Badge>
                )}

                {ordenacao !== "mais-antigas" && (
                  <Badge variant="outline" className="text-xs">
                    Ordenação: {ordenacaoLabel[ordenacao] || ordenacao}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearAllFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            )}

            {/* Tabs */}
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Tabs value={tipoAtividade} onValueChange={(v) => setTipoAtividade(v as TipoAtividade)}>
                <TabsList>
                  <TabsTrigger value="todos" className="gap-2">
                    <Badge variant="secondary" className="text-xs">{stats?.total ?? 0}</Badge>
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="tarefas" className="gap-2">
                    <Badge variant="secondary" className="text-xs">{stats?.total ?? 0}</Badge>
                    Tarefas
                  </TabsTrigger>
                </TabsList>
              </Tabs>

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
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lista de Atividades */}
          <div className="flex-1">
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <span className="hidden sm:inline">Lista de </span>Atividades
                    <Badge variant="secondary" className="text-xs">{atividadesFiltradas.length}</Badge>
                  </CardTitle>
                  <div className="hidden sm:flex items-center gap-2">
                    <Checkbox 
                      checked={selectedItems.length === atividadesFiltradas.length && atividadesFiltradas.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">Selecionar todos</span>
                  </div>
                </div>

                {statusFiltro !== "todos" && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      Status: {statusFiltroLabel[statusFiltro]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatusFiltro("todos")}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loadingAtividades ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : atividadesFiltradas.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma atividade encontrada</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-400px)] sm:h-[600px] min-h-[300px]">
                    <div className="divide-y">
                      {atividadesFiltradas.map((atividade) => (
                        <div
                          key={atividade.id}
                          className={cn(
                            "p-3 sm:p-4 hover:bg-muted/50 cursor-pointer transition-colors flex gap-2 sm:gap-4",
                            selectedTarefaId === atividade.id && "bg-muted/80",
                            atividade.isAtrasado && "border-l-4 border-l-red-500"
                          )}
                          onClick={() => setSelectedTarefaId(atividade.id)}
                        >
                          <div className="pt-1 hidden sm:block">
                            <Checkbox 
                              checked={selectedItems.includes(atividade.id)}
                              onCheckedChange={() => toggleSelectItem(atividade.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                            {/* Header com status, prioridade e avatar */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  {getStatusBadge(atividade)}
                                  {getPrioridadeBadge(atividade.prioridade)}
                                  {atividade.tipo_tarefa && (
                                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                                      {atividade.tipo_tarefa}
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="font-medium text-sm sm:text-base line-clamp-2 sm:truncate break-words">
                                  {atividade.titulo || "Sem título"}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                                  <AvatarFallback className="text-[10px] sm:text-xs bg-primary/10 text-primary">
                                    {atividade.responsavel?.nome ? getInitials(atividade.responsavel.nome) : "?"}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </div>

                            {/* Nome do responsável no mobile */}
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {atividade.responsavel?.nome || "Sem responsável"}
                            </div>

                            {atividade.processo && (
                              <div className="text-xs sm:text-sm text-muted-foreground break-words">
                                <span className="font-mono text-[10px] sm:text-xs">{atividade.processo.numero}</span>
                                {atividade.processo.cliente?.nome && (
                                  <span className="ml-1 sm:ml-2">• {atividade.processo.cliente.nome}</span>
                                )}
                              </div>
                            )}

                            {atividade.descricao && (
                              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words">
                                {atividade.descricao}
                              </p>
                            )}

                            {/* Datas - layout empilhado no mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-[10px] sm:text-xs">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-muted-foreground">
                                {atividade.data_vencimento && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span className="hidden sm:inline">Prevista: </span>
                                    {format(parseISO(atividade.data_vencimento), "dd/MM/yy", { locale: ptBR })}
                                  </span>
                                )}
                                {atividade.data_fatal && (
                                  <span className="flex items-center gap-1 text-red-500">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="hidden sm:inline">Fatal: </span>
                                    {format(parseISO(atividade.data_fatal), "dd/MM/yy", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-xs">
                                {getDiasRestantes(atividade)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Dialog de Detalhes */}
      <TarefaDetalhesDialog
        tarefa={selectedTarefa}
        open={!!selectedTarefaId}
        onOpenChange={(open) => {
          if (!open) setSelectedTarefaId(null);
        }}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
        }}
      />

      {/* Dialogs */}

      <AcoesEmLoteDialog
        open={acoesLoteOpen}
        onOpenChange={setAcoesLoteOpen}
        selectedIds={selectedItems}
        onSuccess={() => {
          setSelectedItems([]);
          queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
        }}
      />

      <EventoDialog
        open={novoCompromissoOpen}
        onOpenChange={setNovoCompromissoOpen}
      />
    </MainLayout>
  );
}
