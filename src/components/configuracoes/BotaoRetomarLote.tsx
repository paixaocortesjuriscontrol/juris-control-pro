import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BotaoRetomarLoteProps {
  nextOffset?: number;
  total?: number;
  onRetomar: () => void;
  disabled?: boolean;
  /** Se true, o usuário cancelou explicitamente - não mostrar botão de retomar */
  wasCancelledByUser?: boolean;
}

export function BotaoRetomarLote({ 
  nextOffset, 
  total, 
  onRetomar, 
  disabled,
  wasCancelledByUser,
}: BotaoRetomarLoteProps) {
  // Não mostrar se foi cancelamento explícito do usuário
  if (wasCancelledByUser) {
    return null;
  }

  // Só mostrar se há offset pendente
  if (!nextOffset || nextOffset <= 0) {
    return null;
  }

  const percentage = total && total > 0 ? Math.round((nextOffset / total) * 100) : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onRetomar}
            disabled={disabled}
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <RotateCcw className="h-4 w-4" />
            Retomar do #{nextOffset + 1}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Execução interrompida. Retomar a partir do registro #{nextOffset + 1}
            {percentage !== null && ` (${percentage}% já processado)`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
