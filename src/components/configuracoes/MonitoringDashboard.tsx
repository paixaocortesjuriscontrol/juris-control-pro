import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  RefreshCw, Activity, Globe, Newspaper, FileSearch, Radar,
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, PlayCircle,
  StopCircle, TrendingUp, Hash, Timer, Zap, BarChart3, MinusCircle, Mail
} from "lucide-react";
import { useEnviarResumoManual } from "@/hooks/useEnviarResumoManual";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  useMonitoringDashboard, 
  formatDuration, 
  formatDateTime,
  type MonitoringStats,
  type MonitoringStatus,
  type MonitoringExecution,
} from "@/hooks/useMonitoringDashboard";
import { useMonitorarDjenProcessosBrowser } from "@/hooks/useMonitorarDjenProcessosBrowser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getExecutionProgress } from "@/utils/executionProgress";
import { supabase } from "@/integrations/supabase/client";
import { DjenTermosDashboardCard } from "./DjenTermosDashboardCardV2";

const ICONS: Record<string, React.ElementType> = {
  RefreshCw,
  Activity,
  Globe,
  Newspaper,
  FileSearch,
  Radar,
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
    icon: AlertTriangle 
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

function ExecutionDetails({
  stats,
  forceRunning = false,
  forceReset = false,
}: {
  stats: MonitoringStats;
  forceRunning?: boolean;
  forceReset?: boolean;
}) {
  // CORREÇÃO: Só mostrar currentExecution se realmente ativo (sem finalizado_em)
  const exec = stats.currentExecution || stats.lastCompletedExecution;
  if (!exec) return null;

  // isRunning agora é calculado com base no hook que já filtra fantasmas
  const isRunning = forceRunning || (stats.status === 'running' && stats.currentExecution !== null);
  const statusConfig = STATUS_CONFIG[stats.status];

  const metadata = (stats.config?.metadata as Record<string, any> | null) ?? null;
  const checkpointTotal = Number(metadata?.total ?? 0);
  const checkpointCurrent = Number((metadata?.next_offset ?? metadata?.current ?? 0) as any) || 0;
  const checkpointPercent = checkpointTotal > 0
    ? Math.min(100, Math.max(0, Math.round((checkpointCurrent / checkpointTotal) * 100)))
    : 0;

  // Progresso derivado da última execução (pode estar atrasado)
  const { current: execCurrent, total: execTotal, percentage: execPct } = getExecutionProgress({
    detalhes: exec.detalhes,
    registros_processados: exec.registros_processados,
    total_lotes: exec.total_lotes,
    lotes_processados: exec.lotes_processados,
  });

  const execPercent = execTotal > 0 ? (execPct ?? 0) : (stats.progress ?? 0);
  const hasCheckpoint = checkpointTotal > 0 && checkpointCurrent > 0;

  // REGRA: nunca regredir por causa de snapshot antigo (ex.: voltar para 7%).
  // - Se houver checkpoint persistido e ele estiver à frente, usar checkpoint.
  // - Se estiver executando e houver currentExecution real, usar exec (mais vivo).
  const preferCheckpoint = hasCheckpoint && (
    execTotal === 0 ||
    checkpointCurrent > execCurrent ||
    checkpointPercent > execPercent
  );

  let progressPercent =
    (isRunning && stats.currentExecution)
      ? execPercent
      : (preferCheckpoint ? checkpointPercent : execPercent);

  // Importante: registros_encontrados na tabela execucoes_agendadas nem sempre é atualizado
  // (principalmente em jobs assíncronos). Para confiabilidade, usamos a contagem persistida no banco
  // que já alimenta o resumo "Hoje" (todayStats.found).
  let encontradosBancoHoje = stats.todayStats.found ?? 0;
  let descartadasBancoHoje = stats.todayStats.descartadas ?? 0;
  let processadosExibicao =
    (isRunning && stats.currentExecution)
      ? execCurrent
      : (preferCheckpoint ? checkpointCurrent : execCurrent);
  let totalExibicao =
    (isRunning && stats.currentExecution)
      ? execTotal
      : (preferCheckpoint ? checkpointTotal : execTotal);
  let elapsedExibicao = stats.elapsedSeconds;

  if (forceReset) {
    progressPercent = 0;
    processadosExibicao = 0;
    encontradosBancoHoje = 0;
    descartadasBancoHoje = 0;
    elapsedExibicao = 0;
  }

  return (
    <div className={cn(
      "rounded-xl p-4 space-y-3 border-2 transition-all",
      statusConfig.bgColor,
      statusConfig.borderColor,
      isRunning && "shadow-lg shadow-blue-500/10"
    )}>
      {/* Progress Bar with "Processando X de Y" */}
      {(progressPercent > 0 || stats.progress !== null || isRunning) && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">
              {isRunning ? (
                totalExibicao > 0 
                  ? `Processando: ${processadosExibicao.toLocaleString('pt-BR')} de ${totalExibicao.toLocaleString('pt-BR')}`
                  : 'Processando...'
              ) : 'Progresso'}
            </span>
            <span className={cn("font-bold", statusConfig.color)}>
              {`${progressPercent}%`}
            </span>
          </div>
          <Progress 
            value={progressPercent}
            className={cn("h-2.5", isRunning && "animate-pulse")}
          />
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background/60 rounded-lg p-2.5 text-center border">
          <div className="text-xs text-muted-foreground mb-0.5">Processados</div>
          <div className="text-lg font-bold font-mono text-foreground">
            {processadosExibicao.toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center border">
          <div className="text-xs text-muted-foreground mb-0.5">Encontrados / Descartadas (hoje)</div>
          <div className="text-lg font-bold font-mono text-green-600">
            {encontradosBancoHoje.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs font-mono text-red-600">
            {descartadasBancoHoje.toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center border">
          <div className="text-xs text-muted-foreground mb-0.5">Total</div>
          <div className="text-lg font-bold font-mono text-foreground">
            {totalExibicao > 0 ? totalExibicao.toLocaleString('pt-BR') : '-'}
          </div>
        </div>
        <div className="bg-background/60 rounded-lg p-2.5 text-center border">
          <div className="text-xs text-muted-foreground mb-0.5">Tempo</div>
          <div className={cn("text-lg font-bold font-mono", isRunning && "text-blue-600")}>
            {formatDuration(elapsedExibicao)}
          </div>
        </div>
      </div>

      {/* Error Display (oculta mensagens técnicas de abort/timeout de signal) */}
      {(() => {
        const ultimoErro = exec.ultimo_erro?.trim();
        const isTechnicalAbort = !!ultimoErro && /signal.*aborted|aborted/i.test(ultimoErro);
        if (!ultimoErro || isTechnicalAbort) return null;

        return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium line-clamp-2">{ultimoErro}</span>
          </div>
        </div>
        );
      })()}

        {/* Running Indicator */}
      {isRunning && (
        <div className="flex items-center justify-center gap-2 text-blue-600 py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Execução em andamento...</span>
        </div>
      )}
    </div>
  );
}

function MonitoringCard({ 
  stats, 
  onExecute, 
  onCancel, 
  onSendSummary,
  isExecuting, 
  isCancelling,
  isSendingSummary,
  optimisticStartAt
}: { 
  stats: MonitoringStats;
  onExecute: () => void;
  onCancel: () => void;
  onSendSummary: () => void;
  isExecuting: boolean;
  isCancelling: boolean;
  isSendingSummary: boolean;
  optimisticStartAt?: number;
}) {
  const Icon = ICONS[stats.icon] || Activity;
  const hasRealProgress =
    (stats.progress ?? 0) > 0 ||
    (stats.currentExecution?.registros_processados ?? 0) > 0 ||
    (stats.currentExecution?.detalhes?.progress?.current ?? 0) > 0;
  const optimisticActive =
    typeof optimisticStartAt === 'number' &&
    !hasRealProgress &&
    (Date.now() - optimisticStartAt) < 120000;
  const displayStatus: MonitoringStatus = optimisticActive ? 'running' : stats.status;
  const statusConfig = STATUS_CONFIG[displayStatus];
  const isRunning = displayStatus === 'running';
  // CORREÇÃO: Permitir executar quando status é 'timeout' (o usuário pode retomar ou reiniciar)
  const canExecute = !isExecuting && !optimisticActive && displayStatus !== 'running';
  const canCancel = displayStatus === 'running' || optimisticActive;
  
  // Verificar se há checkpoint para retomar (next_offset > 0 e status não é running/idle)
  const metadata = stats.config?.metadata;
  const nextOffset = (metadata?.next_offset ?? 0) as number;
  const checkpointPercent = metadata && metadata.total > 0
    ? Math.round(((metadata.next_offset ?? 0) / metadata.total) * 100)
    : 0;
  const hasCheckpoint = nextOffset > 0 &&
    checkpointPercent > 0 &&
    checkpointPercent < 100 &&
    (stats.status === 'timeout' || stats.status === 'failed' || stats.status === 'cancelled');

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isRunning && "ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10",
      stats.status === 'failed' && "ring-1 ring-red-500/30",
      stats.status === 'timeout' && "ring-1 ring-red-500/30",
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl transition-colors",
              statusConfig.bgColor,
            )}>
              <Icon className={cn(
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
                {!stats.config?.ativo && (
                  <Badge variant="secondary" className="text-xs">Desativado</Badge>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={displayStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Execution Details Panel */}
        <ExecutionDetails
          stats={stats}
          forceRunning={optimisticActive}
          forceReset={optimisticActive}
        />

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
            onClick={onExecute}
            disabled={!canExecute}
            variant={hasCheckpoint ? "outline" : "default"}
          >
            {isExecuting || optimisticActive ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
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
            onClick={onCancel}
            disabled={isCancelling || !canCancel}
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={onSendSummary}
                  disabled={isSendingSummary}
                  title="Enviar resumo de hoje"
                >
                  {isSendingSummary ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enviar resumo de hoje (Email/WhatsApp)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

export function MonitoringDashboard() {
  const { user } = useAuth();

  // DJEN Processos: execução 100% no navegador (evita WORKER_LIMIT 546)
  const {
    executar: executarDjenProcessosNoBrowser,
    cancelar: cancelarDjenProcessosNoBrowser,
    isExecutando: isExecutandoDjenProcessosNoBrowser,
    progresso: progressoDjenProcessosBrowser,
  } = useMonitorarDjenProcessosBrowser();

  const { data: userCoordenacao, isLoading: loadingUserCoord } = useQuery({
    queryKey: ['user-coordenacao', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id);

      if (error) throw error;

      const ids = (data || []).map((r: any) => r.coordenacao_id).filter(Boolean);
      if (ids.length !== 1) return "";
      return ids[0];
    },
    enabled: !!user?.id,
  });

  const coordenacaoFiltro =
    !loadingUserCoord && userCoordenacao && userCoordenacao !== ""
      ? userCoordenacao
      : undefined;

  const { 
    monitoringStats, 
    hasRunningJobs, 
    executeMonitoring, 
    cancelMonitoring,
    refetch 
  } = useMonitoringDashboard({ coordenacaoId: coordenacaoFiltro });
  
  const { enviando, enviarResumo } = useEnviarResumoManual();
  
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [optimisticStartByTipo, setOptimisticStartByTipo] = useState<Record<string, number>>({});
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});
  const [confirmResumeOpen, setConfirmResumeOpen] = useState(false);
  const [confirmResumeTipo, setConfirmResumeTipo] = useState<string | null>(null);
  const [confirmReativarOpen, setConfirmReativarOpen] = useState(false);
  const [confirmTipo, setConfirmTipo] = useState<string | null>(null);

  const reativarConfig = async (tipo: string) => {
    const { data: config, error } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, ativo, metadata')
      .eq('tipo', tipo)
      .is('coordenacao_id', null)
      .maybeSingle();

    if (error) throw error;
    if (!config?.id) throw new Error('Configuração não encontrada');

    const currentMeta = (config.metadata as Record<string, any>) || {};
    const { error: updErr } = await supabase
      .from('configuracoes_monitoramento')
      .update({
        ativo: true,
        metadata: {
          ...currentMeta,
          paused_globally: false,
          cancelado: false,
          status: 'idle',
          continuingRun: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    if (updErr) throw updErr;
  };

  const executarAgora = async (tipo: string, options?: { retomar?: boolean }) => {
    // DJEN Processos: sempre browser-only
    if (tipo === 'djen_processos') {
      toast.info('Iniciando DJEN Processos no navegador...');
      void executarDjenProcessosNoBrowser(undefined, undefined, options?.retomar === true)
        .catch((e: any) => {
          toast.error(`Erro no DJEN Processos (browser): ${e?.message || String(e)}`);
        })
        .finally(() => {
          refetch();
        });
      return;
    }

    const result = await executeMonitoring(tipo, options);
    const stats = monitoringStats.find(s => s.tipo === tipo);

    // DJEN Termos usa busca direta - mostrar info ao invés de executar
    if (result?.useDireta) {
      toast.info('DJEN Termos usa busca direta. Use os botões do próprio card no Dashboard.');
      return;
    }
    if (result?.blocked) {
      toast.warning(result.message || 'Aguarde outra execução finalizar');
      return;
    }
    if (result?.paused) {
      toast.warning('Monitoramento está pausado/desativado. Reative para executar.');
      return;
    }
    if (result?.success === false && result?.error) {
      toast.error(`Erro: ${result.error}`);
      return;
    }

    toast.info(`${stats?.nome || tipo} iniciado! Acompanhe o progresso no painel.`);
  };

  const handleExecute = async (tipo: string, options?: { retomar?: boolean }) => {
    // Se estiver desativado/pausado, pedir confirmação para reativar
    try {
      const { data: cfg, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('ativo, metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      if (error) throw error;
      const md = (cfg?.metadata as Record<string, any>) || {};
      const isPaused = cfg?.ativo === false || md.paused_globally === true;
      if (isPaused) {
        setConfirmTipo(tipo);
        setConfirmReativarOpen(true);
        return;
      }

      if (!options?.retomar) {
        const stats = monitoringStats.find(s => s.tipo === tipo);
        const metadata = stats?.config?.metadata as Record<string, any> | undefined;
        const nextOffset = Number(metadata?.next_offset || 0);
        const total = Number(metadata?.total || 0);
        const checkpointPercent = total > 0 ? Math.round((nextOffset / total) * 100) : 0;
        const hasCheckpoint = nextOffset > 0 && checkpointPercent > 0 && checkpointPercent < 100;
        if (hasCheckpoint) {
          setConfirmResumeTipo(tipo);
          setConfirmResumeOpen(true);
          return;
        }
      }

      setExecuting(prev => ({ ...prev, [tipo]: true }));
      setOptimisticStartByTipo(prev => ({ ...prev, [tipo]: Date.now() }));
      setTimeout(() => {
        setOptimisticStartByTipo(prev => {
          if (!prev[tipo]) return prev;
          const next = { ...prev };
          delete next[tipo];
          return next;
        });
      }, 20000);

      // DJEN Processos: iniciar imediatamente no navegador (sem Edge Function)
      if (tipo === 'djen_processos') {
        toast.info('Iniciando DJEN Processos no navegador...');
        void executarDjenProcessosNoBrowser(undefined, undefined, options?.retomar === true)
          .catch((e: any) => {
            toast.error(`Erro no DJEN Processos (browser): ${e?.message || String(e)}`);
          })
          .finally(() => {
            // Garante refresh do painel assim que começarem a chegar checkpoints
            refetch();
          });
        return;
      }

      await executarAgora(tipo, options);
    } catch (error: any) {
      toast.error(`Erro ao iniciar: ${error.message}`);
    } finally {
      setExecuting(prev => ({ ...prev, [tipo]: false }));
    }
  };

  const handleCancel = async (tipo: string) => {
    setCancelling(prev => ({ ...prev, [tipo]: true }));
    try {
      // Se for DJEN Processos browser-only, cancela local + marca no banco
      if (tipo === 'djen_processos' && isExecutandoDjenProcessosNoBrowser) {
        cancelarDjenProcessosNoBrowser();
        await cancelMonitoring(tipo);
        toast.success('Cancelamento solicitado!');
        return;
      }
      await cancelMonitoring(tipo);
      toast.success('Execução cancelada!');
    } catch (error: any) {
      toast.error(`Erro ao cancelar: ${error.message}`);
    } finally {
      setCancelling(prev => ({ ...prev, [tipo]: false }));
    }
  };

  // Mesclar progresso browser-only do DJEN Processos nos stats
  const monitoringStatsEnhanced = monitoringStats.map((s) => {
    if (s.tipo !== 'djen_processos') return s;
    // Se execução local ativa, sobrescrever status/progress
    if (progressoDjenProcessosBrowser.status === 'executando') {
      // Usar startedAt do progresso local se disponível; senão, usar timestamp atual
      const browserStartedAt = progressoDjenProcessosBrowser.startedAt || s.currentExecution?.iniciado_em || new Date().toISOString();
      
      const browserExec: MonitoringExecution = {
        id: 'browser-djen-processos',
        tipo: 'djen_processos',
        status: 'executando',
        job_name: 'browser-monitorar-djen-processos',
        iniciado_em: browserStartedAt,
        finalizado_em: null,
        lotes_processados: progressoDjenProcessosBrowser.currentTribunal,
        total_lotes: progressoDjenProcessosBrowser.totalTribunais,
        registros_processados: progressoDjenProcessosBrowser.totalPublicacoesAnalisadas,
        registros_encontrados: progressoDjenProcessosBrowser.novas,
        erros: 0,
        ultimo_erro: null,
        retry_count: 0,
        detalhes: {
          ...(s.currentExecution?.detalhes || {}),
          browser_execution: true,
          tribunal_atual: progressoDjenProcessosBrowser.tribunalAtual,
          progress: {
            current: progressoDjenProcessosBrowser.currentTribunal,
            total: progressoDjenProcessosBrowser.totalTribunais,
            percentage: progressoDjenProcessosBrowser.percentage,
          },
        },
      };

      return {
        ...s,
        status: 'running' as const,
        progress: progressoDjenProcessosBrowser.percentage,
        // Importante: garantir currentExecution != null para o painel de detalhes
        // calcular isRunning corretamente (evita card “Executando” sem progresso visível).
        currentExecution: s.currentExecution ? {
          ...s.currentExecution,
          status: 'executando',
          iniciado_em: browserStartedAt,
          finalizado_em: null,
          registros_processados: progressoDjenProcessosBrowser.totalPublicacoesAnalisadas,
          registros_encontrados: progressoDjenProcessosBrowser.novas,
          detalhes: {
            ...(s.currentExecution.detalhes || {}),
            browser_execution: true,
            tribunal_atual: progressoDjenProcessosBrowser.tribunalAtual,
            progress: {
              current: progressoDjenProcessosBrowser.currentTribunal,
              total: progressoDjenProcessosBrowser.totalTribunais,
              percentage: progressoDjenProcessosBrowser.percentage,
            },
          },
        } : browserExec,
      };
    }
    return s;
  });

  // Summary Stats
  const totalToday = monitoringStatsEnhanced.reduce((acc, s) => acc + s.todayStats.executions, 0);
  const successToday = monitoringStatsEnhanced.reduce((acc, s) => acc + s.todayStats.successful, 0);
  const novasToday = monitoringStatsEnhanced.reduce((acc, s) => acc + (s.todayStats.novas ?? 0), 0);
  const descartadasToday = monitoringStatsEnhanced.reduce((acc, s) => acc + (s.todayStats.descartadas ?? 0), 0);
  const runningCount = monitoringStatsEnhanced.filter(s => s.status === 'running').length
    + (isExecutandoDjenProcessosNoBrowser ? 1 : 0);

  return (
    <div className="space-y-6">
      <AlertDialog open={confirmResumeOpen} onOpenChange={setConfirmResumeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Execução anterior encontrada</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja continuar de onde parou ou reiniciar do zero?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmResumeTipo(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmResumeTipo) return;
                const tipo = confirmResumeTipo;
                try {
                  setExecuting(prev => ({ ...prev, [tipo]: true }));
                  setOptimisticStartByTipo(prev => ({ ...prev, [tipo]: Date.now() }));
                  setTimeout(() => {
                    setOptimisticStartByTipo(prev => {
                      if (!prev[tipo]) return prev;
                      const next = { ...prev };
                      delete next[tipo];
                      return next;
                    });
                  }, 20000);
                  setConfirmResumeOpen(false);
                  setConfirmResumeTipo(null);
                  await executarAgora(tipo, { retomar: true });
                } finally {
                  setExecuting(prev => ({ ...prev, [tipo]: false }));
                }
              }}
            >
              Continuar de onde parou
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmResumeTipo) return;
                const tipo = confirmResumeTipo;
                try {
                  setExecuting(prev => ({ ...prev, [tipo]: true }));
                  setOptimisticStartByTipo(prev => ({ ...prev, [tipo]: Date.now() }));
                  setTimeout(() => {
                    setOptimisticStartByTipo(prev => {
                      if (!prev[tipo]) return prev;
                      const next = { ...prev };
                      delete next[tipo];
                      return next;
                    });
                  }, 20000);
                  setConfirmResumeOpen(false);
                  setConfirmResumeTipo(null);
                  await executarAgora(tipo, { retomar: false });
                } finally {
                  setExecuting(prev => ({ ...prev, [tipo]: false }));
                }
              }}
            >
              Reiniciar do zero
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmReativarOpen} onOpenChange={setConfirmReativarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Monitoramento está desativado/pausado</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTipo ? `"${monitoringStats.find(s => s.tipo === confirmTipo)?.nome || confirmTipo}" está desativado ou com pausa global. Deseja reativar e executar agora?` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmTipo(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmTipo) return;
                const tipo = confirmTipo;
                try {
                  setExecuting(prev => ({ ...prev, [tipo]: true }));
                  setOptimisticStartByTipo(prev => ({ ...prev, [tipo]: Date.now() }));
                  setTimeout(() => {
                    setOptimisticStartByTipo(prev => {
                      if (!prev[tipo]) return prev;
                      const next = { ...prev };
                      delete next[tipo];
                      return next;
                    });
                  }, 20000);
                  await reativarConfig(tipo);
                  setConfirmTipo(null);
                  toast.success('Reativado. Iniciando execução...');
                  await executarAgora(tipo);
                } catch (e: any) {
                  toast.error(`Não foi possível reativar: ${e?.message || 'erro desconhecido'}`);
                } finally {
                  setExecuting(prev => ({ ...prev, [tipo]: false }));
                  setConfirmReativarOpen(false);
                }
              }}
            >
              Reativar e executar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalToday}</div>
                <div className="text-xs text-muted-foreground">Execuções</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{successToday}</div>
                <div className="text-xs text-muted-foreground">Concluídas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{novasToday.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Novas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <MinusCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{descartadasToday.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground">Descartadas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-2 transition-all",
          runningCount > 0 
            ? "bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/10" 
            : "border-border"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                runningCount > 0 ? "bg-blue-500/20" : "bg-muted"
              )}>
                {runningCount > 0 ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className={cn(
                  "text-2xl font-bold",
                  runningCount > 0 ? "text-blue-600" : "text-muted-foreground"
                )}>
                  {runningCount}
                </div>
                <div className="text-xs text-muted-foreground">Em execução</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Cards Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monitoringStatsEnhanced.map((stats) => {
          if (stats.tipo === 'djen') {
            return (
              <div key={stats.tipo} className="space-y-4">
                <DjenTermosDashboardCard
                  stats={stats}
                  onAfterMutation={refetch}
                />
              </div>
            );
          }

          return (
            <MonitoringCard
              key={stats.tipo}
              stats={stats}
              onExecute={() => handleExecute(stats.tipo)}
              onCancel={() => handleCancel(stats.tipo)}
              onSendSummary={() => enviarResumo(stats.tipo as any)}
              isExecuting={executing[stats.tipo] || false}
              isCancelling={cancelling[stats.tipo] || false}
              isSendingSummary={enviando[stats.tipo] || false}
              optimisticStartAt={optimisticStartByTipo[stats.tipo]}
            />
          );
        })}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
