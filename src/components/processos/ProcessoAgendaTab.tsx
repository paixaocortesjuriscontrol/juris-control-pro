import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Tag,
  MapPin,
  Coins,
} from "lucide-react";
import { format, startOfDay, differenceInDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { GerarParcelasDialog } from "@/components/agenda/GerarParcelasDialog";
import { useUpdateEvento, useDeleteEvento, EventoAgenda } from "@/hooks/useEventosAgenda";

interface ProcessoAgendaTabProps {
  processoId: string;
}

const TIPO_CORES: Record<string, string> = {
  evento: "bg-blue-500",
  tarefa: "bg-amber-500",
  prazo: "bg-red-500",
  audiencia: "bg-purple-500",
  prazo_parcela: "bg-emerald-500",
  parcelamento: "bg-teal-500",
};

const TIPO_LABELS: Record<string, string> = {
  evento: "EVENTO",
  tarefa: "TAREFA",
  prazo: "PRAZO",
  audiencia: "AUDIÊNCIA",
  prazo_parcela: "PARCELA",
  parcelamento: "PARCELAMENTO",
};

export function ProcessoAgendaTab({ processoId }: ProcessoAgendaTabProps) {
  const queryClient = useQueryClient();
  const updateEvento = useUpdateEvento();
  const deleteEvento = useDeleteEvento();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoAgenda | null>(null);
  const [selectedParcelamento, setSelectedParcelamento] = useState<EventoAgenda | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);

  // Buscar eventos vinculados ao processo
  const { data: eventos, isLoading } = useQuery({
    queryKey: ["eventos-processo", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select(`
          *,
          processo:processos(id, numero)
        `)
        .eq("processo_id", processoId)
        .order("data_inicio", { ascending: true });

      if (error) throw error;

      // Buscar participantes
      if (data && data.length > 0) {
        const eventIds = data.map((e) => e.id);
        const { data: participantes } = await supabase
          .from("participantes_evento")
          .select("evento_id, usuario_id")
          .in("evento_id", eventIds);

        const eventsWithParticipants = data.map((evento) => ({
          ...evento,
          participantes:
            participantes?.filter((p) => p.evento_id === evento.id) || [],
        }));

        // Ordenar: futuros primeiro, passados depois
        const now = new Date();
        const futureEvents = eventsWithParticipants
          .filter((e) => new Date(e.data_inicio) >= now)
          .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

        const pastEvents = eventsWithParticipants
          .filter((e) => new Date(e.data_inicio) < now)
          .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());

        return [...futureEvents, ...pastEvents] as EventoAgenda[];
      }

      return data as EventoAgenda[];
    },
    enabled: !!processoId,
  });

  // Buscar parcelas vinculadas a eventos de parcelamento deste processo
  const { data: parcelas } = useQuery({
    queryKey: ["parcelas-processo", processoId],
    queryFn: async () => {
      // Primeiro buscar eventos de parcelamento do processo
      const { data: eventosParcelamento, error: evError } = await supabase
        .from("eventos_agenda")
        .select("id, titulo")
        .eq("processo_id", processoId)
        .eq("tipo", "parcelamento");

      if (evError) throw evError;
      if (!eventosParcelamento || eventosParcelamento.length === 0) return [];

      const eventIds = eventosParcelamento.map((e) => e.id);

      const { data, error } = await supabase
        .from("parcelas_evento")
        .select("*, evento:eventos_agenda(id, titulo)")
        .in("evento_id", eventIds)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  const handleEditEvento = (evento: EventoAgenda) => {
    if (evento.tipo === "parcelamento") {
      setSelectedParcelamento(evento);
      setParcelasDialogOpen(true);
    } else {
      setSelectedEvento(evento);
      setDialogOpen(true);
    }
  };

  const handleDeleteEvento = (id: string) => {
    setEventoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (eventoToDelete) {
      await deleteEvento.mutateAsync(eventoToDelete);
      queryClient.invalidateQueries({ queryKey: ["eventos-processo", processoId] });
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
    queryClient.invalidateQueries({ queryKey: ["eventos-processo", processoId] });
  };

  const handleNovoEvento = () => {
    setSelectedEvento(null);
    setDialogOpen(true);
  };

  const handleNovoParcela = () => {
    setSelectedParcelamento(null);
    setParcelasDialogOpen(true);
  };

  const renderEventoCard = (evento: EventoAgenda) => {
    const dataEvento = toZonedTime(new Date(evento.data_inicio), "America/Sao_Paulo");
    const dataFim = evento.data_fim
      ? toZonedTime(new Date(evento.data_fim), "America/Sao_Paulo")
      : null;
    const diasRestantes = differenceInDays(startOfDay(dataEvento), startOfDay(new Date()));
    const isAtrasado = diasRestantes < 0 && evento.status !== "concluido";
    const isHoje = isToday(dataEvento);

    return (
      <div
        key={evento.id}
        className={cn(
          "flex flex-col p-4 border rounded-lg bg-card transition-all hover:shadow-md",
          evento.status === "concluido" && "opacity-60",
          isAtrasado && "border-destructive/50 bg-destructive/5"
        )}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={evento.status === "concluido"}
              onCheckedChange={() => handleConcluirEvento(evento)}
            />
            <div
              className={cn(
                "w-1.5 h-8 rounded-full",
                TIPO_CORES[evento.tipo] || "bg-gray-400"
              )}
            />
            <div>
              <h3
                className={cn(
                  "font-semibold text-base text-foreground",
                  evento.status === "concluido" && "line-through text-muted-foreground"
                )}
              >
                {evento.titulo}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-medium",
                    evento.tipo === "audiencia" && "border-purple-500 text-purple-600",
                    evento.tipo === "prazo" && "border-red-500 text-red-600",
                    evento.tipo === "tarefa" && "border-amber-500 text-amber-600",
                    evento.tipo === "evento" && "border-blue-500 text-blue-600",
                    evento.tipo === "parcelamento" && "border-teal-500 text-teal-600"
                  )}
                >
                  {TIPO_LABELS[evento.tipo] || evento.tipo.toUpperCase()}
                </Badge>
                {evento.recorrente && (
                  <Badge variant="secondary" className="text-xs">
                    <CalendarDays className="w-3 h-3 mr-1" />
                    Recorrente
                  </Badge>
                )}
                {isAtrasado && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Atrasado {Math.abs(diasRestantes)} dia(s)
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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

        {/* Description */}
        {evento.descricao && (
          <p className="text-sm text-muted-foreground mb-3 pl-10">{evento.descricao}</p>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-10 text-sm">
          {/* Date & Time */}
          <div className="flex items-start gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className={cn("font-medium", isHoje && "text-primary")}>
                {isHoje ? "Hoje" : format(dataEvento, "dd/MM/yyyy", { locale: ptBR })}
              </p>
              {!evento.dia_inteiro && (
                <p className="text-xs text-muted-foreground">
                  {format(dataEvento, "HH:mm")}
                  {dataFim && ` - ${format(dataFim, "HH:mm")}`}
                </p>
              )}
              {evento.dia_inteiro && (
                <p className="text-xs text-muted-foreground">Dia inteiro</p>
              )}
            </div>
          </div>

          {/* Location */}
          {evento.local && (
            <div className="flex items-start gap-2 col-span-2 sm:col-span-1">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Local</p>
                <p className="text-sm truncate max-w-[180px]">{evento.local}</p>
              </div>
            </div>
          )}

          {/* Participants */}
          {evento.participantes && evento.participantes.length > 0 && (
            <div className="flex items-start gap-2 col-span-2 sm:col-span-1">
              <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Participantes</p>
                <p className="text-sm">{evento.participantes.length} pessoa(s)</p>
              </div>
            </div>
          )}

          {/* Parcelas count */}
          {evento.tipo === "parcelamento" && evento.total_parcelas && (
            <div className="flex items-start gap-2">
              <Coins className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Parcelas</p>
                <p className="text-sm">{evento.total_parcelas}x</p>
              </div>
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t pl-10">
          <div className="flex items-center gap-2">
            {evento.status === "concluido" ? (
              <Badge variant="outline" className="text-green-600 border-green-500 bg-green-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Concluído
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-500 bg-amber-50">
                <Clock className="w-3 h-3 mr-1" />
                Pendente
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Criado em {format(new Date(evento.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Agenda
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleNovoParcela}>
              <Coins className="w-4 h-4 mr-2" />
              Gerar Parcelas
            </Button>
            <Button size="sm" onClick={handleNovoEvento}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Evento
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : eventos && eventos.length > 0 ? (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">{eventos.map(renderEventoCard)}</div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Nenhum evento ou parcelamento vinculado</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleNovoParcela}>
                <Coins className="w-4 h-4 mr-2" />
                Gerar Parcelas
              </Button>
              <Button onClick={handleNovoEvento}>
                <Plus className="w-4 h-4 mr-2" />
                Criar evento
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialogs */}
      <EventoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedEvento(null);
            queryClient.invalidateQueries({ queryKey: ["eventos-processo", processoId] });
          }
        }}
        evento={selectedEvento}
        defaultProcessoId={processoId}
      />

      <GerarParcelasDialog
        open={parcelasDialogOpen}
        onOpenChange={(open) => {
          setParcelasDialogOpen(open);
          if (!open) {
            setSelectedParcelamento(null);
            queryClient.invalidateQueries({ queryKey: ["eventos-processo", processoId] });
            queryClient.invalidateQueries({ queryKey: ["parcelas-processo", processoId] });
          }
        }}
        evento={selectedParcelamento}
        defaultProcessoId={processoId}
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
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
