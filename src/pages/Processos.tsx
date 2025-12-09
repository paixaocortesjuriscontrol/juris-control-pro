import { useState } from "react";
import { Search, Filter, Plus, Download, ArrowUpDown, Scale } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProcessCard } from "@/components/dashboard/ProcessCard";
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
import { useProcessos } from "@/hooks/useProcessos";
import { useNavigate } from "react-router-dom";

const Processos = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: processos, isLoading } = useProcessos();

  const mapStatus = (status: string) => {
    const statusMap: Record<string, "active" | "pending" | "urgent" | "closed"> = {
      ativo: "active",
      pendente: "pending",
      urgente: "urgent",
      encerrado: "closed",
      arquivado: "closed",
    };
    return statusMap[status] || "active";
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
            <Button variant="outline" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
              onClick={() => navigate("/importar")}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Novo Processo</span>
            </Button>
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

      {/* Processes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filteredProcessos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProcessos.map((processo, index) => (
            <ProcessCard 
              key={processo.id} 
              numero={processo.numero}
              cliente={processo.polo_ativo || "Não informado"}
              area={processo.area}
              status={mapStatus(processo.status)}
              advogado={processo.advogado_responsavel?.nome || "Não atribuído"}
              descricao={processo.assunto || "Sem descrição"}
              delay={index * 50} 
            />
          ))}
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
    </MainLayout>
  );
};

export default Processos;
