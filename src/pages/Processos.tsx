import { useState, useEffect } from "react";
import { Search, Plus, Download, Scale, FolderOpen, X, CheckSquare, FileText, Pencil, RefreshCw, ArrowRightLeft, ChevronLeft, ChevronRight, Activity } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ler filtros da URL na inicialização
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [areaFilter, setAreaFilter] = useState<string>(() => searchParams.get("area") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string>(() => searchParams.get("coordenacao") || "all");
  const [selectedProcessos, setSelectedProcessos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [processoToEdit, setProcessoToEdit] = useState<any>(null);
  const [monitorandoRedistribuicoes, setMonitorandoRedistribuicoes] = useState(false);
  const [filtrosAvancados, setFiltrosAvancados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAvancados>(defaultFiltrosAvancados);
  const [comPublicacaoDjen, setComPublicacaoDjen] = useState(false);
  const [comAndamentos, setComAndamentos] = useState(false);
  
  // Filtro de grupo de clientes
  const grupoClientesParam = searchParams.get("grupo_clientes");
  const grupoNome = searchParams.get("grupo_nome");
  const clienteIds = grupoClientesParam ? grupoClientesParam.split(",") : undefined;
  
  const { executarMonitoramento } = useConfiguracoesMonitoramento();
  const { data: coordenacoes } = useCoordenacoes();
  const queryClient = useQueryClient();

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Atualizar URL quando filtros mudam
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (areaFilter !== "all") params.set("area", areaFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (coordenacaoFilter !== "all") params.set("coordenacao", coordenacaoFilter);
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, areaFilter, statusFilter, coordenacaoFilter, setSearchParams]);

  const { 
    data, 
    isLoading, 
    isFetching, 
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
    periodoInicio: filtrosAplicados.periodoInicio,
    periodoFim: filtrosAplicados.periodoFim,
    clienteIds: clienteIds,
  });

  const { data: processosRedistribuidos } = useProcessosComRedistribuicaoRecente();

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [debouncedSearch, areaFilter, statusFilter, coordenacaoFilter, filtrosAplicados, comPublicacaoDjen, comAndamentos, clienteIds]);

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
    !!grupoClientesParam;

  const clearGrupoFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("grupo_clientes");
    newParams.delete("grupo_nome");
    setSearchParams(newParams, { replace: true });
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
              <SelectTrigger className="w-full sm:w-48">
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

            {/* Special filters for DJEN and Movements */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={comPublicacaoDjen ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 gap-2",
                    comPublicacaoDjen && "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                  onClick={() => setComPublicacaoDjen(!comPublicacaoDjen)}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Com DJEN</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Processos com publicação DJEN</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={comAndamentos ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 gap-2",
                    comAndamentos && "bg-green-600 hover:bg-green-700 text-white"
                  )}
                  onClick={() => setComAndamentos(!comAndamentos)}
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">Com Andamentos</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Processos com andamentos registrados</TooltipContent>
            </Tooltip>
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
            {(filtrosAplicados.periodoInicio || filtrosAplicados.periodoFim) && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => {
                setFiltrosAvancados(prev => ({ ...prev, periodoInicio: undefined, periodoFim: undefined }));
                setFiltrosAplicados(prev => ({ ...prev, periodoInicio: undefined, periodoFim: undefined }));
              }}>
                Período ×
              </Badge>
            )}
            {grupoNome && (
              <Badge variant="secondary" className="cursor-pointer bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" onClick={clearGrupoFilter}>
                Grupo: {decodeURIComponent(grupoNome)} ×
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
    </MainLayout>
  );
};

export default Processos;
