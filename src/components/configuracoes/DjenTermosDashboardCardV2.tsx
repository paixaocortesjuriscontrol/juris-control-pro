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
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
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
import { getDjenTermosExecutionProgress } from "@/utils/djenTermosExecutionProgress";
import { useDjenTermosScheduler } from "@/hooks/useDjenTermosScheduler";
import { useDjenTermosProScheduler } from "@/hooks/useDjenTermosProScheduler";

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

/**
 * Componente do Card de Agendamento Automático
 */
function SchedulerCard() {
  const { ativo, proximoHorario, start, stop } = useDjenTermosScheduler();

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Agendamento Automático</CardTitle>
          </div>
          <Badge variant={ativo ? "default" : "secondary"}>
            {ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Descrição */}
        <p className="text-sm text-muted-foreground">
          Executa automaticamente todos os dias às <span className="font-semibold text-foreground">05:30 BRT</span>
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="djen-scheduler" className="text-sm font-medium">
              Agendamento automático
            </Label>
          </div>
          <Switch
            id="djen-scheduler"
            checked={ativo}
            onCheckedChange={(checked) => {
              if (checked) {
                start();
                toast.success('Agendamento ativado');
              } else {
                stop();
                toast.info('Agendamento desativado');
              }
            }}
          />
        </div>

        {/* Status e próximo horário */}
        {ativo && proximoHorario && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
            <Clock className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Próxima execução</p>
              <p className="text-sm font-medium">{proximoHorario}</p>
            </div>
          </div>
        )}

        {/* Aviso */}
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 border border-amber-500/20">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Mantenha esta aba aberta para que o agendamento automático funcione
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Card de Agendamento Automático - Termos Pro
 */
function SchedulerProCard() {
  const { ativo, proximoHorario, start, stop } = useDjenTermosProScheduler();

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Agendamento Pro Automático</CardTitle>
          </div>
          <Badge variant={ativo ? "default" : "secondary"}>
            {ativo ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Executa Termos Pro automaticamente todos os dias às <span className="font-semibold text-foreground">20:45 BRT</span>
        </p>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="djen-pro-scheduler" className="text-sm font-medium">
              Agendamento Pro automático
            </Label>
          </div>
          <Switch
            id="djen-pro-scheduler"
            checked={ativo}
            onCheckedChange={(checked) => {
              if (checked) {
                start();
                toast.success('Agendamento Pro ativado');
              } else {
                stop();
                toast.info('Agendamento Pro desativado');
              }
            }}
          />
        </div>

        {ativo && proximoHorario && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
            <Clock className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Próxima execução</p>
              <p className="text-sm font-medium">{proximoHorario}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 border border-muted">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Mantenha esta aba aberta para que o agendamento automático funcione
          </p>
        </div>
      </CardContent>
    </Card>
  );
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

  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  // Query para buscar TODOS os monitoramentos ativos (para lookup de descrição do termo atual)
  const { data: todosMonitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-todos-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
    },
    staleTime: 60000, // Cache por 1 minuto
  });

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord-exec', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId('');
  }, [filtroCoordenacaoId]);

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
      const rodando = md?.status === 'em_andamento' || md?.status === 'executando' || isRunning;
      return rodando ? 2000 : 6000;
    },
  });

  // Snapshot do backend (evita “card desatualizado” ao sair/voltar da tela ou após reload)
  const md = ((liveConfig?.metadata as Record<string, any> | null) || (stats.config?.metadata as Record<string, any> | null) || {});

  // Metadata pode ficar “presa” em em_andamento em cenários de falha (ex.: continuação não enfileirada).
  // Só considerar "rodando" via metadata quando houver sinais de progresso/continuação.
  const mdStatus = typeof (md as any)?.status === 'string' ? ((md as any).status as string) : undefined;
  const mdHasSignals =
    (md as any)?.has_more === true ||
    (md as any)?.djen_run != null ||
    (md as any)?.next_offset != null ||
    (typeof (md as any)?.current === 'number' && (md as any).current > 0);
  const mdRunningMeaningful = (mdStatus === 'executando' || mdStatus === 'em_andamento') && mdHasSignals;

  // Detectar execução órfã (stale): banco diz "executando" mas NÃO há atividade
  // por um período (padrão: 10 min) e o engine local não está rodando.
  // Importante: NÃO usar apenas "tempo desde início" (senão qualquer execução longa vira timeout).
  const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000; // 10 min
  const executionStartTime = stats.currentExecution?.iniciado_em
    ? new Date(stats.currentExecution.iniciado_em).getTime()
    : null;

  const toSafePct = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  // Status bruto do backend (sem heurística de órfão)
  const rawBackendIsRunning =
    stats.status === 'running' ||
    stats.currentExecution?.status === 'executando' ||
    mdRunningMeaningful;

  const backendExecId = typeof stats.currentExecution?.id === 'string' ? stats.currentExecution.id : null;
  const backendExecProgress = useMemo(() => {
    if (!stats.currentExecution) return null;
    return getDjenTermosExecutionProgress({ detalhes: stats.currentExecution.detalhes });
  }, [stats.currentExecution]);

  const backendCurrentCandidate = (() => {
    const curExec = backendExecProgress?.current;
    if (typeof curExec === 'number' && Number.isFinite(curExec)) return Math.max(0, Math.round(curExec));
    const curMd = typeof md.current === 'number' ? md.current : Number(md.current);
    if (Number.isFinite(curMd)) return Math.max(0, Math.round(curMd));
    return null as number | null;
  })();

  const backendPctCandidate = (() => {
    const p = backendExecProgress?.percentage;
    if (typeof p === 'number' && Number.isFinite(p)) return toSafePct(p);
    if (typeof md.percentage === 'number' && Number.isFinite(md.percentage)) return toSafePct(md.percentage);

    const cur = typeof md.current === 'number' ? md.current : Number(md.current);
    const tot = typeof md.total === 'number' ? md.total : Number(md.total);
    if (Number.isFinite(cur) && Number.isFinite(tot) && tot > 0) return toSafePct((cur / tot) * 100);
    return null as number | null;
  })();

  // Guard de atividade: se o progresso do backend sobe, consideramos "ativo" (mesmo em outra aba)
  const lastBackendActivityAtRef = useRef<number | null>(null);
  const lastBackendPctRef = useRef<number>(0);
  const lastBackendCurrentRef = useRef<number>(0);
  const lastBackendExecIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rawBackendIsRunning) {
      lastBackendActivityAtRef.current = null;
      lastBackendPctRef.current = 0;
      lastBackendExecIdRef.current = null;
      return;
    }

    // Troca de execução: resetar baseline e marcar atividade agora
    const key = backendExecId ?? 'no-exec';
    if (lastBackendExecIdRef.current !== key) {
      lastBackendExecIdRef.current = key;
      lastBackendPctRef.current = Math.max(0, backendPctCandidate ?? 0);
      lastBackendCurrentRef.current = Math.max(0, backendCurrentCandidate ?? 0);
      lastBackendActivityAtRef.current = Date.now();
      return;
    }

    const hasPct = backendPctCandidate != null;
    const hasCur = backendCurrentCandidate != null;

    if (!hasPct && !hasCur) {
      // Sem sinais legíveis: não marcar stale agressivamente
      if (lastBackendActivityAtRef.current == null) lastBackendActivityAtRef.current = Date.now();
      return;
    }

    const pctIncreased = hasPct && backendPctCandidate! > lastBackendPctRef.current;
    const curIncreased = hasCur && backendCurrentCandidate! > lastBackendCurrentRef.current;

    if (pctIncreased) lastBackendPctRef.current = backendPctCandidate!;
    if (curIncreased) lastBackendCurrentRef.current = backendCurrentCandidate!;

    if (pctIncreased || curIncreased) {
      lastBackendActivityAtRef.current = Date.now();
    } else if (lastBackendActivityAtRef.current == null) {
      lastBackendActivityAtRef.current = Date.now();
    }
  }, [rawBackendIsRunning, backendExecId, backendPctCandidate, backendCurrentCandidate]);

  const lastBackendActivityAt = lastBackendActivityAtRef.current ?? executionStartTime ?? null;
  const isOrphanExecution =
    !isRunning &&
    stats.currentExecution?.status === 'executando' &&
    !!lastBackendActivityAt &&
    Date.now() - lastBackendActivityAt > ORPHAN_THRESHOLD_MS;

  // Fonte de verdade do status:
  // - Se o engine local está rodando, confiar nele
  // - Se é execução órfã, mostrar como timeout
  // - Caso contrário, confiar no dashboard (execucoes_agendadas) e/ou metadata
  // Considerar "rodando" apenas se não estiver stale
  const backendIsRunning = rawBackendIsRunning && !isOrphanExecution;

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

  const effectiveStatus = (() => {
    if (backendIsRunning) return 'executando';
    if (typeof md.percentage === 'number' && Number.isFinite(md.percentage) && md.percentage >= 100) {
      return 'concluido';
    }
    if (mdStatus === 'concluido') return 'concluido';
    return stableStatus;
  })();
  const effectiveIsRunning = effectiveStatus === 'executando';

  // Percentual (fonte única): DJEN Termos deve usar detalhes.progress da execução ativa.
  // (registros_processados não representa “termos processados” e causava oscilação)
  const computedPercentage = (() => {
    const fromMetadata = (): number | null => {
      if (typeof md.percentage === 'number' && Number.isFinite(md.percentage)) {
        return toSafePct(md.percentage);
      }

      const cur = typeof md.current === 'number' ? md.current : Number(md.current);
      const tot = typeof md.total === 'number' ? md.total : Number(md.total);
      if (Number.isFinite(cur) && Number.isFinite(tot) && tot > 0) {
        return toSafePct((cur / tot) * 100);
      }
      return null;
    };

    // 1) Se houver execução ativa no banco, usar SEMPRE execucoes_agendadas
    if (stats.currentExecution?.status === 'executando' && stats.currentExecution.finalizado_em == null) {
      const p = getDjenTermosExecutionProgress({ detalhes: stats.currentExecution.detalhes });
      if (typeof p.percentage === 'number' && Number.isFinite(p.percentage)) {
        return Math.max(0, Math.min(99, Math.round(p.percentage)));
      }

      // Fallback: se a execução ativa não tem detalhes.progress (janela comum), usar metadata
      const mdPct = fromMetadata();
      if (mdRunningMeaningful && mdPct != null) {
        return Math.max(0, Math.min(99, Math.round(mdPct)));
      }
      return 0;
    }

    // 1b) Modo 100% background: pode haver janela onde finalizado_em ficou preenchido por snapshot antigo,
    // mas a execução continua (heartbeat do backend limpa depois). Nessa janela, ainda assim
    // preferimos detalhes.progress da execução para evitar % "indo e voltando" por metadata.
    if (stats.currentExecution?.status === 'executando') {
      const p = getDjenTermosExecutionProgress({ detalhes: stats.currentExecution.detalhes });
      if (typeof p.percentage === 'number' && Number.isFinite(p.percentage)) {
        return Math.max(0, Math.min(99, Math.round(p.percentage)));
      }

      const mdPct = fromMetadata();
      if (mdRunningMeaningful && mdPct != null) {
        return Math.max(0, Math.min(99, Math.round(mdPct)));
      }
    }

    // 2) Execução local (engine singleton)
    if (isRunning && typeof progress.percentage === 'number') {
      return progress.percentage;
    }

    // 2b) Metadata do backend (quando disponível)
    if (typeof md.percentage === 'number' && Number.isFinite(md.percentage)) {
      return toSafePct(md.percentage);
    }

    // 3) Fallback (sem execução): metadata/stats
    if (mdStatus === 'concluido') return 100;

    // Evitar “% fantasma” quando metadata ficou travada em um estado inválido.
    if (mdRunningMeaningful && typeof md.percentage === 'number' && Number.isFinite(md.percentage)) {
      return Math.max(0, Math.min(99, Math.round(md.percentage)));
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
    (typeof stats.currentExecution?.id === 'string' ? stats.currentExecution.id : null) ||
    (typeof md?.djen_run?.run_id === 'string' ? md.djen_run.run_id : null) ||
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

    // Se o backend “some” com a runKey em um snapshot, não resetar.
    const key = runKey ?? lastRunKeyRef.current ?? 'unknown';
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

  // Descrição do termo atual para diferenciação quando há vários com mesmo nome
  const effectiveTermoDescricao: string | null = useMemo(() => {
    if (!effectiveTermoAtual) return null;
    
    // Tenta buscar a descrição do progress/metadata
    const fromProgress = progress.termoDescricao ?? null;
    if (typeof fromProgress === 'string' && fromProgress) return fromProgress;
    
    const fromMd = typeof md.termoDescricao === 'string' ? md.termoDescricao : null;
    if (fromMd) return fromMd;
    
    // Tenta buscar nos monitoramentos carregados (usa lista completa para lookup)
    const listaLookup = todosMonitoramentos.length > 0 ? todosMonitoramentos : monitoramentos;
    if (listaLookup.length > 0) {
      // Busca por termo_busca (match exato)
      const termo = listaLookup.find(m => m.termo_busca === effectiveTermoAtual);
      if (termo?.descricao) return termo.descricao;
      
      // Fallback: busca por qualquer match parcial
      const termoNorm = effectiveTermoAtual.toUpperCase().trim();
      const termoAlt = listaLookup.find(m => 
        m.termo_busca?.toUpperCase().trim() === termoNorm ||
        (m.descricao || '').toUpperCase().trim() === termoNorm
      );
      if (termoAlt?.descricao) return termoAlt.descricao;
    }
    
    return null;
  }, [effectiveTermoAtual, progress, md, monitoramentos, todosMonitoramentos]);

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
  const [dataIndice, setDataIndice] = useState<Date | undefined>(undefined);
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
    const indice = getDataYmd(dataIndice);
    return indice || null;
  }, [dataIndice, getDataYmd]);

  useEffect(() => {
    if (!dataInicio && !dataFim) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataInicio(hoje);
      setDataFim(hoje);
    }
    if (!dataIndice) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataIndice(hoje);
    }
  }, [dataInicio, dataFim, dataIndice]);

  const { data: indexStatus, refetch: refetchIndexStatus } = useQuery({
    queryKey: ['djen-diario-index', dataIndexYmd],
    queryFn: async () => {
      const baseQuery = (supabase as any)
        .from('djen_diario_index')
        .select('diario_ymd, status, total_publicacoes, total_tribunais, tribunais_processados, atualizado_em, erro_mensagem, started_at')
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
        started_at: string | null;
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
  const indexErroTribunais = useMemo(() => {
    if (!indexStatus) return [];
    if (indexActionPending && indexStatus.status !== 'em_andamento') return [];
    return indexTribunais.filter((t) => t.status === 'erro');
  }, [indexActionPending, indexStatus, indexTribunais]);
  const indexErrosCount = indexErroTribunais.length;
  const shouldShowIndexErrors =
    (indexStatus?.status === 'em_andamento' && Number(indexStatus.tribunais_processados || 0) > 0) ||
    indexStatus?.status === 'concluido';
  const indexStatusLabel = indexActionPending && indexStatus?.status !== 'em_andamento'
    ? 'Iniciando'
    : indexStatus?.status === 'concluido'
      ? 'Concluído'
      : indexStatus?.status === 'em_andamento'
        ? 'Em andamento'
        : indexStatus?.status === 'cancelado'
          ? 'Cancelado'
          : indexStatus?.status === 'erro'
          ? 'Erro'
          : 'Pendente';
  const indexLastUpdateLabel = useMemo(() => {
    if (!indexStatus?.atualizado_em) return null;
    const dt = new Date(indexStatus.atualizado_em);
    if (Number.isNaN(dt.getTime())) return null;
    return format(dt, "dd/MM/yyyy HH:mm", { locale: ptBR });
  }, [indexStatus?.atualizado_em]);
  const indexElapsedLabel = useMemo(() => {
    if (indexStatus?.status !== 'em_andamento') return null;
    if (!indexStatus?.started_at) return null;
    const started = new Date(indexStatus.started_at);
    if (Number.isNaN(started.getTime())) return null;
    const now = new Date();
    const seconds = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));
    return formatDuration(seconds);
  }, [indexStatus?.started_at, indexStatus?.status]);
  const indexStatusMessage = useMemo(() => {
    if (!indexStatus) return null;
    if (indexActionPending && indexStatus.status !== 'em_andamento') {
      return 'Solicitação enviada. Aguardando início do backend...';
    }
    if (indexStatus.status === 'em_andamento' && Number(indexStatus.tribunais_processados || 0) === 0) {
      return 'Iniciando indexação...';
    }
    if (indexStatus.status === 'concluido') return 'Indexação concluída.';
    if (indexStatus.status === 'cancelado') return 'Indexação cancelada.';
    if (indexStatus.status === 'erro') return 'Indexação com erro.';
    return 'Índice pendente.';
  }, [indexActionPending, indexStatus]);

  useEffect(() => {
    if (!indexActionPending) return;
    const t = setTimeout(() => {
      refetchIndexStatus();
    }, 1500);
    return () => clearTimeout(t);
  }, [indexActionPending, refetchIndexStatus]);
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

    const inicioExec = indexMode === 'indexado' ? dataIndexYmd : getDataYmd(dataInicio);
    const fimExec = indexMode === 'indexado' ? dataIndexYmd : getDataYmd(dataFim);

    const filtros = {
      coordenacaoId: filtroCoordenacaoId || undefined,
      monitoramentoIds: filtroMonitoramentoId ? [filtroMonitoramentoId] : undefined,
    };
    if (backgroundOnly) {
      await executarHibrido(inicioExec, fimExec, { backgroundOnly: true, indexMode, ...filtros });
    } else if (hybridMode) {
      await executarHibrido(inicioExec, fimExec, { indexMode, ...filtros });
    } else {
      executar(inicioExec, fimExec, { turbo: turboMode, ...filtros });
    }
    onAfterMutation();
  }, [canResume, executar, executarHibrido, getDataYmd, dataInicio, dataFim, onAfterMutation, turboMode, hybridMode, backgroundOnly, indexMode, dataIndexYmd, indexStatus, filtroCoordenacaoId, filtroMonitoramentoId]);

  const handleIndexarDiario = useCallback(async () => {
    const dataYmd = getDataYmd(dataIndice) || getDataYmd(new Date());
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
  }, [dataIndice, getDataYmd, indexarDiario, onAfterMutation, refetchIndexStatus]);

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
    const filtros = {
      coordenacaoId: filtroCoordenacaoId || undefined,
      monitoramentoIds: filtroMonitoramentoId ? [filtroMonitoramentoId] : undefined,
    };
    retomar({ turbo: turboMode, ...filtros });
    onAfterMutation();
  }, [retomar, onAfterMutation, turboMode, backgroundOnly, indexMode, filtroCoordenacaoId, filtroMonitoramentoId]);

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
    const inicioExec = indexMode === 'indexado' ? dataIndexYmd : getDataYmd(dataInicio);
    const fimExec = indexMode === 'indexado' ? dataIndexYmd : getDataYmd(dataFim);
    const filtros = {
      coordenacaoId: filtroCoordenacaoId || undefined,
      monitoramentoIds: filtroMonitoramentoId ? [filtroMonitoramentoId] : undefined,
    };
    if (backgroundOnly) {
      executarHibrido(inicioExec, fimExec, { backgroundOnly: true, indexMode, ...filtros });
    } else if (hybridMode) {
      executarHibrido(inicioExec, fimExec, { indexMode, ...filtros });
    } else {
      executar(inicioExec, fimExec, { turbo: turboMode, ...filtros });
    }
    onAfterMutation();
  }, [executar, executarHibrido, getDataYmd, dataInicio, dataFim, onAfterMutation, turboMode, hybridMode, backgroundOnly, indexMode, dataIndexYmd, indexStatus, filtroCoordenacaoId, filtroMonitoramentoId]);

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
    // IMPORTANTE: NÃO limpa o checkpoint (false), permitindo retomar depois
    forceKillHibrido(false);
    forceKill(false);
    setHybridMode(false);
    setTurboMode(false);
    setBackgroundOnly(false);
    onAfterMutation();
  }, [forceKill, forceKillHibrido, onAfterMutation]);

  const handleLimparIndice = useCallback(async () => {
    const dataYmd = getDataYmd(dataIndice) || getDataYmd(new Date());
    if (!dataYmd) {
      toast.error('Selecione um dia para limpar o índice');
      return;
    }
    await limparIndiceDiario(dataYmd);
    onAfterMutation();
  }, [dataIndice, getDataYmd, limparIndiceDiario, onAfterMutation]);

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
    // Preferir % exata persistida pelo engine
    const pct = (checkpoint as any).percentage;
    if (typeof pct === 'number' && Number.isFinite(pct)) return Math.min(99, toSafePct(pct));

    const gc = (checkpoint as any).globalCurrent;
    const gt = (checkpoint as any).globalTotal;
    if (typeof gc === 'number' && typeof gt === 'number' && gt > 0) {
      return Math.min(99, toSafePct((gc / gt) * 100));
    }

    // Fallback legado (aproximação) — mantém compatibilidade, mas pode divergir
    const totalDias = Math.max(
      1,
      Math.ceil(
        (new Date(checkpoint.dataFimYmd).getTime() - new Date(checkpoint.dataInicioYmd).getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1
    );
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
          {/* Filtros: Coordenação e Termos — SEMPRE visíveis no topo (disabled quando rodando) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Coordenação</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={filtroCoordenacaoId}
                onChange={(e) => setFiltroCoordenacaoId(e.target.value)}
                disabled={effectiveIsRunning}
              >
                <option value="">Todos</option>
                {coordenacoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {coordenacaoFiltroEfetivo && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Termo</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                  value={filtroMonitoramentoId}
                  onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                  disabled={effectiveIsRunning}
                >
                  <option value="">Todos</option>
                  {monitoramentos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {effectiveIsRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
            <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
              Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Coord.'}
              {filtroMonitoramentoId && (
                <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || 'Termo'}</>
              )}
            </div>
          )}

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
                            const filtros = {
                              coordenacaoId: filtroCoordenacaoId || undefined,
                              monitoramentoIds: filtroMonitoramentoId ? [filtroMonitoramentoId] : undefined,
                            };
                            executar(getDataYmd(dataInicio), getDataYmd(dataFim), { turbo: turboMode, ...filtros });
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
                    <span className="ml-1 break-words">
                      {effectiveTermoAtual}
                      {effectiveTermoDescricao && effectiveTermoDescricao !== effectiveTermoAtual && (
                        <span className="text-xs text-muted-foreground ml-1">({effectiveTermoDescricao})</span>
                      )}
                    </span>
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
            {indexStatus?.status === 'em_andamento' && (
              <Badge variant="secondary">Rodízio por tribunal ativo</Badge>
            )}
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

           {/* Indicador de execução em background */}
           {effectiveIsRunning && (
             <p className="text-xs text-center text-muted-foreground">
               💡 Execução continua em background mesmo ao sair desta tela
             </p>
           )}
         </CardContent>
       </Card>

       {/* Card de Agendamento Automático */}
       <SchedulerCard />
       <SchedulerProCard />

       {/* Card de Índice Diário */}

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Índice diário (DJEN)</CardTitle>
            </div>
            {indexStatus && (
              <Badge variant="secondary">{indexStatusLabel}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {indexStatus ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Índice diário ({indexStatus.diario_ymd})</span>
                <Badge variant="secondary">{indexStatusLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
                <span>{indexStatusMessage}</span>
                {indexElapsedLabel
                  ? <span>Em execução há {indexElapsedLabel}</span>
                  : (indexLastUpdateLabel && <span>Atualizado {indexLastUpdateLabel}</span>)}
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
              {indexStatus.status === 'em_andamento' && shouldShowIndexErrors && indexErrosCount > 0 && (
                <div className="text-[11px] text-destructive">
                  Tribunais com erro: {indexErrosCount}
                </div>
              )}
              {indexStatus.status === 'em_andamento' && indexTribunais.length > 0 && (
                <ScrollArea className="h-40 rounded border bg-muted/20 p-2">
                  <div className="space-y-2">
                    {indexTribunais.map((t) => {
                      const max = Number(t.max_pages || 0);
                      const showTotalPages = max > 0 && max !== 200;
                      const done = Number(t.paginas_processadas || 0);
                      const pct = max > 0 ? Math.min(99, Math.round((done / max) * 100)) : (t.status === 'concluido' ? 100 : 0);
                      const pagesLabel = showTotalPages ? `${done}/${max}` : `${done}`;
                      return (
                        <div key={t.tribunal} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-medium">{t.tribunal}</span>
                            <span className={t.status === 'erro' ? 'text-destructive' : undefined}>
                              {t.status} • {pagesLabel} • {pct}%
                            </span>
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
              {indexStatus.status === 'concluido' && shouldShowIndexErrors && indexErrosCount > 0 && (
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
          ) : indexActionPending ? (
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Indexação solicitada. Aguardando criação do índice...
            </div>
          ) : (
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Nenhum índice encontrado para exibir.
            </div>
          )}

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataIndice ? format(dataIndice, "dd/MM", { locale: ptBR }) : "Data do índice"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataIndice}
                  onSelect={setDataIndice}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

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

          <div className="flex gap-2 flex-wrap">
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

          {indexStatus?.status === 'em_andamento' && (
            <div className="flex">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={handleCancelarIndexacao}
              >
                Forçar cancelar indexação
              </Button>
            </div>
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
