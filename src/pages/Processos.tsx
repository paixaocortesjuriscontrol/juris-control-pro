import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Download, Scale, FolderOpen, X, CheckSquare, FileText, Pencil, RefreshCw, ArrowRightLeft, ChevronLeft, ChevronRight, ChevronDown, Filter, Activity, Users, Gavel, AlertCircle, Building2, Repeat, ClipboardList, Star, Lock, Briefcase, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useProcessosPaginados, fetchTodosProcessosFiltrados } from "@/hooks/useProcessosPaginados";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AtribuirCoordenacaoLoteDialog } from "@/components/processos/AtribuirCoordenacaoLoteDialog";
import { TransferirProcessosDialog } from "@/components/processos/TransferirProcessosDialog";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";
import { FiltrosAvancadosProcessos, FiltrosAvancados, defaultFiltrosAvancados } from "@/components/processos/FiltrosAvancadosProcessos";
import { ProcessoExpandableRow } from "@/components/processos/ProcessoExpandableRow";
import { ProcessoItensLateral } from "@/components/processos/ProcessoItensLateral";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { EtiquetaFilter } from "@/components/etiquetas/EtiquetaFilter";
import { useEtiquetasDeItens } from "@/hooks/useEtiquetas";
import { cn } from "@/lib/utils";
import { Calendar, User } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useProcessosComRedistribuicaoRecente } from "@/hooks/useRedistribuicoes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { CacheIndicator } from "@/components/ui/cache-indicator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { gerarManualProcessosPdf } from "@/lib/manualProcessosPdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportarModeloDialog, type ModeloExportacao } from "@/components/processos/ExportarModeloDialog";
import { toast } from "sonner";

type AreaType = "civil" | "trabalhista" | "empresarial" | "caso";
type StatusType = "pending" | "active" | "closed" | "urgent";

const areaLabels: Record<AreaType, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
  caso: "Caso",
};

const statusLabels: Record<StatusType, string> = {
  pending: "Pendente",
  active: "Ativo",
  closed: "Encerrado",
  urgent: "Urgente",
};

// Mapeamento para novas situações do processo
const situacaoLabels: Record<string, string> = {
  ativo: "Ativo",
  arquivado_parcialmente: "Arquivado Parcialmente",
  arquivado_definitivamente: "Arquivado Definitivamente",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

const Processos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Flag para controlar se já carregou a coordenação do usuário
  const [coordenacaoCarregada, setCoordenacaoCarregada] = useState(false);
  
  // Buscar coordenações do usuário logado + role
  const { data: userCoordData, isLoading: isLoadingUserCoord } = useQuery({
    queryKey: ['user-coordenacoes-processos', user?.id],
    queryFn: async () => {
      if (!user?.id) return { coordenacoesIds: [], isAdmin: false };
      
      // Verificar role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const isAdmin = roleData?.role === "admin";
      
      if (isAdmin) {
        return { coordenacoesIds: [], isAdmin: true };
      }

      // Buscar todas coordenações do usuário (como coordenador ou membro)
      const [coordenadorResult, membroResult] = await Promise.all([
        supabase.from("coordenacoes").select("id").eq("coordenador_id", user.id),
        supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", user.id),
      ]);

      const coordenadorIds = (coordenadorResult.data || []).map((c) => c.id);
      const membroIds = (membroResult.data || []).map((m) => m.coordenacao_id);
      const coordenacoesIds = [...new Set([...coordenadorIds, ...membroIds])];

      return { coordenacoesIds, isAdmin: false };
    },
    enabled: !!user?.id,
  });

  const isAdmin = userCoordData?.isAdmin ?? false;
  const userCoordsIds = userCoordData?.coordenacoesIds ?? [];
  // Processos são visíveis para todas as coordenações — "Todas" liberado a todos
  const canSelectAll = true;
  
  // Ler filtros da URL na inicialização
  const urlCoordParam = searchParams.get("coordenacao");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [areaFilter, setAreaFilter] = useState<string>(() => searchParams.get("area") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string>("all");
  const [exportando, setExportando] = useState(false);
  const [selectedProcessos, setSelectedProcessos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lateralProcessoId, setLateralProcessoId] = useState<string | null>(null);
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false);
  const [showTransferirDialog, setShowTransferirDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [processoToEdit, setProcessoToEdit] = useState<any>(null);
  const [showExportarModelo, setShowExportarModelo] = useState(false);
  const [modeloExportacao, setModeloExportacao] = useState<ModeloExportacao>("monitoramento");
  const [monitorandoRedistribuicoes, setMonitorandoRedistribuicoes] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [comPublicacaoDjen, setComPublicacaoDjen] = useState(() => searchParams.get("comDjen") === "true");
  const [comAndamentos, setComAndamentos] = useState(() => searchParams.get("comAndamentos") === "true");
  const [comAudiencias, setComAudiencias] = useState(() => searchParams.get("comAudiencias") === "true");
  const [comIntimacoes, setComIntimacoes] = useState(() => searchParams.get("comIntimacoes") === "true");
  const [comTarefas, setComTarefas] = useState(() => searchParams.get("comTarefas") === "true");
  const [acompanhamentoEspecial, setAcompanhamentoEspecial] = useState(() => searchParams.get("acompanhamentoEspecial") === "true");
  const [segredoJustica, setSegredoJustica] = useState(() => searchParams.get("segredoJustica") === "true");
  const [etiquetasFiltro, setEtiquetasFiltro] = useState<string[]>([]);
  const [tipoProcessoFilter, setTipoProcessoFilter] = useState<string>(() => searchParams.get("tipo") || "all");
  
  // Filtro de grupo de clientes (da URL ou selecionado manualmente)
  const grupoClientesParam = searchParams.get("grupo_clientes");
  const grupoNomeParam = searchParams.get("grupo_nome");
  
  // Estados para filtros de grupo e cliente (lidos da URL)
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>(() => searchParams.get("grupo_clientes") || "all");
  const [selectedClienteId, setSelectedClienteId] = useState<string>(() => searchParams.get("cliente") || "all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  
  // Buscar grupos de clientes
  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos_clientes_filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos_clientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar todos os clientes para o filtro geral
  const { data: todosClientes = [] } = useQuery({
    queryKey: ["clientes_filter_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar clientes do grupo selecionado
  const { data: clientesDoGrupo = [], isLoading: isLoadingClientesDoGrupo } = useQuery({
    queryKey: ["clientes_do_grupo", selectedGrupoId],
    enabled: selectedGrupoId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_grupos")
        .select("cliente_id, clientes(id, nome)")
        .eq("grupo_id", selectedGrupoId);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.clientes?.id,
        nome: item.clientes?.nome,
      })).filter((c: any) => c.id);
    },
  });

  // Calcular clienteIds baseado nos filtros
  const clienteIds = useMemo(() => {
    // Se veio da URL (clicou no ícone do grupo)
    if (grupoClientesParam) {
      return grupoClientesParam.split(",");
    }
    // Se selecionou um cliente específico no filtro geral (não do grupo)
    if (clienteFilter !== "all") {
      return [clienteFilter];
    }
    // Se selecionou um cliente específico do grupo
    if (selectedClienteId !== "all") {
      return [selectedClienteId];
    }
    // Se selecionou um grupo, aguarda carregar os clientes
    if (selectedGrupoId !== "all") {
      // Se ainda está carregando, retorna array vazio para evitar buscar sem filtro
      if (isLoadingClientesDoGrupo) {
        return [];
      }
      if (clientesDoGrupo.length > 0) {
        return clientesDoGrupo.map((c) => c.id);
      }
      // Grupo sem clientes - retorna ID fictício para não trazer resultados
      return ["no-clients-in-group"];
    }
    return undefined;
  }, [grupoClientesParam, selectedGrupoId, selectedClienteId, clientesDoGrupo, isLoadingClientesDoGrupo, clienteFilter]);

  // Nome do grupo para exibição
  const grupoNome = grupoNomeParam || (selectedGrupoId !== "all" ? grupos.find(g => g.id === selectedGrupoId)?.nome : undefined);
  
  const { executarMonitoramento } = useConfiguracoesMonitoramento();
  const { data: coordenacoes } = useCoordenacoes();

  // Total de processos por coordenação (exibido no seletor de coordenação)
  const { data: processosPorCoordenacao = {} } = useQuery({
    queryKey: ["processos-count-por-coordenacao", (coordenacoes || []).map((c: any) => c.id).join(",")],
    enabled: (coordenacoes?.length ?? 0) > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const results = await Promise.all(
        (coordenacoes || []).map(async (c: any) => {
          const { count } = await supabase
            .from("processos")
            .select("id", { count: "exact", head: true })
            .eq("coordenacao_id", c.id);
          return [c.id, count ?? 0] as const;
        })
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
  });

  const totalProcessosTodasCoordenacoes = useMemo(
    () => Object.values(processosPorCoordenacao).reduce((acc, n) => acc + (n || 0), 0),
    [processosPorCoordenacao]
  );
  const queryClient = useQueryClient();

  // Auto-selecionar coordenação do usuário ao carregar (se não veio da URL)
  useEffect(() => {
    // Aguarda carregar sessão e dados do usuário
    if (!user?.id || isLoadingUserCoord || userCoordData === undefined) return;

    // Se já carregou, não faz nada
    if (coordenacaoCarregada) return;

    // Se veio da URL, usa o valor da URL
    if (urlCoordParam) {
      setCoordenacaoFilter(urlCoordParam);
      setCoordenacaoCarregada(true);
      return;
    }

    // Admin: mostra todas por padrão
    if (isAdmin) {
      setCoordenacaoFilter("all");
      setCoordenacaoCarregada(true);
      return;
    }

    // Se tem exatamente uma coordenação, seleciona ela automaticamente
    if (userCoordsIds.length === 1) {
      setCoordenacaoFilter(userCoordsIds[0]);
      setCoordenacaoCarregada(true);
      return;
    }

    // Múltiplas coordenações: mostra todas (do usuário) por padrão
    setCoordenacaoFilter("all");
    setCoordenacaoCarregada(true);
  }, [user?.id, userCoordData, isLoadingUserCoord, coordenacaoCarregada, urlCoordParam, isAdmin, userCoordsIds]);

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Atualizar URL quando filtros mudam (preservando outros params, ex: grupo_clientes)
  useEffect(() => {
    // Não atualizar URL enquanto coordenação está sendo carregada
    if (!coordenacaoCarregada) return;
    
    const params = new URLSearchParams(searchParams);

    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    if (areaFilter !== "all") params.set("area", areaFilter);
    else params.delete("area");

    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");

    if (coordenacaoFilter !== "all") params.set("coordenacao", coordenacaoFilter);
    else params.delete("coordenacao");

    // Filtros adicionais
    if (comPublicacaoDjen) params.set("comDjen", "true");
    else params.delete("comDjen");

    if (comAndamentos) params.set("comAndamentos", "true");
    else params.delete("comAndamentos");

    if (comAudiencias) params.set("comAudiencias", "true");
    else params.delete("comAudiencias");

    if (comIntimacoes) params.set("comIntimacoes", "true");
    else params.delete("comIntimacoes");

    if (comTarefas) params.set("comTarefas", "true");
    else params.delete("comTarefas");

    if (acompanhamentoEspecial) params.set("acompanhamentoEspecial", "true");
    else params.delete("acompanhamentoEspecial");

    if (segredoJustica) params.set("segredoJustica", "true");
    else params.delete("segredoJustica");

    if (tipoProcessoFilter !== "all") params.set("tipo", tipoProcessoFilter);
    else params.delete("tipo");

    if (selectedGrupoId !== "all") params.set("grupo_clientes", selectedGrupoId);
    else params.delete("grupo_clientes");

    if (selectedClienteId !== "all") params.set("cliente", selectedClienteId);
    else params.delete("cliente");

    // Evita loop/replace desnecessário
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, searchQuery, areaFilter, statusFilter, coordenacaoFilter, comPublicacaoDjen, comAndamentos, comAudiencias, comIntimacoes, comTarefas, acompanhamentoEspecial, segredoJustica, tipoProcessoFilter, selectedGrupoId, selectedClienteId, setSearchParams, coordenacaoCarregada]);

  // Filtros ativos da tela — usados tanto na listagem paginada quanto na exportação
  const filtrosProcessos = useMemo(
    () => ({
      search: debouncedSearch,
      // "Caso" no filtro de tipos equivale à área "caso"
      area: tipoProcessoFilter === "caso" ? "caso" : areaFilter,
      status: statusFilter,
      coordenacao_id: coordenacaoFilter,
      responsavel_id: filtrosAplicados.responsavelId,
      instancia: filtrosAplicados.instancia,
      comMovimento: comAndamentos,
      comPublicacaoDjen: comPublicacaoDjen,
      comAudiencia: comAudiencias,
      comIntimacao: comIntimacoes,
      comTarefa: comTarefas,
      acompanhamentoEspecial: acompanhamentoEspecial,
      segredoJustica: segredoJustica,
      etiquetaIds: etiquetasFiltro,
      periodoInicio: filtrosAplicados.periodoInicio,
      periodoFim: filtrosAplicados.periodoFim,
      clienteIds: clienteIds,
      tipoProcesso: tipoProcessoFilter === "caso" ? "all" : tipoProcessoFilter,
      testemunhaNome: filtrosAplicados.testemunhaNome,
      comTestemunha: filtrosAplicados.comTestemunha,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      debouncedSearch,
      areaFilter,
      statusFilter,
      coordenacaoFilter,
      tipoProcessoFilter,
      comAndamentos,
      comPublicacaoDjen,
      comAudiencias,
      comIntimacoes,
      comTarefas,
      acompanhamentoEspecial,
      segredoJustica,
      JSON.stringify(etiquetasFiltro),
      JSON.stringify(clienteIds),
      JSON.stringify(filtrosAplicados),
    ]
  );

  const { 
    data, 
    isLoading, 
    isFetching,
    isError,
    error,
    isStale, 
    dataUpdatedAt, 
    forceRefetch,
    page,
    goToPage,
    nextPage,
    previousPage,
    resetPage
  } = useProcessosPaginados({
    ...filtrosProcessos,
    enabled: coordenacaoCarregada, // Não buscar enquanto está carregando a coordenação
  });

  const { data: processosRedistribuidos } = useProcessosComRedistribuicaoRecente();

  // Reset page when filters change — use serialized filtrosAplicados to avoid
  // spurious resets caused by object-reference changes from functional setState.
  const filtrosAplicadosKey = JSON.stringify(filtrosAplicados);
  useEffect(() => {
    resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, areaFilter, statusFilter, coordenacaoFilter, filtrosAplicadosKey, comPublicacaoDjen, comAndamentos, comAudiencias, comIntimacoes, comTarefas, acompanhamentoEspecial, segredoJustica, clienteIds, tipoProcessoFilter, JSON.stringify(etiquetasFiltro)]);

  // Auto-apply the "quick" filters (always visible on the bar)
  // so selecting a responsável / período filters immediately.
  useEffect(() => {
    setFiltrosAplicados((prev) => ({
      ...prev,
      periodoInicio: filtrosAvancados.periodoInicio,
      periodoFim: filtrosAvancados.periodoFim,
      responsavelId: filtrosAvancados.responsavelId,
      responsavelNome: filtrosAvancados.responsavelNome,
    }));
  }, [
    filtrosAvancados.periodoInicio,
    filtrosAvancados.periodoFim,
    filtrosAvancados.responsavelId,
    filtrosAvancados.responsavelNome,
  ]);

  // Clear responsible filter when coordination changes
  useEffect(() => {
    if (filtrosAvancados.responsavelId || filtrosAplicados.responsavelId) {
      setFiltrosAvancados((prev) => ({ ...prev, responsavelId: undefined, responsavelNome: undefined }));
      setFiltrosAplicados((prev) => ({ ...prev, responsavelId: undefined, responsavelNome: undefined }));
    }
  }, [coordenacaoFilter]);

  const processos = data?.processos || [];
  const totalCount = data?.totalCount || 0;
  const processoIdsPagina = useMemo(
    () => processos.map((p: any) => p.id as string),
    [processos],
  );
  const { data: etiquetasPorProcesso } = useEtiquetasDeItens("processo", processoIdsPagina);
  const totalPages = data?.totalPages || 1;

  const handleForceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["processos-paginados"] });
    forceRefetch();
  };

  const mapStatus = (status: string): StatusType => {
    const statusMap: Record<string, StatusType> = {
      ativo: "active",
      pendente: "pending",
      urgente: "urgent",
      encerrado: "closed",
      arquivado: "closed",
      arquivado_definitivamente: "closed",
      arquivado_provisoriamente: "closed",
      suspenso: "pending",
    };
    return statusMap[status] || "active";
  };

  const toggleProcessoSelection = (id: string) => {
    setSelectedProcessos(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProcessos.length === processos.length) {
      setSelectedProcessos([]);
    } else {
      setSelectedProcessos(processos.map(p => p.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedProcessos([]);
  };

  const handleAplicarFiltros = () => {
    setFiltrosAplicados(filtrosAvancados);
  };

  const handleLimparFiltros = () => {
    setFiltrosAvancados(defaultFiltrosAvancados);
    setFiltrosAplicados(defaultFiltrosAvancados);
  };

  const hasAdvancedFiltersApplied =
    filtrosAplicados.tipo !== "todos" ||
    filtrosAplicados.periodoInicio ||
    filtrosAplicados.periodoFim ||
    filtrosAplicados.responsavelId ||
    filtrosAplicados.instancia !== "todos" ||
    comPublicacaoDjen ||
    comAndamentos ||
    comAudiencias ||
    comIntimacoes ||
    comTarefas ||
    acompanhamentoEspecial ||
    segredoJustica ||
    !!grupoClientesParam ||
    selectedGrupoId !== "all" ||
    selectedClienteId !== "all";

  const clearGrupoFilter = () => {
    // Limpar params da URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("grupo_clientes");
    newParams.delete("grupo_nome");
    setSearchParams(newParams, { replace: true });
    // Limpar seleções manuais
    setSelectedGrupoId("all");
    setSelectedClienteId("all");
  };

  // Ao mudar o grupo manualmente, limpar cliente selecionado
  const handleGrupoChange = (value: string) => {
    setSelectedGrupoId(value);
    setSelectedClienteId("all");
    // Limpar params da URL se existirem
    if (grupoClientesParam) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("grupo_clientes");
      newParams.delete("grupo_nome");
      setSearchParams(newParams, { replace: true });
    }
  };

  return (
    <MainLayout 
      title="Processos" 
      subtitle={`${totalCount} processos encontrados`}
    >
      <div className="processo-chrome">
      {/* Filters Bar */}
      <div className="bg-card border border-border/50 p-4 mb-6 animate-fade-in">

        <div className="flex flex-col gap-4">
          {/* Search Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Digite algo para pesquisar" 
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <FiltrosAvancadosProcessos
              filtros={filtrosAvancados}
              onFiltrosChange={setFiltrosAvancados}
              onAplicar={handleAplicarFiltros}
              onLimpar={handleLimparFiltros}
              coordenacaoId={coordenacaoFilter}
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="arquivado_parcialmente">Arquivado Parcialmente</SelectItem>
                <SelectItem value="arquivado_definitivamente">Arquivado Definitivamente</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>

            <CacheIndicator
              isFetching={isFetching}
              isStale={isStale}
              dataUpdatedAt={dataUpdatedAt}
              onRefresh={handleForceRefresh}
            />

            {/* Results counter chip */}
            {(filtrosAplicados.responsavelId || coordenacaoFilter !== "all" || areaFilter !== "all" || statusFilter !== "all" || searchQuery) && (
              <Badge variant="outline" className="h-8 px-3 text-xs font-medium bg-primary/10 border-primary/30 text-primary">
                {isFetching ? "..." : totalCount} processo{totalCount !== 1 ? "s" : ""} encontrado{totalCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>


          {/* Additional Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-center">
            <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                {canSelectAll && (
                  <SelectItem value="all">
                    Todas as coordenações
                    {totalProcessosTodasCoordenacoes > 0 ? ` (${totalProcessosTodasCoordenacoes})` : ""}
                  </SelectItem>
                )}
                {coordenacoes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                    {processosPorCoordenacao[c.id] !== undefined ? ` (${processosPorCoordenacao[c.id]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de Tipo de Processo */}
            <Select value={tipoProcessoFilter} onValueChange={setTipoProcessoFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="judicial">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Judicial
                  </div>
                </SelectItem>
                <SelectItem value="administrativo">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Administrativo
                  </div>
                </SelectItem>
                <SelectItem value="outro">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Outro
                  </div>
                </SelectItem>
                <SelectItem value="caso">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Caso
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>




            {/* Filtro de Cliente do Grupo (quando grupo selecionado) */}
            {(selectedGrupoId !== "all" || grupoClientesParam) && clientesDoGrupo.length > 0 && !grupoClientesParam && (
              <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Cliente do grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos do grupo ({clientesDoGrupo.length})</SelectItem>
                  {clientesDoGrupo.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtro de Cliente (geral) */}
            {selectedGrupoId === "all" && !grupoClientesParam && (
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {todosClientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {c.tipo === "pessoa_fisica" ? "PF" : "PJ"}
                        </Badge>
                        {c.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Filtros combinados */}
          <div className="flex flex-wrap gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 gap-2 justify-between min-w-[220px]",
                    (comPublicacaoDjen || comAndamentos || comAudiencias || comTarefas) &&
                      "border-primary text-primary"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {(() => {
                      const sel = [
                        comPublicacaoDjen && "Com DJEN",
                        comAndamentos && "Com Andamentos",
                        comAudiencias && "Com Audiências",
                        comTarefas && "Com Tarefas",
                      ].filter(Boolean) as string[];
                      if (sel.length === 0) return "Conteúdo do processo";
                      if (sel.length === 1) return sel[0];
                      return `${sel.length} selecionados`;
                    })()}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-2">
                {[
                  { label: "Com DJEN", checked: comPublicacaoDjen, set: setComPublicacaoDjen, Icon: FileText },
                  { label: "Com Andamentos", checked: comAndamentos, set: setComAndamentos, Icon: Activity },
                  { label: "Com Audiências", checked: comAudiencias, set: setComAudiencias, Icon: Gavel },
                  { label: "Com Tarefas", checked: comTarefas, set: setComTarefas, Icon: ClipboardList },
                ].map(({ label, checked, set, Icon }) => (
                  <label
                    key={label}
                    className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent rounded-sm"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => (set as any)((prev: boolean) => !prev)} />
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {label}
                  </label>
                ))}
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                acompanhamentoEspecial && "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
              )}
              onClick={() => setAcompanhamentoEspecial(prev => !prev)}
            >
              <Star className="w-4 h-4" />
              Acompanhamento Especial
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                segredoJustica && "bg-slate-700 hover:bg-slate-800 text-primary-foreground border-slate-700"
              )}
              onClick={() => setSegredoJustica(prev => !prev)}
            >
              <Lock className="w-4 h-4" />
              Segredo de Justiça
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                statusFilter === "encerrado" && "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
              )}
              onClick={() => setStatusFilter(prev => (prev === "encerrado" ? "all" : "encerrado"))}
            >
              Encerrados
            </Button>

            <EtiquetaFilter
              modulo="processos"
              coordenacaoId={coordenacaoFilter !== "all" ? coordenacaoFilter : undefined}
              value={etiquetasFiltro}
              onChange={setEtiquetasFiltro}
              className="[&>button]:h-9"
            />
          </div>


          {/* Action Buttons Row */}
          <div className="flex flex-wrap gap-2 justify-end">
            {!isSelectionMode ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-none"
                      disabled={monitorandoRedistribuicoes}
                      onClick={async () => {
                        setMonitorandoRedistribuicoes(true);
                        try {
                          await executarMonitoramento.mutateAsync('redistribuicoes');
                        } finally {
                          setMonitorandoRedistribuicoes(false);
                        }
                      }}
                    >
                      <RefreshCw className={cn("w-4 h-4", monitorandoRedistribuicoes && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Verificar redistribuições</TooltipContent>
                </Tooltip>
                <Button 
                  variant="outline" 
                  className="flex-1 sm:flex-none"
                  onClick={() => setShowTransferirDialog(true)}
                >
                  <Repeat className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Transferir</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 sm:flex-none"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Selecionar</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 sm:flex-none" disabled={exportando}>
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">
                        {exportando ? "Exportando..." : "Exportar"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem
                      onClick={async () => {
                        setExportando(true);
                        const toastId = toast.loading("Exportando processos...");
                        try {
                          const XLSX = await import("xlsx");
                          const coordMap = new Map<string, string>(
                            (coordenacoes || []).map((c: any) => [c.id, c.nome])
                          );
                          // Busca TODAS as linhas que atendem aos filtros ativos (não só a página)
                          const todos = await fetchTodosProcessosFiltrados(
                            filtrosProcessos,
                            (carregados, total) => {
                              toast.loading(`Exportando ${carregados} de ${total} processos...`, {
                                id: toastId,
                              });
                            }
                          );
                          const rows = todos.map((p: any) => ({
                            Numero: p.numero || "",
                            Assunto: p.assunto || "",
                            Cliente: p.cliente?.nome || p.cliente_nome || "",
                            Coordenacao:
                              p.coordenacao?.nome ||
                              p.coordenacao_nome ||
                              (p.coordenacao_id ? coordMap.get(p.coordenacao_id) || "" : ""),
                            Responsavel: p.advogado_responsavel?.nome || "",
                            Situacao: p.situacao || p.status || "",
                            Area: p.area || "",
                            Tipo: p.tipo_processo || "",
                            Polo_Ativo: p.polo_ativo || "",
                            Polo_Passivo: p.polo_passivo || "",
                            Tribunal: p.tribunal || "",
                            Vara: p.vara || "",
                            Comarca: p.comarca || "",
                            Instancia: p.instancia || "",
                            Orgao_Julgador: p.orgao_julgador || "",
                            Data_Distribuicao: p.data_distribuicao || "",
                            Valor_Causa: p.valor_causa || "",
                          }));
                          const ws = XLSX.utils.json_to_sheet(rows);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Processos");
                          const stamp = new Date().toISOString().slice(0, 10);
                          XLSX.writeFile(wb, `processos_${stamp}.xlsx`);
                          toast.success(`${rows.length} processos exportados!`, { id: toastId });
                        } catch (e: any) {
                          console.error("Erro ao exportar:", e);
                          toast.error(`Erro ao exportar: ${e?.message || e}`, { id: toastId });
                        } finally {
                          setExportando(false);
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Lista de processos (padrão)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setModeloExportacao("monitoramento");
                        setShowExportarModelo(true);
                      }}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Excel Monitoramento (andamentos)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setModeloExportacao("cadastro-lote");
                        setShowExportarModelo(true);
                      }}
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Excel Cadastro em Lote
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  title="Gerar manual em PDF da tela Processos e Casos"
                  onClick={() => gerarManualProcessosPdf()}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Manual PDF</span>
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                  onClick={() => navigate("/processos/novo")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Novo Processo</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  title="Criar um caso sem número de processo (pode ser incluído depois)"
                  onClick={() => navigate("/processos/novo?caso=1")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Novo Caso</span>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={toggleSelectAll}
                  className="flex-1 sm:flex-none"
                >
                  {selectedProcessos.length === processos.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={exitSelectionMode}
                  className="flex-1 sm:flex-none"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {(areaFilter !== "all" || statusFilter !== "all" || coordenacaoFilter !== "all" || searchQuery || hasAdvancedFiltersApplied) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                Busca: {searchQuery} ×
              </Badge>
            )}
            {coordenacaoFilter !== "all" && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setCoordenacaoFilter("all")}>
                {coordenacoes?.find(c => c.id === coordenacaoFilter)?.nome || "Coordenação"} ×
              </Badge>
            )}
            {areaFilter !== "all" && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setAreaFilter("all")}>
                {areaFilter === "civil" ? "Cível" : areaFilter === "trabalhista" ? "Trabalhista" : areaFilter === "caso" ? "Caso" : "Empresarial"} ×
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} ×
              </Badge>
            )}
            {filtrosAplicados.responsavelNome && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => {
                setFiltrosAvancados(prev => ({ ...prev, responsavelId: undefined, responsavelNome: undefined }));
                setFiltrosAplicados(prev => ({ ...prev, responsavelId: undefined, responsavelNome: undefined }));
              }}>
                Responsável: {filtrosAplicados.responsavelNome} ×
              </Badge>
            )}
            {filtrosAplicados.instancia !== "todos" && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => {
                setFiltrosAvancados(prev => ({ ...prev, instancia: "todos" }));
                setFiltrosAplicados(prev => ({ ...prev, instancia: "todos" }));
              }}>
                {filtrosAplicados.instancia === "1" ? "1º Grau" : filtrosAplicados.instancia === "2" ? "2º Grau" : "Superior"} ×
              </Badge>
            )}
            {comPublicacaoDjen && (
              <Badge variant="secondary" className="cursor-pointer bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" onClick={() => setComPublicacaoDjen(false)}>
                Com DJEN ×
              </Badge>
            )}
            {comAndamentos && (
              <Badge variant="secondary" className="cursor-pointer bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" onClick={() => setComAndamentos(false)}>
                Com Andamentos ×
              </Badge>
            )}
            {comAudiencias && (
              <Badge variant="secondary" className="cursor-pointer bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" onClick={() => setComAudiencias(false)}>
                Com Audiências ×
              </Badge>
            )}
            {comIntimacoes && (
              <Badge variant="secondary" className="cursor-pointer bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" onClick={() => setComIntimacoes(false)}>
                Com Intimações ×
              </Badge>
            )}
            {comTarefas && (
              <Badge variant="secondary" className="cursor-pointer bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" onClick={() => setComTarefas(false)}>
                Com Tarefas ×
              </Badge>
            )}
            {acompanhamentoEspecial && (
              <Badge variant="secondary" className="cursor-pointer bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" onClick={() => setAcompanhamentoEspecial(false)}>
                Acompanhamento Especial ×
              </Badge>
            )}
            {segredoJustica && (
              <Badge variant="secondary" className="cursor-pointer bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => setSegredoJustica(false)}>
                Segredo de Justiça ×
              </Badge>
            )}
            {(filtrosAplicados.periodoInicio || filtrosAplicados.periodoFim) && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => {
                setFiltrosAvancados(prev => ({ ...prev, periodoInicio: undefined, periodoFim: undefined }));
                setFiltrosAplicados(prev => ({ ...prev, periodoInicio: undefined, periodoFim: undefined }));
              }}>
                Período ×
              </Badge>
            )}
            {(grupoNome || selectedGrupoId !== "all") && (
              <Badge variant="outline" className="cursor-pointer" onClick={clearGrupoFilter}>
                Grupo: {grupoNome || grupos.find(g => g.id === selectedGrupoId)?.nome} ×
              </Badge>
            )}
            {selectedClienteId !== "all" && (
              <Badge variant="outline" className="cursor-pointer" onClick={() => setSelectedClienteId("all")}>
                Cliente: {clientesDoGrupo.find(c => c.id === selectedClienteId)?.nome} ×
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground"
              onClick={() => {
                setSearchQuery("");
                setAreaFilter("all");
                setStatusFilter("all");
                setCoordenacaoFilter("all");
                setComPublicacaoDjen(false);
                setComAndamentos(false);
                setComAudiencias(false);
                setComIntimacoes(false);
                setComTarefas(false);
                setSelectedGrupoId("all");
                setSelectedClienteId("all");
                clearGrupoFilter();
                handleLimparFiltros();
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Selection Action Bar */}
      {isSelectionMode && selectedProcessos.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-xl px-6 py-4 flex items-center gap-4 animate-slide-up">
          <span className="text-sm font-medium">
            {selectedProcessos.length} processo(s) selecionado(s)
          </span>
          <Button onClick={() => setShowAtribuirDialog(true)}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Atribuir Coordenação
          </Button>
        </div>
      )}

      {/* Progresso de carregamento (busca/paginação) */}
      {isFetching && !isLoading && (
        <div className="mb-2">
          <Skeleton className="h-1 w-full" />
        </div>
      )}

      {/* Processes List - Astrea Style */}
      {isLoading ? (
        <div className="bg-card border border-border/50 overflow-hidden">
          <div className="divide-y divide-border/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-card border border-border/50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">Erro ao carregar processos</div>
                <div className="text-sm text-muted-foreground break-words">
                  {(error as any)?.message || "Tente atualizar a página ou refazer a busca."}
                </div>
              </div>
            </div>
            <div className="sm:ml-auto">
              <Button variant="outline" size="sm" onClick={handleForceRefresh}>
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      ) : processos.length > 0 ? (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="bg-card border border-border/50 overflow-hidden">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border/50 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Checkbox
                checked={selectedProcessos.length === processos.length && processos.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span>Selecione todos desta página</span>
            </div>

            {/* List Items */}
            <div className="divide-y divide-border/50">
              {processos.map((processo) => {
                const isSelected = selectedProcessos.includes(processo.id);
                const temRedistribuicaoRecente = processosRedistribuidos?.has(processo.id);
                
                return (
                  <ProcessoExpandableRow
                    key={processo.id}
                    processo={processo}
                    isSelectionMode={isSelectionMode}
                    isSelected={isSelected}
                    temRedistribuicaoRecente={temRedistribuicaoRecente || false}
                    onToggleSelection={toggleProcessoSelection}
                    onNavigate={(id) => navigate(`/processos/${id}`)}
                    etiquetaIds={etiquetasPorProcesso?.get(processo.id) || []}
                    lateralAberto={lateralProcessoId === processo.id}
                    onOpenLateral={(id) =>
                      setLateralProcessoId((prev) => (prev === id ? null : id))
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-muted-foreground">
              {((page - 1) * 50) + 1} de {totalCount} processos e casos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={previousPage}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={page >= totalPages}
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
          </div>

          <ItemDrawer
            open={!!lateralProcessoId}
            onOpenChange={(o) => { if (!o) setLateralProcessoId(null); }}
            titulo={
              (() => {
                const p: any = processos.find((x: any) => x.id === lateralProcessoId);
                if (!p) return "Processo";
                const ativo = p.polo_ativo || p.reclamante || p.autor;
                const passivo = p.polo_passivo || p.reclamados || p.requerido;
                return [ativo, passivo].filter(Boolean).join(" x ") || "Resumo do processo";
              })()
            }
            subtitulo={processos.find((p: any) => p.id === lateralProcessoId)?.numero || null}
          >
            {lateralProcessoId && (
              <ProcessoItensLateral
                key={lateralProcessoId}
                processoId={lateralProcessoId}
                processoNumero={
                  processos.find((p: any) => p.id === lateralProcessoId)?.numero || ""
                }
                hideHeader
                onClose={() => setLateralProcessoId(null)}
                onNavigate={(id) => navigate(`/processos/${id}`)}
              />
            )}
          </ItemDrawer>
        </div>
      ) : (
        <div className="text-center py-12 animate-fade-in">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {totalCount === 0 && !searchQuery && areaFilter === "all" && statusFilter === "all" 
              ? "Nenhum processo cadastrado" 
              : "Nenhum processo encontrado"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {totalCount === 0 && !searchQuery && areaFilter === "all" && statusFilter === "all"
              ? "Importe processos para começar" 
              : "Tente ajustar os filtros ou a busca"
            }
          </p>
          {totalCount === 0 && !searchQuery && areaFilter === "all" && statusFilter === "all" && (
            <Button onClick={() => navigate("/importar")}>
              Importar Processos
            </Button>
          )}
        </div>
      )}

      <AtribuirCoordenacaoLoteDialog
        open={showAtribuirDialog}
        onOpenChange={setShowAtribuirDialog}
        selectedProcessos={selectedProcessos}
        onSuccess={exitSelectionMode}
      />

      <ProcessoFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) setProcessoToEdit(null);
        }}
        processo={processoToEdit}
      />

      <TransferirProcessosDialog
        open={showTransferirDialog}
        onOpenChange={setShowTransferirDialog}
      />

      <ExportarModeloDialog
        open={showExportarModelo}
        onOpenChange={setShowExportarModelo}
        modelo={modeloExportacao}
        filtros={filtrosProcessos}
        selecionados={selectedProcessos}
      />

      </div>
    </MainLayout>
  );
};

export default Processos;
