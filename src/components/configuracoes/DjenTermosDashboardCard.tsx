import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Loader2, Newspaper, PlayCircle, StopCircle, Trash2, Mail,
  CheckCircle2, XCircle, Clock, TrendingUp, Zap, MinusCircle,
  RotateCcw, AlertCircle, Skull, FlaskConical, CalendarIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MonitoringStats, MonitoringStatus } from "@/hooks/useMonitoringDashboard";
import { formatDuration, formatDateTime } from "@/hooks/useMonitoringDashboard";
import { cn } from "@/lib/utils";
import { useBuscaDjenDireta } from "@/hooks/useBuscaDjenDireta";
import { withTimeout } from "@/utils/withTimeout";
import { useEnviarResumoManual } from "@/hooks/useEnviarResumoManual";
import { DjenAdvogadoDiagnosticoDialog } from "@/components/djen/DjenAdvogadoDiagnosticoDialog";
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
import { DjenExecucoesHistoricoDialog } from "@/components/configuracoes/DjenExecucoesHistoricoDialog";

type Props = {
  stats: MonitoringStats;
  isExecuting: boolean;
  isCancelling: boolean;
  onReativarConfig: (tipo: string) => Promise<void>;
  onAfterMutation: () => void;
};

const STATUS_CONFIG: Record<MonitoringStatus | 'cancelado', { 
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
  cancelado: { 
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

// Removido FaseIndicator - interface simplificada

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
  isExecuting: _isExecuting,
  isCancelling: _isCancelling,
  onReativarConfig,
  onAfterMutation,
}: Props) {
  const {
    progresso,
    executarMonitoramento,
    cancelar,
    limparEstado,
    isExecutando: isLoopRunning,
  } = useBuscaDjenDireta();

  const { enviando, enviarResumo } = useEnviarResumoManual();
  const [limpando, setLimpando] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [forcandoCancelamento, setForcandoCancelamento] = useState(false);
  const [execucaoOrfaNoBanco, setExecucaoOrfaNoBanco] = useState<string | null>(null);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  // Intervalo de datas para busca personalizada
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  const ORFA_GHOST_ID = "__ghost__";

  const BR_TZ = 'America/Sao_Paulo';
  const ymdInTimeZone = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  };
  const hojeBrasiliaYmd = ymdInTimeZone(new Date(), BR_TZ);

  const md = (stats.config?.metadata as Record<string, any> | null) || {};
  const isPaused = stats.config?.ativo === false || md.paused_globally === true;

  // Detectar checkpoint válido do localStorage
  // IMPORTANTE: não memoizar apenas por status.
  // O progresso pode avançar sem troca de status e a UI ficava lendo snapshot antigo,
  // gerando inconsistências (ex: 76% no card vs 1% no botão Continuar).
  const savedState = (() => {
    try {
      const saved = localStorage.getItem('djen-direta-progresso');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Expirar após 12 horas
      if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  })();

  const checkpoint = savedState?.checkpoint;
  // Chave estável do run:
  // - se houve dataOverride, ela define o recorte e deve ser usada para validação
  // - senão, usamos o próprio checkpoint.data (permite retomar mesmo no dia seguinte)
  // - fallback: hoje em Brasília
  const runKey = (savedState as any)?.dataOverrideYmd ?? checkpoint?.data ?? hojeBrasiliaYmd;
  const hasCheckpoint = !!(checkpoint && checkpoint.data === runKey && checkpoint.indice > 0);
  const checkpointTotal =
    typeof (savedState as any)?.totalMonitoramentos === 'number'
      ? (savedState as any).totalMonitoramentos
      : (md.total ?? 0);
  const checkpointPercent = hasCheckpoint && checkpoint.indice > 0 && checkpointTotal > 0
    ? Math.round((checkpoint.indice / checkpointTotal) * 100)
    : 0;

  // Status baseado no loop local (fonte de verdade)
  // Usar isExecutando do hook para evitar “sumir” botão de cancelar por oscilação momentânea do status.
  const localRunActive = isLoopRunning;
  const localCancelled = progresso.status === 'cancelado';
  const localCompleted = progresso.status === 'concluido';

  const backendTotal = md.total ?? 0;
  const backendCurrent = md.current ?? 0;
  const backendPercent = backendTotal > 0 ? Math.round((backendCurrent / backendTotal) * 100) : 0;

  // Se o usuário saiu/voltou, a fonte do backend pode estar defasada.
  // Para NÃO regredir (ex: 76% → 25%), comparamos apenas quando é o MESMO run_key.
  const savedTotal = (savedState as any)?.totalMonitoramentos ?? 0;
  const savedCurrent = (savedState as any)?.checkpoint?.indice ?? (savedState as any)?.monitoramentoAtual ?? 0;
  const backendRunKey = (md.run_key as string | undefined) ?? (md.data_override as string | undefined);
  const snapshotRunKey = (savedState as any)?.checkpoint?.data ?? (savedState as any)?.dataOverrideYmd;
  const sameRun = !!(backendRunKey && snapshotRunKey && backendRunKey === snapshotRunKey);

  // Prioridade de status:
  // 1) Execução local ativa (browser)
  // 2) Flags/metadata do backend (timeout/stale/cancelado) — evita “Concluído 93%”
  // 3) Status local finalizado (concluido/cancelado/erro)
  // 4) Fallback: stats.status (calculado pelo dashboard)
  const backendStatus = (md.status as string | undefined) ?? undefined;
  const backendIsTimeout = backendStatus === 'timeout' || backendStatus === 'stale' || md.last_stop_reason === 'stale';
  const backendIsCancelled = backendStatus === 'cancelado' || md.cancelado === true;

  const currentStatus: MonitoringStatus | 'cancelado' = localRunActive
    ? 'running'
    : backendIsCancelled
      ? 'cancelado'
      : backendIsTimeout
        ? 'timeout'
        : localCancelled
          ? 'cancelado'
          : localCompleted
            ? 'completed'
            : progresso.status === 'erro'
              ? 'failed'
              : stats.status;

  const isRunning = currentStatus === 'running';

  // Continuar via backend quando o localStorage foi perdido, mas o metadata tem current/total.
  const backendHasCheckpoint =
    !localRunActive &&
    !isRunning &&
    backendTotal > 0 &&
    backendCurrent > 0 &&
    backendCurrent < backendTotal &&
    (backendIsTimeout || backendStatus === 'erro' || backendStatus === 'failed' || backendStatus === 'cancelado');

  const canResume = hasCheckpoint || backendHasCheckpoint;
  const resumePercent = hasCheckpoint ? checkpointPercent : backendPercent;

  // Regra de ouro para não mostrar números conflitantes:
  // 1) Se o loop local está ativo, usar sempre o progresso local.
  // 2) Se NÃO está rodando e há checkpoint válido, usar SEMPRE o checkpoint (é o que o botão Continuar realmente retoma).
  // 3) Se está rodando no backend (outra aba/dispositivo), usar backend; se o backend não tiver total, cair para snapshot.
  // 4) Caso geral: usar backend.
  const effectiveTotal = localRunActive
    ? (progresso.totalMonitoramentos ?? 0)
    : (!isRunning && hasCheckpoint)
      ? (savedTotal || backendTotal)
      : (isRunning && !localRunActive)
        ? (backendTotal || savedTotal)
        : backendTotal;

  const effectiveCurrent = localRunActive
    ? (progresso.monitoramentoAtual ?? 0)
    : (!isRunning && hasCheckpoint)
      ? (checkpoint?.indice ?? savedCurrent)
      : (isRunning && !localRunActive)
        ? (sameRun ? Math.max(backendCurrent, savedCurrent) : (backendCurrent || savedCurrent))
        : backendCurrent;

  const percent = useMemo(() => {
    if (effectiveTotal <= 0) return 0;
    const calc = Math.round((effectiveCurrent / effectiveTotal) * 100);
    return Math.min(100, calc);
  }, [effectiveCurrent, effectiveTotal]);

  // Tipos de travamento:
  // 1) Órfã real: existe execucao_agendada 'executando' mas o loop local não está ativo
  // 2) Ghost: UI aponta 'executando' mas NÃO existe execução ativa no banco (metadata travado)
  const isGhostOrfa = execucaoOrfaNoBanco === ORFA_GHOST_ID;
  const isOrfaReal = !!execucaoOrfaNoBanco && execucaoOrfaNoBanco !== ORFA_GHOST_ID;
  const hasOrfa = isGhostOrfa || isOrfaReal;

  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.idle;

  // Após terminar uma execução local, forçar refresh do dashboard para pegar contagens deduplicadas do banco
  const refreshedAfterFinishRef = useRef(false);
  useEffect(() => {
    if (localRunActive) {
      refreshedAfterFinishRef.current = false;
      return;
    }

    const finishedLocally = localCompleted || localCancelled || progresso.status === 'erro';
    if (finishedLocally && !refreshedAfterFinishRef.current) {
      refreshedAfterFinishRef.current = true;
      onAfterMutation();
    }
  }, [localRunActive, localCompleted, localCancelled, progresso.status, onAfterMutation]);

  // ============================================================================
  // DETECÇÃO DE ÓRFÃ + AUTO-RESTART
  // - Se execução órfã detectada: expor botão caveira (sem auto-limpeza)
  // - Se timeout recente (< 5 min): auto-restart
  // ============================================================================
  const autoRestartTriedRef = useRef(false);

  // Converte Date para YYYY-MM-DD (fuso horário local, usando meio-dia para evitar problemas de timezone)
  // NOTA: definido aqui (antes do useCallback) para poder ser usado no handleExecutarInternal
  const getDataYmd = useCallback((date?: Date): string | undefined => {
    if (!date) return undefined;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return format(d, 'yyyy-MM-dd');
  }, []);

  // Helper interno para disparar execução (usado pelo auto-restart)
  const handleExecutarInternal = useCallback(async (retomar: boolean) => {
    if (isPaused) {
      await onReativarConfig('djen');
    }
    
    const dataInicioYmd = dataInicio ? getDataYmd(dataInicio) : undefined;
    const dataFimYmd = dataFim ? getDataYmd(dataFim) : undefined;
    
    await executarMonitoramento(undefined, retomar, dataInicioYmd, dataFimYmd);
    onAfterMutation();
  }, [isPaused, onReativarConfig, dataInicio, dataFim, executarMonitoramento, onAfterMutation, getDataYmd]);

  useEffect(() => {
    let isMounted = true;
    
    const verificarExecucoesOrfas = async () => {
      // Se há execução local ativa, não há órfã
      if (localRunActive) {
        setExecucaoOrfaNoBanco(null);
        return;
      }
      
      try {
        // Buscar execução DJEN mais recente (executando ou timeout)
        const { data: execucaoRecente } = await supabase
          .from('execucoes_agendadas')
          .select('id, status, iniciado_em, finalizado_em')
          .eq('tipo', 'djen')
          .in('status', ['executando', 'timeout'])
          .order('iniciado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!isMounted) return;
        
        // CASO 1: Execução "executando" no banco mas sem loop local = órfã
        if (execucaoRecente?.status === 'executando' && !execucaoRecente.finalizado_em) {
          const iniciado = new Date(execucaoRecente.iniciado_em);
          const agora = new Date();
          const minutosDecorridos = (agora.getTime() - iniciado.getTime()) / 60000;
          
          if (minutosDecorridos >= 2) {
            console.log(`[DJEN] Execução órfã detectada: ${execucaoRecente.id} (${Math.round(minutosDecorridos)}min)`);
            setExecucaoOrfaNoBanco(execucaoRecente.id);
            
            // AUTO-RESTART: Se órfã há mais de 5 min, tentar retomar automaticamente
            if (minutosDecorridos >= 5 && !autoRestartTriedRef.current) {
              autoRestartTriedRef.current = true;
              console.log('[DJEN] Órfã antiga - tentando auto-restart...');
              
              // Verificar se há checkpoint válido para retomar
              const hasProgress = backendTotal > 0 && backendCurrent > 0 && backendCurrent < backendTotal;
              
              if (hasProgress) {
                toast.info(`Retomando DJEN do monitoramento ${backendCurrent}/${backendTotal}...`);
                handleExecutarInternal(true);
              } else {
                toast.info('Reiniciando DJEN do zero...');
                handleExecutarInternal(false);
              }
              return;
            }
            
            // NÃO fazer auto-limpeza silenciosa - apenas expor botão caveira
          } else {
            setExecucaoOrfaNoBanco(null);
          }
          return;
        }
        
        // CASO 2: Timeout recente → auto-restart
        if (execucaoRecente?.status === 'timeout' && execucaoRecente.finalizado_em) {
          const finalizadoEm = new Date(execucaoRecente.finalizado_em).getTime();
          const agora = Date.now();
          const minutosDesdeTimeout = (agora - finalizadoEm) / 60000;
          
          // Auto-restart se timeout foi há menos de 5 minutos e ainda não tentamos
          if (minutosDesdeTimeout < 5 && !autoRestartTriedRef.current) {
            autoRestartTriedRef.current = true;
            console.log(`[DJEN] Timeout recente (${Math.round(minutosDesdeTimeout)}min atrás) - auto-reiniciando...`);
            
            const hasProgress = backendTotal > 0 && backendCurrent > 0 && backendCurrent < backendTotal;
            
            if (hasProgress) {
              toast.info(`Retomando DJEN do monitoramento ${backendCurrent}/${backendTotal}...`);
              handleExecutarInternal(true);
            } else {
              toast.info('Reiniciando DJEN do zero...');
              handleExecutarInternal(false);
            }
            return;
          }
          
          setExecucaoOrfaNoBanco(null);
          return;
        }
        
        // CASO 3: UI em "executando" mas sem execução no banco = ghost
        if (isRunning && !execucaoRecente) {
          const startedAt = stats.currentExecution?.iniciado_em;
          const base = startedAt ? new Date(startedAt) : null;
          const minutosDecorridos = base ? (Date.now() - base.getTime()) / 60000 : 999;

          if (minutosDecorridos >= 2) {
            setExecucaoOrfaNoBanco(ORFA_GHOST_ID);
            // NÃO fazer auto-limpeza - apenas expor botão caveira
          } else {
            setExecucaoOrfaNoBanco(null);
          }
        } else {
          setExecucaoOrfaNoBanco(null);
        }
      } catch (e) {
        console.warn('[DJEN] Erro ao verificar execuções órfãs:', e);
      }
    };

    // Verificar imediatamente e a cada 5 segundos
    verificarExecucoesOrfas();
    const interval = setInterval(verificarExecucoesOrfas, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [localRunActive, isRunning, stats.currentExecution?.iniciado_em, backendTotal, backendCurrent, handleExecutarInternal]);

  // Retorna o intervalo {dataInicioYmd, dataFimYmd} para passar ao hook
  const getIntervalo = (): { dataInicioYmd?: string; dataFimYmd?: string } => {
    if (dataInicio && dataFim) {
      return {
        dataInicioYmd: getDataYmd(dataInicio),
        dataFimYmd: getDataYmd(dataFim),
      };
    }
    // Se só dataFim foi definida (ex: "buscar até dia X"), usa ela como início e fim
    if (dataFim && !dataInicio) {
      const ymd = getDataYmd(dataFim);
      return { dataInicioYmd: ymd, dataFimYmd: ymd };
    }
    // Se só dataInicio foi definida, buscar de dataInicio até hoje
    if (dataInicio && !dataFim) {
      return { dataInicioYmd: getDataYmd(dataInicio), dataFimYmd: getDataYmd(new Date()) };
    }
    // Nenhuma data selecionada: comportamento padrão (últimos 3 dias)
    return {};
  };

  const handleExecutar = async () => {
    if (isRunning) return;

    // Verificar se há checkpoint
    if (canResume) {
      setShowResumeDialog(true);
      return;
    }

    try {
      if (isPaused) {
        await onReativarConfig('djen');
      }
      const intervalo = getIntervalo();
      await executarMonitoramento(undefined, false, intervalo.dataInicioYmd, intervalo.dataFimYmd);
      if (intervalo.dataInicioYmd && intervalo.dataFimYmd) {
        toast.info(`DJEN Termos iniciado: ${intervalo.dataInicioYmd} → ${intervalo.dataFimYmd}`);
      } else {
        toast.info('DJEN Termos iniciado (últimos 3 dias).');
      }
    } catch (e: any) {
      toast.error(`Erro ao iniciar DJEN: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleRetomar = async () => {
    setShowResumeDialog(false);
    try {
      if (isPaused) {
        await onReativarConfig('djen');
      }
      // Mantém o mesmo recorte de data (se havia) ao retomar.
      const intervalo = getIntervalo();
      const savedDataInicio = (savedState as any)?.dataInicioYmd;
      const savedDataFim = (savedState as any)?.dataFimYmd ?? (savedState as any)?.dataOverrideYmd;

      const backendDataInicio = typeof md.data_inicio === 'string' ? md.data_inicio : undefined;
      const backendDataFim = typeof md.data_fim === 'string'
        ? md.data_fim
        : (typeof md.data_override === 'string' ? md.data_override : undefined);

      await executarMonitoramento(
        undefined, 
        true, 
        intervalo.dataInicioYmd ?? savedDataInicio ?? backendDataInicio,
        intervalo.dataFimYmd ?? savedDataFim ?? backendDataFim
      );
      toast.info('DJEN Termos retomando de onde parou...');
    } catch (e: any) {
      toast.error(`Erro ao retomar: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleExecutarDoZero = async () => {
    setShowResumeDialog(false);
    limparEstado();
    try {
      if (isPaused) {
        await onReativarConfig('djen');
      }
      const intervalo = getIntervalo();
      await executarMonitoramento(undefined, false, intervalo.dataInicioYmd, intervalo.dataFimYmd);
      if (intervalo.dataInicioYmd && intervalo.dataFimYmd) {
        toast.info(`DJEN Termos iniciado do zero: ${intervalo.dataInicioYmd} → ${intervalo.dataFimYmd}`);
      } else {
        toast.info('DJEN Termos iniciado do zero.');
      }
    } catch (e: any) {
      toast.error(`Erro ao iniciar: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleCancelar = () => {
    try {
      cancelar();
      toast.success('Cancelamento solicitado.');
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e?.message || 'erro desconhecido'}`);
    }
  };

  // FORÇAR CANCELAMENTO: para execuções órfãs (rodando no banco mas não no frontend)
  const handleForceCancelar = async () => {
    setForcandoCancelamento(true);
    try {
      // SEMPRE forçar reset do estado local primeiro (aborta qualquer loop/request pendente)
      limparEstado();

      // FORÇA: Cancelar TODAS as execuções DJEN com status='executando', 
      // independente de finalizado_em (para limpar execuções inconsistentes)
      const { data: execucoesAtivas } = await supabase
        .from('execucoes_agendadas')
        .select('id')
        .eq('tipo', 'djen')
        .eq('status', 'executando');

      if (execucoesAtivas && execucoesAtivas.length > 0) {
        const ids = execucoesAtivas.map(e => e.id);
        await supabase
          .from('execucoes_agendadas')
          .update({
            status: 'cancelado',
            finalizado_em: new Date().toISOString(),
            ultimo_erro: 'Cancelamento forçado pelo usuário (kill switch)',
          })
          .in('id', ids);
        
        console.log(`[DJEN] Forçou cancelamento de ${ids.length} execução(ões):`, ids);
      }

      // Limpar/ajustar metadata da config também
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(md || {}),
            status: 'cancelado',
            cancelado: true,
            continuingRun: false,
            cancel_requested: false,
            last_stop_reason: 'force_cancel_kill_switch',
            last_stop_at: new Date().toISOString(),
            last_error: 'Cancelamento forçado pelo usuário (kill switch)',
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      setExecucaoOrfaNoBanco(null);
      toast.success('Execução cancelada forçadamente! Você já pode iniciar uma nova.');
      onAfterMutation();
    } catch (e: any) {
      toast.error(`Erro ao forçar cancelamento: ${e?.message}`);
    } finally {
      setForcandoCancelamento(false);
    }
  };

  // Cancelar via flag no banco (funciona até quando o loop está em outra aba/dispositivo)
  const handleSolicitarCancelamento = async () => {
    try {
      // Se o loop local está ativo, cancela cooperativamente
      if (localRunActive) {
        handleCancelar();
        return;
      }

      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...(md || {}),
            cancel_requested: true,
            last_stop_reason: 'cancel_requested',
          },
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);

      toast.success('Cancelamento solicitado. Aguarde alguns segundos.');
      onAfterMutation();
    } catch (e: any) {
      toast.error(`Erro ao solicitar cancelamento: ${e?.message || 'erro desconhecido'}`);
    }
  };

  const handleLimparHoje = async () => {
    if (!confirm('Isso vai limpar TODAS as publicações DJEN capturadas hoje. Deseja continuar?')) return;

    setLimpando(true);
    try {
      if (localRunActive) {
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

  // Timeout é estado final (não está executando) — deve permitir nova execução.
  // Porém, se detectamos órfã/ghost, bloqueamos nova execução até o usuário limpar/cancelar.
  const canExecute = !isRunning && !limpando && !forcandoCancelamento && !hasOrfa;
  const canCancel = localRunActive && isRunning;
  // Para DJEN Termos (busca direta), se detectamos execução órfã/ghost,
  // o botão correto é o de *forçar cancelamento*, pois não há loop ativo para consumir cancel_requested.
  const canRequestCancel = !localRunActive && isRunning && !hasOrfa;
  // Mostrar caveira sempre que houver órfã/ghost detectada, mesmo se o status já virou timeout.
  // Pedido do usuário: manter botão de caveira sempre disponível como “kill switch”.
  const showForceCancel = true;

  const processados = effectiveCurrent;
  const total = effectiveTotal;
  
  // CORREÇÃO: usar contadores locais APENAS durante a execução.
  // Após finalizar (concluído/timeout/cancelado), usar SEMPRE o valor do banco (deduplicado via RPC).
  const useLocalCounters = localRunActive;
  const encontrados = useLocalCounters && progresso.publicacoesNovas > 0
    ? progresso.publicacoesNovas
    : (stats.todayStats.found ?? 0);
  const descartadas = useLocalCounters && progresso.publicacoesDescartadas > 0
    ? progresso.publicacoesDescartadas
    : (stats.todayStats.descartadas ?? 0);

  // Progresso exibido: se concluído, garantir 100% (evita “Concluído 93%”).
  const percentDisplay = currentStatus === 'completed' ? 100 : percent;

  const tempoLocal = progresso.tempoDecorrido ?? 0;
  const metadataDuracao = md.duracao_s ?? 0;
  
  // Ao sair e voltar, o loop local pode não estar ativo, mas o hook reidrata `tempoInicio`
  // e continua atualizando `tempoDecorrido`. Preferir `tempoLocal` sempre que estivermos
  // exibindo uma execução como "executando".
  const tempoSegundos = (progresso.status === 'executando' && tempoLocal > 0)
    ? tempoLocal
    : localRunActive
      ? tempoLocal
      : (tempoLocal > 0 && (localCompleted || localCancelled))
        ? tempoLocal
        : (metadataDuracao > 0 ? metadataDuracao : 0);
  
  const tempoFormatado = tempoSegundos > 0 
    ? formatDuration(tempoSegundos) 
    : (stats.elapsedSeconds > 0 ? formatDuration(stats.elapsedSeconds) : '-');

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all duration-300",
        isRunning && "ring-2 ring-primary/30 shadow-lg shadow-primary/10",
        currentStatus === 'failed' && "ring-1 ring-destructive/30",
        currentStatus === 'cancelado' && "ring-1 ring-accent/30",
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
            <Badge 
              variant="outline" 
              className={cn("gap-1.5 font-medium", statusConfig.color, statusConfig.bgColor, statusConfig.borderColor)}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progresso simplificado */}
          {/*
            IMPORTANTE:
            Ao sair e voltar para a tela, o dashboard pode continuar mostrando `isRunning`
            com base no backend (execucoes_agendadas/metadata), mas o progresso local do
            hook (progresso.*) não estará ativo/atualizado. Isso causava o bloco "0/0".
            Para evitar isso, priorizamos:
            1) progresso local (quando ativo)
            2) snapshot salvo no localStorage (último estado conhecido)
            3) fallback do backend (md.current/md.total)
          */}
          {(() => {
            const snapshotTotal = typeof (savedState as any)?.totalMonitoramentos === 'number'
              ? (savedState as any).totalMonitoramentos
              : 0;
            const snapshotCurrent = typeof (savedState as any)?.monitoramentoAtual === 'number'
              ? (savedState as any).monitoramentoAtual
              : 0;
            const snapshotMensagem = typeof (savedState as any)?.mensagem === 'string'
              ? (savedState as any).mensagem
              : '';
            const snapshotTermo = typeof (savedState as any)?.termoAtual === 'string'
              ? (savedState as any).termoAtual
              : undefined;
            // Também buscar termoAtual do metadata do backend (persistido durante execução)
            const backendTermo = typeof md.termoAtual === 'string' ? md.termoAtual : undefined;

            // Termo reidratado pelo hook na remontagem (quando há execução ativa no banco)
            const rehydratedTermo = typeof progresso.termoAtual === 'string'
              ? progresso.termoAtual
              : undefined;

            const topTotal = localRunActive
              ? (progresso.totalMonitoramentos ?? 0)
              : (snapshotTotal || effectiveTotal || 0);
            const topCurrent = localRunActive
              ? (progresso.monitoramentoAtual ?? 0)
              : Math.max(snapshotCurrent, effectiveCurrent || 0);
            const topMensagem = localRunActive
              ? (progresso.mensagem || 'Processando...')
              : (snapshotMensagem || (topTotal > 0 ? `Processando: ${topCurrent} de ${topTotal}` : 'Processando...'));
            // Prioridade: loop local > rehydrated (hook) > snapshot > backend
            const topTermo = localRunActive
              ? progresso.termoAtual
              : (rehydratedTermo || snapshotTermo || backendTermo);

            const topPercent = topTotal > 0
              ? Math.min(100, Math.round((topCurrent / topTotal) * 100))
              : percentDisplay;

            const canShowTop = isRunning && topTotal > 0 && topCurrent > 0;

            return (
              <>
                {canShowTop && (
                  <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{topMensagem}</span>
                      <span className="text-muted-foreground">
                        {topCurrent}/{topTotal}
                      </span>
                    </div>
                    <Progress value={topPercent} className="h-2" />
                    {topTermo && (
                      <div className="text-xs text-muted-foreground truncate">
                        Buscando: {topTermo}
                      </div>
                    )}
                  </div>
                )}

                {/*
                  Execução "rodando" no backend, mas sem loop local ativo E sem snapshot suficiente.
                  Nesse cenário não temos como saber o termo atual de forma confiável.
                */}
                {isRunning && !localRunActive && !canShowTop && (
                  <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            Execução em andamento, mas esta aba não está executando
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Se ficou travado/"órfão", use o botão da caveira (cancelamento forçado) e então execute/retome.
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {effectiveCurrent}/{effectiveTotal || '-'}
                      </span>
                    </div>
                    <Progress value={percentDisplay} className="h-2" />
                  </div>
                )}
              </>
            );
          })()}

          {/* Execution Details Panel */}
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
                  {`${percentDisplay}%`}
                </span>
              </div>
              <Progress 
                value={percentDisplay} 
                className={cn("h-2.5", isRunning && "animate-pulse")}
              />
              {isRunning && localRunActive && progresso.mensagem && (
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
                <div className="text-xs text-muted-foreground mb-0.5">Publicações</div>
                <div className="text-lg font-bold font-mono text-green-600">
                  {encontrados.toLocaleString('pt-BR')}
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
            
            {/* Progresso simples */}

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

          {/* Date Picker + Action Buttons */}
          <div className="flex flex-col gap-2">
            {/* Seletor de intervalo de datas - só mostra se não está executando */}
            {!isRunning && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio 
                          ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR })
                          : "Data início"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        disabled={(date) =>
                          date > new Date() || date < subDays(new Date(), 30)
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim 
                          ? format(dataFim, "dd/MM/yyyy", { locale: ptBR })
                          : "Data fim"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        disabled={(date) =>
                          date > new Date() || date < subDays(new Date(), 30) || (dataInicio ? date < dataInicio : false)
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {(dataInicio || dataFim) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2">
              <Button 
                size="sm"
                className="flex-1"
                onClick={handleExecutar}
                disabled={!canExecute}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : canResume ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Continuar ({resumePercent}%)
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Executar
                  </>
                )}
              </Button>
            
            {/* Botão de cancelar normal (loop ativo) */}
            {canCancel && (
              <Button 
                size="sm"
                variant="destructive"
                onClick={handleCancelar}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            )}

            {/* Cancelamento remoto (loop não está ativo aqui, mas há execução ativa no banco) */}
            {canRequestCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleSolicitarCancelamento}
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Solicitar cancelamento (execução em outra aba/dispositivo)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Botão FORÇAR CANCELAMENTO (sempre disponível) */}
            {showForceCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="destructive"
                      onClick={handleForceCancelar}
                      disabled={forcandoCancelamento}
                      className="gap-1"
                    >
                      {forcandoCancelamento ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Skull className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {hasOrfa
                        ? (isGhostOrfa
                            ? 'Forçar limpeza (status travado sem execução ativa)'
                            : 'Forçar cancelamento (execução órfã no banco)')
                        : 'Forçar cancelamento imediato (kill switch)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Botão desabilitado quando não pode cancelar */}
            {!canCancel && !canRequestCancel && !showForceCancel && (
              <Button 
                size="sm"
                variant="destructive"
                disabled
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => enviarResumo('djen')}
                    disabled={enviando['djen']}
                    title="Enviar resumo de hoje"
                  >
                    {enviando['djen'] ? (
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

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowHistorico(true)}
                    title="Histórico de execuções"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Histórico (todas as execuções em tabela)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDiagnostico(true)}
                    title="Diagnóstico de busca por advogado"
                  >
                    <FlaskConical className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Diagnóstico (OAB): ver URL/HTTP/retorno do PJE</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
          </div>
        </CardContent>
      </Card>

      <DjenAdvogadoDiagnosticoDialog open={showDiagnostico} onOpenChange={setShowDiagnostico} />

      <DjenExecucoesHistoricoDialog open={showHistorico} onOpenChange={setShowHistorico} />

      {/* Dialog de Retomada */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Execução Interrompida
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Uma execução anterior foi interrompida em <strong>{resumePercent}%</strong> de progresso.
              </p>
              <p>
                Deseja retomar de onde parou ou começar do zero?
              </p>
              {canResume && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <div>
                    Checkpoint disponível para retomada
                    {!hasCheckpoint && backendHasCheckpoint ? ' (via backend)' : ''}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecutarDoZero}
              className="bg-muted text-foreground hover:bg-muted/80"
            >
              Começar do Zero
            </AlertDialogAction>
            <AlertDialogAction onClick={handleRetomar}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retomar de {resumePercent}%
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
