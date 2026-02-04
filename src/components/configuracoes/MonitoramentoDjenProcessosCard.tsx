import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSearch, Loader2, RefreshCw, Clock, CalendarIcon, X, ExternalLink, ChevronDown, FileText, Layers, CheckCircle2, Play, StopCircle, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { useRealtimeProgress } from "@/hooks/useRealtimeProgress";
import { BotaoRetomarLote } from "./BotaoRetomarLote";
import { useMonitorarDjenProcessosBrowser } from "@/hooks/useMonitorarDjenProcessosBrowser";

interface ExecutionResult {
  processados: number;
  novas: number;
  erros: number;
  duracaoSegundos?: number;
  executadoEm?: string;
}

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoDjenProcessosCard({ coordenacaoId }: Props) {
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [statsOpen, setStatsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Hook de execução no NAVEGADOR (evita WORKER_LIMIT das Edge Functions)
  const {
    progresso: browserProgress,
    isExecutando: browserExecutando,
    executar: browserExecutar,
    cancelar: browserCancelar,
  } = useMonitorarDjenProcessosBrowser();

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

  // Determina se está executando (browser local ou detectado via realtime)
  const executando = browserExecutando || realtimeProgress.isRunning;

  // Progresso combinado: browser local tem prioridade
  const progresso = browserExecutando ? {
    tribunalAtual: browserProgress.tribunalAtual || '',
    currentTribunal: browserProgress.currentTribunal,
    totalTribunais: browserProgress.totalTribunais,
    novas: browserProgress.novas,
    analisadas: browserProgress.totalPublicacoesAnalisadas,
    mensagem: browserProgress.mensagem,
    percentage: browserProgress.percentage,
    elapsedSeconds: browserProgress.elapsedSeconds,
  } : (realtimeProgress.isRunning ? {
    tribunalAtual: '',
    currentTribunal: 0,
    totalTribunais: 0,
    novas: realtimeProgress.novas ?? 0,
    analisadas: realtimeProgress.current,
    mensagem: `${realtimeProgress.current}/${realtimeProgress.total}`,
    percentage: realtimeProgress.total > 0 ? Math.round((realtimeProgress.current / realtimeProgress.total) * 100) : 0,
    elapsedSeconds: 0,
  } : null);

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
  
  // Mostrar botão Retomar se:
  // 1. Não foi cancelado pelo usuário
  // 2. Tem checkpoint válido (next_offset > 0)
  // 3. Ainda não atingiu o total OU falhou/teve erro
  const shouldShowRetomar =
    !wasCancelledByUser &&
    (nextOffset ?? 0) > 0 &&
    (hasFailed || stableTotalForResume <= 0 || resumeFromOffset < stableTotalForResume);

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

      const { count: processosMonitorados } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('monitorar_andamentos', true);

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

  // Execução no NAVEGADOR - evita completamente o WORKER_LIMIT das Edge Functions
  const handleExecutarManual = useCallback(async (mode: 'novo' | 'retomar' = 'novo') => {
    if (executando) return;
    
    const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined;
    const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined;
    
    await browserExecutar(dataInicioStr, dataFimStr, mode === 'retomar');
  }, [executando, dataInicio, dataFim, browserExecutar]);

  const handleCancelar = useCallback(() => {
    browserCancelar();
  }, [browserCancelar]);

  const handleFrequenciaChange = async (value: string) => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({ frequencia: value })
      .eq('id', config.id);
    if (error) {
      toast.error('Erro ao atualizar frequência');
    } else {
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
      toast.success('Frequência atualizada');
    }
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

        {/* Frequência */}
        <div className="space-y-2">
          <Label>Frequência de Execução</Label>
          <Select
            value={config?.frequencia || 'diario'}
            onValueChange={handleFrequenciaChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (9h BRT)</SelectItem>
              <SelectItem value="semanal">Semanal (Segunda 9h BRT)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Execução automática às 09:00 BRT
          </p>
        </div>

        {/* Horário agendado */}
        <HorarioAgendadoInfo 
          horariosExecucao={config?.horarios_execucao as string[] | null}
          frequencia={config?.frequencia}
        />

        {/* Progresso em Tempo Real */}
        {(executando || progresso) && (
          <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {realtimeProgress.isRunning && !browserExecutando ? 'Execução em andamento' : 'Buscando por tribunal...'}
              </div>
              <div className="flex items-center gap-2">
                {progresso && progresso.elapsedSeconds > 0 && (
                  <Badge variant="outline" className="gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {formatElapsed(progresso.elapsedSeconds)}
                  </Badge>
                )}
                {executando && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelar}
                    className="h-7 gap-1 text-destructive hover:text-destructive"
                  >
                    <StopCircle className="h-3 w-3" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            
            {progresso && (
              <div className="space-y-2">
                {/* Tribunal atual */}
                {progresso.tribunalAtual && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {progresso.tribunalAtual}
                    </Badge>
                    <span className="text-muted-foreground">
                      Tribunal {progresso.currentTribunal}/{progresso.totalTribunais}
                    </span>
                  </div>
                )}
                
                {/* Stats */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {progresso.analisadas?.toLocaleString('pt-BR') || 0} publicações analisadas
                  </span>
                  <span className="font-medium text-green-600">+{progresso.novas} novas</span>
                </div>
              </div>
            )}
            
            <Progress 
              value={progresso?.percentage ?? 0} 
              className={cn("h-2", (!progresso || progresso.percentage === 0) && "animate-pulse")} 
            />
            
            {progresso?.mensagem && (
              <div className="text-xs text-center text-muted-foreground truncate">
                {progresso.mensagem}
              </div>
            )}
          </div>
        )}

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
          <BotaoRetomarLote
            nextOffset={shouldShowRetomar ? resumeFromOffset : undefined}
            total={stableTotalForResume > 0 ? stableTotalForResume : totalCheckpoint}
            onRetomar={() => handleExecutarManual('retomar')}
            disabled={executando}
            wasCancelledByUser={wasCancelledByUser}
          />
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
              onClick={() => handleExecutarManual('novo')} 
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Executar Agora
            </Button>
          )}
        </div>

        {/* Progresso quando executando */}
        {executando && progresso && (
          <div className="text-xs text-center text-muted-foreground">
            Processando... {progressPercent > 0 ? `${progressPercent}%` : ''}
          </div>
        )}

        {/* Link para auditoria */}
        <Link to="/auditoria-djen-processos" className="block">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3 mr-2" />
            Ver auditoria de lotes
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
