import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TarefaComentarios } from "./TarefaComentarios";
import { format, parseISO, differenceInDays, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, User, Briefcase, Clock, CheckCircle2, XCircle, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { toast } from "sonner";

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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const updatePrazo = useUpdatePrazo();

  if (!prazo) return null;

  const today = startOfDay(new Date());
  const dataVencimento = prazo.data_vencimento ? parseISO(prazo.data_vencimento) : null;
  const isAtrasado = prazo.status !== "cumprido" && dataVencimento && isAfter(today, dataVencimento);
  const dias = dataVencimento ? differenceInDays(dataVencimento, today) : null;

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

    if (isAtrasado && dias !== null) {
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

    if (dias === null) {
      return {
        badge: (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        ),
        text: "Sem data de vencimento",
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

  const handleStartEditTitle = () => {
    setEditedTitle(prazo.titulo);
    setIsEditingTitle(true);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      toast.error("O título não pode estar vazio");
      return;
    }
    
    try {
      await updatePrazo.mutateAsync({ id: prazo.id, titulo: editedTitle.trim() });
      setIsEditingTitle(false);
      setEditedTitle("");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") handleCancelEditTitle();
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveTitle}
                    disabled={updatePrazo.isPending}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelEditTitle}
                    disabled={updatePrazo.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <DialogTitle 
                  className="text-lg font-semibold mb-2 cursor-pointer hover:text-primary group flex items-center gap-2"
                  onClick={handleStartEditTitle}
                >
                  {prazo.titulo}
                  <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                </DialogTitle>
              )}
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
              {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "-"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className={cn(
              "font-medium",
              isAtrasado && "text-destructive",
              !isAtrasado && prazo.status !== "cumprido" && dias !== null && dias <= 3 && "text-amber-600"
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
