/**
 * DJEN Termos Pro Dashboard Card
 * 
 * Clone do DjenTermosDashboardCardV2 adaptado para o engine Pro (singleton).
 * Usa useDjenTermosPro ao invés de useDjenTermos.
 * Motor independente com validação por metadados estruturados.
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
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
  Loader2, Zap, PlayCircle, StopCircle,
  CheckCircle2, XCircle, Clock, CalendarIcon, RotateCcw, Skull, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDjenTermosPro } from "@/hooks/useDjenTermosPro";
import { useDjenTermosProScheduler } from "@/hooks/useDjenTermosProScheduler";
import { toast } from "sonner";
import { withTimeout } from "@/utils/withTimeout";

interface Props {
  coordenacaoId: string;
}

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

// Sub-components for scheduler (must be separate to use hooks independently)
function SchedulerProBadge() {
  const { ativo } = useDjenTermosProScheduler();
  return <Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Ativo" : "Inativo"}</Badge>;
}

function SchedulerProToggle() {
  const { ativo, horario, start, stop, setTime } = useDjenTermosProScheduler();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="djen-pro-scheduler-toggle" className="text-sm font-medium">Ativar agendamento</Label>
        <Switch
          id="djen-pro-scheduler-toggle"
          checked={ativo}
          onCheckedChange={(checked) => {
            if (checked) { start(); toast.success('Agendamento Pro ativado'); }
            else { stop(); toast.info('Agendamento Pro desativado'); }
          }}
        />
      </div>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Label className="text-sm font-medium whitespace-nowrap">Horário (BRT)</Label>
        <Input
          type="time"
          value={horario}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              const [h, m] = val.split(':').map(Number);
              setTime(h, m);
              toast.success(`Horário alterado para ${val}`);
            }
          }}
          className="w-28 h-8"
        />
      </div>
    </div>
  );
}

function SchedulerProStatus() {
  const { ativo, proximoHorario } = useDjenTermosProScheduler();
  if (!ativo || !proximoHorario) return null;
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
      <Clock className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Próxima execução</p>
        <p className="text-sm font-medium">{proximoHorario}</p>
      </div>
    </div>
  );
}

export function MonitoramentoTermosProCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    limpar,
    forceKill,
  } = useDjenTermosPro();

  // Filtros
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord-termos-pro', coordenacaoFiltroEfetivo],
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

  // Modo híbrido (backend) — Pro engine pode operar no navegador ou delegar ao backend
  const [hybridMode, setHybridMode] = useState(false);
  const [backgroundOnly, setBackgroundOnly] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);

  useEffect(() => {
    const savedHybrid = localStorage.getItem('djen-pro-hybrid-mode');
    const savedBg = localStorage.getItem('djen-pro-background-only');
    if (savedBg === 'true') {
      setBackgroundOnly(true);
      setHybridMode(false);
    } else if (savedHybrid === 'true') {
      setHybridMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('djen-pro-hybrid-mode', hybridMode ? 'true' : 'false');
  }, [hybridMode]);

  useEffect(() => {
    localStorage.setItem('djen-pro-background-only', backgroundOnly ? 'true' : 'false');
    if (backgroundOnly) setHybridMode(false);
  }, [backgroundOnly]);

  const handleToggleHybrid = useCallback((checked: boolean) => {
    setHybridMode(checked);
    if (checked) setBackgroundOnly(false);
  }, []);

  const handleToggleBackground = useCallback((checked: boolean) => {
    setBackgroundOnly(checked);
    if (checked) setHybridMode(false);
  }, []);

  // Estado para seleção de datas
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!dataInicio && !dataFim) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataInicio(hoje);
      setDataFim(hoje);
    }
  }, [dataInicio, dataFim]);

  const getDataYmd = useCallback((date?: Date): string | undefined => {
    if (!date) return undefined;
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return format(d, 'yyyy-MM-dd');
  }, []);

  // Status config
  const effectiveStatus = progress.status;
  const effectiveIsRunning = isRunning || effectiveStatus === 'executando';
  const displayedPercentage = useMemo(() => {
    const raw = Number.isFinite(progress.percentage) ? Math.round(progress.percentage) : 0;
    const clamped = Math.min(100, Math.max(0, raw));
    return effectiveIsRunning ? Math.min(99, clamped) : clamped;
  }, [progress.percentage, effectiveIsRunning]);
  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.idle;
  const StatusIcon = statusConfig.icon;

  // Checkpoint percent
  const checkpointPercent = useMemo(() => {
    if (!checkpoint) return 0;
    const gc = (checkpoint as any).globalCurrent;
    const gt = (checkpoint as any).globalTotal;
    if (typeof gc === 'number' && typeof gt === 'number' && gt > 0) {
      return Math.min(99, Math.round((gc / gt) * 100));
    }
    const totalDias = Math.max(
      1,
      Math.ceil(
        (new Date(checkpoint.dataFimYmd).getTime() - new Date(checkpoint.dataInicioYmd).getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1
    );
    return Math.min(99, Math.round(((checkpoint.diaIndice * 100 + checkpoint.termoIndice) / (totalDias * 100)) * 100));
  }, [checkpoint]);

  // Handlers
  const getFilterParams = useCallback(() => ({
    coordenacaoId: filtroCoordenacaoId || undefined,
    monitoramentoIds: filtroMonitoramentoId ? [filtroMonitoramentoId] : 
      (filtroCoordenacaoId && monitoramentos.length > 0 ? monitoramentos.map(m => m.id) : undefined),
  }), [filtroCoordenacaoId, filtroMonitoramentoId, monitoramentos]);

  const handleExecutar = useCallback(() => {
    if (canResume && !backgroundOnly) {
      setShowResumeDialog(true);
      return;
    }
    
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data de início e fim antes de executar');
      return;
    }

    const filters = getFilterParams();
    executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
  }, [canResume, backgroundOnly, dataInicio, dataFim, getDataYmd, executar, getFilterParams]);

  const handleRetomar = useCallback(() => {
    if (!checkpoint) return;
    const filters = getFilterParams();
    retomar(filters.coordenacaoId, filters.monitoramentoIds);
  }, [checkpoint, retomar, getFilterParams]);

  const handleNovaExecucao = useCallback(() => {
    setShowResumeDialog(false);
    const filters = getFilterParams();
    executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
  }, [executar, getDataYmd, dataInicio, dataFim, getFilterParams]);

  const handleCancelar = useCallback(() => {
    cancelar();
  }, [cancelar]);

  const handleForceKill = useCallback(() => {
    setShowKillDialog(false);
    forceKill(true);
  }, [forceKill]);

  const handleLimparPublicacoes = useCallback(async () => {
    try {
      forceKill(true);
      toast.info('Limpando publicações...');
      
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje', {
          body: {
            modo: 'intervalo',
            dataInicio: getDataYmd(dataInicio),
            dataFim: getDataYmd(dataFim),
          },
        }),
        240_000,
        'A limpeza demorou mais que 240s.'
      );
      if (error) throw error;

      limpar();

      const keys = [
        ['publicacoes-djen'], ['publicacoes-unificadas'], ['publicacoes-unificadas-stats'],
        ['descartadas-djen'], ['djen-stats'], ['djen-stats-hoje'], ['notificacoes-counts'],
      ] as const;
      await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [...k], refetchType: 'active' })));

      toast.success((data as any)?.message ?? 'Limpeza concluída!');
    } catch (err: any) {
      console.error('Erro ao limpar:', err);
      toast.error(`Erro: ${err?.message ?? String(err)}`);
    }
  }, [forceKill, limpar, getDataYmd, dataInicio, dataFim, queryClient]);

  return (
    <>
      <Card className={cn("relative overflow-hidden", effectiveIsRunning && "ring-2 ring-primary/30")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">DJEN Termos Pro</CardTitle>
            </div>
            <Badge variant="secondary" className={cn("gap-1", statusConfig.bg, statusConfig.color)}>
              <StatusIcon className={cn("h-3 w-3", statusConfig.animate && "animate-spin")} />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filtros: Coordenação e Termos */}
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
              Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Todas'}
              {filtroMonitoramentoId && (
                <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || 'Termo'}</>
              )}
            </div>
          )}

          {/* Alerta de checkpoint disponível após erro/cancelamento */}
          {!effectiveIsRunning && canResume && 
           (effectiveStatus === 'erro' || effectiveStatus === 'cancelado') && (
            <div className="rounded-md bg-accent p-3 text-sm text-accent-foreground border border-accent/50">
              <div className="flex items-start gap-2">
                <RotateCcw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Execução interrompida em {checkpointPercent}%</p>
                  <p className="text-xs mt-1 mb-2">
                    Você pode continuar de onde parou ou reiniciar do zero.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={handleRetomar}>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Continuar de {checkpointPercent}%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      forceKill(true);
                      setTimeout(() => {
                        if (dataInicio && dataFim) {
                          const filters = getFilterParams();
                          executar(getDataYmd(dataInicio), getDataYmd(dataFim), filters.coordenacaoId, filters.monitoramentoIds);
                        }
                      }, 500);
                    }}>
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Reiniciar do Zero
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progresso */}
          {(effectiveIsRunning || effectiveStatus === 'concluido' || effectiveStatus === 'cancelado') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.diaAtualYmd && (
                    <span className="font-medium">
                      📅 Dia {progress.diaAtualIndice}/{progress.totalDias} •
                    </span>
                  )}
                  {progress.termoAtual && (
                    <span className="ml-1 break-words">{progress.termoAtual}</span>
                  )}
                </span>
                <span className="font-mono font-medium">{displayedPercentage}%</span>
              </div>
              <Progress value={displayedPercentage} className="h-2" />
              {!!progress.mensagem && (
                <p className="text-xs text-muted-foreground">{progress.mensagem}</p>
              )}
            </div>
          )}

          {/* Totalizadores */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-primary">
              ✓ {progress.novas} encontradas (não lidas)
            </span>
            <span className="text-muted-foreground">
              ↔ {progress.duplicadas} duplicadas
            </span>
            <span className="text-destructive">
              ✗ {progress.descartadas} descartadas
            </span>
          </div>

          {/* Indicadores de estratégia */}
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary">Prioridade: Advogado/OAB</Badge>
            <Badge variant="secondary">Validação por metadados</Badge>
            {backgroundOnly && <Badge variant="secondary">Modo 100% background</Badge>}
            {!backgroundOnly && hybridMode && <Badge variant="secondary">Modo híbrido</Badge>}
            {!backgroundOnly && !hybridMode && <Badge variant="secondary">Modo navegador</Badge>}
          </div>

          {/* Modo híbrido */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-pro-hybrid" className="text-xs text-muted-foreground">
                Modo híbrido (backend)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Executa a busca usando backend como proxy quando o navegador é bloqueado por CORS.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="djen-pro-hybrid"
              checked={hybridMode}
              onCheckedChange={handleToggleHybrid}
              disabled={effectiveIsRunning || backgroundOnly}
            />
          </div>

          {/* 100% background */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="djen-pro-background" className="text-xs text-muted-foreground">
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
              id="djen-pro-background"
              checked={backgroundOnly}
              onCheckedChange={handleToggleBackground}
              disabled={effectiveIsRunning}
            />
          </div>

          {/* Tempo */}
          {progress.tempoDecorrido > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(progress.tempoDecorrido)}</span>
            </div>
          )}

          {/* Seletor de datas */}
          {!effectiveIsRunning && (
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

          {/* Botões principais */}
          <div className="flex gap-2 flex-wrap">
            {effectiveIsRunning ? (
              <Button variant="destructive" size="sm" className="flex-1" onClick={handleCancelar}>
                <StopCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            ) : (
              <>
                <Button size="sm" className="flex-1" onClick={handleExecutar}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Executar
                </Button>
                {canResume && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={handleRetomar}>
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

          {/* Limpar e Reset */}
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-muted-foreground hover:text-foreground"
                    onClick={handleLimparPublicacoes}
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

          {/* Indicador background */}
          {effectiveIsRunning && (
            <p className="text-xs text-center text-muted-foreground">
              💡 Execução continua em background mesmo ao sair desta tela
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card de Agendamento Pro */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Agendamento Automático Pro</CardTitle>
            </div>
            <SchedulerProBadge />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Executa automaticamente todos os dias às <span className="font-semibold text-foreground">20:45 BRT</span> com data do dia
          </p>
          <SchedulerProToggle />
          <SchedulerProStatus />
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 border border-muted">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Mantenha esta aba aberta para que o agendamento funcione
            </p>
          </div>
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
            <Button variant="destructive" onClick={handleForceKill}>
              Forçar Cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
