import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DiaAgendaLateral } from "@/components/painel/DiaAgendaLateral";
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
import { ClipboardList, CalendarPlus, Clock, Gavel, Coins, Eye, EyeOff, SlidersHorizontal, FilterX } from "lucide-react";
import { BarChart3 } from "lucide-react";
import { RelatorioAudienciasDialog } from "@/components/audiencias/RelatorioAudienciasDialog";
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
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMensagensNaoLidas } from "@/hooks/useMensagensNaoLidas";
import { toast } from "sonner";
import ListaAtividadesView from "@/components/lista/ListaAtividadesView";
import TstPrazos from "@/pages/TstPrazos";
import { KanbanItensAgenda } from "@/components/painel/KanbanItensAgenda";
import { EquipeItensAgenda } from "@/components/painel/EquipeItensAgenda";
import PainelAudiencias from "@/pages/PainelAudiencias";
import MinhasMensagensRecebidas from "@/components/notificacoes/MinhasMensagensRecebidas";
import { BuscaGlobalPainel } from "@/components/painel/BuscaGlobalPainel";
import { AcompanhamentoEspecialEventos } from "@/components/processos/AcompanhamentoEspecialEventos";
import { Sparkles } from "lucide-react";

const TIME_ZONE = "America/Sao_Paulo";

type TabMode = "pessoal" | "escritorio";
type ViewMode = "agenda" | "lista" | "kanban" | "equipe" | "prazos" | "audiencias" | "notificacoes";

const isPainelViewMode = (value: string | null): value is ViewMode =>
  value === "agenda" ||
  value === "lista" ||
  value === "kanban" ||
  value === "equipe" ||
  value === "prazos" ||
  value === "audiencias" ||
  value === "notificacoes";

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

const normalizeAgendaStatus = (status?: string | null) =>
  (status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isItemCancelado = (item: Pick<ItemAgendaUnificado, "status">) => {
  const status = normalizeAgendaStatus(item.status);
  return status === "cancelado" || status === "cancelada";
};

const isItemEncerrado = (item: ItemAgendaUnificado) =>
  isItemTratado(item) || isItemCancelado(item);

const diasDaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function PainelControle() {
  const { user } = useAuth();
  const { isAdmin, isAdminOrCoordinator } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { totalNaoLidas } = useMensagensNaoLidas();
  const handledSelectedIdRef = useRef(false);
  const handledItemParamRef = useRef(false);
  const [tabMode, setTabMode] = useState<TabMode>("pessoal");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const viewParam = searchParams.get("view");
    return isPainelViewMode(viewParam) ? viewParam : "agenda";
  });
  const [mesAtual, setMesAtual] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<ItemAgendaUnificado | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [relatorioAudOpen, setRelatorioAudOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [selectedParcelamento, setSelectedParcelamento] = useState<EventoAgenda | null>(null);
  const [novoItemTipo, setNovoItemTipo] = useState<null | "tarefa" | "evento" | "prazo" | "audiencia" | "parcelamento">(null);
  const [tarefaEditando, setTarefaEditando] = useState<any | null>(null);
  const [prazoEditando, setPrazoEditando] = useState<any | null>(null);
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [diaLateralKey, setDiaLateralKey] = useState<string | null>(null);
  const [somenteHoje, setSomenteHoje] = useState(false);

  const lastViewParamRef = useRef<string | null>(searchParams.get("view"));
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === lastViewParamRef.current) return;
    lastViewParamRef.current = viewParam;
    if (isPainelViewMode(viewParam)) {
      setSelectedItem(null);
      setViewMode(viewParam);
    }
  }, [searchParams]);

  // Mantém a URL em sincronia quando o usuário troca de visão manualmente
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (!viewParam || viewParam === viewMode) return;
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    lastViewParamRef.current = null;
    setSearchParams(next, { replace: true });
  }, [viewMode, searchParams, setSearchParams]);

  // Abrir item vindo da busca global (?selectedId=...&origem=tarefa|evento)
  useEffect(() => {
    if (handledSelectedIdRef.current) return;
    const selId = searchParams.get("selectedId");
    const origem = searchParams.get("origem") as "tarefa" | "evento" | null;
    if (!selId || !origem) return;
    handledSelectedIdRef.current = true;
    (async () => {
      const table = origem === "evento" ? "eventos_agenda" : "tarefas";
      const { data, error } = await supabase.from(table).select("*").eq("id", selId).maybeSingle();
      if (error || !data) {
        toast.error("Item não encontrado ou sem permissão");
        setSearchParams({}, { replace: true });
        return;
      }
      const row: any = data;
      const tipoTarefa = String(row.tipo_tarefa || "").toLowerCase();
      const tipo =
        origem === "evento"
          ? (row.tipo || "evento")
          : tipoTarefa.includes("prazo")
            ? "prazo"
            : tipoTarefa.includes("audi")
              ? "audiencia"
              : "tarefa";
      const item: ItemAgendaUnificado = {
        ...row,
        id: row.id,
        origem,
        tipo,
        titulo: row.titulo ?? "",
        descricao: row.descricao ?? null,
        data_inicio: row.data_inicio || row.data_vencimento || row.data_fatal || row.created_at,
        data_fim: row.data_fim ?? null,
        dia_inteiro: row.dia_inteiro ?? false,
        local: row.local ?? null,
        recorrente: row.recorrente ?? false,
        recorrencia_tipo: row.recorrencia_tipo ?? null,
        status: row.status ?? "pendente",
        concluido_em: row.concluido_em ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        processo_id: row.processo_id ?? null,
        coordenacao_id: row.coordenacao_id ?? null,
      };
      setSelectedItem(item);
      setSearchParams({}, { replace: true });
    })();
  }, [searchParams, setSearchParams]);
  const [situacaoFilter, setSituacaoFilter] = useState<string>("todos");
  const [adminCoordFilter, setAdminCoordFilter] = useState<string>("todas");
  const [painelFiltros, setPainelFiltros] = useState<PainelFiltrosState>(PAINEL_FILTROS_DEFAULT);
  const limparFiltrosPainel = useCallback(() => {
    setPainelFiltros(PAINEL_FILTROS_DEFAULT);
    setSituacaoFilter("todos");
    setSomenteHoje(false);
  }, []);
  const [mostrarTotalizadores, setMostrarTotalizadores] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("painel:mostrarTotalizadores");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem("painel:mostrarTotalizadores", mostrarTotalizadores ? "1" : "0"); } catch {}
  }, [mostrarTotalizadores]);
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("painel:mostrarFiltros");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem("painel:mostrarFiltros", mostrarFiltros ? "1" : "0"); } catch {}
  }, [mostrarFiltros]);

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
        coordenacaoIds: coordenacoesUsuario,
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

  // Intervalo do mês em ISO (yyyy-MM-dd) — alinha totalizadores ao calendário
  const rangeInicioStr = useMemo(() => format(dataInicio, "yyyy-MM-dd"), [dataInicio]);
  const rangeFimStr = useMemo(() => format(dataFim, "yyyy-MM-dd"), [dataFim]);

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
    queryKey: ["painel-controle-resumo-stats", tabMode, hoje_str, rangeInicioStr, rangeFimStr, membrosIdsParaResumo, isAdmin, isAdminOrCoordinator, adminCoordFilter, coordenacoesUsuario],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return { tarefas: empty, audiencias: empty, compromissos: empty };

      const baseSelect = "data_vencimento, data_fatal, tipo_tarefa, status, responsavel_id, criado_por";

      let q = supabase
        .from("tarefas")
        .select(baseSelect)
        .not("status", "in", "(cumprido,cancelado)");

      if (tabMode === "escritorio" && isAdmin && adminCoordFilter !== "todas") {
        q = supabase
          .from("tarefas")
          .select(`${baseSelect}, processo:processos!inner(coordenacao_id)`)
          .eq("processo.coordenacao_id", adminCoordFilter)
          .not("status", "in", "(cumprido,cancelado)");
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
      // Filtra pelo intervalo do mês exibido (usa data_vencimento ?? data_fatal)
      const inRange = (t: any) => {
        const dateStr = (t.data_vencimento ?? t.data_fatal ?? "").slice(0, 10);
        if (!dateStr) return false;
        return dateStr >= rangeInicioStr && dateStr <= rangeFimStr;
      };
      const tarefasFiltradas = (tarefas || []).filter(inRange);
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

      const all = tarefasFiltradas;
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
    queryKey: ["painel-controle-eventos-stats", tabMode, hoje_str, rangeInicioStr, rangeFimStr, membrosIdsParaResumo, isAdmin, adminCoordFilter, processosIds],
    queryFn: async () => {
      const empty = { atrasadas: 0, hoje: 0, futuras: 0, total: 0 };
      if (!user?.id) return { eventos: empty, parcelamentos: empty };
      let q = supabase
        .from("eventos_agenda")
        .select("data_inicio, tipo, status, criado_por, processo_id")
        .not("status", "in", "(concluido,cancelado)")
        .gte("data_inicio", rangeInicioStr)
        .lte("data_inicio", rangeFimStr + "T23:59:59");
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
      rangeInicioStr,
      rangeFimStr,
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
        .not("status", "in", "(tratado,cancelado,concluido)")
        .gte("data_audiencia", rangeInicioStr)
        .lte("data_audiencia", rangeFimStr + "T23:59:59");

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
        // Evento é APENAS quando o tipo real do item é "evento". Não usar item.origem,
        // que no hook useAgendaUnificada é só um rótulo interno (tarefa vs. outras origens).
        const isEvento = tipo === "evento" || tipoUpper === "EVENTO";
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
        const st = normalizeAgendaStatus(item.status);
        const concluido = isItemTratado(item);
        const cancelado = isItemCancelado(item);
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

  // ===== Classificação de um item (mesma regra do filtro de classificação) =====
  const classificarItem = (item: any): "audiencia" | "prazo" | "parcelamento" | "evento" | "tarefa" => {
    const tipoUpper = (item.tipo_tarefa ?? "").toUpperCase().trim();
    const tipo = (item.tipo ?? "").toLowerCase();
    if (tipoUpper === "AUDIÊNCIA" || tipoUpper === "AUDIENCIA" || tipo === "audiencia") return "audiencia";
    if (tipo === "prazo" || tipo === "prazo_parcela") return "prazo";
    if (tipo === "parcelamento") return "parcelamento";
    if (tipo === "evento" || tipoUpper === "EVENTO") return "evento";
    return "tarefa";
  };

  // ===== Contagens por classificação, usando a MESMA base do calendário =====
  // Aplica todos os filtros do painel EXCETO o de classificação, de modo que
  // ao clicar num card, o calendário mostra exatamente aqueles itens.
  const contagensPorClassificacao = useMemo(() => {
    const counts = { tarefa: 0, evento: 0, prazo: 0, audiencia: 0, parcelamento: 0 };
    const base = itensAgenda.filter((item) => {
      // Os cards totalizadores SEMPRE representam pendências em aberto,
      // independentemente do filtro de status escolhido pelo usuário.
      // Isso evita contabilizar prazos/tarefas já tratados, cumpridos ou cancelados.
      if (isItemEncerrado(item) || isItemTratado(item) || isItemCancelado(item)) return false;
      const statusGroup = painelFiltros.statusGroup ?? "todas";
      if (statusGroup === "concluidas" || statusGroup === "canceladas") {
        // Nesses filtros o calendário mostra encerrados; os cards continuam zerados.
        return false;
      }
      if (painelFiltros.situacoes.length > 0 && !painelFiltros.situacoes.includes(item.status)) return false;
      if (painelFiltros.souResponsavel || painelFiltros.estouEnvolvido) {
        const userId = user?.id;
        if (!userId) return false;
        const isResp = item.responsavel_id === userId || item.criado_por === userId;
        const isEnvolvido = item.participantes?.some((p: any) => p.usuario_id === userId);
        if (painelFiltros.souResponsavel && painelFiltros.estouEnvolvido) {
          if (!isResp && !isEnvolvido) return false;
        } else if (painelFiltros.souResponsavel) {
          if (!isResp) return false;
        } else if (painelFiltros.estouEnvolvido) {
          if (!isEnvolvido) return false;
        }
      }
      if (painelFiltros.responsavelIds.length > 0) {
        const rid = item.responsavel_id;
        const cid = item.criado_por;
        const envolvido = item.participantes?.some((p: any) => painelFiltros.responsavelIds.includes(p.usuario_id));
        const isMatch =
          (rid && painelFiltros.responsavelIds.includes(rid)) ||
          (cid && painelFiltros.responsavelIds.includes(cid)) ||
          envolvido;
        if (!isMatch) return false;
      }
      if (somenteHoje) {
        let dateStr: string | undefined;
        if (item.origem === "tarefa") {
          dateStr = (painelFiltros.dataFatal && !painelFiltros.dataPrevista)
            ? (item.data_fatal ?? item.data_vencimento ?? item.data_inicio)
            : (item.data_vencimento ?? item.data_fatal ?? item.data_inicio);
        } else {
          dateStr = item.data_inicio;
        }
        if ((dateStr ?? "").slice(0, 10) !== hoje_str) return false;
      }
      if (situacaoFilter && situacaoFilter !== "todos") {
        if ((item.status ?? "").toLowerCase() !== situacaoFilter) return false;
      }
      return true;
    });
    base.forEach((it) => { counts[classificarItem(it)]++; });
    return counts;
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

  // Abre o item (tarefa/prazo/evento/audiência) vinculado a um alerta recebido
  const abrirItemPorReferencia = async (referenciaId: string, silencioso = false): Promise<boolean> => {
    const local = itensPainelFiltrados.find(
      (i) =>
        i.id === referenciaId ||
        String(i.id).startsWith(`${referenciaId}-`) ||
        String(i.id).endsWith(`-${referenciaId}`)
    );
    if (local) {
      setSelectedItem(local);
      return true;
    }

    const { data: tarefa } = await supabase
      .from("tarefas")
      .select(
        "*, processo:processos!tarefas_processo_id_fkey(id,numero,assunto,cliente_id,coordenacao_id), responsavel:profiles!tarefas_responsavel_id_fkey(id,nome)"
      )
      .eq("id", referenciaId)
      .maybeSingle();

    if (tarefa) {
      const t = tarefa as any;
      setSelectedItem({
        ...t,
        origem: "tarefa",
        tipo: t.tipo_tarefa || "tarefa",
        data_inicio: t.data_vencimento || t.data_fatal || t.created_at,
        data_fim: t.data_fatal ?? null,
        dia_inteiro: true,
        local: null,
        recorrente: !!t.recorrente,
        concluido_em: t.concluido_em ?? null,
      } as ItemAgendaUnificado);
      return true;
    }

    const { data: evento } = await supabase
      .from("eventos_agenda")
      .select("*, processo:processos(id,numero,assunto,cliente_id,coordenacao_id)")
      .eq("id", referenciaId)
      .maybeSingle();

    if (evento) {
      const e = evento as any;
      setSelectedItem({
        ...e,
        origem: "evento",
        tipo: e.tipo || "evento",
        data_inicio: e.data_inicio,
        data_fim: e.data_fim ?? null,
        dia_inteiro: !!e.dia_inteiro,
        recorrente: !!e.recorrente,
        concluido_em: e.concluido_em ?? null,
        status: e.status || "pendente",
      } as ItemAgendaUnificado);
      return true;
    }

    const { data: audiencia } = await supabase
      .from("audiencias_detectadas")
      .select(
        "id, titulo, processo_id, processo_numero, data_audiencia, hora, status, observacoes, local_audiencia, forum, criado_por, coordenacao_id, created_at, updated_at"
      )
      .eq("id", referenciaId)
      .maybeSingle();

    if (audiencia) {
      const a = audiencia as any;
      setSelectedItem({
        id: `audiencia-det-${a.id}`,
        titulo: a.titulo || `Audiência ${a.processo_numero ?? ""}`.trim(),
        descricao: a.observacoes ?? null,
        tipo: "audiencia",
        origem: "evento",
        data_inicio: a.data_audiencia,
        data_fim: null,
        dia_inteiro: !a.hora,
        local: a.local_audiencia || a.forum || null,
        recorrente: false,
        status: a.status === "cumprido" ? "concluido" : a.status || "pendente",
        concluido_em: null,
        created_at: a.created_at,
        updated_at: a.updated_at,
        processo_id: a.processo_id ?? null,
        processo: a.processo_numero ? { id: a.processo_id ?? a.id, numero: a.processo_numero } : null,
        criado_por: a.criado_por,
        coordenacao_id: a.coordenacao_id ?? null,
      } as unknown as ItemAgendaUnificado);
      return true;
    }

    // Parcelas: abrir o evento-pai (parcelamento)
    const { data: parcela } = await supabase
      .from("parcelas_evento")
      .select("id, evento_id")
      .eq("id", referenciaId)
      .maybeSingle();

    if (parcela?.evento_id) {
      const { data: eventoPai } = await supabase
        .from("eventos_agenda")
        .select("*, processo:processos(id,numero,assunto,cliente_id,coordenacao_id)")
        .eq("id", parcela.evento_id)
        .maybeSingle();
      if (eventoPai) {
        const e = eventoPai as any;
        setSelectedItem({
          ...e,
          origem: "evento",
          tipo: e.tipo || "parcelamento",
          data_inicio: e.data_inicio,
          data_fim: e.data_fim ?? null,
          dia_inteiro: !!e.dia_inteiro,
          recorrente: !!e.recorrente,
          concluido_em: e.concluido_em ?? null,
          status: e.status || "pendente",
        } as ItemAgendaUnificado);
        return true;
      }
    }

    if (!silencioso) toast.error("Item vinculado a este alerta não foi encontrado");
    return false;
  };

  // Deep link vindo dos e-mails de alerta:
  // /painel-controle?view=notificacoes&item=<id> abre o detalhe do item.
  useEffect(() => {
    if (handledItemParamRef.current) return;
    const itemId = searchParams.get("item");
    if (!itemId) return;
    if (!user) return; // aguarda a sessão para respeitar RLS
    handledItemParamRef.current = true;
    (async () => {
      let ok = await abrirItemPorReferencia(itemId, true);
      // Retentativa curta: em cargas frias o token/cache pode não estar pronto.
      for (let i = 0; i < 3 && !ok; i++) {
        await new Promise((r) => setTimeout(r, 800));
        ok = await abrirItemPorReferencia(itemId, i === 2);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("item");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarTotalizadores((v) => !v)}
            title={mostrarTotalizadores ? "Ocultar cards totalizadores" : "Mostrar cards totalizadores"}
          >
            {mostrarTotalizadores ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarFiltros((v) => !v)}
            title={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
            aria-label={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
          >
            <SlidersHorizontal className={`w-4 h-4 ${mostrarFiltros ? "" : "opacity-50"}`} />
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          )}
          {isAdminOrCoordinator && (
            <Button asChild variant="outline" size="sm">
              <Link to="/notificacoes">Config. Notificações</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setRelatorioAudOpen(true)} title="Relatório de audiências por usuário/situação">
            <BarChart3 className="w-4 h-4 mr-1" /> Relatório Audiências
          </Button>
          {false && isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/painel-intimacoes">Painel Intimações</Link>
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col -m-4 md:-m-6 md:h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 bg-card border-b border-border flex-shrink-0 space-y-2">
          {relatorioAudOpen && (
            <RelatorioAudienciasDialog
              open={relatorioAudOpen}
              onOpenChange={setRelatorioAudOpen}
            />
          )}
          {mostrarFiltros && (<>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="flex gap-1 flex-shrink-0">
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={limparFiltrosPainel}
              title="Limpar todos os filtros do painel"
            >
              <FilterX className="w-3.5 h-3.5 mr-1" />
              Limpar filtros
            </Button>
            {/* Filtro de coordenação para admin no modo escritório - desktop inline */}
            {isAdmin && tabMode === "escritorio" && (
              <div className="block min-w-0">
                <Select value={adminCoordFilter} onValueChange={setAdminCoordFilter}>
                  <SelectTrigger className="h-7 w-full max-w-[13rem] text-xs">
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
            <div className="md:ml-auto flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="flex flex-wrap gap-1 mr-1">
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
                <Button
                  size="sm"
                  variant={viewMode === "equipe" ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("equipe")}
                  title="Painel da Equipe (obedece os filtros)"
                >
                  Equipe
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "notificacoes" ? "default" : "destructive"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode("notificacoes")}
                  title="Central de notificações (mantém menu e filtros)"
                >
                  Alertas{totalNaoLidas > 0 ? ` (${totalNaoLidas})` : ""}
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
                  // Coletar IDs por origem para buscar responsáveis/envolvidos (N:N)
                  const tarefaIds: string[] = [];
                  const eventoIds: string[] = [];
                  const audienciaIds: string[] = [];
                  for (const it of itensPainelFiltrados) {
                    const rawId = String(it.id);
                    if (rawId.startsWith("audiencia-det-")) {
                      audienciaIds.push(rawId.replace("audiencia-det-", ""));
                    } else if (rawId.startsWith("prazo-tst-")) {
                      // sem N:N — ignorar
                    } else if (it.origem === "tarefa") {
                      tarefaIds.push(rawId);
                    } else if (it.origem === "evento") {
                      eventoIds.push(rawId.split("::")[0]);
                    }
                  }

                  const [
                    tarefaResp,
                    tarefaEnv,
                    eventoResp,
                    eventoEnv,
                    audAdv,
                    audEnv,
                  ] = await Promise.all([
                    tarefaIds.length
                      ? supabase
                          .from("tarefa_responsaveis")
                          .select("tarefa_id, usuario_id")
                          .in("tarefa_id", tarefaIds)
                      : Promise.resolve({ data: [] as any[] }),
                    tarefaIds.length
                      ? supabase
                          .from("tarefa_envolvidos")
                          .select("tarefa_id, usuario_id")
                          .in("tarefa_id", tarefaIds)
                      : Promise.resolve({ data: [] as any[] }),
                    eventoIds.length
                      ? supabase
                          .from("evento_responsaveis")
                          .select("evento_id, usuario_id")
                          .in("evento_id", eventoIds)
                      : Promise.resolve({ data: [] as any[] }),
                    eventoIds.length
                      ? supabase
                          .from("evento_envolvidos")
                          .select("evento_id, usuario_id")
                          .in("evento_id", eventoIds)
                      : Promise.resolve({ data: [] as any[] }),
                    audienciaIds.length
                      ? supabase
                          .from("audiencias_advogados")
                          .select("audiencia_id, advogado_id")
                          .in("audiencia_id", audienciaIds)
                      : Promise.resolve({ data: [] as any[] }),
                    audienciaIds.length
                      ? supabase
                          .from("audiencia_envolvidos")
                          .select("audiencia_id, usuario_id")
                          .in("audiencia_id", audienciaIds)
                      : Promise.resolve({ data: [] as any[] }),
                  ]);

                  // Carregar nomes dos profiles envolvidos em uma única query
                  const allProfileIds = new Set<string>();
                  ((tarefaResp.data as any[]) || []).forEach((r) => r.usuario_id && allProfileIds.add(r.usuario_id));
                  ((tarefaEnv.data as any[]) || []).forEach((r) => r.usuario_id && allProfileIds.add(r.usuario_id));
                  ((eventoResp.data as any[]) || []).forEach((r) => r.usuario_id && allProfileIds.add(r.usuario_id));
                  ((eventoEnv.data as any[]) || []).forEach((r) => r.usuario_id && allProfileIds.add(r.usuario_id));
                  ((audAdv.data as any[]) || []).forEach((r) => r.advogado_id && allProfileIds.add(r.advogado_id));
                  ((audEnv.data as any[]) || []).forEach((r) => r.usuario_id && allProfileIds.add(r.usuario_id));
                  const nomeById = new Map<string, string>();
                  if (allProfileIds.size > 0) {
                    const { data: profs } = await supabase
                      .from("profiles")
                      .select("id, nome")
                      .in("id", Array.from(allProfileIds));
                    (profs || []).forEach((p: any) => p?.id && nomeById.set(p.id, p.nome));
                  }

                  const pushNome = (map: Map<string, string[]>, key: string, nome?: string | null) => {
                    if (!nome) return;
                    const arr = map.get(key) ?? [];
                    if (!arr.includes(nome)) arr.push(nome);
                    map.set(key, arr);
                  };
                  const respMap = new Map<string, string[]>();
                  const envMap = new Map<string, string[]>();
                  ((tarefaResp.data as any[]) || []).forEach((r) =>
                    pushNome(respMap, `t:${r.tarefa_id}`, nomeById.get(r.usuario_id))
                  );
                  ((tarefaEnv.data as any[]) || []).forEach((r) =>
                    pushNome(envMap, `t:${r.tarefa_id}`, nomeById.get(r.usuario_id))
                  );
                  ((eventoResp.data as any[]) || []).forEach((r) =>
                    pushNome(respMap, `e:${r.evento_id}`, nomeById.get(r.usuario_id))
                  );
                  ((eventoEnv.data as any[]) || []).forEach((r) =>
                    pushNome(envMap, `e:${r.evento_id}`, nomeById.get(r.usuario_id))
                  );
                  ((audAdv.data as any[]) || []).forEach((r) =>
                    pushNome(respMap, `a:${r.audiencia_id}`, nomeById.get(r.advogado_id))
                  );
                  ((audEnv.data as any[]) || []).forEach((r) =>
                    pushNome(envMap, `a:${r.audiencia_id}`, nomeById.get(r.usuario_id))
                  );

                  const extractHora = (iso?: string | null) => {
                    if (!iso) return "";
                    const m = String(iso).match(/T(\d{2}:\d{2})/);
                    return m ? m[1] : "";
                  };

                  // Carrega nomes das coordenações usadas nos itens
                  const coordIdsSet = new Set<string>();
                  for (const it of itensPainelFiltrados) {
                    const cid = (it as any).coordenacao_id ?? it.processo?.coordenacao_id;
                    if (cid) coordIdsSet.add(cid);
                  }
                  const coordNomeById = new Map<string, string>();
                  if (coordIdsSet.size > 0) {
                    const { data: coords } = await supabase
                      .from("coordenacoes")
                      .select("id, nome")
                      .in("id", Array.from(coordIdsSet));
                    (coords || []).forEach((c: any) => c?.id && coordNomeById.set(c.id, c.nome));
                  }

                  const itensOrdenados = [...itensPainelFiltrados].sort((a, b) => {
                    const da = String(a.data_vencimento ?? a.data_inicio ?? "").slice(0, 10);
                    const db = String(b.data_vencimento ?? b.data_inicio ?? "").slice(0, 10);
                    if (!da && !db) return 0;
                    if (!da) return 1;
                    if (!db) return -1;
                    return da.localeCompare(db);
                  });
                  const rows = itensOrdenados.map((it) => {
                    const rawId = String(it.id);
                    let key = "";
                    let horario = "";
                    if (rawId.startsWith("audiencia-det-")) {
                      key = `a:${rawId.replace("audiencia-det-", "")}`;
                      horario = it.dia_inteiro ? "" : extractHora(it.data_inicio);
                    } else if (it.origem === "tarefa") {
                      key = `t:${rawId}`;
                      horario = (it.hora_fatal ?? "").slice(0, 5);
                    } else if (it.origem === "evento") {
                      key = `e:${rawId.split("::")[0]}`;
                      horario = it.dia_inteiro ? "" : extractHora(it.data_inicio);
                    }
                    const responsaveisArr = respMap.get(key) ?? [];
                    // fallback para o responsável 1:1 quando não há N:N cadastrado
                    if (responsaveisArr.length === 0 && it.responsavel?.nome) {
                      responsaveisArr.push(it.responsavel.nome);
                    }
                    const envolvidosArr = envMap.get(key) ?? [];
                    const fmtDate = (v?: string | null) => {
                      const s = (v ?? "").slice(0, 10);
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
                      const [y, m, d] = s.split("-");
                      return `${d}/${m}/${y}`;
                    };
                    return {
                      Classificação: TIPO_LABELS[it.tipo as string] ?? it.tipo_tarefa ?? it.tipo,
                      Título: it.titulo,
                      Status: it.status,
                      "Data prevista": fmtDate(it.data_vencimento ?? it.data_inicio),
                      Horário: horario,
                      "Data fatal": fmtDate(it.data_fatal),
                      Responsáveis: responsaveisArr.join(", "),
                      Envolvidos: envolvidosArr.join(", "),
                      Processo: it.processo?.numero ?? "",
                      Coordenação:
                        coordNomeById.get(
                          (it as any).coordenacao_id ?? it.processo?.coordenacao_id ?? ""
                        ) ?? "",
                    };
                  });
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
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("tarefa"); }}>
                    <ClipboardList className="w-4 h-4 mr-2" /> Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("evento"); }}>
                    <CalendarPlus className="w-4 h-4 mr-2" /> Evento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("prazo"); }}>
                    <Clock className="w-4 h-4 mr-2" /> Prazo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("audiencia"); }}>
                    <Gavel className="w-4 h-4 mr-2" /> Audiência
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("parcelamento"); }}>
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
          </>)}
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
          {!mostrarTotalizadores ? null : isLoading ? (
            <div className="flex gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-9 md:h-10 flex-1 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-2">
              {/* Data Atual */}
              <button
                type="button"
                title="Ver todas as atividades de hoje"
                onClick={() => {
                  setSelectedItem(null);
                  setNovoItemTipo(null);
                  setViewMode("agenda");
                  setDiaLateralKey(format(nowBrt, "yyyy-MM-dd"));
                }}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-2 py-1 transition-opacity hover:opacity-90 cursor-pointer"
              >
                <p className="text-lg md:text-xl font-bold leading-none">
                  {format(nowBrt, "dd")}
                </p>
                <p className="text-[10px] md:text-xs font-semibold opacity-80 truncate">
                  <span className="uppercase tracking-wider">{format(nowBrt, "MMM", { locale: ptBR })}</span>
                  <span className="mx-1 opacity-60">·</span>
                  <span className="capitalize font-normal">{format(nowBrt, "EEEE", { locale: ptBR })}</span>
                </p>
              </button>

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
                <CardContent className="px-2 py-1 md:px-3 md:py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="text-lg md:text-xl font-bold leading-none text-blue-700 dark:text-blue-300">{contagensPorClassificacao.tarefa}</p>
                      <p className="text-[11px] md:text-xs font-medium leading-none text-blue-600 dark:text-blue-400 truncate">Tarefas</p>
                    </div>
                    <ClipboardList className="w-4 h-4 md:w-5 md:h-5 text-blue-500/50 flex-shrink-0" />
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
                <CardContent className="px-2 py-1 md:px-3 md:py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="text-lg md:text-xl font-bold leading-none text-green-700 dark:text-green-300">{contagensPorClassificacao.evento}</p>
                      <p className="text-[11px] md:text-xs font-medium leading-none text-green-700 dark:text-green-400 truncate">Eventos</p>
                    </div>
                    <CalendarPlus className="w-4 h-4 md:w-5 md:h-5 text-green-500/50 flex-shrink-0" />
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
                <CardContent className="px-2 py-1 md:px-3 md:py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="text-lg md:text-xl font-bold leading-none text-red-700 dark:text-red-300">{contagensPorClassificacao.prazo}</p>
                      <p className="text-[11px] md:text-xs font-medium leading-none text-red-600 dark:text-red-400 truncate">Prazos</p>
                    </div>
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-red-500/50 flex-shrink-0" />
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
                <CardContent className="px-2 py-1 md:px-3 md:py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="text-lg md:text-xl font-bold leading-none text-yellow-700 dark:text-yellow-300">{contagensPorClassificacao.audiencia}</p>
                      <p className="text-[11px] md:text-xs font-medium leading-none text-yellow-700 dark:text-yellow-400 truncate">Audiências</p>
                    </div>
                    <Gavel className="w-4 h-4 md:w-5 md:h-5 text-yellow-500/50 flex-shrink-0" />
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
                <CardContent className="px-2 py-1 md:px-3 md:py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <p className="text-lg md:text-xl font-bold leading-none text-emerald-700 dark:text-emerald-300">{contagensPorClassificacao.parcelamento}</p>
                      <p className="text-[11px] md:text-xs font-medium leading-none text-emerald-600 dark:text-emerald-400 truncate">Parcelamentos</p>
                    </div>
                    <Coins className="w-4 h-4 md:w-5 md:h-5 text-emerald-500/50 flex-shrink-0" />
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
              onRequestNovo={() => { setSelectedItem(null); setViewMode("agenda"); setNovoItemTipo("tarefa"); }}
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
          selectedItem ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <EdicaoItemPanel
                key={selectedItem.id}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                }}
              />
            </div>
          ) : (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <KanbanItensAgenda
              itens={itensPainelFiltrados}
              onItemClick={handleItemClick}
            />
          </div>
          )
        ) : viewMode === "equipe" ? (
          selectedItem ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <EdicaoItemPanel
                key={selectedItem.id}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                }}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
              <EquipeItensAgenda
                itens={itensPainelFiltrados}
                onItemClick={handleItemClick}
              />
            </div>
          )
        ) : viewMode === "audiencias" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <PainelAudiencias embedded statusFilter={situacaoFilter} onStatusFilterChange={setSituacaoFilter} />
          </div>
        ) : viewMode === "notificacoes" ? (
          selectedItem ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <EdicaoItemPanel
                key={selectedItem.id}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
                }}
              />
            </div>
          ) : (
          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <MinhasMensagensRecebidas
              coordenacaoId={adminCoordFilter}
              todosDestinatarios={tabMode === "escritorio" && isAdminOrCoordinator}
              onAbrirItem={abrirItemPorReferencia}
              periodoInicio={
                somenteHoje
                  ? new Date(new Date().setHours(0, 0, 0, 0))
                  : painelFiltros.periodoInicio
                    ? new Date(`${painelFiltros.periodoInicio}T00:00:00`)
                    : undefined
              }
              periodoFim={
                somenteHoje
                  ? new Date(new Date().setHours(0, 0, 0, 0))
                  : painelFiltros.periodoFim
                    ? new Date(`${painelFiltros.periodoFim}T00:00:00`)
                    : undefined
              }
            />
          </div>
          )
        ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Calendário Mensal */}
          <div
            className={cn(
              "flex-col border-r border-border bg-card flex-1 lg:flex",
              (selectedItem || novoItemTipo) ? "hidden lg:flex" : "flex"
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
                        const MAX_VISIBLE = 5;
                        const visiveis = itens.slice(0, MAX_VISIBLE);
                        const extras = itens.length - MAX_VISIBLE;

                        return (
                          <div
                            key={i}
                            className={cn(
                              "border-r border-border last:border-r-0 p-0.5 md:p-1 transition-colors cursor-pointer hover:bg-muted/30",
                              !ehMesAtual && "bg-muted/10",
                              ehHoje && "bg-primary/5"
                            )}
                             onClick={() => {
                               setSelectedItem(null);
                               setNovoItemTipo(null);
                               setDiaLateralKey(key);
                             }}
                             title="Clique para ver todas as atividades do dia"
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
                                const isCancelado = isItemCancelado(item);
                                return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "text-[9px] md:text-[10px] leading-tight px-0.5 md:px-1 py-0.5 rounded truncate cursor-pointer font-medium flex items-center gap-0.5",
                                    isCancelado
                                      ? "bg-black text-white border border-black"
                                      : isConcluido
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
                                  <span className={cn("truncate", (isConcluido || isCancelado) && "line-through")}>
                                    {item.titulo || TIPO_LABELS[item.tipo]}
                                  </span>
                                </div>
                              )})}
                              {extras > 0 && (
                                <button
                                  className="text-[9px] md:text-[10px] text-primary font-semibold px-0.5 md:px-1 hover:underline cursor-pointer w-full text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(null);
                                    setNovoItemTipo(null);
                                    setDiaLateralKey(key);
                                  }}
                                >
                                  +{extras} mais
                                </button>
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

          {!selectedItem && !novoItemTipo && diaLateralKey && (
            <aside className="flex flex-1 lg:flex-none lg:w-[420px] xl:w-[460px] flex-shrink-0 border-l border-border bg-background flex-col min-h-0 overflow-hidden">
              <DiaAgendaLateral
                dia={new Date(`${diaLateralKey}T12:00:00`)}
                itens={itensPorDia.get(diaLateralKey) || []}
                userId={user?.id}
                onSelectItem={(item) => {
                  setDiaLateralKey(null);
                  handleItemClick(item);
                }}
                onClose={() => setDiaLateralKey(null)}
              />
            </aside>
          )}

          {selectedItem && (
            <aside className="flex flex-1 lg:flex-none lg:w-[640px] xl:w-[720px] flex-shrink-0 border-l border-border bg-background flex-col min-h-0 overflow-hidden">
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
            <aside className="flex flex-1 lg:flex-none lg:w-[640px] xl:w-[720px] flex-shrink-0 border-l border-border bg-background flex-col min-h-0 overflow-hidden">
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
