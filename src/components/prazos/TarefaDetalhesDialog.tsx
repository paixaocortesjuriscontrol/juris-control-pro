import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TarefaComentarios } from "./TarefaComentarios";
import { format, parseISO, differenceInDays, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, User, Briefcase, Clock, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Prazo } from "@/hooks/usePrazos";

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

interface TarefaDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prazo: Prazo | null;
  onEdit?: (prazo: Prazo) => void;
  onMarkAsCumprido?: (prazo: Prazo) => void;
}

export function TarefaDetalhesDialog({
  open,
  onOpenChange,
  prazo,
  onEdit,
  onMarkAsCumprido,
}: TarefaDetalhesDialogProps) {
  if (!prazo) return null;

  const today = startOfDay(new Date());
  const dataVencimento = parseISO(prazo.data_vencimento);
  const isAtrasado = prazo.status !== "cumprido" && isAfter(today, dataVencimento);
  const dias = differenceInDays(dataVencimento, today);

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

  const getStatusInfo = () => {
    if (prazo.status === "cumprido") {
      return {
        badge: (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Cumprido
          </Badge>
        ),
        text: prazo.data_cumprimento 
          ? `Cumprido em ${format(parseISO(prazo.data_cumprimento), "dd/MM/yyyy", { locale: ptBR })}`
          : "Cumprido",
      };
    }

    if (isAtrasado) {
      return {
        badge: (
          <Badge className="bg-destructive/10 text-destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Atrasado
          </Badge>
        ),
        text: `${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""} de atraso`,
      };
    }

    return {
      badge: (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      ),
      text: dias === 0 ? "Vence hoje" : `${dias} dia${dias !== 1 ? "s" : ""} restantes`,
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold mb-2">
                {prazo.titulo}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {getPrioridadeBadge(prazo.prioridade)}
                {statusInfo.badge}
              </div>
            </div>
            <div className="flex gap-2">
              {prazo.status !== "cumprido" && onMarkAsCumprido && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkAsCumprido(prazo)}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Marcar Cumprido
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(prazo)}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Vencimento:</span>
            <span className="font-medium">
              {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className={cn(
              "font-medium",
              isAtrasado && "text-destructive",
              !isAtrasado && prazo.status !== "cumprido" && dias <= 3 && "text-amber-600"
            )}>
              {statusInfo.text}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Responsável:</span>
            <span className="font-medium">{prazo.responsavel?.nome || "Não atribuído"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Processo:</span>
            <span className="font-mono text-xs">{prazo.processo?.numero || "-"}</span>
          </div>
        </div>

        {prazo.descricao && (
          <div className="py-2">
            <h4 className="text-sm font-medium mb-1">Descrição</h4>
            <p className="text-sm text-muted-foreground">{prazo.descricao}</p>
          </div>
        )}

        {prazo.observacoes && (
          <div className="py-2">
            <h4 className="text-sm font-medium mb-1">Observações</h4>
            <p className="text-sm text-muted-foreground">{prazo.observacoes}</p>
          </div>
        )}

        <Separator className="my-2" />

        <TarefaComentarios prazoId={prazo.id} className="flex-1 min-h-[200px]" />
      </DialogContent>
    </Dialog>
  );
}
