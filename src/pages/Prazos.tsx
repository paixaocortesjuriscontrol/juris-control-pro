import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  Filter,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  List,
  CalendarDays,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrazos, useUpdatePrazo, useDeletePrazo, type Prazo } from "@/hooks/usePrazos";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { PrazosCalendar } from "@/components/prazos/PrazosCalendar";
import { format, parseISO, differenceInDays, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  cumprido: "Cumprido",
  atrasado: "Atrasado",
};

const Prazos = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPrazo, setSelectedPrazo] = useState<Prazo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prazoToDelete, setPrazoToDelete] = useState<string | null>(null);

  const { data: prazos, isLoading } = usePrazos();
  const updatePrazo = useUpdatePrazo();
  const deletePrazo = useDeletePrazo();

  // Calcula estatísticas
  const stats = useMemo(() => {
    if (!prazos) return { pendentes: 0, atrasados: 0, cumpridos: 0, urgentes: 0 };

    const today = startOfDay(new Date());
    let pendentes = 0;
    let atrasados = 0;
    let cumpridos = 0;
    let urgentes = 0;

    prazos.forEach((prazo) => {
      if (prazo.status === "cumprido") {
        cumpridos++;
      } else {
        const dataVencimento = parseISO(prazo.data_vencimento);
        if (isAfter(today, dataVencimento)) {
          atrasados++;
        } else {
          pendentes++;
        }
        if (prazo.prioridade === "urgente") {
          urgentes++;
        }
      }
    });

    return { pendentes, atrasados, cumpridos, urgentes };
  }, [prazos]);

  // Filtra prazos
  const filteredPrazos = useMemo(() => {
    if (!prazos) return [];

    const today = startOfDay(new Date());

    return prazos.filter((prazo) => {
      // Busca
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitulo = prazo.titulo.toLowerCase().includes(query);
        const matchProcesso = prazo.processo?.numero.toLowerCase().includes(query);
        const matchResponsavel = prazo.responsavel?.nome.toLowerCase().includes(query);
        if (!matchTitulo && !matchProcesso && !matchResponsavel) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "atrasado") {
          const dataVencimento = parseISO(prazo.data_vencimento);
          if (prazo.status === "cumprido" || !isAfter(today, dataVencimento)) return false;
        } else if (prazo.status !== statusFilter) {
          return false;
        }
      }

      // Prioridade filter
      if (prioridadeFilter !== "all" && prazo.prioridade !== prioridadeFilter) {
        return false;
      }

      return true;
    });
  }, [prazos, searchQuery, statusFilter, prioridadeFilter]);

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

  const getStatusBadge = (prazo: Prazo) => {
    const today = startOfDay(new Date());
    const dataVencimento = parseISO(prazo.data_vencimento);
    const isAtrasado = prazo.status !== "cumprido" && isAfter(today, dataVencimento);

    if (prazo.status === "cumprido") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Cumprido
        </Badge>
      );
    }

    if (isAtrasado) {
      return (
        <Badge className="bg-destructive/10 text-destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Atrasado
        </Badge>
      );
    }

    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getDiasRestantes = (prazo: Prazo) => {
    if (prazo.status === "cumprido") return null;

    const today = startOfDay(new Date());
    const dataVencimento = parseISO(prazo.data_vencimento);
    const dias = differenceInDays(dataVencimento, today);

    if (dias < 0) {
      return (
        <span className="text-destructive font-medium">
          {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? "s" : ""} atrasado
        </span>
      );
    }

    if (dias === 0) {
      return <span className="text-amber-600 dark:text-amber-400 font-medium">Vence hoje</span>;
    }

    if (dias <= 3) {
      return (
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          {dias} dia{dias !== 1 ? "s" : ""}
        </span>
      );
    }

    return (
      <span className="text-muted-foreground">
        {dias} dia{dias !== 1 ? "s" : ""}
      </span>
    );
  };

  const handleMarkAsCumprido = async (prazo: Prazo) => {
    await updatePrazo.mutateAsync({
      id: prazo.id,
      status: "cumprido",
      data_cumprimento: new Date().toISOString(),
    });
  };

  const handleEdit = (prazo: Prazo) => {
    setSelectedPrazo(prazo);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPrazoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (prazoToDelete) {
      await deletePrazo.mutateAsync(prazoToDelete);
      setDeleteDialogOpen(false);
      setPrazoToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPrioridadeFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || prioridadeFilter !== "all";

  const handleMarkAsCumpridoFromCalendar = async (prazo: Prazo) => {
    await updatePrazo.mutateAsync({
      id: prazo.id,
      status: "cumprido",
      data_cumprimento: new Date().toISOString(),
    });
  };

  const handleUpdatePrazoDate = async (prazoId: string, newDate: string) => {
    await updatePrazo.mutateAsync({
      id: prazoId,
      data_vencimento: newDate,
    });
  };

  return (
    <MainLayout
      title="Controle de Prazos"
      subtitle="Gerencie os prazos processuais"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("pendente")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("atrasado")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.atrasados}</p>
                <p className="text-xs text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPrioridadeFilter("urgente")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.urgentes}</p>
                <p className="text-xs text-muted-foreground">Urgentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("cumprido")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : stats.cumpridos}</p>
                <p className="text-xs text-muted-foreground">Cumpridos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Calendário
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => { setSelectedPrazo(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Prazo
        </Button>
      </div>

      {viewMode === "calendar" ? (
        <PrazosCalendar
          prazos={prazos || []}
          onEditPrazo={handleEdit}
          onMarkAsCumprido={handleMarkAsCumpridoFromCalendar}
          onUpdatePrazoDate={handleUpdatePrazoDate}
        />
      ) : (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por título, processo ou responsável..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cumprido">Cumprido</SelectItem>
                  </SelectContent>
                </Select>

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
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                      Busca: {searchQuery} ×
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                      {statusLabels[statusFilter]} ×
                    </Badge>
                  )}
                  {prioridadeFilter !== "all" && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setPrioridadeFilter("all")}>
                      {prioridadeLabels[prioridadeFilter]} ×
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpar todos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPrazos.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum prazo encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? "Tente ajustar os filtros de busca"
                  : "Cadastre seu primeiro prazo"}
              </p>
              {!hasActiveFilters && (
                <Button onClick={() => { setSelectedPrazo(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Prazo
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrazos.map((prazo) => (
                  <TableRow key={prazo.id}>
                    <TableCell className="font-medium">{prazo.titulo}</TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary"
                        onClick={() => navigate(`/processos/${prazo.processo_id}`)}
                      >
                        {prazo.processo?.numero || "-"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(prazo.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getDiasRestantes(prazo)}</TableCell>
                    <TableCell>{getPrioridadeBadge(prazo.prioridade)}</TableCell>
                    <TableCell>{getStatusBadge(prazo)}</TableCell>
                    <TableCell>{prazo.responsavel?.nome || "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/processos/${prazo.processo_id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Processo
                          </DropdownMenuItem>
                          {prazo.status !== "cumprido" && (
                            <DropdownMenuItem onClick={() => handleMarkAsCumprido(prazo)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Marcar como Cumprido
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(prazo)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(prazo.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
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
        </>
      )}

      {/* Dialog */}
      <PrazoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prazo={selectedPrazo}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este prazo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Prazos;
