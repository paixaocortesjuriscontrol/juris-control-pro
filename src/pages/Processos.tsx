import { useState } from "react";
import { Search, Filter, Plus, Download, ArrowUpDown } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProcessCard, AreaType, StatusType } from "@/components/dashboard/ProcessCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const allProcesses = [
  {
    numero: "0001234-12.2024.8.19.0001",
    cliente: "Empresa ABC Ltda",
    area: "civil" as AreaType,
    status: "active" as StatusType,
    advogado: "Dr. Silva",
    dataProximoEvento: "12/12/2025",
    descricao: "Ação de cobrança - valor R$ 150.000,00",
  },
  {
    numero: "0005678-45.2024.5.01.0034",
    cliente: "João da Silva",
    area: "trabalhista" as AreaType,
    status: "urgent" as StatusType,
    advogado: "Dra. Santos",
    dataProximoEvento: "09/12/2025",
    descricao: "Reclamação trabalhista - horas extras",
  },
  {
    numero: "0009012-78.2024.8.19.0042",
    cliente: "Tech Solutions S.A.",
    area: "empresarial" as AreaType,
    status: "pending" as StatusType,
    advogado: "Dr. Oliveira",
    dataProximoEvento: "15/12/2025",
    descricao: "Dissolução de sociedade",
  },
  {
    numero: "0003456-89.2024.8.19.0015",
    cliente: "Maria Fernanda Costa",
    area: "civil" as AreaType,
    status: "active" as StatusType,
    advogado: "Dr. Paixão",
    dataProximoEvento: "20/12/2025",
    descricao: "Indenização por danos morais",
  },
  {
    numero: "0007890-23.2024.5.01.0056",
    cliente: "Indústrias Metalúrgicas Beta",
    area: "trabalhista" as AreaType,
    status: "active" as StatusType,
    advogado: "Dra. Cortes",
    dataProximoEvento: "18/12/2025",
    descricao: "Ação coletiva - adicional de periculosidade",
  },
  {
    numero: "0002345-67.2024.8.19.0078",
    cliente: "Startup Innovation Ltda",
    area: "empresarial" as AreaType,
    status: "closed" as StatusType,
    advogado: "Dr. Alves",
    descricao: "Contrato de investimento - Series A",
  },
];

const Processos = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProcesses = allProcesses.filter((processo) => {
    const matchesSearch = 
      processo.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      processo.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      processo.advogado.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesArea = areaFilter === "all" || processo.area === areaFilter;
    const matchesStatus = statusFilter === "all" || processo.status === statusFilter;

    return matchesSearch && matchesArea && matchesStatus;
  });

  return (
    <MainLayout 
      title="Processos" 
      subtitle={`${filteredProcesses.length} processos encontrados`}
    >
      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por número, cliente ou advogado..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="closed">Encerrado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Processo
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {(areaFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
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
                {statusFilter === "active" ? "Ativo" : statusFilter === "pending" ? "Pendente" : statusFilter === "urgent" ? "Urgente" : "Encerrado"} ×
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProcesses.map((processo, index) => (
          <ProcessCard key={processo.numero} {...processo} delay={index * 50} />
        ))}
      </div>

      {filteredProcesses.length === 0 && (
        <div className="text-center py-12 animate-fade-in">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum processo encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar os filtros ou a busca</p>
        </div>
      )}
    </MainLayout>
  );
};

export default Processos;
