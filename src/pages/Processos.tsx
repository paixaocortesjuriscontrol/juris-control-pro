import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Download, Scale, FolderOpen, X, CheckSquare, FileText, Pencil, RefreshCw, ArrowRightLeft, ChevronLeft, ChevronRight, Activity, Users, Gavel, AlertCircle, Building2, Repeat, ClipboardList } from "lucide-react";
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
import { useProcessosPaginados } from "@/hooks/useProcessosPaginados";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AtribuirCoordenacaoLoteDialog } from "@/components/processos/AtribuirCoordenacaoLoteDialog";
import { TransferirProcessosDialog } from "@/components/processos/TransferirProcessosDialog";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";
import { FiltrosAvancadosProcessos, FiltrosAvancados, defaultFiltrosAvancados } from "@/components/processos/FiltrosAvancadosProcessos";
import { ProcessoExpandableRow } from "@/components/processos/ProcessoExpandableRow";
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

type AreaType = "civil" | "trabalhista" | "empresarial";
type StatusType = "pending" | "active" | "closed" | "urgent";

const areaLabels: Record<AreaType, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const statusLabels: Record<StatusType, string> = {
  pending: "Pendente",
  active: "Ativo",
  closed: "Encerrado",
  urgent: "Urgente",
};

const Processos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Flag para controlar se já carregou a coordenação do usuário
  const [coordenacaoCarregada, setCoordenacaoCarregada] = useState(false);
  
  // Buscar coordenação do usuário logado
  const { data: userCoordData, isLoading: isLoadingUserCoord } = useQuery({
    queryKey: ['user-coordenacao-processos', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Primeiro verifica se é coordenador
      const { data: coordenador } = await supabase
        .from('coordenacoes')
        .select('id')
        .eq('coordenador_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (coordenador) return coordenador.id;

      // Senão, verifica se é membro de alguma coordenação
      const { data: membro } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      return membro?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });
  
  // Ler filtros da URL na inicialização
  const urlCoordParam = searchParams.get("coordenacao");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [areaFilter, setAreaFilter] = useState<string>(() => searchParams.get("area") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string>("all");
  const [selectedProcessos, setSelectedProcessos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false);
  const [showTransferirDialog, setShowTransferirDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [processoToEdit, setProcessoToEdit] = useState<any>(null);
  const [monitorandoRedistribuicoes, setMonitorandoRedistribuicoes] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [comPublicacaoDjen, setComPublicacaoDjen] = useState(() => searchParams.get("comDjen") === "true");
  const [comAndamentos, setComAndamentos] = useState(() => searchParams.get("comAndamentos") === "true");
  const [comAudiencias, setComAudiencias] = useState(() => searchParams.get("comAudiencias") === "true");
  const [comIntimacoes, setComIntimacoes] = useState(() => searchParams.get("comIntimacoes") === "true");
  const [comTarefas, setComTarefas] = useState(() => searchParams.get("comTarefas") === "true");
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
  const queryClient = useQueryClient();

  // Auto-selecionar coordenação do usuário ao carregar (se não veio da URL)
  useEffect(() => {
    // Aguarda carregar sessão
    if (!user?.id) return;

    // Se já carregou, não faz nada
    if (coordenacaoCarregada) return;

    // Se veio da URL, usa o valor da URL
    if (urlCoordParam) {
      setCoordenacaoFilter(urlCoordParam);
      setCoordenacaoCarregada(true);
      return;
    }

    // Se ainda está carregando a coordenação do usuário, aguarda
    if (isLoadingUserCoord || userCoordData === undefined) return;

    // Quando terminou de carregar, define a coordenação
    setCoordenacaoFilter(userCoordData ?? "all");
    setCoordenacaoCarregada(true);
  }, [user?.id, userCoordData, isLoadingUserCoord, coordenacaoCarregada, urlCoordParam]);

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
  }, [searchParams, searchQuery, areaFilter, statusFilter, coordenacaoFilter, comPublicacaoDjen, comAndamentos, comAudiencias, comIntimacoes, comTarefas, tipoProcessoFilter, selectedGrupoId, selectedClienteId, setSearchParams, coordenacaoCarregada]);

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
    search: debouncedSearch,
    area: areaFilter,
    status: statusFilter,
    coordenacao_id: coordenacaoFilter,
    responsavel_id: filtrosAplicados.responsavelId,
    instancia: filtrosAplicados.instancia,
    comMovimento: comAndamentos,
    comPublicacaoDjen: comPublicacaoDjen,
    comAudiencia: comAudiencias,
    comIntimacao: comIntimacoes,
    comTarefa: comTarefas,
    periodoInicio: filtrosAplicados.periodoInicio,
    periodoFim: filtrosAplicados.periodoFim,
    clienteIds: clienteIds,
    tipoProcesso: tipoProcessoFilter,
    enabled: coordenacaoCarregada, // Não buscar enquanto está carregando a coordenação
  });

  const { data: processosRedistribuidos } = useProcessosComRedistribuicaoRecente();

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [debouncedSearch, areaFilter, statusFilter, coordenacaoFilter, filtrosAplicados, comPublicacaoDjen, comAndamentos, comAudiencias, comIntimacoes, comTarefas, clienteIds, tipoProcessoFilter]);

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
      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6 animate-fade-in">
        <div className="flex flex-col gap-4">
          {/* Search Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Digite algo para pesquisar" 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ATIVOS</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <CacheIndicator
              isFetching={isFetching}
              isStale={isStale}
              dataUpdatedAt={dataUpdatedAt}
              onRefresh={handleForceRefresh}
            />
          </div>

          {/* Advanced Filters Row - Astrea Style */}
          <div className="flex flex-wrap items-center gap-3">
            <FiltrosAvancadosProcessos
              filtros={filtrosAvancados}
              onFiltrosChange={setFiltrosAvancados}
              onAplicar={handleAplicarFiltros}
              onLimpar={handleLimparFiltros}
              coordenacaoId={coordenacaoFilter}
            />
            
            {/* Results counter chip */}
            {(filtrosAplicados.responsavelId || coordenacaoFilter !== "all" || areaFilter !== "all" || statusFilter !== "all" || searchQuery) && (
              <Badge variant="outline" className="h-8 px-3 text-xs font-medium bg-primary/10 border-primary/30 text-primary">
                {isFetching ? "..." : totalCount} processo{totalCount !== 1 ? "s" : ""} encontrado{totalCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Additional Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as coordenações</SelectItem>
                {coordenacoes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Filtro de Tipo de Processo */}
            <Select value={tipoProcessoFilter} onValueChange={setTipoProcessoFilter}>
              <SelectTrigger className="w-full sm:w-44">
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
              </SelectContent>
            </Select>
            
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                <SelectItem value="civil">Cível</SelectItem>
                <SelectItem value="trabalhista">Trabalhista</SelectItem>
                <SelectItem value="empresarial">Empresarial</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filtro de Grupo de Clientes */}
            <Select 
              value={grupoClientesParam ? "url" : selectedGrupoId} 
              onValueChange={handleGrupoChange}
              disabled={!!grupoClientesParam}
            >
              <SelectTrigger className="w-full sm:w-44">
                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {grupoClientesParam && (
                  <SelectItem value="url">{grupoNome || "Grupo selecionado"}</SelectItem>
                )}
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de Cliente do Grupo (quando grupo selecionado) */}
            {(selectedGrupoId !== "all" || grupoClientesParam) && clientesDoGrupo.length > 0 && !grupoClientesParam && (
              <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                <SelectTrigger className="w-full sm:w-48">
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
                <SelectTrigger className="w-full sm:w-56">
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

          {/* Filtros combinados - Com DJEN, Andamentos, Audiências, Intimações */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                comPublicacaoDjen && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              )}
              onClick={() => setComPublicacaoDjen(prev => !prev)}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Com DJEN</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                comAndamentos && "bg-green-600 hover:bg-green-700 text-white border-green-600"
              )}
              onClick={() => setComAndamentos(prev => !prev)}
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Com Andamentos</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                comAudiencias && "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              )}
              onClick={() => setComAudiencias(prev => !prev)}
            >
              <Gavel className="w-4 h-4" />
              <span className="hidden sm:inline">Com Audiências</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                comIntimacoes && "bg-red-600 hover:bg-red-700 text-white border-red-600"
              )}
              onClick={() => setComIntimacoes(prev => !prev)}
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Com Intimações</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 touch-manipulation select-none",
                comTarefas && "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
              )}
              onClick={() => setComTarefas(prev => !prev)}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Com Tarefas</span>
            </Button>
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
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => navigate("/importar")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Importar</span>
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                  onClick={() => setShowFormDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Novo Processo</span>
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
                {areaFilter === "civil" ? "Cível" : areaFilter === "trabalhista" ? "Trabalhista" : "Empresarial"} ×
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
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="divide-y divide-border/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border border-border/50 p-4">
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
        <>
          {/* Header Row */}
          <div className="bg-card rounded-t-xl border border-border/50 overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[40px_1fr_200px_180px_180px] gap-4 px-4 py-3 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center justify-center">
                {isSelectionMode && (
                  <Checkbox
                    checked={selectedProcessos.length === processos.length && processos.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                )}
              </div>
              <div>TÍTULO</div>
              <div>CLIENTE / PASTA</div>
              <div>AÇÃO / FORO</div>
              <div className="text-right">AÇÕES / DATA</div>
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
        </>
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
    </MainLayout>
  );
};

export default Processos;
