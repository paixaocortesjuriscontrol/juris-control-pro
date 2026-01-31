import { useEffect, useMemo, useRef } from "react";
import { RefreshCw, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { toast } from "sonner";

interface BotaoSincronizarDjenProps {
  /** IDs específicos de monitoramentos (opcional - se vazio, sincroniza todos) */
  monitoramentoIds?: string[];
  /** Callback após sincronização */
  onComplete?: () => void;
  /** Tamanho do botão */
  size?: "sm" | "default" | "lg";
  /** Variante do botão */
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function BotaoSincronizarDjen({
  monitoramentoIds,
  onComplete,
  size = "sm",
  variant = "outline",
}: BotaoSincronizarDjenProps) {
  const {
    progresso,
    isExecutando,
    executarMonitoramento,
    cancelar,
  } = useBuscaDjenDireta();

  const wasRunningRef = useRef(false);
  const isRunning = isExecutando && progresso.status === "executando";

  const progressPercent = useMemo(() => {
    if (!progresso?.totalMonitoramentos) return 0;
    return Math.min(
      100,
      Math.round((progresso.monitoramentoAtual / progresso.totalMonitoramentos) * 100)
    );
  }, [progresso.monitoramentoAtual, progresso.totalMonitoramentos]);

  useEffect(() => {
    // Disparar onComplete quando uma execução que estava rodando finalizar
    if (wasRunningRef.current && !isRunning) {
      onComplete?.();
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, onComplete]);

  const handleClick = async () => {
    if (isRunning) {
      cancelar();
      toast.info("Cancelamento solicitado.");
      return;
    }

    try {
      await executarMonitoramento(monitoramentoIds, false);
      toast.info("Iniciando execução DJEN...");
    } catch (e: any) {
      toast.error(e?.message ? `Erro ao iniciar: ${e.message}` : "Erro ao iniciar execução");
    }
  };

  if (isRunning) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {progresso.monitoramentoAtual}/{progresso.totalMonitoramentos} monitoramentos
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 ml-auto"
            onClick={cancelar}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {progresso.mensagem?.slice(0, 22)}
            {(progresso.mensagem?.length || 0) > 22 ? "..." : ""}
          </span>
          <span>
            {progresso.publicacoesNovas} novas
          </span>
        </div>
      </div>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleClick}
      disabled={isRunning}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Sincronizar Agora
    </Button>
  );
}
