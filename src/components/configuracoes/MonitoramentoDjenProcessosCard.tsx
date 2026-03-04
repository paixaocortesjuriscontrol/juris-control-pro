import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Clock, CalendarIcon, X, ExternalLink, ChevronDown, FileText, Layers, CheckCircle2, Play, Globe, Skull, FileSearch, StopCircle, RotateCcw, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useDjenProcessosScheduler } from "@/hooks/useDjenProcessosScheduler";
import { useRealtimeProgress } from "@/hooks/useRealtimeProgress";
import { useDjenProcessos } from "@/hooks/useDjenProcessos";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

interface ExecutionResult {
  processados: number;
  novas: number;
  erros: number;
  duracaoSegundos?: number;
  executadoEm?: string;
}

interface Props {
  coordenacaoId: string;
  onOpenFullTab?: () => void;
  /** Quando informado (ex: Dashboard), usa o fluxo do pai em vez do interno */
  onExecute?: () => void | Promise<void>;
}

export function MonitoramentoDjenProcessosCard({ coordenacaoId, onOpenFullTab, onExecute }: Props) {
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [statsOpen, setStatsOpen] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);
  const [backgroundOnly, setBackgroundOnly] = useState(false);
  const queryClient = useQueryClient();

  // Hook singleton para execução no NAVEGADOR (persiste ao sair da tela)
  const {
    progress: engineProgress,
    isRunning: engineRunning,
    hasCheckpoint,
    executar: engineExecutar,
    executarHibrido,
    cancelar: engineCancelar,
    cancelarHibrido,
    forceKill,
    forceKillHibrido,
    limparPublicacoesProcesso,
  } = useDjenProcessos();

  // Hook de progresso realtime via Supabase (para detectar execuções externas/agendadas)
  const { progress: realtimeProgress } = useRealtimeProgress({
    tipo: 'djen_processos',
    enabled: true,
    onComplete: () => {
      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
      toast.success('Busca DJEN por Processo concluída!');
    },
  });

  // Determina se está executando (engine local ou detectado via realtime)
  const executando = engineRunning || realtimeProgress.isRunning;

  // Progresso combinado: engine local tem prioridade
  const progresso = useMemo(() => {
    if (engineRunning) {
      return {
        grupoAtual: `Processo ${engineProgress.currentGroup}/${engineProgress.totalGroups}`,
        currentGroup: engineProgress.currentGroup,
        totalGroups: engineProgress.totalGroups,
        novas: engineProgress.novas,
        analisadas: engineProgress.totalPublicacoesAnalisadas,
        mensagem: engineProgress.mensagem,
        percentage: engineProgress.percentage,
        elapsedSeconds: engineProgress.tempoDecorrido,
      };
    }
    if (realtimeProgress.isRunning) {
      return {
        grupoAtual: `Processo ${realtimeProgress.current}/${realtimeProgress.total}`,
        currentGroup: realtimeProgress.current,
        totalGroups: realtimeProgress.total,
        novas: realtimeProgress.novas ?? 0,
        analisadas: realtimeProgress.current,
        mensagem: `${realtimeProgress.current}/${realtimeProgress.total}`,
        percentage: realtimeProgress.total > 0 ? Math.round((realtimeProgress.current / realtimeProgress.total) * 100) : 0,
        elapsedSeconds: 0,
      };
    }
    return null;
  }, [engineRunning, engineProgress, realtimeProgress]);

  useEffect(() => {
    const savedTurbo = localStorage.getItem('djen-processos-turbo');
    const savedHybrid = localStorage.getItem('djen-processos-hybrid');
    const savedBg = localStorage.getItem('djen-processos-background-only');
    setTurboMode(savedTurbo === 'true');
    setHybridMode(savedHybrid === 'true');
    setBackgroundOnly(savedBg === 'true');
  }, []);

  // Datas padrão (igual DJEN Termos) - essencial para Executar funcionar
  useEffect(() => {
    if (!dataInicio && !dataFim) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      setDataInicio(hoje);
      setDataFim(hoje);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('djen-processos-turbo', turboMode ? 'true' : 'false');
  }, [turboMode]);

  useEffect(() => {
    localStorage.setItem('djen-processos-hybrid', hybridMode ? 'true' : 'false');
    if (hybridMode) {
      setBackgroundOnly(false);
      setTurboMode(false);
    }
  }, [hybridMode]);

  useEffect(() => {
    localStorage.setItem('djen-processos-background-only', backgroundOnly ? 'true' : 'false');
    if (backgroundOnly) {
      setHybridMode(false);
      setTurboMode(false);
    }
  }, [backgroundOnly]);

  // Helper para formatar tempo
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Buscar configuração
  const { data: config, isLoading } = useQuery({
    queryKey: ['config-djen-processos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const metadata = (config?.metadata as Record<string, any> | null) ?? null;
  const nextOffset = (metadata?.next_offset as number | undefined) ?? undefined;
  const totalCheckpoint = (metadata?.total as number | undefined) ?? undefined;
  // Detecta se foi cancelamento explícito do usuário (não mostrar botão Retomar)
  const wasCancelledByUser = metadata?.cancelado === true || metadata?.status === 'cancelado';

  // Usa a melhor estimativa de checkpoint/progresso para evitar “voltar” ao retomar.
  // Importante: só mostramos o botão se o backend realmente indicou checkpoint (next_offset > 0)
  // e se ainda não atingimos o total.
  const stableTotalForResume = Math.max(totalCheckpoint ?? 0, realtimeProgress.total ?? 0);
  const resumeFromOffsetRaw = Math.max(
    nextOffset ?? 0,
    (metadata?.current as number | undefined) ?? 0,
    realtimeProgress.current ?? 0
  );
  const resumeFromOffset = stableTotalForResume > 0
    ? Math.min(resumeFromOffsetRaw, stableTotalForResume)
    : resumeFromOffsetRaw;
  
  // Detecta se falhou e precisa de retomada (502, timeout, etc.)
  const hasFailed = metadata?.status === 'falhou' || metadata?.status === 'erro' || metadata?.status === 'timeout';
  
  // Mostrar botão Retomar se tem checkpoint no engine
  const shouldShowRetomar = hasCheckpoint && !engineRunning;

  // Buscar estatísticas
  const { data: stats } = useQuery({
    queryKey: ['djen-processos-stats'],
    queryFn: async () => {
      const { count: totalPublicacoes } = await supabase
        .from('publicacoes_djen_processos')
        .select('*', { count: 'exact', head: true });

      const { count: naoLidas } = await supabase
        .from('publicacoes_djen_processos')
        .select('*', { count: 'exact', head: true })
        .eq('lida', false);

      // Conta somente processos com monitorar_djen = true
      const { count: processosMonitorados } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .eq('monitorar_djen', true);

      return {
        totalPublicacoes: totalPublicacoes || 0,
        naoLidas: naoLidas || 0,
        processosMonitorados: processosMonitorados || 0
      };
    },
    refetchInterval: 30000
  });

  // Buscar último histórico
  const { data: ultimoHistorico } = useQuery({
    queryKey: ['djen-processos-historico'],
    queryFn: async () => {
      const { data } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .order('executado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  // Buscar histórico completo para relatório
  const { data: historicoCompleto } = useQuery({
    queryKey: ['djen-processos-historico-completo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .order('executado_em', { ascending: false })
        .limit(20);
      return data || [];
    }
  });

  const handleExecutar = useCallback(async () => {
    if (executando) {
      toast.info('Execução já em andamento');
      return;
    }
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : format(hoje, 'yyyy-MM-dd');
    const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : format(hoje, 'yyyy-MM-dd');
    try {
      toast.info('Iniciando busca DJEN Processos...');
      if (backgroundOnly) {
        await executarHibrido(dataInicioStr, dataFimStr, { backgroundOnly: true });
        return;
      }
      if (hybridMode) {
        await executarHibrido(dataInicioStr, dataFimStr);
        return;
      }
      engineExecutar(dataInicioStr, dataFimStr, { retomar: false, turbo: turboMode });
    } catch (err: any) {
      console.error('[DJEN Processos] Erro ao iniciar:', err);
      toast.error(`Erro: ${err?.message ?? 'Falha ao iniciar'}`);
    }
  }, [executando, dataInicio, dataFim, engineExecutar, turboMode, hybridMode, backgroundOnly, executarHibrido]);

  const handleExecutarManual = useCallback((mode: 'novo' | 'retomar' = 'novo') => {
    if (mode === 'retomar') {
      if (executando) return;
      const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined;
      const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined;
      engineExecutar(dataInicioStr, dataFimStr, { retomar: true, turbo: turboMode });
      toast.info('Retomando busca...');
      return;
    }
    handleExecutar();
  }, [executando, dataInicio, dataFim, engineExecutar, turboMode, handleExecutar]);

  const handleCancelar = useCallback(() => {
    if (hybridMode || backgroundOnly) {
      cancelarHibrido();
    } else {
      engineCancelar();
    }
    toast.info('Cancelando...');
  }, [engineCancelar, cancelarHibrido, hybridMode, backgroundOnly]);

  const handleForceKill = useCallback(async () => {
    setShowKillDialog(false);
    forceKillHibrido();
    await forceKill();
    queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
  }, [forceKill, forceKillHibrido, queryClient]);

  // Scheduler hook
  const scheduler = useDjenProcessosScheduler();

  const handleFrequenciaChange = async (value: string) => {
    // No longer used - kept for compatibility
  };

  const handleAtivoChange = async (checked: boolean) => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({ ativo: checked })
      .eq('id', config.id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
      toast.success(checked ? 'Monitoramento ativado' : 'Monitoramento desativado');
    }
  };

  const limparDatas = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = progresso?.percentage ?? 0;

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSearch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">DJEN por Processo</CardTitle>
              <CardDescription className="text-xs">
                Busca publicações no DJEN para processos cadastrados
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={config?.ativo ?? false}
            onCheckedChange={handleAtivoChange}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progresso em destaque quando executando - aparece no topo para visibilidade */}
        {executando && (
          <div className="space-y-3 p-3 rounded-lg bg-primary/10 border-2 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando por processos...
              </div>
              <div className="flex items-center gap-2">
                {progresso && progresso.elapsedSeconds > 0 && (
                  <Badge variant="outline" className="gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {formatElapsed(progresso.elapsedSeconds)}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleCancelar} className="h-7 gap-1 text-destructive hover:text-destructive">
                  <StopCircle className="h-3 w-3" />
                  Cancelar
                </Button>
              </div>
            </div>
            {/* Barra de progresso com porcentagem igual DJEN Termos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {progresso?.currentGroup ?? 0}/{progresso?.totalGroups ?? '?'} processos • +{progresso?.novas ?? 0} novas
                </span>
                <span className="font-mono font-semibold text-primary">
                  {progresso?.percentage ?? 0}%
                </span>
              </div>
              <Progress value={progresso?.percentage ?? 0} className="h-3" />
            </div>
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{stats?.processosMonitorados || 0}</p>
            <p className="text-xs text-muted-foreground">Processos</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{stats?.totalPublicacoes || 0}</p>
            <p className="text-xs text-muted-foreground">Publicações</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold text-orange-600">{stats?.naoLidas || 0}</p>
            <p className="text-xs text-muted-foreground">Não lidas</p>
          </div>
        </div>

        {/* Filtros de data */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Período de busca (opcional)</span>
            {(dataInicio || dataFim) && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={limparDatas}>
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal h-8",
                    !dataInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {dataInicio ? format(dataInicio, "dd/MM/yy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal h-8",
                    !dataFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {dataFim ? format(dataFim, "dd/MM/yy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  disabled={(date) => date > new Date() || (dataInicio ? date < dataInicio : false)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            {!dataInicio && !dataFim ? "Sem datas = busca apenas hoje" : ""}
          </p>
        </div>

        {/* Indicadores de modo */}
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {backgroundOnly && <Badge variant="secondary">Modo 100% background</Badge>}
          {!backgroundOnly && hybridMode && <Badge variant="secondary">Modo híbrido</Badge>}
          {!backgroundOnly && !hybridMode && <Badge variant="secondary">Modo navegador</Badge>}
          {turboMode && !hybridMode && !backgroundOnly && <Badge variant="secondary">Modo turbo</Badge>}
        </div>

        {/* Modo turbo */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="djen-processos-turbo" className="text-xs text-muted-foreground">
              Modo turbo
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Aumenta a velocidade com mais paralelismo e menos delays.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            id="djen-processos-turbo"
            checked={turboMode}
            onCheckedChange={setTurboMode}
            disabled={executando || hybridMode || backgroundOnly}
          />
        </div>

        {/* Modo híbrido */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="djen-processos-hybrid" className="text-xs text-muted-foreground">
              Modo híbrido (backend)
            </Label>
          </div>
          <Switch
            id="djen-processos-hybrid"
            checked={hybridMode}
            onCheckedChange={setHybridMode}
            disabled={executando || backgroundOnly}
          />
        </div>

        {/* 100% background */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="djen-processos-background" className="text-xs text-muted-foreground">
              100% background
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Executa totalmente no backend. Pode fechar o navegador.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            id="djen-processos-background"
            checked={backgroundOnly}
            onCheckedChange={setBackgroundOnly}
            disabled={executando}
          />
        </div>

        {/* Status e Última execução */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Status</Label>
              <p className="text-sm text-muted-foreground">
                {config?.ativo ? "Executando automaticamente" : "Pausado"}
              </p>
            </div>
            <Badge variant={config?.ativo ? "default" : "secondary"}>
              {config?.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          
          {config?.ultima_execucao && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Última execução: {format(toZonedTime(new Date(config.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              {ultimoHistorico && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Layers className="h-3 w-3" />
                    {ultimoHistorico.processos_verificados} processos
                  </Badge>
                  {ultimoHistorico.novos_andamentos > 0 && (
                    <Badge variant="default" className="gap-1 bg-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {ultimoHistorico.novos_andamentos} novas
                    </Badge>
                  )}
                  {ultimoHistorico.erros > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      {ultimoHistorico.erros} erros
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agendamento Automático */}
        <div className="space-y-3 p-3 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Agendamento Automático</Label>
              <p className="text-xs text-muted-foreground">
                Executa diariamente no horário configurado (BRT)
              </p>
            </div>
            <Switch
              checked={scheduler.ativo}
              onCheckedChange={(checked) => {
                if (checked) scheduler.start();
                else scheduler.stop();
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Horário (BRT):</Label>
            <Input
              type="time"
              value={scheduler.horario}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [h, m] = val.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m)) {
                    scheduler.setTime(h, m);
                  }
                }
              }}
              className="w-28 h-8 text-sm"
            />
          </div>

          {scheduler.ativo && scheduler.proximoHorario && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Próximo: {scheduler.proximoHorario}</span>
            </div>
          )}
        </div>

        {/* Relatório de Execuções */}
        {historicoCompleto && historicoCompleto.length > 0 && (
          <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Histórico de Execuções
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Execuções</p>
                    <p className="font-bold text-lg">{historicoCompleto.length}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Total Processos</p>
                    <p className="font-bold text-lg">{historicoCompleto.reduce((acc, h) => acc + h.processos_verificados, 0)}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Novas</p>
                    <p className="font-bold text-lg text-green-600">{historicoCompleto.reduce((acc, h) => acc + h.novos_andamentos, 0)}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Erros</p>
                    <p className="font-bold text-lg text-destructive">{historicoCompleto.reduce((acc, h) => acc + h.erros, 0)}</p>
                  </div>
                </div>

                {/* Executions Table */}
                <ScrollArea className="h-[200px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b">
                        <th className="text-left p-1.5 font-medium">Data/Hora</th>
                        <th className="text-right p-1.5 font-medium">Processos</th>
                        <th className="text-right p-1.5 font-medium text-green-600">Novas</th>
                        <th className="text-right p-1.5 font-medium text-destructive">Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoCompleto.map((h) => (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="p-1.5">
                            {format(toZonedTime(new Date(h.executado_em), 'America/Sao_Paulo'), "dd/MM HH:mm", { locale: ptBR })}
                          </td>
                          <td className="p-1.5 text-right">{h.processos_verificados}</td>
                          <td className="p-1.5 text-right text-green-600 font-medium">{h.novos_andamentos || '-'}</td>
                          <td className="p-1.5 text-right text-destructive">{h.erros || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Botões */}
        <div className="flex gap-2 flex-wrap">
          {/* Botão Retomar (aparece se tem checkpoint) */}
          {shouldShowRetomar && (
            <Button
              variant="outline"
              onClick={() => handleExecutarManual('retomar')}
              disabled={executando}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Continuar
            </Button>
          )}

          {/* Kill Switch */}
          {(executando || hasCheckpoint || engineProgress.status === 'erro') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowKillDialog(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Skull className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Reset Total - Forçar cancelamento e limpar todo estado</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Botão principal */}
          {executando ? (
            <Button
              variant="destructive"
              onClick={handleCancelar}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          ) : (
            <Button 
              type="button"
              className="flex-1"
              onClick={() => (onExecute ? onExecute() : handleExecutar())}
            >
              <Play className="h-4 w-4 mr-2" />
              Executar
            </Button>
          )}
        </div>

        {/* Linha 2: Limpar Publicações e Reset Total (igual DJEN Termos) */}
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  await limparPublicacoesProcesso(
                    dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined,
                    dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined
                  );
                  queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
                }}
                disabled={executando}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpar Publicações
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Limpar SOMENTE publicações encontradas por processo (não toca em termos)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => setShowKillDialog(true)}
                disabled={executando}
              >
                <Skull className="h-4 w-4 mr-1" />
                Reset Total
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Forçar cancelamento e limpar todo estado</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Progresso quando executando */}
        {executando && progresso && (
          <div className="text-xs text-center text-muted-foreground">
            Processando... {progressPercent > 0 ? `${progressPercent}%` : ''}
          </div>
        )}

        {/* Abrir aba completa + Link para auditoria */}
        <div className="flex gap-2">
          {onOpenFullTab && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={onOpenFullTab}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              Abrir aba DJEN Processos
            </Button>
          )}
          <Link to="/auditoria-djen-processos" className={onOpenFullTab ? "flex-1" : "block"}>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3 mr-2" />
              Ver auditoria de lotes
            </Button>
          </Link>
        </div>
      </CardContent>

      {/* Dialog Reset Total */}
      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Total?</AlertDialogTitle>
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
    </Card>
    </>
  );
}
