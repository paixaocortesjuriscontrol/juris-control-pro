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

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDjenTermos } from "@/hooks/useDjenTermos";
import type { MonitoringStats } from "@/hooks/useMonitoringDashboard";
import { toast } from "sonner";

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
    executarHibrido,
    cancelar,
    cancelarHibrido,
    forceKill,
    forceKillHibrido,
    limparTudoComPublicacoes,
    limparIndiceDiario,
    indexarDiario,
    cancelarIndexacao,
  } = useDjenTermos();

  const { data: liveConfig } = useQuery({
    queryKey: ['djen-config-live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('tipo', 'djen')
        .is('coordenacao_id', null)
        .maybeSingle();
      if (error) throw error;
      return data as { metadata: Record<string, any> | null } | null;
    },
    enabled: true,
    refetchInterval: (query) => {
      const md = (query?.state?.data?.metadata as Record<string, any> | null) || {};
      return md?.status === 'em_andamento' ? 3000 : 8000;
    },
  });

  // Snapshot do backend (evita “card desatualizado” ao sair/voltar da tela ou após reload)
  const md = ((liveConfig?.metadata as Record<string, any> | null) || (stats.config?.metadata as Record<string, any> | null) || {});

  // Detectar execução órfã: se backend diz "executando" mas:
  // 1. O engine local NÃO está rodando
  // 2. A execução foi iniciada há mais de 1 hora
  // Isso acontece quando a aba do navegador é fechada durante a execução
  const ORPHAN_THRESHOLD_MS = 60 * 60 * 1000; // 1 hora
  const executionStartTime = stats.currentExecution?.iniciado_em
    ? new Date(stats.currentExecution.iniciado_em).getTime()
    : null;
  const executionRunningTime = executionStartTime ? Date.now() - executionStartTime : 0;
  
  const isOrphanExecution = !isRunning && 
    stats.currentExecution?.status === 'executando' &&
    executionRunningTime > ORPHAN_THRESHOLD_MS;

  // Fonte de verdade do status:
  // - Se o engine local está rodando, confiar nele
  // - Se é execução órfã, mostrar como timeout
  // - Caso contrário, confiar no dashboard (execucoes_agendadas) e/ou metadata
  const backendIsRunning =
    stats.status === 'running' ||
    stats.currentExecution?.status === 'executando' ||
    md.status === 'executando' ||
    md.status === 'em_andamento';

  const mdIsRunning = md.status === 'executando' || md.status === 'em_andamento';

  const backendIsTimeout =
    stats.status === 'timeout' ||
    md.status === 'timeout' ||
    md.status === 'stale' ||
    md.last_stop_reason === 'stale' ||
    isOrphanExecution;

  const backendIsCancelled =
    stats.status === 'cancelled' ||
    md.status === 'cancelado' ||
    md.cancelado === true;

  const rawEffectiveStatus: string = isRunning
    ? 'executando'
    : isOrphanExecution
      ? 'timeout'
      : backendIsRunning && !isOrphanExecution
        ? 'executando'
        : backendIsTimeout
          ? 'timeout'
          : backendIsCancelled
            ? 'cancelado'
            : progress.status;

  // Evita “flicker” de status (Executando → Aguardando → Executando)
  // durante ciclos de polling/refetch.
  const lastRunningAtRef = useRef<number | null>(null);
  const [stableStatus, setStableStatus] = useState<string>(rawEffectiveStatus);

  useEffect(() => {
    // Status terminais: aplicar imediatamente
    if (rawEffectiveStatus === 'concluido' || rawEffectiveStatus === 'cancelado' || rawEffectiveStatus === 'timeout' || rawEffectiveStatus === 'erro') {
      lastRunningAtRef.current = null;
      setStableStatus(rawEffectiveStatus);
      return;
    }

    if (rawEffectiveStatus === 'executando') {
      lastRunningAtRef.current = Date.now();
      setStableStatus('executando');
      return;
    }

    // Se acabou de “perder” o estado de executando, segurar por um curto período
    // para não sumir a barra nem voltar para “Aguardando” por inconsistência momentânea.
    if (rawEffectiveStatus === 'idle' && lastRunningAtRef.current && Date.now() - lastRunningAtRef.current < 15_000) {
      setStableStatus('executando');
      return;
    }

    lastRunningAtRef.current = null;
    setStableStatus(rawEffectiveStatus);
  }, [rawEffectiveStatus]);

  const effectiveStatus = stableStatus;
  const effectiveIsRunning = effectiveStatus === 'executando';

  const toSafePct = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  // Percentual (solução definitiva): durante execução de BACKEND, usar APENAS metadata.
  // Isso evita “indo e voltando” quando existem múltiplas execuções 'executando'
  // em execucoes_agendadas ou quando snapshots chegam fora de ordem.
  const computedPercentage = (() => {
    // 1) Execução no backend (modo híbrido/background)
    if (!isRunning && mdIsRunning) {
      if (typeof md.percentage === 'number' && Number.isFinite(md.percentage)) {
        return md.percentage;
      }
      const current = typeof md.current === 'number' ? md.current : Number(md.current);
      const total = typeof md.total === 'number' ? md.total : Number(md.total);
      if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
        return Math.max(0, Math.min(99, Math.round((current / total) * 100)));
      }
      return 0;
    }

    // 2) Execução local (engine singleton)
    if (isRunning && typeof progress.percentage === 'number') {
      return progress.percentage;
    }

    // 3) Fallback (sem execução)
    if (typeof md.percentage === 'number') {
      return md.percentage;
    }
    if (typeof stats.progress === 'number') {
      return stats.progress;
    }
    return 0;
  })();

  // Travar percentual por execução (monotônico), usando a chave da execução.
  // Chave estável: preferir SEMPRE o executionId do execucoes_agendadas.
  // (metadata pode aparecer/sumir entre polls e isso resetava o lock monotônico)
  const runKey: string | null =
    (typeof md?.djen_run?.run_id === 'string' ? md.djen_run.run_id : null) ||
    (typeof stats.currentExecution?.id === 'string' ? stats.currentExecution.id : null) ||
    (typeof md?.execucaoId === 'string' ? md.execucaoId : null) ||
    (typeof md?.run_key === 'string' ? md.run_key : null);

  const lastRunKeyRef = useRef<string | null>(null);
  const [stablePercentage, setStablePercentage] = useState<number>(() => toSafePct(computedPercentage));

  useEffect(() => {
    const safe = toSafePct(computedPercentage);

    if (!effectiveIsRunning) {
      lastRunKeyRef.current = null;
      setStablePercentage(safe);
      return;
    }

    const key = runKey ?? 'unknown';
    if (lastRunKeyRef.current !== key) {
      lastRunKeyRef.current = key;
      setStablePercentage(safe);
      return;
    }

    setStablePercentage((prev) => Math.max(prev, safe));
  }, [effectiveIsRunning, runKey, computedPercentage]);

  const effectivePercentage = effectiveIsRunning ? stablePercentage : toSafePct(computedPercentage);

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
    (typeof md.warning === 'string' ? md.warning : '') ||
    (effectiveIsRunning ? 'Executando...' : '');

  // Pedido: não exibir texto de “execução travada” (mantém a UI limpa; ações continuam disponíveis).
  const effectiveMensagemSafe = /travada/i.test(effectiveMensagem) ? '' : effectiveMensagem;

  const effectiveTempoDecorrido = Math.max(progress.tempoDecorrido || 0, stats.elapsedSeconds || 0);

  // Contadores: priorizar engine local quando ativo; senão usar backend (metadata/stats)
  // Nota: a tela de Análise mostra apenas o que foi persistido no banco. Duplicadas podem ser >0
  // mesmo com 0 novas, pois significam “já existia no banco”.
  const effectiveEncontradas: number =
    (isRunning && progress.novas > 0)
      ? progress.novas
      : (typeof md.novas_nao_lidas === 'number' ? md.novas_nao_lidas : 0) ||
        (typeof md.novas === 'number' ? md.novas : 0) ||
        (typeof md.encontradas === 'number' ? md.encontradas : 0) ||
        (typeof md.found === 'number' ? md.found : 0) ||
        (typeof stats.todayStats?.novas_nao_lidas === 'number' ? stats.todayStats.novas_nao_lidas : 0) ||
        (typeof stats.todayStats?.novas === 'number' ? stats.todayStats.novas : 0) ||
        (typeof stats.todayStats?.found === 'number' ? stats.todayStats.found : 0) ||
        0;

  const effectiveEncontradasTotal: number =
    (typeof md.novas === 'number' ? md.novas : 0) ||
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

  const effectiveDescartadasTribunal: number =
    (isRunning && progress.descartadasTribunal > 0)
      ? progress.descartadasTribunal
      : (typeof md.descartadas_tribunal === 'number' ? md.descartadas_tribunal : 0) ||
        0;

  // Estado para seleção de datas
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);
  const [backgroundOnly, setBackgroundOnly] = useState(false);
  const [indexMode, setIndexMode] = useState<'normal' | 'indexado'>('normal');

  useEffect(() => {
    const savedHybrid = localStorage.getItem('djen-hybrid-mode');
    const savedBg = localStorage.getItem('djen-background-only');
    const savedIndexMode = localStorage.getItem('djen-index-mode');
    if (savedBg === 'true') {
      setBackgroundOnly(true);
      setHybridMode(false);
    } else if (savedHybrid === 'true') {
      setHybridMode(true);
    }
    if (savedIndexMode === 'indexado' || savedIndexMode === 'normal') {
      setIndexMode(savedIndexMode);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('djen-hybrid-mode', hybridMode ? 'true' : 'false');
  }, [hybridMode]);

  useEffect(() => {
    const saved = localStorage.getItem('djen-background-only');
    if (saved === 'true') {
      setBackgroundOnly(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('djen-background-only', backgroundOnly ? 'true' : 'false');
    if (backgroundOnly) {
      setHybridMode(false);
    }
  }, [backgroundOnly]);

  useEffect(() => {
    localStorage.setItem('djen-index-mode', indexMode);
  }, [indexMode]);

  useEffect(() => {
    if (backendIsRunning && !backgroundOnly) {
      setHybridMode(true);
    }
  }, [backendIsRunning, backgroundOnly]);

  const handleToggleHybrid = useCallback((checked: boolean) => {
    setHybridMode(checked);
    if (checked) setBackgroundOnly(false);
  }, []);

  const handleToggleBackground = useCallback((checked: boolean) => {
    setBackgroundOnly(checked);
    if (checked) setHybridMode(false);
  }, []);

  // Helpers
  const getDataYmd = useCallback((date?: Date): string | undefined => {
    if (!date) return undefined;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const dataIndexYmd = useMemo(() => {
    const inicio = getDataYmd(dataInicio);
    const fim = getDataYmd(dataFim);
    if (inicio && fim && inicio === fim) return inicio;
    if (inicio && !fim) return inicio;
    if (fim && !inicio) return fim;
    if (inicio && fim && inicio !== fim) return null;
    return null;
  }, [dataInicio, dataFim, getDataYmd]);

  const { data: indexStatus, refetch: refetchIndexStatus } = useQuery({
    queryKey: ['djen-diario-index', dataIndexYmd],
    queryFn: async () => {
      const baseQuery = (supabase as any)
        .from('djen_diario_index')
        .select('diario_ymd, status, total_publicacoes, total_tribunais, tribunais_processados, atualizado_em, erro_mensagem')
        .order('atualizado_em', { ascending: false })
        .limit(1);
      const { data, error } = dataIndexYmd
        ? await baseQuery.eq('diario_ymd', dataIndexYmd).maybeSingle()
        : await baseQuery.maybeSingle();
      if (error) throw error;
      return data as {
        diario_ymd: string;
        status: string;
        total_publicacoes: number | null;
        total_tribunais: number | null;
        tribunais_processados: number | null;
        atualizado_em: string | null;
        erro_mensagem: string | null;
      } | null;
    },
    enabled: true,
    refetchInterval: (query) => (query?.state?.data?.status === 'em_andamento' ? 3000 : false),
  });

  const { data: indexTribunais = [] } = useQuery({
    queryKey: ['djen-diario-index-tribunais', indexStatus?.diario_ymd],
    queryFn: async () => {
      if (!indexStatus?.diario_ymd) return [];
      const { data, error } = await (supabase as any)
        .from('djen_diario_index_tribunais')
        .select('tribunal, status, paginas_processadas, max_pages, atualizado_em, erro_mensagem')
        .eq('diario_ymd', indexStatus.diario_ymd)
        .order('tribunal', { ascending: true });
      if (error) throw error;
      return data as Array<{
        tribunal: string;
        status: string;
        paginas_processadas: number | null;
        max_pages: number | null;
        atualizado_em: string | null;
        erro_mensagem: string | null;
      }>;
    },
    enabled: !!indexStatus?.diario_ymd,
    refetchInterval: (data) => (indexStatus?.status === 'em_andamento' ? 3000 : false),
  });

  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.idle;
  const StatusIcon = statusConfig.icon;
  const [indexActionPending, setIndexActionPending] = useState(false);
  const indexErroTribunais = useMemo(
    () => indexTribunais.filter((t) => t.status === 'erro'),
    [indexTribunais]
  );
  const indexErrosCount = indexErroTribunais.length;
  const indexStatusLabel = indexStatus?.status === 'concluido'
    ? 'Concluído'
    : indexStatus?.status === 'em_andamento'
      ? 'Em andamento'
      : indexStatus?.status === 'cancelado'
        ? 'Cancelado'
        : indexStatus?.status === 'erro'
        ? 'Erro'
        : 'Pendente';
  const indexProgress = (() => {
    if (!indexStatus) return 0;
    if (indexStatus.status === 'cancelado') return 0;
    if (indexStatus.status === 'concluido') return 100;
    const total = Number(indexStatus.total_tribunais || 0);
    const done = Number(indexStatus.tribunais_processados || 0);
    if (total > 0) return Math.min(99, Math.round((done / total) * 100));
    return indexStatus.status === 'em_andamento' ? 10 : 0;
  })();

  // Handlers
  const handleExecutar = useCallback(async () => {
    // Se há checkpoint, perguntar se quer retomar ou começar do zero
    if (canResume && !hybridMode && !backendIsRunning && !backgroundOnly) {
      setShowResumeDialog(true);
      return;
    }
    
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data de início e fim antes de executar');
      return;
    }

    if (indexMode === 'indexado') {
      if (!dataIndexYmd) {
        toast.error('Consulta indexada exige seleção de apenas um dia.');
        return;
      }
      if (indexStatus?.status !== 'concluido') {
        toast.error('Índice diário não concluído para a data selecionada.');
        return;
      }
      if (!hybridMode && !backgroundOnly) {
        toast.error('Consulta indexada só funciona no backend. Ative modo híbrido ou 100% background.');
        return;
      }
    }

    if (backgroundOnly) {
      await executarHibrido(getDataYmd(dataInicio), getDataYmd(dataFim), { backgroundOnly: true, indexMode });
    } else if (hybridMode) {
      await executarHibrido(getDataYmd(dataInicio), getDataYmd(dataFim), { indexMode });
    } else {
      executar(getDataYmd(dataInicio), getDataYmd(dataFim), { turbo: turboMode });
    }
    onAfterMutation();
  }, [canResume, executar, executarHibrido, getDataYmd, dataInicio, dataFim, onAfterMutation, turboMode, hybridMode, backgroundOnly, indexMode, dataIndexYmd, indexStatus]);

  const handleIndexarDiario = useCallback(async () => {
    const inicio = getDataYmd(dataInicio);
    const fim = getDataYmd(dataFim);

    if (inicio && fim && inicio !== fim) {
      toast.error('Para indexar, selecione apenas um dia');
      return;
    }

    const dataYmd = inicio || fim || getDataYmd(new Date());
    if (!dataYmd) {
      toast.error('Selecione um dia para indexar');
      return;
    }

    setIndexActionPending(true);
    try {
      await indexarDiario(dataYmd);
      await refetchIndexStatus();
      onAfterMutation();
    } finally {
      setIndexActionPending(false);
    }
  }, [dataInicio, dataFim, getDataYmd, indexarDiario, onAfterMutation, refetchIndexStatus]);

  const handleRetomar = useCallback(() => {
    setShowResumeDialog(false);
    if (indexMode === 'indexado') {
      toast.error('Consulta indexada não permite retomar execução local.');
      return;
    }
    if (backgroundOnly) {
      toast.error('Modo 100% background não permite retomar execução local.');
      return;
    }
    retomar({ turbo: turboMode });
    onAfterMutation();
  }, [retomar, onAfterMutation, turboMode, backgroundOnly, indexMode]);

  const handleNovaExecucao = useCallback(() => {
    setShowResumeDialog(false);
    if (indexMode === 'indexado') {
      if (!dataIndexYmd) {
        toast.error('Consulta indexada exige seleção de apenas um dia.');
        return;
      }
      if (indexStatus?.status !== 'concluido') {
        toast.error('Índice diário não concluído para a data selecionada.');
        return;
      }
      if (!hybridMode && !backgroundOnly) {
        toast.error('Consulta indexada só funciona no backend. Ative modo híbrido ou 100% background.');
        return;
      }
    }
    if (backgroundOnly) {
      executarHibrido(getDataYmd(dataInicio), getDataYmd(dataFim), { backgroundOnly: true, indexMode });
    } else if (hybridMode) {
      executarHibrido(getDataYmd(dataInicio), getDataYmd(dataFim), { indexMode });
    } else {
      executar(getDataYmd(dataInicio), getDataYmd(dataFim), { turbo: turboMode });
    }
    onAfterMutation();
  }, [executar, executarHibrido, getDataYmd, dataInicio, dataFim, onAfterMutation, turboMode, hybridMode, backgroundOnly, indexMode, dataIndexYmd, indexStatus]);

  const handleCancelar = useCallback(() => {
    if (hybridMode) {
      cancelarHibrido();
    } else {
      cancelar();
    }
    onAfterMutation();
  }, [cancelar, cancelarHibrido, onAfterMutation, hybridMode]);

  const handleForceKill = useCallback(() => {
    setShowKillDialog(false);
    // Sempre tentar parar ambos os modos para evitar ficar preso
    forceKillHibrido();
    forceKill();
    setHybridMode(false);
    setTurboMode(false);
    setBackgroundOnly(false);
    onAfterMutation();
  }, [forceKill, forceKillHibrido, onAfterMutation]);

  const handleLimparIndice = useCallback(async () => {
    const dataYmd = getDataYmd(dataInicio) || getDataYmd(dataFim) || getDataYmd(new Date());
    if (!dataYmd) {
      toast.error('Selecione um dia para limpar o índice');
      return;
    }
    await limparIndiceDiario(dataYmd);
    onAfterMutation();
  }, [dataInicio, dataFim, getDataYmd, limparIndiceDiario, onAfterMutation]);

  const handleCancelarIndexacao = useCallback(async () => {
    if (!dataIndexYmd) {
      toast.error('Selecione um dia para cancelar a indexação');
      return;
    }
    await cancelarIndexacao(dataIndexYmd);
    onAfterMutation();
  }, [cancelarIndexacao, dataIndexYmd, onAfterMutation]);

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
          {/* Alerta de checkpoint disponível após erro/cancelamento */}
          {!effectiveIsRunning && canResume && 
           (effectiveStatus === 'erro' || effectiveStatus === 'cancelado' || effectiveStatus === 'timeout') && (
            <div className="rounded-md bg-accent p-3 text-sm text-accent-foreground border border-accent/50">
              <div className="flex items-start gap-2">
                <RotateCcw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Execução interrompida em {checkpointPercent}%</p>
                  <p className="text-xs mt-1 mb-2">
                    Você pode continuar de onde parou ou reiniciar do zero.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRetomar}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Continuar de {checkpointPercent}%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        forceKill();
                        setTimeout(() => {
                          if (dataInicio && dataFim) {
                            executar(getDataYmd(dataInicio), getDataYmd(dataFim), { turbo: turboMode });
                          }
                        }, 500);
                      }}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Reiniciar do Zero
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    <span className="ml-1 break-words">{effectiveTermoAtual}</span>
                  )}
                </span>
                <span className="font-mono font-medium">{Math.round(effectivePercentage)}%</span>
              </div>
              <Progress value={Math.round(effectivePercentage)} className="h-2" />
              {!!effectiveMensagemSafe && (
                <p className="text-xs text-muted-foreground">{effectiveMensagemSafe}</p>
              )}
            </div>
          )}

          {/* Índice diário */}
          {indexStatus ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Índice diário ({indexStatus.diario_ymd})</span>
                <Badge variant="secondary">{indexStatusLabel}</Badge>
              </div>
              <Progress value={indexProgress} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {indexStatus?.total_tribunais
                    ? `Tribunais: ${indexStatus.tribunais_processados || 0}/${indexStatus.total_tribunais}`
                    : 'Sem estimativa'}
                </span>
                <span>{indexProgress}%</span>
              </div>
              {indexActionPending && indexStatus?.status !== 'em_andamento' && (
                <div className="text-[11px] text-muted-foreground">
                  Iniciando indexação...
                </div>
              )}
              {indexStatus.status === 'em_andamento' && indexErrosCount > 0 && (
                <div className="text-[11px] text-destructive">
                  Tribunais com erro: {indexErrosCount}
                </div>
              )}
              {indexStatus.status === 'em_andamento' && indexTribunais.length > 0 && (
                <ScrollArea className="h-40 rounded border bg-muted/20 p-2">
                  <div className="space-y-2">
                    {indexTribunais.map((t) => {
                      const max = Number(t.max_pages || 0);
                      const done = Number(t.paginas_processadas || 0);
                      const pct = max > 0 ? Math.min(99, Math.round((done / max) * 100)) : (t.status === 'concluido' ? 100 : 0);
                      return (
                        <div key={t.tribunal} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-medium">{t.tribunal}</span>
                            <span className={t.status === 'erro' ? 'text-destructive' : undefined}>{t.status}</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                          {t.status === 'erro' && t.erro_mensagem && (
                            <div className="text-[10px] text-destructive">
                              {t.erro_mensagem}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              {indexStatus.status === 'concluido' && indexErrosCount > 0 && (
                <div className="text-[11px] text-destructive">
                  Tribunais com erro: {indexErrosCount}
                </div>
              )}
              {indexStatus.status === 'erro' && indexStatus.erro_mensagem && (
                <div className="text-[11px] text-destructive">
                  {indexStatus.erro_mensagem}
                </div>
              )}
              {indexStatus.status === 'cancelado' && (
                <div className="text-[11px] text-muted-foreground">
                  Indexação cancelada. Clique em “Indexar diário” para reiniciar.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Nenhum índice encontrado para exibir.
            </div>
          )}

          {/* Totalizadores */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-primary">
              ✓ {effectiveEncontradas} encontradas (não lidas)
            </span>
            {effectiveEncontradasTotal > 0 && effectiveEncontradasTotal !== effectiveEncontradas && (
              <span className="text-muted-foreground">
                • {effectiveEncontradasTotal} total hoje
              </span>
            )}
            <span className="text-muted-foreground">
              ↔ {effectiveDuplicadas} duplicadas
            </span>
            <span className="text-destructive">
              ✗ {effectiveDescartadas} descartadas
            </span>
            {effectiveDescartadasTribunal > 0 && (
              <span className="text-muted-foreground">
                • {effectiveDescartadasTribunal} fora do tribunal
              </span>
            )}
          </div>

          {/* Indicadores de estratégia */}
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary">Prioridade: Advogado/OAB</Badge>
            <Badge variant="secondary">Agrupamento por OAB ativo</Badge>
            {backgroundOnly && <Badge variant="secondary">Modo 100% background</Badge>}
            {!backgroundOnly && hybridMode && <Badge variant="secondary">Modo híbrido</Badge>}
            {!backgroundOnly && !hybridMode && <Badge variant="secondary">Modo navegador</Badge>}
          </div>

          {/* Modo turbo */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-turbo" className="text-xs text-muted-foreground">
                Modo turbo
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Aumenta a velocidade com mais paralelismo e menos delays. Se houver muitos 429, o sistema reduz automaticamente.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="djen-turbo"
              checked={turboMode}
              onCheckedChange={setTurboMode}
              disabled={effectiveIsRunning || hybridMode}
            />
          </div>

          {/* Modo híbrido */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-hybrid" className="text-xs text-muted-foreground">
                Modo híbrido (backend)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Executa a busca no backend com controle global de rate limit. Se falhar, cai no modo navegador.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="djen-hybrid"
              checked={hybridMode}
              onCheckedChange={handleToggleHybrid}
              disabled={effectiveIsRunning || backgroundOnly}
            />
          </div>

          {/* 100% background */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-background" className="text-xs text-muted-foreground">
                100% background
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Executa apenas no backend. Se o backend estiver indisponível, não cai no navegador.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="djen-background"
              checked={backgroundOnly}
              onCheckedChange={handleToggleBackground}
              disabled={effectiveIsRunning}
            />
          </div>

          {/* Consulta indexada */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-indexed" className="text-xs text-muted-foreground">
                Consulta indexada
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Usa o índice diário (apenas 1 dia selecionado). Requer índice concluído.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="djen-indexed"
              checked={indexMode === 'indexado'}
              onCheckedChange={(checked) => setIndexMode(checked ? 'indexado' : 'normal')}
              disabled={effectiveIsRunning}
            />
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

          {/* Linha 1: Botões principais de ação */}
          <div className="flex gap-2 flex-wrap">
            {effectiveIsRunning ? (
              <Button 
                variant="destructive" 
                size="sm" 
                className="flex-1"
                onClick={handleCancelar}
              >
                <StopCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
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
                {canResume && !hybridMode && !backendIsRunning && !backgroundOnly && (
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

            <Button
              variant="outline"
              size="sm"
              onClick={handleIndexarDiario}
              disabled={effectiveIsRunning}
            >
              Indexar diário
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparIndice}
              disabled={effectiveIsRunning}
            >
              Limpar índice
            </Button>
          </div>

          {/* Linha 2: Botões de limpeza e reset */}
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-muted-foreground hover:text-foreground"
                    onClick={async () => {
                      setHybridMode(false);
                      setBackgroundOnly(false);
                      setTurboMode(false);
                      await limparTudoComPublicacoes(
                        getDataYmd(dataInicio),
                        getDataYmd(dataFim)
                      );
                      onAfterMutation();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Limpar Publicações
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limpar publicações do intervalo selecionado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowKillDialog(true)}
                  >
                    <Skull className="h-4 w-4 mr-1" />
                    Reset Total
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Forçar cancelamento e limpar todo estado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Linha 3: Cancelar indexação */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelarIndexacao}
            disabled={!indexStatus || indexStatus.status === 'concluido'}
            className="w-full text-destructive hover:text-destructive"
          >
            Forçar cancelar indexação
          </Button>

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
