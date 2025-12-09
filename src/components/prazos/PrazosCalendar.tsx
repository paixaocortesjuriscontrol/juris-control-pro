import { useState, useMemo, DragEvent } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  parseISO,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isAfter,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, CheckCircle2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Prazo } from "@/hooks/usePrazos";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PrazosCalendarProps {
  prazos: Prazo[];
  onEditPrazo: (prazo: Prazo) => void;
  onMarkAsCumprido: (prazo: Prazo) => void;
  onUpdatePrazoDate?: (prazoId: string, newDate: string) => void;
}

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PrazosCalendar({ prazos, onEditPrazo, onMarkAsCumprido, onUpdatePrazoDate }: PrazosCalendarProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedPrazo, setDraggedPrazo] = useState<Prazo | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Get all days to display in the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group prazos by date
  const prazosByDate = useMemo(() => {
    const map = new Map<string, Prazo[]>();
    
    prazos.forEach((prazo) => {
      const dateKey = format(parseISO(prazo.data_vencimento), "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, prazo]);
    });

    return map;
  }, [prazos]);

  const getPrazosForDate = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return prazosByDate.get(dateKey) || [];
  };

  const getPrazoStatus = (prazo: Prazo) => {
    if (prazo.status === "cumprido") return "cumprido";
    const today = startOfDay(new Date());
    const dataVencimento = parseISO(prazo.data_vencimento);
    if (isAfter(today, dataVencimento)) return "atrasado";
    return "pendente";
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, prazo: Prazo) => {
    if (prazo.status === "cumprido") {
      e.preventDefault();
      return;
    }
    setDraggedPrazo(prazo);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", prazo.id);
    
    // Add a slight delay to show the drag effect
    const target = e.currentTarget;
    setTimeout(() => {
      target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = "1";
    setDraggedPrazo(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);

    if (!draggedPrazo || !onUpdatePrazoDate) return;

    const newDateStr = format(targetDate, "yyyy-MM-dd");
    const currentDateStr = format(parseISO(draggedPrazo.data_vencimento), "yyyy-MM-dd");

    if (newDateStr === currentDateStr) {
      setDraggedPrazo(null);
      return;
    }

    onUpdatePrazoDate(draggedPrazo.id, newDateStr);
    toast.success(`Prazo movido para ${format(targetDate, "dd/MM/yyyy", { locale: ptBR })}`);
    setDraggedPrazo(null);
  };

  const getDayIndicators = (date: Date) => {
    const dayPrazos = getPrazosForDate(date);
    if (dayPrazos.length === 0) return null;

    const today = startOfDay(new Date());
    let hasUrgente = false;
    let hasAtrasado = false;
    let hasPendente = false;
    let hasCumprido = false;

    dayPrazos.forEach((prazo) => {
      if (prazo.status === "cumprido") {
        hasCumprido = true;
      } else {
        const dataVencimento = parseISO(prazo.data_vencimento);
        if (isAfter(today, dataVencimento)) {
          hasAtrasado = true;
        } else {
          hasPendente = true;
          if (prazo.prioridade === "urgente") {
            hasUrgente = true;
          }
        }
      }
    });

    return (
      <div className="flex gap-0.5 justify-center mt-0.5">
        {hasAtrasado && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
        {hasUrgente && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
        {hasPendente && !hasUrgente && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
        {hasCumprido && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      </div>
    );
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "urgente": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
      case "alta": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "media": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "cumprido":
        return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
      case "atrasado":
        return <AlertTriangle className="w-3 h-3 text-destructive" />;
      default:
        return <Clock className="w-3 h-3 text-amber-500" />;
    }
  };

  const selectedDatePrazos = selectedDate ? getPrazosForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDate(new Date());
              }}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Drag hint */}
        {onUpdatePrazoDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 bg-muted/30 rounded-md p-2">
            <GripVertical className="w-3 h-3" />
            <span>Arraste os prazos entre as datas para alterar o vencimento</span>
          </div>
        )}

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayPrazos = getPrazosForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dateKey = format(day, "yyyy-MM-dd");
            const isDragOver = dragOverDate === dateKey;

            return (
              <Popover key={day.toISOString()}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "aspect-square p-1 rounded-lg text-sm transition-all hover:bg-accent relative",
                      !isCurrentMonth && "text-muted-foreground/40",
                      isSelected && "ring-2 ring-primary",
                      isTodayDate && "bg-primary/10 font-bold",
                      dayPrazos.length > 0 && "cursor-pointer",
                      isDragOver && "ring-2 ring-primary bg-primary/20 scale-105"
                    )}
                    onClick={() => setSelectedDate(day)}
                    onDragOver={(e) => handleDragOver(e, dateKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center mx-auto rounded-full",
                      isTodayDate && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    {getDayIndicators(day)}
                    {dayPrazos.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 text-[10px] font-medium text-muted-foreground">
                        {dayPrazos.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                {dayPrazos.length > 0 && (
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b bg-muted/30">
                      <p className="font-medium">
                        {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {dayPrazos.length} prazo{dayPrazos.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-2 space-y-2">
                        {dayPrazos.map((prazo) => {
                          const status = getPrazoStatus(prazo);
                          const isDraggable = status !== "cumprido" && !!onUpdatePrazoDate;
                          return (
                            <div
                              key={prazo.id}
                              draggable={isDraggable}
                              onDragStart={(e) => handleDragStart(e, prazo)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "p-2 rounded-lg border transition-all",
                                getPrioridadeColor(prazo.prioridade),
                                isDraggable && "cursor-grab active:cursor-grabbing hover:shadow-md",
                                !isDraggable && "cursor-pointer hover:bg-accent/50"
                              )}
                              onClick={() => !isDraggable && onEditPrazo(prazo)}
                            >
                              <div className="flex items-start gap-2">
                                {isDraggable && (
                                  <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                )}
                                {getStatusIcon(status)}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {prazo.titulo}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {prazo.processo?.numero}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {prioridadeLabels[prazo.prioridade]}
                                    </Badge>
                                    {prazo.responsavel && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {prazo.responsavel.nome}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Atrasado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Urgente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Cumprido</span>
          </div>
        </div>
      </Card>

      {/* Selected Date Details */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">
          {selectedDate
            ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
            : "Selecione uma data"}
        </h3>

        {selectedDate && selectedDatePrazos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum prazo nesta data</p>
            {draggedPrazo && (
              <p className="text-xs mt-2 text-primary animate-pulse">
                Solte aqui para mover o prazo
              </p>
            )}
          </div>
        )}

        {selectedDatePrazos.length > 0 && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-2">
              {selectedDatePrazos.map((prazo) => {
                const status = getPrazoStatus(prazo);
                const isDraggable = status !== "cumprido" && !!onUpdatePrazoDate;
                return (
                  <div
                    key={prazo.id}
                    draggable={isDraggable}
                    onDragStart={(e) => handleDragStart(e, prazo)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      status === "cumprido" && "bg-emerald-500/5 border-emerald-500/20",
                      status === "atrasado" && "bg-destructive/5 border-destructive/20",
                      status === "pendente" && "bg-amber-500/5 border-amber-500/20",
                      isDraggable && "cursor-grab active:cursor-grabbing hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {isDraggable && (
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        {getStatusIcon(status)}
                        <span className="font-medium text-sm">{prazo.titulo}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px]", getPrioridadeColor(prazo.prioridade))}
                      >
                        {prioridadeLabels[prazo.prioridade]}
                      </Badge>
                    </div>

                    {prazo.descricao && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {prazo.descricao}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => navigate(`/processos/${prazo.processo_id}`)}
                      >
                        {prazo.processo?.numero}
                      </button>
                      {prazo.responsavel && (
                        <>
                          <span>•</span>
                          <span>{prazo.responsavel.nome}</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {status !== "cumprido" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => onMarkAsCumprido(prazo)}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Concluir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onEditPrazo(prazo)}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
