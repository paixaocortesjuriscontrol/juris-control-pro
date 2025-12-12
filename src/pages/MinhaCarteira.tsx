import { useState } from "react";
import {
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  FileText,
  Users,
  MoreHorizontal,
  Eye,
  ClipboardCheck,
  XCircle,
  ListChecks,
  Building2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMinhaCarteira, ProcessoDelegado, TarefaDelegada } from "@/hooks/useMinhaCarteira";
import { useUpdatePrazo } from "@/hooks/usePrazos";
import { TarefaDetalhesDialog } from "@/components/prazos/TarefaDetalhesDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const areaColors: Record<string, string> = {
  civil: "bg-area-civil/10 text-area-civil border-area-civil/30",
  trabalhista: "bg-area-trabalhista/10 text-area-trabalhista border-area-trabalhista/30",
  empresarial: "bg-area-empresarial/10 text-area-empresarial border-area-empresarial/30",
};

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

const statusTarefaLabels: Record<string, string> = {
  pendente: "Pendente",
  cumprido: "Cumprido",
  atrasado: "Atrasado",
};

const MinhaCarteira = () => {
  const navigate = useNavigate();
  const { processos, tarefas, stats, isLoading, refetch } = useMinhaCarteira();
  const updatePrazo = useUpdatePrazo();
  
  const [activeTab, setActiveTab] = useState<"processos" | "tarefas">("tarefas");
  const [searchQuery, setSearchQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [tarefaDetalhes, setTarefaDetalhes] = useState<any | null>(null);

  // Filtrar processos
  const filteredProcessos = processos.filter((processo) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchNumero = processo.numero.toLowerCase().includes(query);
      const matchAssunto = processo.assunto?.toLowerCase().includes(query);
      const matchPolo = processo.polo_ativo?.toLowerCase().includes(query) || 
                        processo.polo_passivo?.toLowerCase().includes(query);
      if (!matchNumero && !matchAssunto && !matchPolo) return false;
    }
    if (areaFilter !== "all" && processo.area !== areaFilter) return false;
    return true;
  });

  // Filtrar tarefas
  const filteredTarefas = tarefas.filter((tarefa) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchTitulo = tarefa.titulo.toLowerCase().includes(query);
      const matchProcesso = tarefa.processo?.numero.toLowerCase().includes(query);
      if (!matchTitulo && !matchProcesso) return false;
    }
    if (prioridadeFilter !== "all" && tarefa.prioridade !== prioridadeFilter) return false;
    return true;
  });

  const handleMarkAsCumprido = async (tarefa: TarefaDelegada) => {
    try {
      await updatePrazo.mutateAsync({
        id: tarefa.id,
        status: "cumprido",
        data_cumprimento: new Date().toISOString(),
      });
      refetch();
    } catch (error) {
      toast.error("Erro ao marcar tarefa como cumprida");
    }
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const variants: Record<string, string> = {
      baixa: "bg-muted text-muted-foreground",
      media: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      alta: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      urgente: "bg-destructive/10 text-destructive",
    };
    return (
      <Badge className={cn("font-medium", variants[prioridade])}>
        {prioridadeLabels[prioridade]}
      </Badge>
    );
  };

  const getDiasRestantesBadge = (tarefa: TarefaDelegada) => {
    if (tarefa.is_atrasado) {
      return (
        <Badge className="bg-destructive/10 text-destructive">
          <XCircle className="w-3 h-3 mr-1" />
          {Math.abs(tarefa.dias_restantes)} dia{Math.abs(tarefa.dias_restantes) !== 1 ? "s" : ""} atrasado
        </Badge>
      );
    }

    if (tarefa.dias_restantes === 0) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Vence hoje
        </Badge>
      );
    }

    if (tarefa.dias_restantes <= 3) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600">
          <Clock className="w-3 h-3 mr-1" />
          {tarefa.dias_restantes} dia{tarefa.dias_restantes !== 1 ? "s" : ""}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Calendar className="w-3 h-3 mr-1" />
        {tarefa.dias_restantes} dias
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <MainLayout 
        title="Minha Carteira" 
        subtitle="Seus processos e tarefas delegadas"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Minha Carteira" 
      subtitle="Seus processos e tarefas delegadas pelo coordenador"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("processos")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalProcessos || 0}</p>
                <p className="text-xs text-muted-foreground">Processos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("tarefas")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ListChecks className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tarefasPendentes || 0}</p>
                <p className="text-xs text-muted-foreground">Tarefas Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            setActiveTab("tarefas");
            setPrioridadeFilter("urgente");
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tarefasAtrasadas || 0}</p>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.tarefasCumpridas || 0}</p>
                <p className="text-xs text-muted-foreground">Cumpridas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for overdue tasks */}
      {(stats?.tarefasAtrasadas || 0) > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  Você tem {stats?.tarefasAtrasadas} tarefa{stats?.tarefasAtrasadas !== 1 ? "s" : ""} atrasada{stats?.tarefasAtrasadas !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Verifique suas tarefas pendentes e atualize o status
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                className="ml-auto"
                onClick={() => {
                  setActiveTab("tarefas");
                  setPrioridadeFilter("all");
                }}
              >
                Ver tarefas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "processos" | "tarefas")}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="tarefas" className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Minhas Tarefas
              {(stats?.tarefasPendentes || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats?.tarefasPendentes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processos" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Meus Processos
              {(stats?.totalProcessos || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats?.totalProcessos}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={activeTab === "processos" 
                    ? "Buscar por número, assunto ou partes..." 
                    : "Buscar por título ou processo..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {activeTab === "processos" ? (
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Áreas</SelectItem>
                    <SelectItem value="civil">Cível</SelectItem>
                    <SelectItem value="trabalhista">Trabalhista</SelectItem>
                    <SelectItem value="empresarial">Empresarial</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Prioridades</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tarefas Tab */}
        <TabsContent value="tarefas" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Tarefas Delegadas
              </CardTitle>
              <CardDescription>
                Tarefas atribuídas pelo coordenador da sua equipe
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTarefas.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma tarefa pendente</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || prioridadeFilter !== "all"
                      ? "Tente ajustar os filtros de busca"
                      : "Você está em dia com suas tarefas!"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTarefas.map((tarefa) => (
                      <TableRow 
                        key={tarefa.id}
                        className={cn(
                          tarefa.is_atrasado && "bg-destructive/5"
                        )}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{tarefa.titulo}</p>
                            {tarefa.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {tarefa.descricao}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tarefa.processo ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate(`/processos/${tarefa.processo?.id}`)}
                            >
                              {tarefa.processo.numero}
                            </Button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={cn(
                              "font-medium",
                              tarefa.status === "cumprido" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                              tarefa.status === "pendente" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                              tarefa.status === "atrasado" && "bg-destructive/10 text-destructive"
                            )}
                          >
                            {statusTarefaLabels[tarefa.status] || tarefa.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getDiasRestantesBadge(tarefa)}
                        </TableCell>
                        <TableCell>
                          {getPrioridadeBadge(tarefa.prioridade)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setTarefaDetalhes(tarefa)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleMarkAsCumprido(tarefa)}
                                className="text-emerald-600"
                              >
                                <ClipboardCheck className="w-4 h-4 mr-2" />
                                Marcar como Cumprida
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processos Tab */}
        <TabsContent value="processos" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Processos Atribuídos
              </CardTitle>
              <CardDescription>
                Processos sob sua responsabilidade
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProcessos.length === 0 ? (
                <div className="p-12 text-center">
                  <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum processo encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || areaFilter !== "all"
                      ? "Tente ajustar os filtros de busca"
                      : "Você não tem processos atribuídos no momento"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>Partes</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Coordenação</TableHead>
                      <TableHead>Tarefas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcessos.map((processo) => (
                      <TableRow key={processo.id}>
                        <TableCell>
                          <div>
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary font-medium"
                              onClick={() => navigate(`/processos/${processo.id}`)}
                            >
                              {processo.numero}
                            </Button>
                            {processo.assunto && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {processo.assunto}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            {processo.polo_ativo && (
                              <p className="text-sm truncate" title={processo.polo_ativo}>
                                <span className="text-muted-foreground">A: </span>
                                {processo.polo_ativo}
                              </p>
                            )}
                            {processo.polo_passivo && (
                              <p className="text-sm truncate" title={processo.polo_passivo}>
                                <span className="text-muted-foreground">P: </span>
                                {processo.polo_passivo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", areaColors[processo.area])}>
                            {areaLabels[processo.area]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {processo.coordenacao ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{processo.coordenacao.nome}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {processo.prazos_pendentes > 0 ? (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                              {processo.prazos_pendentes} pendente{processo.prazos_pendentes !== 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {processo.prazos_count > 0 ? `${processo.prazos_count} total` : "Nenhuma"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/processos/${processo.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tarefa Details Dialog */}
      {tarefaDetalhes && (
        <TarefaDetalhesDialog
          open={!!tarefaDetalhes}
          onOpenChange={(open) => !open && setTarefaDetalhes(null)}
          prazo={{
            ...tarefaDetalhes,
            responsavel: null,
          }}
          onMarkAsCumprido={() => handleMarkAsCumprido(tarefaDetalhes)}
        />
      )}
    </MainLayout>
  );
};

export default MinhaCarteira;
