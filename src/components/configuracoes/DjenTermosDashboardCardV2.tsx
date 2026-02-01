/**
 * DJEN Termos Dashboard Card v2.0
 * 
 * Card simplificado que usa o novo engine singleton.
 * Funcionalidades:
 * - Executar busca (com seleção de intervalo de datas)
 * - Retomar de onde parou (quando há checkpoint)
 * - Cancelar execução
 * - Kill switch (forçar cancelamento total)
 * - Mostrar progresso global + indicador do dia atual
 */

import { useMemo, useState, useCallback } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { 
  Loader2, Newspaper, PlayCircle, StopCircle,
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDjenTermos } from "@/hooks/useDjenTermos";
import type { MonitoringStats } from "@/hooks/useMonitoringDashboard";

type Props = {
  stats: MonitoringStats;
  onAfterMutation: () => void;
};

const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  bg: string; 
  icon: typeof Clock; 
  animate?: boolean;
}> = {
  idle: { label: 'Aguardando', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Clock },
  executando: { label: 'Executando', color: 'text-primary', bg: 'bg-primary/10', icon: Loader2, animate: true },
  concluido: { label: 'Concluído', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: StopCircle },
  erro: { label: 'Erro', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DjenTermosDashboardCard({ stats, onAfterMutation }: Props) {
  const {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    forceKill,
  } = useDjenTermos();

  // Estado para seleção de datas
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);

  // Helpers
  const getDataYmd = useCallback((date?: Date): string | undefined => {
    if (!date) return undefined;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const statusConfig = STATUS_CONFIG[progress.status] || STATUS_CONFIG.idle;
  const StatusIcon = statusConfig.icon;

  // Handlers
  const handleExecutar = useCallback(() => {
    // Se há checkpoint, perguntar se quer retomar ou começar do zero
    if (canResume) {
      setShowResumeDialog(true);
      return;
    }
    
    executar(getDataYmd(dataInicio), getDataYmd(dataFim));
    onAfterMutation();
  }, [canResume, executar, getDataYmd, dataInicio, dataFim, onAfterMutation]);

  const handleRetomar = useCallback(() => {
    setShowResumeDialog(false);
    retomar();
    onAfterMutation();
  }, [retomar, onAfterMutation]);

  const handleNovaExecucao = useCallback(() => {
    setShowResumeDialog(false);
    executar(getDataYmd(dataInicio), getDataYmd(dataFim));
    onAfterMutation();
  }, [executar, getDataYmd, dataInicio, dataFim, onAfterMutation]);

  const handleCancelar = useCallback(() => {
    cancelar();
  }, [cancelar]);

  const handleForceKill = useCallback(() => {
    setShowKillDialog(false);
    forceKill();
    onAfterMutation();
  }, [forceKill, onAfterMutation]);

  // Calcular percentual do checkpoint para exibição
  const checkpointPercent = useMemo(() => {
    if (!checkpoint) return 0;
    const totalDias = Math.max(1, Math.ceil(
      (new Date(checkpoint.dataFimYmd).getTime() - new Date(checkpoint.dataInicioYmd).getTime()) / (24 * 60 * 60 * 1000)
    ) + 1);
    // Precisamos saber quantos termos, mas não temos acesso aqui - usar aproximação
    // O checkpoint tem diaIndice e termoIndice
    return Math.min(99, Math.round(((checkpoint.diaIndice * 100 + checkpoint.termoIndice) / (totalDias * 100)) * 100));
  }, [checkpoint]);

  return (
    <>
      <Card className={cn("relative overflow-hidden", isRunning && "ring-2 ring-primary/30")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">DJEN Termos</CardTitle>
            </div>
            <Badge variant="secondary" className={cn("gap-1", statusConfig.bg, statusConfig.color)}>
              <StatusIcon className={cn("h-3 w-3", statusConfig.animate && "animate-spin")} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progresso */}
          {(isRunning || progress.status === 'concluido' || progress.status === 'cancelado') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.diaAtualYmd && (
                    <span className="font-medium">
                      📅 Dia {progress.diaAtualIndice}/{progress.totalDias} • 
                    </span>
                  )}
                  {progress.termoAtual && (
                    <span className="ml-1">{progress.termoAtual}</span>
                  )}
                </span>
                <span className="font-mono font-medium">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress.mensagem}</p>
            </div>
          )}

          {/* Estatísticas */}
          {(progress.novas > 0 || progress.duplicadas > 0 || progress.descartadas > 0) && (
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-600">✓ {progress.novas} novas</span>
              <span className="text-amber-600">↔ {progress.duplicadas} dup.</span>
              {progress.descartadas > 0 && (
                <span className="text-destructive">✗ {progress.descartadas} desc.</span>
              )}
            </div>
          )}

          {/* Tempo */}
          {progress.tempoDecorrido > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(progress.tempoDecorrido)}</span>
            </div>
          )}

          {/* Seletor de datas (apenas quando não está executando) */}
          {!isRunning && progress.status !== 'executando' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2">
            {isRunning ? (
              <>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleCancelar}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={handleExecutar}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Executar
                </Button>
                {canResume && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleRetomar}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Continuar de {checkpointPercent}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
            
            {/* Botões sempre visíveis: Limpar Tudo e Caveira */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      forceKill();
                      onAfterMutation();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limpar tudo (reset estado)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowKillDialog(true)}
                  >
                    <Skull className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Forçar cancelamento total</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Indicador de execução em background */}
          {isRunning && (
            <p className="text-xs text-center text-muted-foreground">
              💡 Execução continua em background mesmo ao sair desta tela
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de retomada */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Execução anterior encontrada</AlertDialogTitle>
            <AlertDialogDescription>
              Há uma execução pausada em {checkpointPercent}% 
              ({checkpoint?.dataInicioYmd} → {checkpoint?.dataFimYmd}).
              Deseja continuar de onde parou ou iniciar uma nova busca?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="secondary" onClick={handleNovaExecucao}>
              Nova Busca
            </Button>
            <AlertDialogAction onClick={handleRetomar}>
              Continuar ({checkpointPercent}%)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de kill */}
      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forçar cancelamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá interromper a execução imediatamente e limpar todo o estado.
              O checkpoint será perdido e você precisará reiniciar do zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleForceKill}
            >
              Forçar Cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
