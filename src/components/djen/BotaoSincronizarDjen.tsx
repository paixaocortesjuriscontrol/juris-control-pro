import { RefreshCw, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSincronizarDjenBrowser } from "@/hooks/useSincronizarDjenBrowser";
import { format, subDays } from "date-fns";

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
  const { sincronizar, cancelar, isSyncing, progress } = useSincronizarDjenBrowser();

  const handleClick = async () => {
    if (isSyncing) {
      cancelar();
      return;
    }

    // Por padrão, buscar últimos 3 dias para garantir cobertura
    const dataFim = format(new Date(), 'yyyy-MM-dd');
    const dataInicio = format(subDays(new Date(), 2), 'yyyy-MM-dd');

    await sincronizar(monitoramentoIds, { dataInicio, dataFim });
    
    onComplete?.();
  };

  const progressPercent = progress 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  if (isSyncing && progress) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {progress.current}/{progress.total} monitoramentos
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
            {progress.currentMonitoramento?.slice(0, 20)}
            {(progress.currentMonitoramento?.length || 0) > 20 ? '...' : ''}
          </span>
          <span>
            {progress.novasInseridas} novas
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
      disabled={isSyncing}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Sincronizar Agora
    </Button>
  );
}
