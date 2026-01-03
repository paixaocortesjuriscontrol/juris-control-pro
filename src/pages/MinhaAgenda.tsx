import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  CalendarDays,
  List,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Tag,
  MoreVertical,
  Trash2,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEventosAgenda, useEventoStats, useUpdateEvento, useDeleteEvento, EventoAgenda, EventoFilters } from "@/hooks/useEventosAgenda";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

type ViewMode = "lista" | "dia" | "semana" | "mes";

const TIPO_CORES: Record<string, string> = {
  evento: "bg-blue-500",
  tarefa: "bg-amber-500",
  prazo: "bg-red-500",
  audiencia: "bg-purple-500",
};

const TIPO_LABELS: Record<string, string> = {
  evento: "EVENTO",
  tarefa: "TAREFA",
  prazo: "PRAZO",
  audiencia: "AUDIÊNCIA",
};

export default function MinhaAgenda() {
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);

  // Filters state
  const [tiposFiltro, setTiposFiltro] = useState<string[]>(["tarefa", "evento", "prazo", "audiencia"]);
  const [statusFiltro, setStatusFiltro] = useState<string>("todas");
  const [pessoasFiltro, setPessoasFiltro] = useState<string[]>([]);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [pessoasPopoverOpen, setPessoasPopoverOpen] = useState(false);

  const updateEvento = useUpdateEvento();
  const deleteEvento = useDeleteEvento();

  // Calculate date range based on view mode
  const getDateRange = () => {
    switch (viewMode) {
      case "dia":
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case "semana":
        return { start: startOfWeek(selectedDate, { locale: ptBR }), end: endOfWeek(selectedDate, { locale: ptBR }) };
      case "mes":
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
      default:
        return { start: undefined, end: undefined };
    }
  };

  const dateRange = getDateRange();

  const filters: EventoFilters = {
    tipos: tiposFiltro.length > 0 ? tiposFiltro : undefined,
    status: statusFiltro,
    dataInicio: dateRange.start,
    dataFim: dateRange.end,
    responsavelIds: pessoasFiltro.length > 0 ? pessoasFiltro : undefined,
  };

  const { data: eventos, isLoading } = useEventosAgenda(filters);
  const { data: stats } = useEventoStats();

  const [coordenacaoFiltroPage, setCoordenacaoFiltroPage] = useState<string>("todas");

  const { data: coordenacoes } = useQuery({
    queryKey: ["coordenacoes-agenda-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-agenda-filter", coordenacaoFiltroPage],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      
      if (coordenacaoFiltroPage && coordenacaoFiltroPage !== "todas") {
        const { data: membros } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id")
          .eq("coordenacao_id", coordenacaoFiltroPage);
        
        const userIds = membros?.map(m => m.usuario_id) || [];
        if (userIds.length > 0) {
          query = query.in("id", userIds);
        } else {
          return [];
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Filter by search
  const filteredEventos = eventos?.filter(evento => 
    !search || 
    evento.titulo.toLowerCase().includes(search.toLowerCase()) ||
    evento.processo?.numero?.includes(search)
  );

  const handleEditEvento = (evento: EventoAgenda) => {
    setSelectedEvento(evento);
    setDialogOpen(true);
  };

  const handleDeleteEvento = (id: string) => {
    setEventoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (eventoToDelete) {
      await deleteEvento.mutateAsync(eventoToDelete);
      setDeleteDialogOpen(false);
      setEventoToDelete(null);
    }
  };

  const handleConcluirEvento = async (evento: EventoAgenda) => {
    await updateEvento.mutateAsync({
      id: evento.id,
      status: evento.status === "concluido" ? "pendente" : "concluido",
      concluido_em: evento.status === "concluido" ? null : new Date().toISOString(),
    });
  };

  const toggleTipo = (tipo: string) => {
    setTiposFiltro(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const togglePessoa = (id: string) => {
    setPessoasFiltro(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const renderEventoCard = (evento: EventoAgenda) => {
    const dataEvento = new Date(evento.data_inicio);
    const diasRestantes = differenceInDays(startOfDay(dataEvento), startOfDay(new Date()));
    const isAtrasado = diasRestantes < 0 && evento.status !== "concluido";
    
    return (
      <div
        key={evento.id}
        className={cn(
          "flex items-start gap-4 p-4 border rounded-lg bg-card transition-all hover:shadow-md",
          evento.status === "concluido" && "opacity-60"
        )}
      >
        <Checkbox
          checked={evento.status === "concluido"}
          onCheckedChange={() => handleConcluirEvento(evento)}
          className="mt-1"
        />
        
        <div className={cn("w-1 self-stretch rounded-full", TIPO_CORES[evento.tipo] || "bg-gray-400")} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {isToday(dataEvento) ? "Hoje" : format(dataEvento, "EEE, dd MMM yyyy", { locale: ptBR })}
            </span>
            <Badge variant="outline" className="text-xs">
              {TIPO_LABELS[evento.tipo] || evento.tipo.toUpperCase()}
            </Badge>
            {evento.recorrente && (
              <Badge variant="secondary" className="text-xs">Recorrente</Badge>
            )}
          </div>
          
          <h3 className={cn(
            "font-medium text-foreground",
            evento.status === "concluido" && "line-through"
          )}>
            {evento.titulo}
          </h3>
          
          {evento.descricao && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {evento.descricao}
            </p>
          )}
          
          {evento.processo && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {evento.processo.numero}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {!evento.dia_inteiro && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(dataEvento, "HH:mm")}
              </span>
            )}
            {evento.local && (
              <span className="truncate max-w-[150px]">{evento.local}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isAtrasado && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Atrasado
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditEvento(evento)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteEvento(evento.id)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <MainLayout title="Minha Agenda" subtitle="Gerencie seus eventos, tarefas, prazos e audiências">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => { setSelectedEvento(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Evento
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.concluidas || 0}</div>
            <div className="text-xs text-muted-foreground">Concluídas</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats?.pendentes || 0}</div>
            <div className="text-xs text-muted-foreground">A concluir (hoje)</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats?.atrasadas || 0}</div>
            <div className="text-xs text-muted-foreground">Atrasadas</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode */}
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lista">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Em lista
                </div>
              </SelectItem>
              <SelectItem value="dia">Por dia</SelectItem>
              <SelectItem value="semana">Por semana</SelectItem>
              <SelectItem value="mes">Por mês</SelectItem>
            </SelectContent>
          </Select>

          {/* Pessoas Filter */}
          <Popover open={pessoasPopoverOpen} onOpenChange={setPessoasPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Users className="w-4 h-4" />
                {pessoasFiltro.length > 0 ? `${pessoasFiltro.length} pessoas` : "Pessoas"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div className="font-medium">Pessoas</div>
                
                <Select value={coordenacaoFiltroPage} onValueChange={setCoordenacaoFiltroPage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as coordenações</SelectItem>
                    {coordenacoes?.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id}>
                        {coord.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {usuarios?.map((usuario) => (
                    <div key={usuario.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`filter-user-${usuario.id}`}
                        checked={pessoasFiltro.includes(usuario.id)}
                        onCheckedChange={() => togglePessoa(usuario.id)}
                      />
                      <Label htmlFor={`filter-user-${usuario.id}`} className="cursor-pointer text-sm">
                        {usuario.nome}
                      </Label>
                    </div>
                  ))}
                  {usuarios?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum membro nesta coordenação
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => { setPessoasFiltro([]); setCoordenacaoFiltroPage("todas"); }}>
                    Limpar
                  </Button>
                  <Button size="sm" onClick={() => setPessoasPopoverOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Atividades Filter */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Tag className="w-4 h-4" />
                Todas as atividades
                <ChevronDown className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-4">
                <div>
                  <div className="font-medium mb-2">Exibir</div>
                  <div className="space-y-2">
                    {["tarefa", "evento", "prazo", "audiencia"].map((tipo) => (
                      <div key={tipo} className="flex items-center gap-2">
                        <Checkbox
                          id={`tipo-${tipo}`}
                          checked={tiposFiltro.includes(tipo)}
                          onCheckedChange={() => toggleTipo(tipo)}
                        />
                        <Label htmlFor={`tipo-${tipo}`} className="cursor-pointer capitalize">
                          {tipo === "audiencia" ? "Audiências" : `${tipo}s`}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-2">Status</div>
                  <div className="space-y-2">
                    {[
                      { value: "pendente", label: "A concluir" },
                      { value: "concluido", label: "Concluídas" },
                      { value: "cancelado", label: "Canceladas" },
                      { value: "todas", label: "Todas" },
                    ].map((status) => (
                      <div key={status.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`status-${status.value}`}
                          name="status"
                          checked={statusFiltro === status.value}
                          onChange={() => setStatusFiltro(status.value)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor={`status-${status.value}`} className="cursor-pointer">
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setTiposFiltro(["tarefa", "evento", "prazo", "audiencia"]);
                    setStatusFiltro("todas");
                  }}>
                    Limpar
                  </Button>
                  <Button size="sm" onClick={() => setFilterPopoverOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Picker for filtered views */}
          {viewMode !== "lista" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays className="w-4 h-4" />
                  {format(selectedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Date Header for filtered views */}
        {viewMode !== "lista" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">
              {viewMode === "dia" && format(selectedDate, "'Hoje •' dd/MM/yyyy", { locale: ptBR })}
              {viewMode === "semana" && `Semana de ${format(dateRange.start!, "dd/MM")} a ${format(dateRange.end!, "dd/MM/yyyy")}`}
              {viewMode === "mes" && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <span className="text-sm">
              Mostrando {filteredEventos?.length || 0} atividades
            </span>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))
          ) : filteredEventos?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade encontrada</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setSelectedEvento(null); setDialogOpen(true); }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar evento
              </Button>
            </div>
          ) : (
            filteredEventos?.map(renderEventoCard)
          )}
        </div>
      </div>

      <EventoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        evento={selectedEvento}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
