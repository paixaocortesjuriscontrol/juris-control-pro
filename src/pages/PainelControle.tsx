import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
} from "lucide-react";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useAgendaUnificada,
  useUpdateItemAgenda,
  ItemAgendaUnificado,
  AGENDA_INFINITE_QUERY_KEY,
} from "@/hooks/useAgendaUnificada";
import { useUpdateEvento, useDeleteEvento, EventoAgenda } from "@/hooks/useEventosAgenda";
import { TarefaAgendaPanel } from "@/components/agenda/TarefaAgendaPanel";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { toZonedTime } from "date-fns-tz";
import { useNavigate } from "react-router-dom";

const TIME_ZONE = "America/Sao_Paulo";

type TabMode = "pessoal" | "escritorio";

// Cores dos tipos
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
  evento: "Evento",
  tarefa: "Tarefa",
  tarefa_delegada: "Delegada",
  prazo: "Prazo",
  audiencia: "Audiência",
  prazo_parcela: "Parcela",
  parcelamento: "Parcelamento",
};

const diasDaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function PainelControle() {
  const { user } = useAuth();
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabMode, setTabMode] = useState<TabMode>("pessoal");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [selectedParcelamento, setSelectedParcelamento] = useState<EventoAgenda | null>(null);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [adminCoordFilter, setAdminCoordFilter] = useState<string>("todas");

  const updateItemAgenda = useUpdateItemAgenda();
  const updateEvento = useUpdateEvento();
  const deleteEvento = useDeleteEvento();

  const nowBrt = toZonedTime(new Date(), TIME_ZONE);
  const hoje = startOfDay(nowBrt);

  // Buscar coordenações do usuário (para filtro "Escritório")
  // Inclui coordenações onde é membro OU coordenador
  const { data: coordenacoesUsuario = [], isLoading: coordLoading } = useQuery({
    queryKey: ["painel-controle-coordenacoes-usuario", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Buscar como membro
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      // Buscar como coordenador
      const { data: coordenador } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", user.id);
      const ids = new Set([
        ...(membros || []).map((r) => r.coordenacao_id),
        ...(coordenador || []).map((r) => r.id),
      ]);
      return [...ids];
    },
    enabled: !!user?.id,
  });

  // Buscar IDs de todos os membros das coordenações do usuário (para modo escritório)
  // Inclui membros + coordenadores
  const { data: membrosDasCoordenacoes = [], isLoading: membrosLoading } = useQuery({
    queryKey: ["painel-controle-membros-coordenacoes", coordenacoesUsuario],
    queryFn: async () => {
      if (!coordenacoesUsuario.length) return [];
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .in("coordenacao_id", coordenacoesUsuario);
      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .in("id", coordenacoesUsuario)
        .not("coordenador_id", "is", null);
      const ids = new Set([
        ...(membros || []).map((r) => r.usuario_id),
        ...(coords || []).map((r) => r.coordenador_id!),
      ]);
      return [...ids];
    },
    enabled: coordenacoesUsuario.length > 0,
  });

  // Todas as coordenações (para filtro admin)
  const { data: todasCoordenacoes = [] } = useQuery({
    queryKey: ["painel-controle-todas-coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Membros da coordenação filtrada (admin) — inclui coordenador
  const { data: membrosCoordFiltrada = [], isLoading: membrosFilterLoading } = useQuery({
    queryKey: ["painel-controle-membros-coord-filtrada", adminCoordFilter],
    queryFn: async () => {
      if (adminCoordFilter === "todas") return [];
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id")
        .eq("coordenacao_id", adminCoordFilter);
      const { data: coord } = await supabase
        .from("coordenacoes")
        .select("coordenador_id")
        .eq("id", adminCoordFilter)
        .maybeSingle();
      const ids = new Set((membros || []).map((r) => r.usuario_id));
      if (coord?.coordenador_id) ids.add(coord.coordenador_id);
      return [...ids];
    },
    enabled: isAdmin && adminCoordFilter !== "todas",
  });

  // Intervalo do mês exibido no calendário
  const dataInicio = useMemo(() => {
    return new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1, 0, 0, 0);
  }, [mesAtual]);
  const dataFim = useMemo(() => {
    return new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0, 23, 59, 59);
  }, [mesAtual]);

  // Filtros conforme aba selecionada (apenas para o calendário)
  const filters = useMemo(() => {
    const dateRange = { dataInicio, dataFim };

    if (tabMode === "pessoal") {
      return {
        responsavelIds: user?.id ? [user.id] : undefined,
        fetchAll: false,
        pessoal: true,
        ...dateRange,
      };
    }

    // Admin no escritório
    if (isAdmin) {
      if (adminCoordFilter !== "todas" && membrosCoordFiltrada.length > 0) {
        return { responsavelIds: membrosCoordFiltrada, fetchAll: false, ...dateRange };
      }
      if (adminCoordFilter !== "todas" && membrosFilterLoading) {
        return { responsavelIds: [], fetchAll: false, ...dateRange };
      }
      return { fetchAll: true, ...dateRange };
    }

    if (coordLoading || membrosLoading) {
      return { responsavelIds: user?.id ? [user.id] : undefined, fetchAll: false, pessoal: false, ...dateRange };
    }

    if (membrosDasCoordenacoes.length > 0) {
      return {
        responsavelIds: membrosDasCoordenacoes,
        fetchAll: false,
        ...dateRange,
      };
    }

    return {
      responsavelIds: user?.id ? [user.id] : undefined,
      fetchAll: false,
      ...dateRange,
    };
  }, [tabMode, user?.id, isAdmin, adminCoordFilter, membrosCoordFiltrada, membrosFilterLoading, coordLoading, membrosLoading, membrosDasCoordenacoes, dataInicio, dataFim]);

  const agendaQuery = useAgendaUnificada(filters);
  const itensAgenda = agendaQuery.data;
  const isLoading = agendaQuery.isLoading;

  // Auto-fetch all pages
  useEffect(() => {
    if (agendaQuery.hasNextPage && !agendaQuery.isFetchingNextPage) {
      agendaQuery.fetchNextPage();
    }
  }, [agendaQuery.hasNextPage, agendaQuery.isFetchingNextPage, agendaQuery.fetchNextPage]);

  // Busca direta ao banco para totalizadores
  const hoje_str = format(nowBrt, "yyyy-MM-dd");

  const resumoStatsReady = useMemo(() => {
    if (tabMode === "pessoal") return true;
    if (isAdmin) return true;
    if (coordLoading || membrosLoading) return false;
    if (coordenacoesUsuario.length > 0 && membrosDasCoordenacoes.length === 0) return false;
    return true;
  }, [tabMode, isAdmin, coordLoading, membrosLoading, coordenacoesUsuario.length, membrosDasCoordenacoes.length]);

  const membrosIdsParaResumo = useMemo(() => {
    if (tabMode === "pessoal") return user?.id ? [user.id] : [];
    if (isAdmin) {
      if (adminCoordFilter !== "todas" && membrosCoordFiltrada.length > 0) return membrosCoordFiltrada;
      return [];
    }
    if (membrosDasCoordenacoes.length > 0) return membrosDasCoordenacoes;
    return user?.id ? [user.id] : [];
  }, [tabMode, isAdmin, adminCoordFilter, membrosCoordFiltrada, membrosDasCoordenacoes, user?.id]);

  const { data: resumoStats } = useQuery({
    queryKey: ["painel-controle-resumo-stats", tabMode, hoje_str, membrosIdsParaResumo, isAdmin, adminCoordFilter],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return { tarefas: empty, audiencias: empty, compromissos: empty };

      let q = supabase
        .from("tarefas")
        .select("data_vencimento, data_fatal, tipo_tarefa, status, responsavel_id, criado_por")
        .neq("status", "cumprido");

      if (tabMode === "escritorio" && isAdmin && membrosIdsParaResumo.length === 0) {
        // Admin escritório sem filtro: vê tudo
      } else if (membrosIdsParaResumo.length > 0) {
        if (tabMode === "pessoal") {
          const ids = membrosIdsParaResumo.join(",");
          q = q.or(`responsavel_id.in.(${ids}),criado_por.in.(${ids})`);
        } else {
          q = q.in("responsavel_id", membrosIdsParaResumo);
        }
      } else {
        q = q.or(`responsavel_id.eq.${user.id},criado_por.eq.${user.id}`);
      }

      const { data: tarefas, error } = await q;
      if (error) {
        console.error("[resumoStats] erro na query:", error);
        return { tarefas: empty, audiencias: empty, compromissos: empty };
      }

      const hoje_d = new Date(hoje_str + "T00:00:00");
      const calcStats = (items: any[]) => {
        const atrasadas = items.filter(t => {
          const dateStr = t.data_vencimento ?? t.data_fatal ?? "";
          if (!dateStr) return false;
          return new Date(dateStr + "T00:00:00") < hoje_d;
        }).length;
        const hoje_count = items.filter(t => {
          const dateStr = t.data_vencimento ?? t.data_fatal ?? "";
          return dateStr.slice(0, 10) === hoje_str;
        }).length;
        const futuras = items.filter(t => {
          const dateStr = t.data_vencimento ?? t.data_fatal ?? "";
          if (!dateStr) return false;
          return new Date(dateStr + "T00:00:00") > hoje_d;
        }).length;
        return { atrasadas, hoje: hoje_count, futuras, total: items.length };
      };

      const all = tarefas || [];
      const audienciaItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u === "AUDIÊNCIA" || u === "AUDIENCIA"; });
      const compromissoItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u === "EVENTO"; });
      const tarefaItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u !== "AUDIÊNCIA" && u !== "AUDIENCIA" && u !== "EVENTO"; });

      return {
        tarefas: calcStats(tarefaItems),
        audiencias: calcStats(audienciaItems),
        compromissos: calcStats(compromissoItems),
      };
    },
    enabled: !!user?.id && resumoStatsReady,
    staleTime: 30000,
  });

  // IDs dos processos das coordenações do usuário (para filtrar intimações e andamentos)
  const { data: processosIds = [] } = useQuery({
    queryKey: ["painel-controle-processos-ids", tabMode, coordenacoesUsuario, isAdmin, adminCoordFilter],
    queryFn: async () => {
      if (!user?.id) return [];

      // Escritório: admin vê tudo ou filtra por coordenação selecionada
      if (tabMode === "escritorio") {
        if (isAdmin) {
          if (adminCoordFilter !== "todas") {
            const { data } = await supabase
              .from("processos")
              .select("id")
              .eq("coordenacao_id", adminCoordFilter);
            return (data || []).map((p) => p.id);
          }
          return []; // sem filtro
        }

        // Coordenador/usuário: filtra pelas coordenações vinculadas
        if (coordenacoesUsuario.length > 0) {
          const { data } = await supabase
            .from("processos")
            .select("id")
            .in("coordenacao_id", coordenacoesUsuario);
          return (data || []).map((p) => p.id);
        }
        return [];
      }

      // Pessoal: processos onde é responsável
      const { data } = await supabase
        .from("processos")
        .select("id")
        .eq("advogado_responsavel_id", user.id);
      return (data || []).map((p) => p.id);
    },
    enabled: !!user?.id,
  });

  // ===== CARDS DE RESUMO — usa resumoStats (query direta sem limite de página) =====
  const resumo = useMemo(() => {
    const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
    if (!resumoStats) return { tarefas: empty, audiencias: empty, compromissos: empty };
    return resumoStats;
  }, [resumoStats]);

  // Intimações pendentes — filtradas por processos da coordenação (ou todas para admin sem coordenação)
  const { data: intimacoesPendentes = 0 } = useQuery({
    queryKey: ["painel-controle-intimacoes", tabMode, user?.id, coordenacoesUsuario, isAdmin, adminCoordFilter, processosIds],
    queryFn: async () => {
      let q = supabase
        .from("intimacoes_detectadas")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");

      // Admin em modo escritório sem filtro: vê tudo
      if (tabMode === "escritorio" && isAdmin && adminCoordFilter === "todas") {
        const { count } = await q;
        return count ?? 0;
      }

      // Filtrar pelos processos das coordenações do usuário (ou pessoal)
      if (processosIds.length > 0) {
        q = q.in("processo_id", processosIds);
      } else {
        // Sem processos encontrados — retorna 0 em vez de mostrar global
        return 0;
      }

      const { count } = await q;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Publicações DJEN não lidas — filtradas por coordenação (ou todas para admin sem coordenação)
  const { data: andamentosNaoLidos = 0 } = useQuery({
    queryKey: ["painel-controle-andamentos", tabMode, user?.id, coordenacoesUsuario, isAdmin, adminCoordFilter],
    queryFn: async () => {
      let q = supabase
        .from("publicacoes_djen")
        .select("id", { count: "exact", head: true })
        .eq("lida", false);

      // Admin em modo escritório sem filtro: vê tudo
      if (tabMode === "escritorio" && isAdmin && adminCoordFilter === "todas") {
        const { count } = await q;
        return count ?? 0;
      }

      // Admin com filtro de coordenação
      if (tabMode === "escritorio" && isAdmin && adminCoordFilter !== "todas") {
        const { data: monitoramentos } = await supabase
          .from("monitoramentos_djen")
          .select("id")
          .eq("coordenacao_id", adminCoordFilter);
        const monIds = (monitoramentos || []).map((m) => m.id);
        if (monIds.length > 0) {
          q = q.in("monitoramento_id", monIds);
        } else {
          return 0;
        }
        const { count } = await q;
        return count ?? 0;
      }

      // Filtrar por monitoramentos das coordenações do usuário
      if (coordenacoesUsuario.length > 0) {
        const { data: monitoramentos } = await supabase
          .from("monitoramentos_djen")
          .select("id")
          .in("coordenacao_id", coordenacoesUsuario);
        const monIds = (monitoramentos || []).map((m) => m.id);
        if (monIds.length > 0) {
          q = q.in("monitoramento_id", monIds);
        } else {
          return 0;
        }
      } else if (tabMode === "pessoal") {
        // Pessoal: monitoramentos onde o usuário é responsável
        const { data: monitoramentos } = await supabase
          .from("monitoramentos_djen")
          .select("id")
          .eq("criado_por", user?.id ?? "");
        const monIds = (monitoramentos || []).map((m) => m.id);
        if (monIds.length > 0) {
          q = q.in("monitoramento_id", monIds);
        } else {
          return 0;
        }
      }

      const { count } = await q;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // ===== CALENDÁRIO MENSAL =====
  const diasDoCalendario = useMemo(() => {
    const inicioMes = startOfMonth(mesAtual);
    const fimMes = endOfMonth(mesAtual);
    const inicioCal = startOfWeek(inicioMes, { weekStartsOn: 0 });
    const fimCal = endOfWeek(fimMes, { weekStartsOn: 0 });

    const dias: Date[] = [];
    let d = inicioCal;
    while (d <= fimCal) {
      dias.push(d);
      d = addDays(d, 1);
    }
    return dias;
  }, [mesAtual]);

  // Mapa de itens por dia (chave: "YYYY-MM-DD")
  // Concluídas aparecem no final de cada dia, pendentes primeiro
  const itensPorDia = useMemo(() => {
    const map = new Map<string, ItemAgendaUnificado[]>();
    itensAgenda.forEach((item) => {
      const key = item.data_inicio.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    // Ordenar: pendentes/atrasados primeiro, concluídos por último
    map.forEach((itens, key) => {
      map.set(key, [
        ...itens.filter(i => i.status !== "cumprido" && i.status !== "concluido"),
        ...itens.filter(i => i.status === "cumprido" || i.status === "concluido"),
      ]);
    });
    return map;
  }, [itensAgenda]);

  const handleDayClick = (_dia: Date) => {
    // Apenas para visualização
  };

  const handleItemClick = (item: ItemAgendaUnificado) => {
    if (item.tipo === "parcelamento") {
      setSelectedParcelamento(item as unknown as EventoAgenda);
      setParcelasDialogOpen(true);
    } else if (item.origem === "evento") {
      setSelectedItem(item);
    } else {
      setSelectedItem(item);
    }
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

  const handleConcluirItem = async (item: ItemAgendaUnificado) => {
    const isConcluido = item.status === "concluido" || item.status === "cumprido";
    const nextStatus = isConcluido ? "pendente" : "concluido";
    const concluidoEm = isConcluido ? null : new Date().toISOString();

    queryClient.setQueriesData({ queryKey: [AGENDA_INFINITE_QUERY_KEY] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: ItemAgendaUnificado[]) =>
          page.map((it) =>
            it.id === item.id
              ? { ...it, status: nextStatus, concluido_em: concluidoEm, is_atrasado: nextStatus === "concluido" ? false : it.is_atrasado }
              : it
          )
        ),
      };
    });

    try {
      await updateItemAgenda.mutateAsync({
        id: item.id,
        origem: item.origem,
        status: nextStatus,
        concluido_em: concluidoEm,
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
    }
  };

  const navMes = (delta: number) => {
    setMesAtual((prev) => (delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)));
  };

  // ===== CARD SUMÁRIO =====
  const SummaryCard = ({
    label,
    total,
    stats,
    ringClass,
  }: {
    label: string;
    total: number;
    stats: { label: string; value: number; highlight?: boolean }[];
    ringClass: string;
  }) => (
    <div className="flex items-center gap-2 md:gap-4 bg-card border border-border rounded-lg px-2 md:px-5 py-2 md:py-4 flex-shrink-0 md:flex-1 min-w-0">
      <div
        className={cn(
          "w-9 h-9 md:w-14 md:h-14 rounded-full border-2 md:border-4 flex items-center justify-center text-base md:text-2xl font-bold flex-shrink-0",
          ringClass
        )}
      >
        {total}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 md:mb-1">
          {label}
        </p>
        <div className="space-y-0">
          {stats.map((s) => (
            <p
              key={s.label}
              className={cn(
                "text-[10px] md:text-xs leading-tight",
                s.highlight && s.value > 0
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {s.value} {s.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title="Painel de Controle">
      <div className="flex flex-col -m-4 md:-m-6" style={{ height: "calc(100vh - 64px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-card border-b border-border flex-shrink-0">
          <h1 className="text-base md:text-xl font-bold text-foreground">Painel de Controle</h1>
          <div className="flex gap-1 ml-2">
            <Button
              size="sm"
              variant={tabMode === "pessoal" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setTabMode("pessoal")}
            >
              Pessoal
            </Button>
            <Button
              size="sm"
              variant={tabMode === "escritorio" ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setTabMode("escritorio")}
            >
              Escritório
            </Button>
          </div>
          {/* Filtro de coordenação para admin no modo escritório */}
          {isAdmin && tabMode === "escritorio" && (
            <Select value={adminCoordFilter} onValueChange={setAdminCoordFilter}>
              <SelectTrigger className="h-7 w-40 md:w-52 text-xs">
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {todasCoordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => setNovaTarefaOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Tarefa</span>
              <span className="sm:hidden">Tarefa</span>
            </Button>
          </div>
        </div>

        {/* Cards de Resumo — compactos no mobile */}
        <div className="flex-shrink-0 px-3 md:px-6 py-2 md:py-3 border-b border-border bg-card">
          {isLoading ? (
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 md:h-20 flex-1 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 md:flex-wrap scrollbar-none">
              {/* Data Atual */}
              <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-3 py-2 flex-shrink-0">
                <div className="text-center">
                  <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider opacity-80">
                    {format(nowBrt, "MMM", { locale: ptBR })}
                  </p>
                  <p className="text-2xl md:text-4xl font-bold leading-none">
                    {format(nowBrt, "dd")}
                  </p>
                  <p className="text-[10px] md:text-xs opacity-80 capitalize hidden md:block">
                    {format(nowBrt, "EEEE", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <SummaryCard
                label="Tarefas"
                total={resumo.tarefas.total}
                ringClass="border-amber-400/40 bg-amber-400/10 text-amber-600"
                stats={[
                  { label: "atras.", value: resumo.tarefas.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.tarefas.hoje },
                  { label: "fut.", value: resumo.tarefas.futuras },
                ]}
              />

              <SummaryCard
                label="Intim."
                total={intimacoesPendentes}
                ringClass="border-blue-400/40 bg-blue-400/10 text-blue-600"
                stats={[
                  { label: "pend.", value: intimacoesPendentes, highlight: true },
                ]}
              />

              <SummaryCard
                label="Andamentos"
                total={andamentosNaoLidos}
                ringClass="border-primary/30 bg-primary/10 text-primary"
                stats={[
                  { label: "não lidos", value: andamentosNaoLidos, highlight: true },
                ]}
              />

              <SummaryCard
                label="Audiências"
                total={resumo.audiencias.total}
                ringClass="border-purple-400/40 bg-purple-400/10 text-purple-600"
                stats={[
                  { label: "atras.", value: resumo.audiencias.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.audiencias.hoje },
                  { label: "fut.", value: resumo.audiencias.futuras },
                ]}
              />

              <SummaryCard
                label="Comprom."
                total={resumo.compromissos.total}
                ringClass="border-emerald-400/40 bg-emerald-400/10 text-emerald-600"
                stats={[
                  { label: "atras.", value: resumo.compromissos.atrasadas, highlight: true },
                  { label: "hoje", value: resumo.compromissos.hoje },
                  { label: "fut.", value: resumo.compromissos.futuras },
                ]}
              />
            </div>
          )}
        </div>

        {/* Corpo principal: calendário + painel detalhe */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Calendário Mensal — escondido no mobile quando item selecionado */}
          <div
            className={cn(
              "flex flex-col border-r border-border bg-card transition-all duration-300",
              // Desktop: lado a lado
              "md:flex md:flex-col",
              selectedItem ? "md:w-[55%]" : "md:flex-1",
              // Mobile: tela cheia ou escondido quando item selecionado
              selectedItem ? "hidden md:flex" : "flex flex-1"
            )}
          >
            {/* Cabeçalho calendário */}
            <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b border-border flex-shrink-0">
              <h2 className="text-sm md:text-base font-bold text-foreground flex-1">Agenda</h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navMes(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold"
                  onClick={() => setMesAtual(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navMes(1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <span className="text-xs md:text-sm font-semibold text-foreground capitalize min-w-[100px] md:min-w-[140px] text-center">
                {format(mesAtual, "MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>

            {/* Grade do calendário */}
            <div className="flex-1 overflow-auto">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 border-b border-border">
                {diasDaSemana.map((d) => (
                  <div
                    key={d}
                    className="text-center py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Semanas */}
              {Array.from({ length: Math.ceil(diasDoCalendario.length / 7) }).map(
                (_, semanaIdx) => (
                  <div
                    key={semanaIdx}
                    className="grid grid-cols-7 border-b border-border last:border-b-0"
                    style={{ minHeight: "60px" }}
                  >
                    {diasDoCalendario
                      .slice(semanaIdx * 7, semanaIdx * 7 + 7)
                      .map((dia, i) => {
                        const key = format(dia, "yyyy-MM-dd");
                        const itens = itensPorDia.get(key) || [];
                        const ehHoje = isToday(dia);
                        const ehMesAtual = isSameMonth(dia, mesAtual);
                        const MAX_VISIBLE = selectedItem ? 2 : 3;
                        const visiveis = itens.slice(0, MAX_VISIBLE);
                        const extras = itens.length - MAX_VISIBLE;

                        return (
                          <div
                            key={i}
                            className={cn(
                              "border-r border-border last:border-r-0 p-0.5 md:p-1 transition-colors",
                              !ehMesAtual && "bg-muted/10",
                              ehHoje && "bg-primary/5"
                            )}
                          >
                            {/* Número do dia */}
                            <div className="flex justify-start mb-0.5 md:mb-1">
                              <span
                                className={cn(
                                  "text-[10px] md:text-xs font-medium w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full",
                                  ehHoje
                                    ? "bg-primary text-primary-foreground font-bold"
                                    : ehMesAtual
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                )}
                              >
                                {format(dia, "d")}
                              </span>
                            </div>

                            {/* Itens do dia */}
                            <div className="space-y-0.5">
                              {visiveis.map((item) => {
                                const isConcluido = item.status === "cumprido" || item.status === "concluido";
                                return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "text-[9px] md:text-[10px] leading-tight px-0.5 md:px-1 py-0.5 rounded truncate cursor-pointer font-medium flex items-center gap-0.5",
                                    isConcluido
                                      ? "bg-green-500 text-white opacity-75"
                                      : cn("text-white", TIPO_CORES[item.tipo] || "bg-muted")
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(item);
                                  }}
                                  title={item.titulo}
                                >
                                  {isConcluido ? (
                                    <CheckCircle2 className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0" />
                                  ) : (
                                    <FileText className="w-2 h-2 md:w-2.5 md:h-2.5 flex-shrink-0 opacity-90" />
                                  )}
                                  <span className={cn("truncate", isConcluido && "line-through")}>
                                    {item.titulo || TIPO_LABELS[item.tipo]}
                                  </span>
                                </div>
                              )})}
                              {extras > 0 && (
                                <Popover
                                  open={openPopoverKey === key}
                                  onOpenChange={(open) =>
                                    setOpenPopoverKey(open ? key : null)
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      className="text-[9px] md:text-[10px] text-primary font-semibold px-0.5 md:px-1 hover:underline cursor-pointer w-full text-left"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenPopoverKey(
                                          openPopoverKey === key ? null : key
                                        );
                                      }}
                                    >
                                      +{extras} mais
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-72 p-0"
                                    side="right"
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="px-3 py-2 border-b border-border">
                                      <p className="text-xs font-semibold text-foreground">
                                        {format(dia, "dd 'de' MMMM", { locale: ptBR })}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        +{extras} item(s) não exibido(s)
                                      </p>
                                    </div>
                                    <ScrollArea className="h-64">
                                      <div className="space-y-1 p-2">
                                        {itens.slice(MAX_VISIBLE).map((item) => {
                                          const isConcluido = item.status === "cumprido" || item.status === "concluido";
                                          return (
                                          <div
                                            key={item.id}
                                            className={cn(
                                              "text-[10px] leading-tight px-2 py-1.5 rounded cursor-pointer font-medium flex items-center gap-1.5",
                                              isConcluido
                                                ? "bg-green-500 text-white opacity-75"
                                                : cn("text-white", TIPO_CORES[item.tipo] || "bg-muted")
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenPopoverKey(null);
                                              handleItemClick(item);
                                            }}
                                          >
                                            {isConcluido ? (
                                              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                                            ) : (
                                              <FileText className="w-3 h-3 flex-shrink-0 opacity-90" />
                                            )}
                                            <span className={cn("truncate", isConcluido && "line-through")}>
                                              {item.titulo || TIPO_LABELS[item.tipo]}
                                            </span>
                                          </div>
                                        )})}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Painel de detalhes — tela cheia no mobile, lado a lado no desktop */}
          {selectedItem && (
            <div className={cn(
              "flex flex-col bg-card overflow-hidden",
              // Mobile: tela cheia absoluta sobre o calendário
              "absolute inset-0 md:relative md:inset-auto",
              // Desktop: 45% ao lado
              "md:w-[45%] md:border-l md:border-border"
            )}>
              <TarefaAgendaPanel
                tarefa={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* EventoDialog para edição de eventos */}
      <EventoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEvento(null);
        }}
        evento={selectedEvento}
      />

      {/* GerarParcelasDialog para parcelamentos */}
      <GerarParcelasDialog
        open={parcelasDialogOpen}
        onOpenChange={(open) => {
          setParcelasDialogOpen(open);
          if (!open) setSelectedParcelamento(null);
        }}
        evento={selectedParcelamento}
      />

      {/* Nova Tarefa */}
      <NovaTarefaDialogWrapper
        open={novaTarefaOpen}
        onOpenChange={setNovaTarefaOpen}
      />
    </MainLayout>
  );
}

function NovaTarefaDialogWrapper({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Buscar coordenações que o usuário pertence (para não-admins)
  const { data: membrosCoordenacoes = [] } = useQuery({
    queryKey: ["membros-coordenacoes-nova-tarefa", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return (data || []).map((m) => m.coordenacao_id);
    },
    enabled: open && !!user?.id && !isAdmin,
  });

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-nova-tarefa-painel", isAdmin, membrosCoordenacoes],
    queryFn: async () => {
      let query = supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");

      // Não-admins só veem as coordenações que pertencem
      if (!isAdmin && membrosCoordenacoes.length > 0) {
        query = query.in("id", membrosCoordenacoes);
      } else if (!isAdmin && membrosCoordenacoes.length === 0) {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && (isAdmin || membrosCoordenacoes.length > 0),
  });

  return (
    <NovaTarefaDialog
      open={open}
      onOpenChange={onOpenChange}
      coordenacoes={coordenacoes}
    />
  );
}
