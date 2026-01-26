import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Loader2, Newspaper, PlayCircle, StopCircle, Trash2,
  CheckCircle2, XCircle, Clock, TrendingUp, Zap, MinusCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MonitoringStats, MonitoringStatus } from "@/hooks/useMonitoringDashboard";
import { formatDuration, formatDateTime } from "@/hooks/useMonitoringDashboard";
import { cn } from "@/lib/utils";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { withTimeout } from "@/utils/withTimeout";
import { useState } from "react";

type Props = {
  stats: MonitoringStats;
  isExecuting: boolean;
  isCancelling: boolean;
  onReativarConfig: (tipo: string) => Promise<void>;
  onAfterMutation: () => void;
};

const STATUS_CONFIG: Record<MonitoringStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  animate?: boolean;
}> = {
  idle: { 
    label: 'Aguardando', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
    icon: Clock 
  },
  running: { 
    label: 'Executando', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Loader2,
    animate: true
  },
  completed: { 
    label: 'Concluído', 
    color: 'text-green-600', 
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon: CheckCircle2 
  },
  failed: { 
    label: 'Erro', 
    color: 'text-red-600', 
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: XCircle 
  },
  cancelled: { 
    label: 'Cancelado', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: StopCircle 
  },
  timeout: { 
    label: 'Timeout', 
    color: 'text-red-600', 
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: XCircle 
  },
};

function StatusBadge({ status }: { status: MonitoringStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 font-medium",
        config.color,
        config.bgColor,
        config.borderColor
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", config.animate && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

function MetricBadge({ 
  icon: Icon, 
  value, 
  label, 
  variant = 'default' 
}: { 
  icon: React.ElementType; 
  value: number | string; 
  label: string;
  variant?: 'default' | 'success' | 'info';
}) {
  const colorClass = {
    default: 'text-muted-foreground',
    success: 'text-green-600',
    info: 'text-blue-600',
  }[variant];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5 text-sm", colorClass)}>
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono font-medium">{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DjenTermosDashboardCard({
  stats,
  isExecuting,
  isCancelling,
  onReativarConfig,
  onAfterMutation,
}: Props) {
  const {
    progresso,
    executando,
    executarMonitoramento,
    cancelarExecucao,
  } = useBuscaDjenDireta();

  const [limpando, setLimpando] = useState(false);

  const md = (stats.config?.metadata as Record<string, any> | null) || {};
  const isPaused = stats.config?.ativo === false || md.paused_globally === true;

  // Verificar se há execução ativa no backend (edge function)
  const backendRunning = md.status === 'em_andamento' && !md.cancelado;
  const backendTotal = md.total ?? 0;
  const backendCurrent = md.current ?? 0;
  
  // Usar dados do backend quando a execução é server-side, senão usar client-side
  const effectiveTotal = backendRunning && backendTotal > 0 
    ? backendTotal 
    : progresso.totalMonitoramentos;
  const effectiveCurrent = backendRunning 
    ? backendCurrent 
    : progresso.monitoramentoAtual;
  
  const percent = useMemo(() => {
    if (effectiveTotal <= 0) return 0;
    return Math.round((effectiveCurrent / effectiveTotal) * 100);
  }, [effectiveCurrent, effectiveTotal]);

  // Determinar status real - priorizar backend sobre client-side
  const isRunning = executando || backendRunning;
  const currentStatus: MonitoringStatus = isRunning
    ? 'running' 
    : progresso.status === 'concluido' || md.status === 'concluido'
      ? 'completed' 
      : progresso.status === 'erro' || md.status === 'falhou'
        ? 'failed' 
        : stats.status;

  const statusConfig = STATUS_CONFIG[currentStatus];

  const handleExecutar = async () => {
    if (executando || isExecuting) return;

    try {
      if (isPaused) {
        await onReativarConfig('djen');
      }
      await executarMonitoramento();
      toast.info('DJEN Termos iniciado (busca direta).');
    } catch (e: any) {
      toast.error(`Erro ao iniciar DJEN: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleCancelar = () => {
    try {
      cancelarExecucao();
      toast.success('Cancelamento solicitado.');
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleLimparHoje = async () => {
    if (!confirm('Isso vai limpar TODAS as publicações DJEN capturadas hoje. Deseja continuar?')) return;

    setLimpando(true);
    try {
      if (executando) {
        handleCancelar();
        await new Promise((r) => setTimeout(r, 600));
      }

      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje'),
        180_000,
        'A limpeza demorou mais que 180s. Verifique o log da função e tente novamente.'
      );
      if (error) throw error;

      toast.success((data as any)?.message ?? 'Limpeza concluída!');
      onAfterMutation();
    } catch (e: any) {
      toast.error(`Erro ao limpar: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setLimpando(false);
    }
  };

  const canExecute = !isRunning && !isExecuting && currentStatus !== 'timeout';
  const canCancel = isRunning;

  // Métricas reais - usar dados do backend quando disponíveis
  const processados = effectiveCurrent;
  const total = effectiveTotal;
  const encontrados = md.djen_run?.totals?.novas ?? stats.todayStats.found ?? 0;
  const descartadas = md.djen_run?.totals?.descartadas ?? stats.todayStats.descartadas ?? 0;

  // Tempo - usar do backend quando running server-side
  const backendDuration = md.djen_run?.totals?.duracao_s ?? 0;
  const tempoSegundos = backendRunning && backendDuration > 0
    ? backendDuration
    : (progresso.tempoDecorrido ?? 0);
  const tempoFormatado = tempoSegundos > 0 
    ? formatDuration(tempoSegundos) 
    : formatDuration(stats.elapsedSeconds);

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isRunning && "ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10",
      currentStatus === 'failed' && "ring-1 ring-red-500/30",
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl transition-colors",
              statusConfig.bgColor,
            )}>
              <Newspaper className={cn(
                "h-5 w-5",
                statusConfig.color,
                isRunning && "animate-pulse"
              )} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{stats.nome}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {stats.config?.frequencia || 'diário'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Busca direta
                </Badge>
                {isPaused && (
                  <Badge variant="secondary" className="text-xs">Desativado</Badge>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Execution Details Panel - mesmo padrão dos outros cards */}
        <div className={cn(
          "rounded-xl p-4 space-y-3 border-2 transition-all",
          statusConfig.bgColor,
          statusConfig.borderColor,
          isRunning && "shadow-lg shadow-blue-500/10"
        )}>
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">
                {isRunning ? (
                  total > 0 
                    ? `Processando: ${processados.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`
                    : 'Processando...'
                ) : 'Progresso'}
              </span>
              <span className={cn("font-bold", statusConfig.color)}>
                {`${percent}%`}
              </span>
            </div>
            <Progress 
              value={percent} 
              className={cn("h-2.5", isRunning && "animate-pulse")}
            />
            {isRunning && progresso.mensagem && (
              <div className="text-xs text-muted-foreground truncate">
                {progresso.mensagem}
              </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-background/60 rounded-lg p-2.5 text-center border">
              <div className="text-xs text-muted-foreground mb-0.5">Processados</div>
              <div className="text-lg font-bold font-mono text-foreground">
                {processados.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="bg-background/60 rounded-lg p-2.5 text-center border">
              <div className="text-xs text-muted-foreground mb-0.5">Encontrados / Descartadas (hoje)</div>
              <div className="text-lg font-bold font-mono text-green-600">
                {encontrados.toLocaleString('pt-BR')}
              </div>
              <div className="text-xs font-mono text-red-600">
                {descartadas.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="bg-background/60 rounded-lg p-2.5 text-center border">
              <div className="text-xs text-muted-foreground mb-0.5">Total</div>
              <div className="text-lg font-bold font-mono text-foreground">
                {total > 0 ? total.toLocaleString('pt-BR') : '-'}
              </div>
            </div>
            <div className="bg-background/60 rounded-lg p-2.5 text-center border">
              <div className="text-xs text-muted-foreground mb-0.5">Tempo</div>
              <div className={cn("text-lg font-bold font-mono", isRunning && "text-blue-600")}>
                {tempoFormatado}
              </div>
            </div>
          </div>

          {/* Running Indicator */}
          {isRunning && (
            <div className="flex items-center justify-center gap-2 text-blue-600 py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Execução em andamento...</span>
            </div>
          )}
        </div>

        {/* Today's Stats Summary */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
          <span className="text-xs text-muted-foreground font-medium">Hoje:</span>
          <div className="flex items-center gap-4">
            <MetricBadge icon={Zap} value={stats.todayStats.executions} label="Execuções hoje" />
            <MetricBadge icon={TrendingUp} value={stats.todayStats.novas ?? 0} label="Novas" variant="success" />
            <MetricBadge icon={MinusCircle} value={stats.todayStats.descartadas ?? 0} label="Descartadas" />
          </div>
        </div>

        {/* Last Execution Time */}
        <div className="text-xs text-muted-foreground text-center">
          Última execução: {formatDateTime(stats.currentExecution?.iniciado_em || stats.lastCompletedExecution?.iniciado_em)}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            size="sm"
            className="flex-1"
            onClick={handleExecutar}
            disabled={!canExecute}
          >
            {executando || isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar
              </>
            )}
          </Button>
          
          <Button 
            size="sm"
            variant="destructive"
            onClick={handleCancelar}
            disabled={isCancelling || !canCancel}
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleLimparHoje}
            disabled={limpando}
            title="Limpar DJEN hoje"
          >
            {limpando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
