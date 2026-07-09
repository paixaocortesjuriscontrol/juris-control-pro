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
  FileText,
  Plus,
} from "lucide-react";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { PainelFiltros, PainelFiltrosState, PAINEL_FILTROS_DEFAULT } from "@/components/painel/PainelFiltros";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { AudienciaFormSimplificado } from "@/components/audiencias/AudienciaFormSimplificado";
import { ClipboardList, CalendarPlus, Clock, Gavel, Coins } from "lucide-react";
import { TratadoCheck, isItemTratado } from "@/components/shared/TratadoCheck";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { toZonedTime } from "date-fns-tz";
import { Link, useNavigate } from "react-router-dom";
import ListaAtividadesView from "@/components/lista/ListaAtividadesView";
import TstPrazos from "@/pages/TstPrazos";
import PainelAudiencias from "@/pages/PainelAudiencias";
import Notificacoes from "@/pages/Notificacoes";
import { BuscaGlobalPainel } from "@/components/painel/BuscaGlobalPainel";
import { AcompanhamentoEspecialEventos } from "@/components/processos/AcompanhamentoEspecialEventos";
import { Sparkles } from "lucide-react";

const TIME_ZONE = "America/Sao_Paulo";

type TabMode = "pessoal" | "escritorio";
type ViewMode = "agenda" | "lista" | "kanban" | "prazos" | "audiencias" | "notificacoes";

// Cores dos tipos
const TIPO_CORES: Record<string, string> = {
  evento: "bg-green-500",
  tarefa: "bg-blue-500",
  tarefa_delegada: "bg-blue-600",
  prazo: "bg-red-500",
  audiencia: "bg-yellow-500",
  prazo_parcela: "bg-red-400",
  parcelamento: "bg-emerald-500",
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
  const [viewMode, setViewMode] = useState<ViewMode>("agenda");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [selectedParcelamento, setSelectedParcelamento] = useState<EventoAgenda | null>(null);
  const [novoItemTipo, setNovoItemTipo] = useState<null | "tarefa" | "evento" | "prazo" | "audiencia" | "parcelamento">(null);
  const [tarefaEditando, setTarefaEditando] = useState<any | null>(null);
  const [prazoEditando, setPrazoEditando] = useState<any | null>(null);
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [somenteHoje, setSomenteHoje] = useState(false);
  const [situacaoFilter, setSituacaoFilter] = useState<string>("todos");
  const [adminCoordFilter, setAdminCoordFilter] = useState<string>("todas");
  const [painelFiltros, setPainelFiltros] = useState<PainelFiltrosState>(PAINEL_FILTROS_DEFAULT);

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
        return {
          coordenacaoId: adminCoordFilter,
          strictCoordenacaoIsolation: true,
          fetchAll: false,
          ...dateRange,
        };
      }
      if (adminCoordFilter !== "todas" && membrosFilterLoading) {
        return {
          coordenacaoId: adminCoordFilter,
          strictCoordenacaoIsolation: true,
          fetchAll: false,
          ...dateRange,
        };
      }
      return { fetchAll: true, ...dateRange };
    }

    if (coordLoading || membrosLoading) {
      return { responsavelIds: user?.id ? [user.id] : undefined, fetchAll: false, pessoal: false, ...dateRange };
    }

    if (isAdminOrCoordinator && coordenacoesUsuario.length > 0) {
      return {
        responsavelIds: membrosDasCoordenacoes.length > 0 ? membrosDasCoordenacoes : undefined,
        fetchAll: false,
        ...dateRange,
      };
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
  }, [tabMode, user?.id, isAdmin, isAdminOrCoordinator, adminCoordFilter, membrosCoordFiltrada, membrosFilterLoading, coordLoading, membrosLoading, membrosDasCoordenacoes, coordenacoesUsuario, dataInicio, dataFim]);

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
    queryKey: ["painel-controle-resumo-stats", tabMode, hoje_str, membrosIdsParaResumo, isAdmin, isAdminOrCoordinator, adminCoordFilter, coordenacoesUsuario],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return { tarefas: empty, audiencias: empty, compromissos: empty };

      const baseSelect = "data_vencimento, data_fatal, tipo_tarefa, status, responsavel_id, criado_por";

      let q = supabase
        .from("tarefas")
        .select(baseSelect)
        .neq("status", "cumprido");

      if (tabMode === "escritorio" && isAdmin && adminCoordFilter !== "todas") {
        q = supabase
          .from("tarefas")
          .select(`${baseSelect}, processo:processos!inner(coordenacao_id)`)
          .eq("processo.coordenacao_id", adminCoordFilter)
          .neq("status", "cumprido");
      } else if (tabMode === "escritorio" && isAdmin && membrosIdsParaResumo.length === 0) {
        // Admin escritório sem filtro: vê tudo
      } else if (membrosIdsParaResumo.length > 0) {
        if (tabMode === "pessoal") {
          const ids = membrosIdsParaResumo.join(",");
          q = q.or(`responsavel_id.in.(${ids}),criado_por.in.(${ids})`);
        } else {
          // Escritório: tarefas onde qualquer membro é responsável OU criador
          const ids = membrosIdsParaResumo.join(",");
          q = q.or(`responsavel_id.in.(${ids}),criado_por.in.(${ids})`);
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
      const eventoTarefaItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u === "EVENTO"; });
      const prazoItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u === "PRAZO"; });
      const tarefaItems = all.filter(t => { const u = (t.tipo_tarefa ?? "").toUpperCase().trim(); return u !== "AUDIÊNCIA" && u !== "AUDIENCIA" && u !== "EVENTO" && u !== "PRAZO"; });

      return {
        tarefas: calcStats(tarefaItems),
        prazos: calcStats(prazoItems),
        audiencias: calcStats(audienciaItems),
        eventosTarefa: calcStats(eventoTarefaItems),
      };
    },
    enabled: !!user?.id && resumoStatsReady,
    staleTime: 30000,
  });

  // Eventos e Parcelamentos a partir de eventos_agenda
  // IDs dos processos das coordenações do usuário (para filtrar intimações,
  // andamentos e eventos). Declarado antes de eventosStats pois é usado lá.
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

  const { data: eventosStats } = useQuery({
    queryKey: ["painel-controle-eventos-stats", tabMode, hoje_str, membrosIdsParaResumo, isAdmin, adminCoordFilter, processosIds],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return { eventos: empty, parcelamentos: empty };
      let q = supabase
        .from("eventos_agenda")
        .select("data_inicio, tipo, status, criado_por, processo_id")
        .neq("status", "cumprido");
      if (tabMode === "pessoal") {
        q = q.eq("criado_por", user.id);
      } else if (isAdmin && adminCoordFilter !== "todas") {
        // Admin com coordenação selecionada: TODOS os eventos vinculados a
        // processos da coordenação, independente de quem criou.
        if (processosIds.length > 0) {
          q = q.in("processo_id", processosIds);
        } else {
          return { eventos: empty, parcelamentos: empty };
        }
      } else if (!isAdmin && membrosIdsParaResumo.length > 0) {
        q = q.in("criado_por", membrosIdsParaResumo);
      }
      const { data, error } = await q;
      if (error) return { eventos: empty, parcelamentos: empty };
      const hoje_d = new Date(hoje_str + "T00:00:00");
      const calc = (items: any[]) => {
        const atrasadas = items.filter(t => t.data_inicio && new Date(String(t.data_inicio).slice(0, 10) + "T00:00:00") < hoje_d).length;
        const hoje_count = items.filter(t => String(t.data_inicio ?? "").slice(0, 10) === hoje_str).length;
        const futuras = items.filter(t => t.data_inicio && new Date(String(t.data_inicio).slice(0, 10) + "T00:00:00") > hoje_d).length;
        return { atrasadas, hoje: hoje_count, futuras, total: items.length };
      };
      const rows = data || [];
      const parcels = rows.filter(r => (r.tipo ?? "").toLowerCase() === "parcelamento");
      const eventos = rows.filter(r => (r.tipo ?? "").toLowerCase() !== "parcelamento");
      return { eventos: calc(eventos), parcelamentos: calc(parcels) };
    },
    enabled: !!user?.id && resumoStatsReady,
    staleTime: 30000,
  });

  // Audiências vindas de audiencias_detectadas (fonte real do calendário)
  const { data: audienciasDetStats } = useQuery({
    queryKey: [
      "painel-controle-audiencias-det-stats",
      tabMode,
      hoje_str,
      user?.id,
      membrosIdsParaResumo,
      isAdmin,
      adminCoordFilter,
      coordenacoesUsuario,
    ],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return empty;

      let q = supabase
        .from("audiencias_detectadas")
        .select("data_audiencia, status, criado_por, coordenacao_id, id")
        .not("data_audiencia", "is", null)
        .neq("status", "cumprido");

      if (tabMode === "escritorio") {
        if (isAdmin) {
          if (adminCoordFilter !== "todas") {
            q = q.eq("coordenacao_id", adminCoordFilter);
          }
          // admin sem filtro: tudo
        } else if (coordenacoesUsuario.length > 0) {
          q = q.in("coordenacao_id", coordenacoesUsuario);
        } else {
          return empty;
        }
      } else {
        // pessoal: criado por mim OU vinculado (advogado/envolvido)
        const [{ data: audAdvs }, { data: audEnv }] = await Promise.all([
          supabase.from("audiencias_advogados").select("audiencia_id").eq("advogado_id", user.id),
          supabase.from("audiencia_envolvidos").select("audiencia_id").eq("usuario_id", user.id),
        ]);
        const ids = [
          ...new Set([
            ...(audAdvs ?? []).map((a: any) => a.audiencia_id),
            ...(audEnv ?? []).map((a: any) => a.audiencia_id),
          ]),
        ];
        if (ids.length > 0) {
          q = q.or(`criado_por.eq.${user.id},id.in.(${ids.join(",")})`);
        } else {
          q = q.eq("criado_por", user.id);
        }
      }

      const { data, error } = await q;
      if (error) {
        console.error("[audienciasDetStats] erro:", error);
        return empty;
      }
      const hoje_d = new Date(hoje_str + "T00:00:00");
      const rows = data || [];
      const atrasadas = rows.filter((r: any) => r.data_audiencia && new Date(String(r.data_audiencia).slice(0, 10) + "T00:00:00") < hoje_d).length;
      const hoje_count = rows.filter((r: any) => String(r.data_audiencia ?? "").slice(0, 10) === hoje_str).length;
      const futuras = rows.filter((r: any) => r.data_audiencia && new Date(String(r.data_audiencia).slice(0, 10) + "T00:00:00") > hoje_d).length;
      return { atrasadas, hoje: hoje_count, futuras, total: rows.length };
    },
    enabled: !!user?.id && resumoStatsReady,
    staleTime: 30000,
  });

  // ===== CARDS DE RESUMO — usa resumoStats (query direta sem limite de página) =====
  const resumo = useMemo(() => {
    const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
    if (!resumoStats) return { tarefas: empty, prazos: empty, audiencias: empty, eventosTarefa: empty };
    const base = resumoStats as any;
    return {
      ...base,
      audiencias: audienciasDetStats ?? base.audiencias ?? empty,
    };
  }, [resumoStats, audienciasDetStats]);

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

  const itensPainelFiltrados = useMemo(() => {
    return itensAgenda.filter((item) => {
      // Classificação filter
      if (painelFiltros.classificacoes.length > 0) {
        const tipoUpper = (item.tipo_tarefa ?? "").toUpperCase().trim();
        const tipo = (item.tipo ?? "").toLowerCase();
        const isAudiencia = tipoUpper === "AUDIÊNCIA" || tipoUpper === "AUDIENCIA" || tipo === "audiencia";
        const isPrazo = tipo === "prazo" || tipo === "prazo_parcela";
        const isParcelamento = tipo === "parcelamento";
        const isEvento = !isParcelamento && (item.origem === "evento" || tipoUpper === "EVENTO" || tipo === "evento");
        const isTarefa = !isAudiencia && !isPrazo && !isEvento && !isParcelamento;

        const match =
          (painelFiltros.classificacoes.includes("audiencia") && isAudiencia) ||
          (painelFiltros.classificacoes.includes("prazo") && isPrazo) ||
          (painelFiltros.classificacoes.includes("parcelamento") && isParcelamento) ||
          (painelFiltros.classificacoes.includes("evento") && isEvento) ||
          (painelFiltros.classificacoes.includes("tarefa") && isTarefa);
        if (!match) return false;
      }

      // Status (grupo simplificado)
      if (painelFiltros.statusGroup && painelFiltros.statusGroup !== "todas") {
        const st = (item.status ?? "").toLowerCase();
        const concluido = isItemTratado(item);
        const cancelado = st === "cancelado";
        if (painelFiltros.statusGroup === "a_concluir" && (concluido || cancelado)) return false;
        if (painelFiltros.statusGroup === "concluidas" && !concluido) return false;
        if (painelFiltros.statusGroup === "canceladas" && !cancelado) return false;
      }

      // Situação detalhada (avançado)
      if (painelFiltros.situacoes.length > 0) {
        if (!painelFiltros.situacoes.includes(item.status)) return false;
      }

      // Envolvimento filter
      if (painelFiltros.souResponsavel || painelFiltros.estouEnvolvido) {
        const userId = user?.id;
        if (!userId) return false;
        const isResp = item.responsavel_id === userId || item.criado_por === userId;
        const isEnvolvido = item.participantes?.some((p) => p.usuario_id === userId);
        if (painelFiltros.souResponsavel && painelFiltros.estouEnvolvido) {
          if (!isResp && !isEnvolvido) return false;
        } else if (painelFiltros.souResponsavel) {
          if (!isResp) return false;
        } else if (painelFiltros.estouEnvolvido) {
          if (!isEnvolvido) return false;
        }
      }

      // Responsável(is) selecionado(s)
      if (painelFiltros.responsavelIds.length > 0) {
        const rid = item.responsavel_id;
        const cid = item.criado_por;
        const envolvido = item.participantes?.some((p) => painelFiltros.responsavelIds.includes(p.usuario_id));
        const isMatch =
          (rid && painelFiltros.responsavelIds.includes(rid)) ||
          (cid && painelFiltros.responsavelIds.includes(cid)) ||
          envolvido;
        if (!isMatch) return false;
      }

      // Período (data prevista/fatal conforme escolha em "Prazo")
      if (painelFiltros.periodoInicio || painelFiltros.periodoFim) {
        let dateStr: string | undefined;
        if (item.origem === "tarefa") {
          if (painelFiltros.dataFatal && !painelFiltros.dataPrevista) {
            dateStr = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
          } else {
            dateStr = item.data_vencimento ?? item.data_fatal ?? item.data_inicio;
          }
        } else {
          dateStr = item.data_inicio;
        }
        const d = (dateStr ?? "").slice(0, 10);
        if (!d) return false;
        if (painelFiltros.periodoInicio && d < painelFiltros.periodoInicio) return false;
        if (painelFiltros.periodoFim && d > painelFiltros.periodoFim) return false;
      }

      // Filtro "Somente Hoje"
      if (somenteHoje) {
        let dateStr: string | undefined;
        if (item.origem === "tarefa") {
          if (painelFiltros.dataFatal && !painelFiltros.dataPrevista) {
            dateStr = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
          } else {
            dateStr = item.data_vencimento ?? item.data_fatal ?? item.data_inicio;
          }
        } else {
          dateStr = item.data_inicio;
        }
        const d = (dateStr ?? "").slice(0, 10);
        if (d !== hoje_str) return false;
      }

      // Filtro rápido de Situação (global)
      if (situacaoFilter && situacaoFilter !== "todos") {
        if ((item.status ?? "").toLowerCase() !== situacaoFilter) return false;
      }

      return true;
    });
  }, [itensAgenda, painelFiltros, user?.id, somenteHoje, hoje_str, situacaoFilter]);

  // Mapa de itens por dia (chave: "YYYY-MM-DD")
  // Concluídas aparecem no final de cada dia, pendentes primeiro
  const itensPorDia = useMemo(() => {
    const map = new Map<string, ItemAgendaUnificado[]>();

    const filtered = itensPainelFiltrados;

    filtered.forEach((item) => {
      // Choose date key based on prazo filter
      let dateKey: string;
      if (item.origem === "tarefa") {
        if (painelFiltros.dataFatal && !painelFiltros.dataPrevista && item.data_fatal) {
          dateKey = item.data_fatal.slice(0, 10);
        } else if (painelFiltros.dataPrevista && item.data_vencimento) {
          dateKey = item.data_vencimento.slice(0, 10);
        } else {
          dateKey = item.data_inicio.slice(0, 10);
        }
      } else {
        dateKey = item.data_inicio.slice(0, 10);
      }

      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(item);
    });

    // Ordenar: pendentes/atrasados primeiro, concluídos por último
    map.forEach((itens, key) => {
      map.set(key, [
        ...itens.filter(i => !isItemTratado(i)),
        ...itens.filter(i => isItemTratado(i)),
      ]);
    });
    return map;
  }, [itensPainelFiltrados, painelFiltros]);

  const handleDayClick = (_dia: Date) => {
    // Apenas para visualização
  };

  const handleItemClick = (item: ItemAgendaUnificado) => {
    handleEditItem(item);
  };

  const handleEditItem = (item: ItemAgendaUnificado) => {
    setSelectedItem(item);
  };

  const handleConcluirItem = async (item: ItemAgendaUnificado) => {
    const isConcluido = isItemTratado(item);
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
    <MainLayout
      title="Painel de Controle"
      headerActions={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/notificacoes">Notificações</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/painel-intimacoes">Painel Intimações</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/painel-equipe">Painel da Equipe</Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col -m-4 md:-m-6" style={{ height: "calc(100vh - 64px)" }}>
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 bg-card border-b border-border flex-shrink-0 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
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
            <Button
              size="sm"
              variant={somenteHoje ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setSomenteHoje((v) => !v)}
              title="Exibir apenas itens de hoje"
            >
              Somente Hoje
            </Button>
            <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
              <SelectTrigger className="h-7 w-[160px] text-xs" title="Filtrar por situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">⏳ Pendentes</SelectItem>
                <SelectItem value="confirmado">✅ Confirmados</SelectItem>
                <SelectItem value="reagendado">🔄 Reagendados</SelectItem>
                <SelectItem value="tratado">✔️ Tratados</SelectItem>
                <SelectItem value="cancelado">❌ Cancelados</SelectItem>
                <SelectItem value="ignorado">🚫 Ignorados</SelectItem>
              </SelectContent>
            </Select>
            {/* Filtro de coordenação para admin no modo escritório - desktop inline */}
            {isAdmin && tabMode === "escritorio" && (
              <div className="hidden md:block">
                <Select value={adminCoordFilter} onValueChange={setAdminCoordFilter}>
                  <SelectTrigger className="h-7 w-52 text-xs">
                    <SelectValue placeholder="Coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as coordenações</SelectItem>
                    {todasCoordenacoes.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <div className="hidden md:flex gap-1 mr-1">
                <Button
                  size="sm"
                  variant={viewMode === "agenda" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("agenda")}
                  title="Visão em agenda"
                >
                  Em Agenda
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "lista" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("lista")}
                  title="Visão em lista"
                >
                  Em Lista
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "kanban" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("kanban")}
                  title="Visão em Kanban (obedece os filtros)"
                >
                  Kanban
                </Button>
                {([
                  { key: "prazo",         label: "Prazos" },
                  { key: "audiencia",     label: "Audiências" },
                  { key: "tarefa",        label: "Tarefas" },
                  { key: "evento",        label: "Eventos" },
                  { key: "parcelamento",  label: "Parcelamentos" },
                ] as const).map((f) => {
                  const active =
                    painelFiltros.classificacoes.length === 1 &&
                    painelFiltros.classificacoes[0] === f.key;
                  return (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-7 px-3 text-xs"
                      onClick={() =>
                        setPainelFiltros((s) => ({
                          ...s,
                          classificacoes: active ? [] : [f.key],
                        }))
                      }
                      title={`Somente ${f.label}`}
                    >
                      {f.label}
                    </Button>
                  );
                })}
                <Button
                  size="sm"
                  variant={painelFiltros.classificacoes.length === 0 ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() =>
                    setPainelFiltros((s) => ({ ...s, classificacoes: [] }))
                  }
                  title="Todos os tipos"
                >
                  Tudo
                </Button>
              </div>
              <PainelFiltros filtros={painelFiltros} onChange={setPainelFiltros} />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={async () => {
                  const XLSX = await import("xlsx");
                  const rows = itensPainelFiltrados.map((it) => ({
                    Classificação: TIPO_LABELS[it.tipo as string] ?? it.tipo_tarefa ?? it.tipo,
                    Título: it.titulo,
                    Status: it.status,
                    "Data prevista": (it.data_vencimento ?? it.data_inicio ?? "").slice(0, 10),
                    "Data fatal": (it.data_fatal ?? "").slice(0, 10),
                    Responsável: it.responsavel?.nome ?? "",
                    Processo: it.processo?.numero ?? "",
                    Coordenação: (it as any).coordenacao_nome ?? "",
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Atividades");
                  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
                  XLSX.writeFile(wb, `atividades_${stamp}.xlsx`);
                }}
                title="Exportar atividades filtradas para Excel"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-7 px-3 text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setNovoItemTipo("tarefa"); }}>
                    <ClipboardList className="w-4 h-4 mr-2" /> Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setNovoItemTipo("evento"); }}>
                    <CalendarPlus className="w-4 h-4 mr-2" /> Evento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setNovoItemTipo("prazo"); }}>
                    <Clock className="w-4 h-4 mr-2" /> Prazo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setNovoItemTipo("audiencia"); }}>
                    <Gavel className="w-4 h-4 mr-2" /> Audiência
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setNovoItemTipo("parcelamento"); }}>
                    <Coins className="w-4 h-4 mr-2" /> Parcelamento recorrente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Filtro de coordenação para admin no modo escritório - mobile linha separada */}
          {isAdmin && tabMode === "escritorio" && (
            <div className="md:hidden">
              <Select value={adminCoordFilter} onValueChange={setAdminCoordFilter}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações</SelectItem>
                  {todasCoordenacoes.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Cards de Resumo — compactos no mobile */}
        <div className="flex-shrink-0 px-3 md:px-6 py-2 md:py-3 border-b border-border bg-card">
          <details className="mb-2 group">
            <summary className="cursor-pointer flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              Acompanhamento Especial — Novidades
            </summary>
            <div className="mt-2 max-h-56 overflow-y-auto pr-2">
              <AcompanhamentoEspecialEventos limit={10} showProcesso />
            </div>
          </details>
          {isLoading ? (
            <div className="flex gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 md:h-20 flex-1 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
              {/* Data Atual */}
              <div className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-3 py-2">
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

              <Card
                onClick={() =>
                  setPainelFiltros((f) => ({
                    ...f,
                    classificacoes: f.classificacoes.includes("tarefa") ? [] : ["tarefa"],
                  }))
                }
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800",
                  painelFiltros.classificacoes.includes("tarefa") && "ring-2 ring-blue-500",
                )}
              >
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">Tarefas</p>
                      <p className="text-xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">{resumo.tarefas.total}</p>
                    </div>
                    <ClipboardList className="w-6 h-6 md:w-10 md:h-10 text-blue-500/50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() =>
                  setPainelFiltros((f) => ({
                    ...f,
                    classificacoes: f.classificacoes.includes("evento") ? [] : ["evento"],
                  }))
                }
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800",
                  painelFiltros.classificacoes.includes("evento") && "ring-2 ring-green-500",
                )}
              >
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-green-700 dark:text-green-400 truncate">Eventos</p>
                      <p className="text-xl md:text-3xl font-bold text-green-700 dark:text-green-300">{(eventosStats?.eventos.total ?? 0) + (resumo.eventosTarefa?.total ?? 0)}</p>
                    </div>
                    <CalendarPlus className="w-6 h-6 md:w-10 md:h-10 text-green-500/50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() =>
                  setPainelFiltros((f) => ({
                    ...f,
                    classificacoes: f.classificacoes.includes("prazo") ? [] : ["prazo"],
                  }))
                }
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800",
                  painelFiltros.classificacoes.includes("prazo") && "ring-2 ring-red-500",
                )}
              >
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400 truncate">Prazos</p>
                      <p className="text-xl md:text-3xl font-bold text-red-700 dark:text-red-300">{resumo.prazos?.total ?? 0}</p>
                    </div>
                    <Clock className="w-6 h-6 md:w-10 md:h-10 text-red-500/50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() =>
                  setPainelFiltros((f) => ({
                    ...f,
                    classificacoes: f.classificacoes.includes("audiencia") ? [] : ["audiencia"],
                  }))
                }
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/30 border-yellow-200 dark:border-yellow-800",
                  painelFiltros.classificacoes.includes("audiencia") && "ring-2 ring-yellow-500",
                )}
              >
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-yellow-700 dark:text-yellow-400 truncate">Audiências</p>
                      <p className="text-xl md:text-3xl font-bold text-yellow-700 dark:text-yellow-300">{resumo.audiencias.total}</p>
                    </div>
                    <Gavel className="w-6 h-6 md:w-10 md:h-10 text-yellow-500/50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() =>
                  setPainelFiltros((f) => ({
                    ...f,
                    classificacoes: f.classificacoes.includes("parcelamento") ? [] : ["parcelamento"],
                  }))
                }
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800",
                  painelFiltros.classificacoes.includes("parcelamento") && "ring-2 ring-emerald-500",
                )}
              >
                <CardContent className="p-3 md:pt-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">Parcelamentos</p>
                      <p className="text-xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">{eventosStats?.parcelamentos.total ?? 0}</p>
                    </div>
                    <Coins className="w-6 h-6 md:w-10 md:h-10 text-emerald-500/50 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Corpo principal: calendário + painel detalhe OU lista de atividades */}
        {viewMode === "lista" ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ListaAtividadesView
              embedded
              onRequestNovo={() => { setSelectedItem(null); setNovoItemTipo("tarefa"); }}
              externalItems={itensPainelFiltrados}
              externalLoading={isLoading}
              forcedCoordenacaoId={
                tabMode === "pessoal"
                  ? "all"
                  : isAdmin
                    ? (adminCoordFilter === "todas" ? "all" : adminCoordFilter)
                    : (coordenacoesUsuario[0] ?? "all")
              }
              forcedResponsavelId={tabMode === "pessoal" ? (user?.id ?? undefined) : undefined}
            />
          </div>
        ) : viewMode === "prazos" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <TstPrazos embedded />
          </div>
        ) : viewMode === "kanban" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            {(() => {
              const c = painelFiltros.classificacoes;
              // Se um único tipo estiver selecionado, mostra o kanban correspondente.
              if (c.length === 1 && c[0] === "prazo") return <TstPrazos embedded />;
              if (c.length === 1 && c[0] === "audiencia") return <PainelAudiencias embedded statusFilter={situacaoFilter} onStatusFilterChange={setSituacaoFilter} />;
              // Default: audiências (kanban principal). Usuário troca o tipo pelos chips.
              return <PainelAudiencias embedded statusFilter={situacaoFilter} onStatusFilterChange={setSituacaoFilter} />;
            })()}
          </div>
        ) : viewMode === "audiencias" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <PainelAudiencias embedded statusFilter={situacaoFilter} onStatusFilterChange={setSituacaoFilter} />
          </div>
        ) : viewMode === "notificacoes" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <Notificacoes embedded />
          </div>
        ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Calendário Mensal */}
          <div className="flex flex-col border-r border-border bg-card flex-1">
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
                        const MAX_VISIBLE = 3;
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
                                const isConcluido = isItemTratado(item);
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
                                    <TratadoCheck tratado size={10} className="text-current dark:text-current" />
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
                                          const isConcluido = isItemTratado(item);
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
                                              <TratadoCheck tratado size={12} className="text-current dark:text-current" />
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

          {selectedItem && (
            <aside className="hidden lg:flex w-[640px] xl:w-[720px] flex-shrink-0 border-l border-border bg-background flex-col min-h-0">
              <EdicaoItemPanel
                key={selectedItem.id}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                }}
              />
            </aside>
          )}

          {!selectedItem && novoItemTipo && (
            <aside className="hidden lg:flex w-[640px] xl:w-[720px] flex-shrink-0 border-l border-border bg-background flex-col min-h-0">
              <NovoItemPanel
                tipo={novoItemTipo}
                onClose={() => setNovoItemTipo(null)}
                onSuccess={async () => {
                  setNovoItemTipo(null);
                  await queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                  await queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] });
                  await queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] });
                }}
              />
            </aside>
          )}

        </div>
        )}
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
    </MainLayout>
  );
}

function NovaTarefaDialogWrapper({
  open,
  onOpenChange,
  tarefaParaEditar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaParaEditar?: any | null;
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
      tarefaParaEditar={tarefaParaEditar}
    />
  );
}

function NovoItemPanel({
  tipo,
  onClose,
  onSuccess,
}: {
  tipo: "tarefa" | "evento" | "prazo" | "audiencia" | "parcelamento";
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: membrosCoordenacoes = [] } = useQuery({
    queryKey: ["membros-coordenacoes-novo-item-painel", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return (data || []).map((m) => m.coordenacao_id);
    },
    enabled: !!user?.id && !isAdmin && tipo === "tarefa",
  });

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-novo-item-painel", isAdmin, membrosCoordenacoes],
    queryFn: async () => {
      let query = supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (!isAdmin && membrosCoordenacoes.length > 0) {
        query = query.in("id", membrosCoordenacoes);
      } else if (!isAdmin && membrosCoordenacoes.length === 0) {
        return [];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: tipo === "tarefa" && (isAdmin || membrosCoordenacoes.length > 0),
  });

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-end px-2 py-1.5 border-b bg-card flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
          <span className="sr-only">Fechar</span>
          ×
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tipo === "tarefa" && (
          <NovaTarefaDialog
            inline
            open
            onOpenChange={handleOpenChange}
            coordenacoes={coordenacoes}
            onSuccess={() => { void onSuccess(); }}
          />
        )}
        {tipo === "evento" && (
          <EventoDialog
            inline
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            evento={null}
          />
        )}
        {tipo === "prazo" && (
          <PrazoDialog
            inline
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            prazo={null}
          />
        )}
        {tipo === "audiencia" && (
          <div className="h-full flex flex-col">
            <div className="px-4 pt-4 sm:px-6 sm:pt-5 pb-3 shrink-0 border-b">
              <h3 className="text-base font-semibold">Audiência</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              <AudienciaFormSimplificado
                hideTitleHeader
                onSuccess={() => { void onSuccess(); }}
                onCancel={onClose}
              />
            </div>
          </div>
        )}
        {tipo === "parcelamento" && (
          <GerarParcelasDialog
            inline
            open
            onOpenChange={(o) => { handleOpenChange(o); if (!o) void onSuccess(); }}
            evento={null}
          />
        )}
      </div>
    </div>
  );
}
