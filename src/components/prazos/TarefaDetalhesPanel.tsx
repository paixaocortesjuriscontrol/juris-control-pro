import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TarefaComentarios } from "./TarefaComentarios";
import { format, parseISO, differenceInDays, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  User,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdatePrazo, type Prazo } from "@/hooks/usePrazos";
import { toast } from "sonner";

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

interface Props {
  prazo: Prazo;
  onClose: () => void;
  onEdit?: (prazo: Prazo) => void;
  onMarkAsCumprido?: (prazo: Prazo) => void;
}

export function TarefaDetalhesPanel({ prazo, onClose, onEdit, onMarkAsCumprido }: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const updatePrazo = useUpdatePrazo();

  const today = startOfDay(new Date());
  const dataVencimento = prazo.data_vencimento ? parseISO(prazo.data_vencimento) : null;
  const isAtrasado =
    prazo.status !== "cumprido" && dataVencimento && isAfter(today, dataVencimento);
  const dias = dataVencimento ? differenceInDays(dataVencimento, today) : null;

  const prioridadeBadge = (
    <Badge
      className={cn(
        "font-medium",
        {
          baixa: "bg-muted text-muted-foreground",
          media: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
          alta: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          urgente: "bg-destructive/10 text-destructive",
        }[prazo.prioridade],
      )}
    >
      {prioridadeLabels[prazo.prioridade]}
    </Badge>
  );

  let statusBadge = (
    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <Clock className="w-3 h-3 mr-1" />
      Pendente
    </Badge>
  );
  let statusText = "Sem data de vencimento";
  if (prazo.status === "cumprido") {
    statusBadge = (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Cumprido
      </Badge>
    );
    statusText = prazo.data_cumprimento
      ? `Cumprido em ${format(parseISO(prazo.data_cumprimento), "dd/MM/yyyy", { locale: ptBR })}`
      : "Cumprido";
  } else if (isAtrasado && dias !== null) {
    statusBadge = (
      <Badge className="bg-destructive/10 text-destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Atrasado
      </Badge>
    );
    statusText = `${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""} de atraso`;
  } else if (dias !== null) {
    statusText = dias === 0 ? "Vence hoje" : `${dias} dia${dias !== 1 ? "s" : ""} restantes`;
  }

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      toast.error("O título não pode estar vazio");
      return;
    }
    try {
      await updatePrazo.mutateAsync({ id: prazo.id, titulo: editedTitle.trim() });
      setIsEditingTitle(false);
      setEditedTitle("");
    } catch {
      /* handled */
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 border-b">
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-base font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    setEditedTitle("");
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveTitle}
                disabled={updatePrazo.isPending}
                className="text-emerald-600"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditingTitle(false);
                  setEditedTitle("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <h2
              className="text-base font-semibold mb-2 cursor-pointer hover:text-primary group flex items-center gap-2"
              onClick={() => {
                setEditedTitle(prazo.titulo);
                setIsEditingTitle(true);
              }}
            >
              <span className="truncate">{prazo.titulo}</span>
              <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 shrink-0" />
            </h2>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {prioridadeBadge}
            {statusBadge}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {prazo.status !== "cumprido" && onMarkAsCumprido && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkAsCumprido(prazo)}
              className="text-emerald-600 hover:text-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Cumprir
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(prazo)}>
              <Pencil className="w-4 h-4 mr-1" />
              Editar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Vencimento:</span>
            <span className="font-medium">
              {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span
              className={cn(
                "font-medium",
                isAtrasado && "text-destructive",
                !isAtrasado &&
                  prazo.status !== "cumprido" &&
                  dias !== null &&
                  dias <= 3 &&
                  "text-amber-600",
              )}
            >
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Responsável:</span>
            <span className="font-medium">{prazo.responsavel?.nome || "Não atribuído"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Processo:</span>
            <span className="font-mono text-xs">{prazo.processo?.numero || "-"}</span>
          </div>
        </div>

        {prazo.descricao && (
          <div>
            <h4 className="text-sm font-medium mb-1">Descrição</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prazo.descricao}</p>
          </div>
        )}

        {prazo.observacoes && (
          <div>
            <h4 className="text-sm font-medium mb-1">Observações</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{prazo.observacoes}</p>
          </div>
        )}

        <Separator />

        <TarefaComentarios tarefaId={prazo.id} className="min-h-[200px]" />
      </div>
    </div>
  );
}