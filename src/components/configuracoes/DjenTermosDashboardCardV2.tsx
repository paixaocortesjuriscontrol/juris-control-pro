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
import { format } from "date-fns";
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
  timeout: { label: 'Timeout', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
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
    limparTudoComPublicacoes,
  } = useDjenTermos();

  // Snapshot do backend (evita “card desatualizado” ao sair/voltar da tela ou após reload)
  const md = (stats.config?.metadata as Record<string, any> | null) || {};

  // Fonte de verdade do status:
  // - Se o engine local está rodando, confiar nele
  // - Caso contrário, confiar no dashboard (execucoes_agendadas) e/ou metadata
  const backendIsRunning =
    stats.status === 'running' ||
    stats.currentExecution?.status === 'executando' ||
    md.status === 'executando';

  const backendIsTimeout =
    stats.status === 'timeout' ||
    md.status === 'timeout' ||
    md.status === 'stale' ||
    md.last_stop_reason === 'stale';

  const backendIsCancelled =
    stats.status === 'cancelled' ||
    md.status === 'cancelado' ||
    md.cancelado === true;

  const effectiveStatus: string = isRunning
    ? 'executando'
    : backendIsRunning
      ? 'executando'
      : backendIsTimeout
        ? 'timeout'
        : backendIsCancelled
          ? 'cancelado'
          : progress.status;

  const effectiveIsRunning = effectiveStatus === 'executando';
  const effectivePercentage =
    (typeof progress.percentage === 'number' && progress.percentage > 0)
      ? progress.percentage
      : (typeof md.percentage === 'number')
        ? md.percentage
        : (typeof stats.progress === 'number')
          ? stats.progress
          : 0;

  const effectiveDiaAtualYmd: string | null =
    progress.diaAtualYmd ??
    (typeof md.diaAtual === 'string' ? md.diaAtual : null) ??
    (typeof md.diaAtualYmd === 'string' ? md.diaAtualYmd : null) ??
    null;

  const effectiveDiaAtualIndice: number =
    progress.diaAtualIndice ||
    (typeof md.diaIndice === 'number' ? md.diaIndice : 0) ||
    (typeof md.diaAtualIndice === 'number' ? md.diaAtualIndice : 0) ||
    0;

  const effectiveTotalDias: number =
    progress.totalDias ||
    (typeof md.totalDias === 'number' ? md.totalDias : 0) ||
    (typeof stats.currentExecution?.detalhes?.totalDias === 'number'
      ? stats.currentExecution?.detalhes?.totalDias
      : 0) ||
    0;

  const effectiveTermoAtual: string | null =
    progress.termoAtual ?? (typeof md.termoAtual === 'string' ? md.termoAtual : null) ?? null;

  const effectiveMensagem: string =
    progress.mensagem ||
    (typeof md.mensagem === 'string' ? md.mensagem : '') ||
    (typeof md.message === 'string' ? md.message : '') ||
    (effectiveIsRunning ? 'Executando...' : '');

  const effectiveTempoDecorrido = Math.max(progress.tempoDecorrido || 0, stats.elapsedSeconds || 0);

  // Contadores: priorizar engine local quando ativo; senão usar backend (metadata/stats)
  // Nota: a tela de Análise mostra apenas o que foi persistido no banco. Duplicadas podem ser >0
  // mesmo com 0 novas, pois significam “já existia no banco”.
  const effectiveEncontradas: number =
    (isRunning && progress.novas > 0)
      ? progress.novas
      : (typeof md.novas === 'number' ? md.novas : 0) ||
        (typeof md.encontradas === 'number' ? md.encontradas : 0) ||
        (typeof md.found === 'number' ? md.found : 0) ||
        (typeof stats.todayStats?.novas === 'number' ? stats.todayStats.novas : 0) ||
        (typeof stats.todayStats?.found === 'number' ? stats.todayStats.found : 0) ||
        0;

  const effectiveDuplicadas: number =
    (isRunning && progress.duplicadas > 0)
      ? progress.duplicadas
      : (typeof md.duplicadas === 'number' ? md.duplicadas : 0) ||
        (typeof md.duplicatas === 'number' ? md.duplicatas : 0) ||
        (typeof (stats.todayStats as any)?.duplicadas === 'number' ? (stats.todayStats as any).duplicadas : 0) ||
        0;

  const effectiveDescartadas: number =
    (isRunning && progress.descartadas > 0)
      ? progress.descartadas
      : (typeof md.descartadas === 'number' ? md.descartadas : 0) ||
        (typeof md.discarded === 'number' ? md.discarded : 0) ||
        (typeof stats.todayStats?.descartadas === 'number' ? stats.todayStats.descartadas : 0) ||
        0;

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

  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.idle;
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
    onAfterMutation();
  }, [cancelar, onAfterMutation]);

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
      <Card className={cn("relative overflow-hidden", effectiveIsRunning && "ring-2 ring-primary/30")}>
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
          {(effectiveIsRunning || effectiveStatus === 'concluido' || effectiveStatus === 'cancelado' || effectiveStatus === 'timeout') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {effectiveDiaAtualYmd && (
                    <span className="font-medium">
                      📅 Dia {effectiveDiaAtualIndice}/{effectiveTotalDias} •
                    </span>
                  )}
                  {effectiveTermoAtual && (
                    <span className="ml-1">{effectiveTermoAtual}</span>
                  )}
                </span>
                <span className="font-mono font-medium">{Math.round(effectivePercentage)}%</span>
              </div>
              <Progress value={Math.round(effectivePercentage)} className="h-2" />
              {!!effectiveMensagem && (
                <p className="text-xs text-muted-foreground">{effectiveMensagem}</p>
              )}
            </div>
          )}

          {/* Totalizadores */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-primary">
              ✓ {effectiveEncontradas} encontradas
            </span>
            <span className="text-muted-foreground">
              ↔ {effectiveDuplicadas} duplicadas
            </span>
            <span className="text-destructive">
              ✗ {effectiveDescartadas} descartadas
            </span>
          </div>

          {/* Tempo */}
          {effectiveTempoDecorrido > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(effectiveTempoDecorrido)}</span>
            </div>
          )}

          {/* Seletor de datas (apenas quando não está executando) */}
          {!effectiveIsRunning && effectiveStatus !== 'executando' && (
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
            {effectiveIsRunning ? (
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
            
            {/* Botões sempre visíveis: Limpar Tudo (intervalo) e Caveira */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      // Usa datas selecionadas ou checkpoint ou últimos 3 dias
                      await limparTudoComPublicacoes(
                        getDataYmd(dataInicio),
                        getDataYmd(dataFim)
                      );
                      onAfterMutation();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limpar tudo (intervalo selecionado)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
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
          {effectiveIsRunning && (
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
