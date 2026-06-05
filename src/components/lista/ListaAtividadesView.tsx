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
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { TarefaDetalhesPanel } from "@/components/prazos/TarefaDetalhesPanel";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { TIPOS_TAREFA, TIPOS_TAREFA_LABELS } from "@/constants/tiposTarefa";
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

const STATUS_DOT: Record<string, string> = {
  pendente: "bg-amber-500",
  cumprido: "bg-emerald-500",
  atrasado: "bg-red-500",
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
}

export default function ListaAtividadesView({ embedded = false, onRequestNovo }: ListaAtividadesViewProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrazo, setEditingPrazo] = useState<Prazo | null>(null);
  const [detalhesPrazo, setDetalhesPrazo] = useState<Prazo | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { setCollapsed } = useSidebarCollapsed();

  const debouncedSearch = useDebouncedValue(filters.search, 300);

  // Collapse main app sidebar while a tarefa is selected (split-screen mode)
  useEffect(() => {
    if (detalhesPrazo) setCollapsed(true);
  }, [detalhesPrazo, setCollapsed]);

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

  // Auto-selecionar coordenação do usuário
  useEffect(() => {
    if (filters.coordenacaoId === "" && coordenacoes && coordenacoes.length > 0) {
      setFilters((f) => ({ ...f, coordenacaoId: coordenacoes[0].id }));
    }
  }, [coordenacoes, filters.coordenacaoId]);

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
      },
    ],
    [filters, debouncedSearch, page],
  );

  const { data: result, isLoading } = useQuery({
    queryKey,
    enabled: !coordenacoesLoading && (filters.coordenacaoId !== "" || (coordenacoes?.length ?? 0) === 0),
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const today = new Date().toISOString().split("T")[0];

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
        q = q.eq("tipo_tarefa", filters.tipo);
      }
      if (filters.responsavelId !== "all") {
        q = q.eq("responsavel_id", filters.responsavelId);
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

  const rows = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      rows.forEach((r) => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      rows.forEach((r) => next.add(r.id));
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
          <Button onClick={() => (onRequestNovo ? onRequestNovo() : setDialogOpen(true))} className="gap-2">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      )}
      <div className={cn("flex flex-col gap-4 bg-muted/30", embedded ? "p-3 md:p-4" : "p-4 lg:p-6 min-h-[calc(100vh-4rem)]")}>

        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            detalhesPrazo
              ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(380px,1fr)]"
              : "lg:grid-cols-[280px_1fr]",
          )}
        >
          {/* Filtros laterais — ocultos no modo dividido */}
          {!detalhesPrazo && (
          <Card className="p-4 h-fit lg:sticky lg:top-4 space-y-4">
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
                  <SelectItem value="cumprido">Cumprido</SelectItem>
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
                  {TIPOS_TAREFA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPOS_TAREFA_LABELS[t] || t}
                    </SelectItem>
                  ))}
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
          </Card>
          )}

          {/* Tabela */}
          <Card className="overflow-hidden">
            {/* Toolbar de bulk */}
            <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/40">
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

            <div className="overflow-auto">
              <Table className="text-xs w-full table-fixed">
                <colgroup>
                  <col className="w-9" />
                  <col />
                  {detalhesPrazo ? (
                    <col className="w-[72px]" />
                  ) : (
                    <>
                      <col className="w-[160px]" />
                      <col className="w-[140px]" />
                      <col className="w-[110px]" />
                      <col className="w-[72px]" />
                    </>
                  )}
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
                    <TableHead
                      colSpan={detalhesPrazo ? 1 : 3}
                      className="h-9 font-semibold w-full text-left"
                    >
                      Atividade
                    </TableHead>
                    {!detalhesPrazo && (
                      <TableHead className="h-9 font-semibold whitespace-nowrap w-px text-left">
                        Status
                      </TableHead>
                    )}
                    <TableHead className="h-9 font-semibold w-px whitespace-nowrap text-right pr-3">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={detalhesPrazo ? 3 : 6}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={detalhesPrazo ? 3 : 6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        Nenhuma atividade encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const isSel = selected.has(r.id);
                      return (
                        <TableRow
                          key={r.id}
                          data-state={isSel ? "selected" : undefined}
                          className="hover:bg-muted/40 cursor-pointer align-top"
                          onClick={(e) => {
                            const tgt = e.target as HTMLElement;
                            if (tgt.closest("[data-stop]")) return;
                            setDetalhesPrazo(r);
                          }}
                        >
                          <TableCell className="px-2 py-3 align-top" data-stop>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleOne(r.id)}
                            />
                          </TableCell>
                          <TableCell colSpan={detalhesPrazo ? 1 : 3} className="py-3 align-top">
                            <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] text-primary font-semibold">
                                  {r.identificador_projuris || "—"}
                                </span>
                                {r.tipo_tarefa && (
                                  <Badge
                                    variant="outline"
                                    className="font-normal text-[10px] px-1.5 py-0"
                                  >
                                    {TIPOS_TAREFA_LABELS[r.tipo_tarefa] || r.tipo_tarefa}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-normal text-[10px] px-1.5 py-0",
                                    PRIO_BADGE[r.prioridade] || "",
                                  )}
                                >
                                  {PRIO_LABEL[r.prioridade] || r.prioridade}
                                </Badge>
                              </div>
                              <div className="font-medium text-sm text-foreground break-words leading-snug">
                                {r.titulo}
                              </div>
                              {r.processo?.numero && (
                                <div className="text-[11px] text-muted-foreground font-mono break-words">
                                  Processo: {r.processo.numero}
                                  {r.processo.assunto ? ` — ${r.processo.assunto}` : ""}
                                </div>
                              )}
                            </div>
                            {!detalhesPrazo && (
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  {r.responsavel?.nome ? (
                                    <>
                                      <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                                        {initials(r.responsavel.nome)}
                                      </div>
                                      <span className="max-w-[180px] truncate text-foreground">
                                        {r.responsavel.nome}
                                      </span>
                                    </>
                                  ) : (
                                    <span>Responsável: —</span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 font-medium text-foreground">
                                    <CalendarIcon className="h-3 w-3 text-destructive" />
                                    <span className="text-muted-foreground">Fatal:</span>
                                    <span>{fmtDate(r.data_fatal || r.data_vencimento)}</span>
                                  </div>
                                  <div className="pl-4">Base: {fmtDate(r.data_base)}</div>
                                </div>
                              </div>
                            )}
                            </div>
                          </TableCell>
                          {!detalhesPrazo && (
                          <TableCell className="py-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  STATUS_DOT[r.status],
                                )}
                              />
                              <span className="capitalize">{r.status}</span>
                            </div>
                          </TableCell>
                          )}
                          <TableCell className="py-3 align-top text-right pr-3" data-stop>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar"
                                onClick={() => {
                                  setEditingPrazo(r);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Concluir"
                              disabled={r.status === "cumprido"}
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("tarefas")
                                  .update({
                                    status: "cumprido",
                                    data_cumprimento: new Date().toISOString(),
                                  })
                                  .eq("id", r.id);
                                if (error) {
                                  toast.error(error.message);
                                  return;
                                }
                                await queryClient.invalidateQueries({
                                  queryKey: ["lista-atividades"],
                                });
                                toast.success("Tarefa concluída");
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
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

          {/* Painel de detalhes (split-screen) */}
          {detalhesPrazo && (
            <div className="lg:sticky lg:top-4 h-[calc(100vh-6rem)]">
              <TarefaDetalhesPanel
                prazo={detalhesPrazo}
                onClose={() => setDetalhesPrazo(null)}
                onEdit={(p) => {
                  setEditingPrazo(p);
                  setDialogOpen(true);
                }}
                onMarkAsCumprido={async (p) => {
                  const { error } = await supabase
                    .from("tarefas")
                    .update({
                      status: "cumprido",
                      data_cumprimento: new Date().toISOString(),
                    })
                    .eq("id", p.id);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  await queryClient.invalidateQueries({ queryKey: ["lista-atividades"] });
                  toast.success("Tarefa concluída");
                  setDetalhesPrazo({ ...p, status: "cumprido" });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <PrazoDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingPrazo(null);
        }}
        prazo={editingPrazo}
      />
    </MainLayout>
  );
}
