import { useState, useEffect } from "react";
import { Search, Plus, Download, Scale, FolderOpen, X, CheckSquare, FileText, Pencil, RefreshCw, ArrowRightLeft } from "lucide-react";
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
import { useProcessos } from "@/hooks/useProcessos";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AtribuirCoordenacaoLoteDialog } from "@/components/processos/AtribuirCoordenacaoLoteDialog";
import { ProcessoFormDialog } from "@/components/processos/ProcessoFormDialog";
import { cn } from "@/lib/utils";
import { Calendar, User } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useProcessosComRedistribuicaoRecente } from "@/hooks/useRedistribuicoes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProcessos, setSelectedProcessos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [processoToEdit, setProcessoToEdit] = useState<any>(null);
  const [monitorandoRedistribuicoes, setMonitorandoRedistribuicoes] = useState(false);
  
  const { executarMonitoramento } = useConfiguracoesMonitoramento();

  // Ler parâmetros da URL na inicialização
  useEffect(() => {
    const areaFromUrl = searchParams.get("area");
    if (areaFromUrl && ["civil", "trabalhista", "empresarial"].includes(areaFromUrl)) {
      setAreaFilter(areaFromUrl);
    }
  }, [searchParams]);
  
  const { data: processos, isLoading } = useProcessos();
  const { data: processosRedistribuidos } = useProcessosComRedistribuicaoRecente();

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
    if (selectedProcessos.length === filteredProcessos.length) {
      setSelectedProcessos([]);
    } else {
      setSelectedProcessos(filteredProcessos.map(p => p.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedProcessos([]);
  };

  const filteredProcessos = (processos || []).filter((processo) => {
    const matchesSearch = 
      processo.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (processo.polo_ativo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (processo.polo_passivo?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (processo.advogado_responsavel?.nome?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesArea = areaFilter === "all" || processo.area === areaFilter;
    const matchesStatus = statusFilter === "all" || processo.status === statusFilter;

    return matchesSearch && matchesArea && matchesStatus;
  });

  return (
    <MainLayout 
      title="Processos" 
      subtitle={`${filteredProcessos.length} processos encontrados`}
    >
      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6 animate-fade-in">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por número, parte ou advogado..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
                  {selectedProcessos.length === filteredProcessos.length ? "Desmarcar todos" : "Selecionar todos"}
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
        {(areaFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                Busca: {searchQuery} ×
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground"
              onClick={() => {
                setSearchQuery("");
                setAreaFilter("all");
                setStatusFilter("all");
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

      {/* Processes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filteredProcessos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProcessos.map((processo, index) => {
            const isSelected = selectedProcessos.includes(processo.id);
            const status = mapStatus(processo.status);
            const temRedistribuicaoRecente = processosRedistribuidos?.has(processo.id);
            
            return (
              <div 
                key={processo.id}
                onClick={() => isSelectionMode ? toggleProcessoSelection(processo.id) : navigate(`/processos/${processo.id}`)}
                className={cn(
                  "bg-card rounded-xl p-5 border shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up cursor-pointer group relative",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/50 hover:border-primary/30"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Edit button */}
                {!isSelectionMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProcessoToEdit(processo);
                      setShowFormDialog(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("badge-area-" + processo.area, "text-xs font-medium px-2 py-0.5")}>
                      {areaLabels[processo.area]}
                    </Badge>
                    <Badge className={cn("badge-status-" + status, "text-xs font-medium px-2 py-0.5")}>
                      {statusLabels[status]}
                    </Badge>
                    {temRedistribuicaoRecente && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30">
                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                            Redistribuído
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Este processo foi redistribuído nos últimos 7 dias
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {isSelectionMode && (
                    <Checkbox 
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleProcessoSelection(processo.id)}
                    />
                  )}
                </div>

                <h3 className="font-mono text-sm font-semibold text-foreground mb-1">{processo.numero}</h3>
                <p className="text-foreground font-medium mb-1">{processo.polo_ativo || "Não informado"}</p>
                {processo.cliente?.nome && (
                  <p className="text-xs text-primary font-medium mb-1">Cliente: {processo.cliente.nome}</p>
                )}
                {processo.assunto && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{processo.assunto}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span>{processo.advogado_responsavel?.nome || "Não atribuído"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 animate-fade-in">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {processos?.length === 0 ? "Nenhum processo cadastrado" : "Nenhum processo encontrado"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {processos?.length === 0 
              ? "Importe processos para começar" 
              : "Tente ajustar os filtros ou a busca"
            }
          </p>
          {processos?.length === 0 && (
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
