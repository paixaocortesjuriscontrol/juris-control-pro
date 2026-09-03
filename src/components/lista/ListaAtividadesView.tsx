import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Filter,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { TratadoCheck, isItemTratado } from "@/components/shared/TratadoCheck";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { fetchIdsPorEtiquetas, useEtiquetasDeItens } from "@/hooks/useEtiquetas";
import { EtiquetaFilter } from "@/components/etiquetas/EtiquetaFilter";
import { EtiquetaPicker } from "@/components/etiquetas/EtiquetaPicker";
import { EdicaoItemPanel } from "@/components/agenda/EdicaoItemPanel";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { AtividadeBadge } from "@/components/comum/AtividadeBadge";
import { ComentarioBadge } from "@/components/comum/ComentarioBadge";
import { useItensComComentarios, temComentarioItem } from "@/hooks/useItensComComentarios";
import { useItensComAtividades, getItemRawId } from "@/hooks/useItensComAtividades";
import { AGENDA_INFINITE_QUERY_KEY, type ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Prazo } from "@/hooks/usePrazos";

const PAGE_SIZE = 50;

type Filters = {
  search: string;
  status: string;
  prioridade: string;
  tipo: string;
  responsavelId: string;
  coordenacaoId: string;
  dataDe: string;
  dataAte: string;
};

type ListaRow = Prazo | ItemAgendaUnificado;

function isAgendaItem(row: ListaRow): row is ItemAgendaUnificado {
  return "origem" in row && "tipo" in row;
}

const STATUS_DOT: Record<string, string> = {
  pendente: "bg-amber-500",
  cumprido: "bg-emerald-500",
  concluido: "bg-emerald-500",
  tratado: "bg-emerald-500",
  atrasado: "bg-red-500",
  cancelado: "bg-slate-500",
};

const PRIO_BADGE: Record<string, string> = {
  urgente: "bg-red-100 text-red-700 border-red-200",
  alta: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-blue-100 text-blue-700 border-blue-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIO_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const TIPO_LABELS: Record<string, string> = {
  tarefa: "Tarefa",
  evento: "Evento",
  prazo: "Prazo",
  audiencia: "Audiência",
  parcelamento: "Parcelamento recorrente",
  prazo_parcela: "Parcela",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return format(parseISO(s), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function tarefaToAgendaItem(tarefa: ListaRow): ItemAgendaUnificado {
  if (isAgendaItem(tarefa)) return tarefa;
  const tipoUpper = (tarefa.tipo_tarefa ?? "").toUpperCase().trim();
  const tipo = tipoUpper === "PRAZO"
    ? "prazo"
    : tipoUpper === "AUDIÊNCIA" || tipoUpper === "AUDIENCIA"
      ? "audiencia"
      : tipoUpper === "EVENTO"
        ? "evento"
        : tipoUpper === "PARCELAMENTO" || tipoUpper === "PARCELAMENTO_RECORRENTE"
          ? "parcelamento"
          : "tarefa";
  return {
    ...tarefa,
    tipo,
    origem: "tarefa",
    data_inicio: tarefa.data_vencimento ? `${tarefa.data_vencimento}T00:00:00` : tarefa.created_at,
    data_fim: null,
    dia_inteiro: true,
    local: null,
    recorrente: false,
    recorrencia_tipo: null,
    concluido_em: tarefa.data_cumprimento,
    updated_at: tarefa.created_at,
  } as ItemAgendaUnificado;
}

const defaultFilters: Filters = {
  search: "",
  status: "all",
  prioridade: "all",
  tipo: "all",
  responsavelId: "all",
  coordenacaoId: "",
  dataDe: "",
  dataAte: "",
};

interface ListaAtividadesViewProps {
  embedded?: boolean;
  onRequestNovo?: () => void;
  /**
   * Quando informado, a lista usa exatamente os itens já carregados/filtrados pela Agenda.
   */
  externalItems?: ItemAgendaUnificado[];
  externalLoading?: boolean;
  /**
   * Quando definido, sobrescreve o filtro de coordenação interno.
   * Use "" (string vazia) ou "all" para não filtrar por coordenação (admin vendo tudo).
   */
  forcedCoordenacaoId?: string;
  /**
   * Quando definido, fixa o responsável da lista (ex.: modo Pessoal mostra apenas tarefas do usuário).
   */
  forcedResponsavelId?: string;
}

export default function ListaAtividadesView({
  embedded = false,
  onRequestNovo,
  externalItems,
  externalLoading = false,
  forcedCoordenacaoId,
  forcedResponsavelId,
}: ListaAtividadesViewProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detalhesPrazo, setDetalhesPrazo] = useState<ItemAgendaUnificado | null>(null);
  const [detalhesEditOnOpen, setDetalhesEditOnOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [etiquetasFiltro, setEtiquetasFiltro] = useState<string[]>([]);
  const { setCollapsed } = useSidebarCollapsed();

  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const usingExternalItems = externalItems !== undefined;
  const showLocalFilters = !usingExternalItems;

  // (Sem split-screen — clique abre um dialog modal)

  const { data: coordenacoes, isLoading: coordenacoesLoading } = useCoordenacoesFull();

  // Responsáveis para filtro
  const { data: responsaveis } = useQuery({
    queryKey: ["lista-atividades-responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });


  // Sincroniza com o escopo forçado (vindo do Painel de Controle, por ex.)
  useEffect(() => {
    if (forcedCoordenacaoId !== undefined) {
      const next = forcedCoordenacaoId === "all" ? "" : forcedCoordenacaoId;
      setFilters((f) => (f.coordenacaoId === next ? f : { ...f, coordenacaoId: next }));
    }
  }, [forcedCoordenacaoId]);

  useEffect(() => {
    if (forcedResponsavelId !== undefined) {
      const next = forcedResponsavelId || "all";
      setFilters((f) => (f.responsavelId === next ? f : { ...f, responsavelId: next }));
    }
  }, [forcedResponsavelId]);

  // Auto-selecionar coordenação do usuário (somente quando não há escopo forçado)
  useEffect(() => {
    if (forcedCoordenacaoId !== undefined) return;
    if (filters.coordenacaoId === "" && coordenacoes && coordenacoes.length > 0) {
      setFilters((f) => ({ ...f, coordenacaoId: coordenacoes[0].id }));
    }
  }, [coordenacoes, filters.coordenacaoId, forcedCoordenacaoId]);

  // Reset página quando filtros mudam
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [
    debouncedSearch,
    filters.status,
    filters.prioridade,
    filters.tipo,
    filters.responsavelId,
    filters.coordenacaoId,
    filters.dataDe,
    filters.dataAte,
  ]);

  const queryKey = useMemo(
    () => [
      "lista-atividades",
      {
        ...filters,
        search: debouncedSearch,
        page,
        etiquetas: [...etiquetasFiltro].sort(),
      },
    ],
    [filters, debouncedSearch, page, etiquetasFiltro],
  );

  const { data: result, isLoading: queryLoading } = useQuery({
    queryKey,
    enabled: !usingExternalItems && !coordenacoesLoading && (
      forcedCoordenacaoId !== undefined ||
      filters.coordenacaoId !== "" ||
      (coordenacoes?.length ?? 0) === 0
    ),
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const today = new Date().toISOString().split("T")[0];

      if (["evento", "parcelamento"].includes(filters.tipo)) {
        let q = supabase
          .from("eventos_agenda")
          .select("*, processo:processos!eventos_agenda_processo_id_fkey(id, numero, assunto, coordenacao_id)", { count: "estimated" })
          .eq("tipo", filters.tipo)
          .order("data_inicio", { ascending: false })
          .range(from, to);

        if (filters.status !== "all") {
          q = q.eq("status", filters.status === "cumprido" ? "concluido" : filters.status);
        }
        if (filters.coordenacaoId) q = q.eq("processo.coordenacao_id", filters.coordenacaoId);
        if (filters.dataDe) q = q.gte("data_inicio", `${filters.dataDe}T00:00:00`);
        if (filters.dataAte) q = q.lte("data_inicio", `${filters.dataAte}T23:59:59`);
        if (debouncedSearch) q = q.ilike("titulo", `%${debouncedSearch.trim()}%`);

        const { data, error, count } = await q;
        if (error) throw error;
        return {
          rows: (data || []).map((e: any) => ({
            ...e,
            origem: "evento",
            data_vencimento: e.data_inicio?.slice(0, 10) || null,
            data_cumprimento: e.concluido_em,
            prioridade: "media",
            responsavel: null,
          })) as any[],
          count: count || 0,
        };
      }

      const selectFields = filters.coordenacaoId
        ? `
          id, titulo, descricao, data_vencimento, status, prioridade,
          processo_id, responsavel_id, observacoes, data_cumprimento,
          created_at, criado_por, identificador_projuris, tipo_tarefa,
          data_base, data_fatal, criado_por_nome, concluido_por_nome,
          grupos_trabalho, marcadores, quadro_kanban,
          processo:processos!inner(id, numero, assunto, coordenacao_id),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `
        : `
          id, titulo, descricao, data_vencimento, status, prioridade,
          processo_id, responsavel_id, observacoes, data_cumprimento,
          created_at, criado_por, identificador_projuris, tipo_tarefa,
          data_base, data_fatal, criado_por_nome, concluido_por_nome,
          grupos_trabalho, marcadores, quadro_kanban,
          processo:processos!tarefas_processo_id_fkey(id, numero, assunto),
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)
        `;

      let q = supabase
        .from("tarefas")
        .select(selectFields, { count: "estimated" })
        .order("created_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (filters.coordenacaoId) {
        q = q.eq("processo.coordenacao_id", filters.coordenacaoId);
      }
      if (filters.status !== "all") {
        if (filters.status === "atrasado") {
          q = q.neq("status", "cumprido").lt("data_vencimento", today);
        } else {
          q = q.eq("status", filters.status as "pendente" | "cumprido" | "atrasado");
        }
      }
      if (filters.prioridade !== "all") {
        q = q.eq(
          "prioridade",
          filters.prioridade as "baixa" | "media" | "alta" | "urgente",
        );
      }
      if (filters.tipo !== "all") {
        if (filters.tipo === "evento") q = q.eq("tipo_tarefa", "EVENTO");
        else if (filters.tipo === "prazo") q = q.eq("tipo_tarefa", "PRAZO");
        else if (filters.tipo === "audiencia")
          q = q.in("tipo_tarefa", ["AUDIÊNCIA", "AUDIENCIA"]);
        else if (filters.tipo === "parcelamento")
          q = q.in("tipo_tarefa", ["PARCELAMENTO", "PARCELAMENTO_RECORRENTE"]);
        else if (filters.tipo === "tarefa")
          q = q.not(
            "tipo_tarefa",
            "in",
            "(EVENTO,PRAZO,AUDIÊNCIA,AUDIENCIA,PARCELAMENTO,PARCELAMENTO_RECORRENTE)"
          );
      }
      if (filters.responsavelId !== "all") {
        q = q.eq("responsavel_id", filters.responsavelId);
      }
      if (etiquetasFiltro.length > 0) {
        const ids = await fetchIdsPorEtiquetas("tarefa", etiquetasFiltro);
        if (ids.length === 0) return { rows: [] as Prazo[], count: 0 };
        q = q.in("id", ids);
      }
      if (filters.dataDe) {
        q = q.gte("data_vencimento", filters.dataDe);
      }
      if (filters.dataAte) {
        q = q.lte("data_vencimento", filters.dataAte);
      }
      if (debouncedSearch) {
        const searchTrim = debouncedSearch.trim();
        const digits = searchTrim.replace(/\D/g, "");
        // Se parece um número de processo (6+ dígitos), busca por processo.numero
        if (digits.length >= 6) {
          // O campo "numero" no banco contém pontuação (ex: 0058600-96.2024.8.04.1000),
          // então um ilike com apenas dígitos nunca casa. Intercalamos % entre os
          // dígitos para permitir os separadores (-, ., /) entre eles.
          const pattern = `%${digits.split("").join("%")}%`;
          let pq = supabase
            .from("processos")
            .select("id")
            .ilike("numero", pattern)
            .limit(500);
          if (filters.coordenacaoId) {
            pq = pq.eq("coordenacao_id", filters.coordenacaoId);
          }
          const { data: procs, error: procErr } = await pq;
          if (procErr) throw procErr;
          const procIds = (procs || []).map((p: any) => p.id);
          if (procIds.length === 0) {
            return { rows: [] as Prazo[], count: 0 };
          }
          q = q.in("processo_id", procIds);
        } else {
          q = q.or(
            `titulo.ilike.%${searchTrim}%,identificador_projuris.ilike.%${searchTrim}%`,
          );
        }
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data || []) as unknown as Prazo[],
        count: count || 0,
      };
    },
  });

  /** Ids dos itens marcados com alguma das etiquetas filtradas. */
  const { data: idsPorEtiqueta } = useQuery({
    queryKey: ["lista-atividades-etiqueta-ids", [...etiquetasFiltro].sort()],
    enabled: etiquetasFiltro.length > 0,
    queryFn: () => fetchIdsPorEtiquetas("tarefa", etiquetasFiltro),
  });

  const etiquetaIdsSet = useMemo(
    () => (etiquetasFiltro.length > 0 ? new Set(idsPorEtiqueta || []) : null),
    [etiquetasFiltro, idsPorEtiqueta],
  );

  const externalRows = useMemo(() => {
    if (!usingExternalItems) return [];
    const base = etiquetaIdsSet
      ? (externalItems || []).filter((i: any) => etiquetaIdsSet.has(i.id))
      : externalItems || [];
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return base.slice(from, to) as ListaRow[];
  }, [externalItems, page, usingExternalItems, etiquetaIdsSet]);

  const rows: ListaRow[] = usingExternalItems ? externalRows : (result?.rows || []);
  const { data: itensComAtividades = new Set<string>() } = useItensComAtividades(rows.map(tarefaToAgendaItem));
  const { data: itensComComentarios = new Set<string>() } = useItensComComentarios(rows.map(tarefaToAgendaItem));
  const total = usingExternalItems
    ? (etiquetaIdsSet
        ? (externalItems || []).filter((i: any) => etiquetaIdsSet.has(i.id)).length
        : externalItems?.length || 0)
    : (result?.count || 0);
  const isLoading = usingExternalItems ? externalLoading : queryLoading;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: etiquetasPorItem } = useEtiquetasDeItens(
    "tarefa",
    useMemo(
      () =>
        rows
          .map((r: any) => String(r.id))
          .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
      [rows],
    ),
  );

  // Lookup de criadores para eventos que não têm responsável nem participante
  const criadorIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r: any) => {
      if (!r.responsavel?.nome && !r.participantes?.length && r.criado_por) {
        ids.add(r.criado_por);
      }
    });
    return [...ids];
  }, [rows]);

  const { data: criadoresLookup } = useQuery({
    queryKey: ["lista-criadores-lookup", criadorIds],
    queryFn: async () => {
      if (criadorIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id,nome").in("id", criadorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.nome; });
      return map;
    },
    enabled: criadorIds.length > 0,
  });

  // Lookup dos advogados vinculados às audiências visíveis (audiencias_advogados)
  const audienciaIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r: any) => {
      const rid = String(r.id ?? "");
      if (rid.startsWith("audiencia-det-")) {
        ids.add(rid.replace("audiencia-det-", ""));
      }
    });
    return [...ids];
  }, [rows]);

  const { data: audienciaAdvogadosLookup } = useQuery({
    queryKey: ["lista-audiencia-advogados", audienciaIds],
    queryFn: async () => {
      const map: Record<string, string[]> = {};
      if (audienciaIds.length === 0) return map;
      const { data: rels } = await supabase
        .from("audiencias_advogados")
        .select("audiencia_id, advogado_id")
        .in("audiencia_id", audienciaIds);
      const advIds = [...new Set((rels || []).map((r: any) => r.advogado_id))];
      if (advIds.length === 0) return map;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,nome")
        .in("id", advIds);
      const nameById: Record<string, string> = {};
      (profs || []).forEach((p: any) => { nameById[p.id] = p.nome; });
      (rels || []).forEach((r: any) => {
        const nome = nameById[r.advogado_id];
        if (!nome) return;
        if (!map[r.audiencia_id]) map[r.audiencia_id] = [];
        if (!map[r.audiencia_id].includes(nome)) map[r.audiencia_id].push(nome);
      });
      return map;
    },
    enabled: audienciaIds.length > 0,
  });

  function fmtDateTime(dateStr?: string | null, horaStr?: string | null) {
    if (!dateStr) return "—";
    try {
      const d = parseISO(dateStr);
      const dataFmt = format(d, "dd/MM/yyyy", { locale: ptBR });
      if (horaStr) return `${dataFmt} ${horaStr}`;
      const timePart = dateStr.includes("T") ? dateStr.split("T")[1] : "";
      if (timePart && timePart !== "00:00:00" && timePart !== "00:00") {
        const t = timePart.slice(0, 5);
        return `${dataFmt} ${t}`;
      }
      return dataFmt;
    } catch {
      return "—";
    }
  }

  function renderResponsavel(row: any) {
    // Audiências: sempre priorizar os advogados vinculados (não o criador)
    const rid = String(row.id ?? "");
    if (rid.startsWith("audiencia-det-")) {
      const audId = rid.replace("audiencia-det-", "");
      const nomes = audienciaAdvogadosLookup?.[audId] || [];
      if (nomes.length > 0) {
        const nome = nomes[0];
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
              {initials(nome)}
            </div>
            <span className="text-[11px] text-foreground truncate">
              {nome}{nomes.length > 1 ? ` +${nomes.length - 1}` : ""}
            </span>
          </div>
        );
      }
      return <span className="text-muted-foreground text-[11px]">—</span>;
    }
    if (row.responsavel?.nome) {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
            {initials(row.responsavel.nome)}
          </div>
          <span className="text-[11px] text-foreground truncate">{row.responsavel.nome}</span>
        </div>
      );
    }
    const parts = row.participantes as { usuario?: { nome: string } }[] | undefined;
    if (parts && parts.length > 0) {
      const nomes = parts.filter((p: any) => p.usuario?.nome).map((p: any) => p.usuario.nome);
      const nome = nomes[0];
      if (nome) {
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
              {initials(nome)}
            </div>
            <span className="text-[11px] text-foreground truncate">
              {nome}{nomes.length > 1 ? ` +${nomes.length - 1}` : ""}
            </span>
          </div>
        );
      }
    }
    return <span className="text-muted-foreground text-[11px]">—</span>;
  }

  const selectableRows = rows.filter((r) => tarefaToAgendaItem(r).origem === "tarefa" && !String(r.id).startsWith("prazo-tst-"));
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      selectableRows.forEach((r) => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      selectableRows.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function concluirEmLote() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("tarefas")
        .update({
          status: "cumprido",
          data_cumprimento: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas-paginated"] });
      await queryClient.invalidateQueries({ queryKey: ["tarefas-stats"] });
      setSelected(new Set());
      toast.success(`${ids.length} tarefa(s) concluída(s)`);
    } catch (e: any) {
      toast.error("Erro ao concluir em lote: " + (e?.message || ""));
    } finally {
      setBulkLoading(false);
    }
  }

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.prioridade !== "all" ||
    filters.tipo !== "all" ||
    filters.responsavelId !== "all" ||
    !!filters.dataDe ||
    !!filters.dataAte ||
    !!filters.search;

  return (
    <>
      {!embedded && (
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b bg-card">
          <div>
            <h2 className="text-base font-bold">Lista de atividades</h2>
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString("pt-BR")} atividade(s) encontrada(s)
            </p>
          </div>
          <Button onClick={() => onRequestNovo?.()} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      )}
      <div className={cn(
        "flex flex-col gap-4 bg-muted/30",
        embedded ? "p-3 md:p-4 h-full min-h-0 overflow-hidden" : "p-4 lg:p-6 min-h-[calc(100vh-4rem)]"
      )}>

        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            showLocalFilters ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-1",

            embedded && "flex-1 min-h-0 lg:overflow-hidden"
          )}
        >
          {!showLocalFilters && (
            <div className="col-span-full">
              <EtiquetaFilter
                modulo="itens"
                coordenacaoId={forcedCoordenacaoId && forcedCoordenacaoId !== "all" ? forcedCoordenacaoId : undefined}
                value={etiquetasFiltro}
                onChange={(ids) => { setEtiquetasFiltro(ids); setPage(1); }}
              />
            </div>
          )}
          {/* Filtros laterais */}
          {showLocalFilters && <Card className="p-4 h-fit lg:sticky lg:top-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4" /> Filtros
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setFilters({ ...defaultFilters, coordenacaoId: filters.coordenacaoId })}
                >
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
            <Separator />

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Título, identificador ou nº processo"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Etiquetas
              </label>
              <EtiquetaFilter
                modulo="itens"
                coordenacaoId={filters.coordenacaoId || undefined}
                value={etiquetasFiltro}
                onChange={(ids) => { setEtiquetasFiltro(ids); setPage(1); }}
              />
            </div>

            <div className="space-y-2">
              {!embedded && <>
              <label className="text-xs font-medium text-muted-foreground">
                Coordenação
              </label>
              <Select
                value={filters.coordenacaoId || "_none"}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, coordenacaoId: v === "_none" ? "" : v }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Todas</SelectItem>
                  {coordenacoes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cumprido">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Prioridade
              </label>
              <Select
                value={filters.prioridade}
                onValueChange={(v) => setFilters((f) => ({ ...f, prioridade: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <Select
                value={filters.tipo}
                onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="prazo">Prazo</SelectItem>
                  <SelectItem value="audiencia">Audiência</SelectItem>
                  <SelectItem value="parcelamento">Parcelamento recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Responsável
              </label>
              <Select
                value={filters.responsavelId}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, responsavelId: v }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos</SelectItem>
                  {responsaveis?.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Vencimento de
              </label>
              <Input
                type="date"
                value={filters.dataDe}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dataDe: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Vencimento até
              </label>
              <Input
                type="date"
                value={filters.dataAte}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dataAte: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
          </Card>}

          {/* Tabela */}
          <Card className={cn(
            "overflow-hidden",
            embedded && "lg:h-full lg:min-h-0 lg:flex lg:flex-col"
          )}>
            {/* Toolbar de bulk */}
            <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/40 flex-shrink-0">
              <div className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} selecionada(s)`
                  : `Página ${page} de ${totalPages}`}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={bulkLoading}
                    onClick={concluirEmLote}
                    className="h-7 gap-1.5"
                  >
                    {bulkLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Concluir em lote
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className={cn("overflow-auto", embedded && "lg:flex-1 lg:min-h-0")}>
              <Table className="text-xs w-full table-fixed">
                <colgroup>
                  <col className="w-9" />
                  <col className="w-[280px]" />
                  <col className="w-[150px]" />
                  <col className="w-[160px]" />
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[100px]" />
                  <col className="w-[80px]" />
                </colgroup>
                <TableHeader className="bg-muted/60 sticky top-0 z-10">
                  <TableRow className="h-9">
                    <TableHead className="w-8 px-2 whitespace-nowrap">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead className="h-9 font-semibold text-left">Atividade</TableHead>
                    <TableHead className="h-9 font-semibold text-left whitespace-nowrap">Responsável</TableHead>
                    <TableHead className="h-9 font-semibold text-left whitespace-nowrap">Datas</TableHead>
                    <TableHead className="h-9 font-semibold text-left whitespace-nowrap">Local / Parte</TableHead>
                    <TableHead className="h-9 font-semibold text-left whitespace-nowrap">Prioridade</TableHead>
                    <TableHead className="h-9 font-semibold text-left whitespace-nowrap">Status</TableHead>
                    <TableHead className="h-9 font-semibold whitespace-nowrap text-right pr-3">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-32 text-center text-muted-foreground"
                      >
                        Nenhuma atividade encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const item = tarefaToAgendaItem(r);
                      const isSel = selected.has(r.id);
                      return (
                        <TableRow
                          key={r.id}
                          data-state={isSel ? "selected" : undefined}
                          className="hover:bg-muted/40 cursor-pointer align-top"
                          onClick={(e) => {
                            const tgt = e.target as HTMLElement;
                            if (tgt.closest("[data-stop]")) return;
                            setDetalhesPrazo(item);
                          }}
                        >
                          <TableCell className="px-2 py-3 align-top" data-stop>
                            <Checkbox
                              checked={isSel}
                              disabled={item.origem !== "tarefa" || String(r.id).startsWith("prazo-tst-")}
                              onCheckedChange={() => toggleOne(r.id)}
                            />
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-primary font-semibold">
                                  {r.identificador_projuris || r.processo?.numero || "—"}
                                </span>
                                <Badge variant="outline" className="font-normal text-[9px] px-1 py-0">
                                  {TIPO_LABELS[item.tipo]}
                                </Badge>
                              </div>
                              <div className="font-medium text-xs text-foreground break-words leading-snug flex items-center gap-1">
                                <TratadoCheck tratado={isItemTratado({ ...item, ...r })} />
                                <span>{r.titulo || "(sem título)"}</span>
                                {itensComAtividades.has(getItemRawId(r.id)) && <AtividadeBadge className="w-3.5 h-3.5 text-[8px]" />}
                                {temComentarioItem(itensComComentarios, r as any) && <ComentarioBadge className="w-3.5 h-3.5 text-[8px]" />}
                              </div>
                              <div data-stop>
                                <EtiquetaPicker
                                  entidade="tarefa"
                                  entidadeId={r.id}
                                  coordenacaoId={(r as any).processo?.coordenacao_id ?? undefined}
                                  etiquetaIds={etiquetasPorItem?.get(r.id) || []}
                                  compact
                                />
                              </div>
                              {r.processo?.assunto && (
                                <div className="text-[10px] text-muted-foreground break-words">
                                  {r.processo.assunto}
                                </div>
                              )}
                              {(r as any).partes_ativas && (
                                <div className="text-[10px] text-muted-foreground break-words line-clamp-1">
                                  <span className="font-medium text-foreground/70">Cliente:</span> {(r as any).partes_ativas}
                                </div>
                              )}
                              {(r as any).observacoes && (
                                <div className="text-[10px] text-muted-foreground break-words line-clamp-2">
                                  {(r as any).observacoes}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            {renderResponsavel(r)}
                          </TableCell>
                          <TableCell className="py-3 align-top text-[11px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <CalendarIcon className="h-3 w-3 text-destructive shrink-0" />
                                <span className="text-muted-foreground shrink-0">Limite:</span>
                                <span>{fmtDateTime(item.data_vencimento || item.data_inicio, (r as any).hora_fatal)}</span>
                              </div>
                              {item.data_fatal && (
                                <div className="flex items-center gap-1 text-foreground">
                                  <span className="text-muted-foreground shrink-0">Fatal:</span>
                                  <span>{fmtDateTime(item.data_fatal, (r as any).hora_fatal)}</span>
                                </div>
                              )}
                              <div className="text-muted-foreground">
                                Base: {fmtDateTime((r as Prazo).data_base)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 align-top text-[11px]">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {(r as any).local && (
                                <div className="text-foreground break-words line-clamp-1">
                                  <span className="text-muted-foreground">Local:</span> {(r as any).local}
                                </div>
                              )}
                              {(r as any).orgao && (
                                <div className="text-foreground break-words line-clamp-1">
                                  <span className="text-muted-foreground">Órgão:</span> {(r as any).orgao}
                                </div>
                              )}
                              {(r as any).orgao_julgador && (
                                <div className="text-foreground break-words line-clamp-1">
                                  <span className="text-muted-foreground">Órgão:</span> {(r as any).orgao_julgador}
                                </div>
                              )}
                              {!(r as any).local && !(r as any).orgao && !(r as any).orgao_julgador && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-normal text-[10px] px-1.5 py-0",
                                PRIO_BADGE[r.prioridade] || "",
                              )}
                            >
                              {PRIO_LABEL[r.prioridade] || r.prioridade || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  STATUS_DOT[r.status],
                                )}
                              />
                              <span className="capitalize text-[11px]">{r.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 align-top text-right pr-3" data-stop>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar"
                                onClick={() => {
                                  setDetalhesPrazo(item);
                                  setDetalhesEditOnOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação inferior */}
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground flex-shrink-0">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {total.toLocaleString("pt-BR")} resultado(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* Edição em painel sobreposto (igual ao modo Agenda) */}
      <ItemDrawer
        open={!!detalhesPrazo}
        onOpenChange={(o) => {
          if (!o) {
            setDetalhesPrazo(null);
            setDetalhesEditOnOpen(false);
          }
        }}
        titulo={detalhesPrazo?.titulo || "Detalhe do item"}
        subtitulo={detalhesPrazo?.processo?.numero ?? null}
      >
        {detalhesPrazo && (
          <EdicaoItemPanel
            key={detalhesPrazo.id}
            item={detalhesPrazo}
            hideHeader
            onClose={() => {
              setDetalhesPrazo(null);
              setDetalhesEditOnOpen(false);
            }}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
              queryClient.invalidateQueries({ queryKey: [AGENDA_INFINITE_QUERY_KEY] });
            }}
          />
        )}
      </ItemDrawer>
    </>

  );
}
