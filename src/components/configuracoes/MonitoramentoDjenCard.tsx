import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Newspaper, Play, Clock, RefreshCw, ChevronDown, FileText, Layers, CheckCircle2, Activity, History, Radio, StopCircle, Trash2, CalendarIcon } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useDjenRunsHistory, useDjenRunDetails } from "@/hooks/useDjenRunsHistory";
import { useExecutarMonitoramento } from "@/hooks/useExecutarMonitoramento";
import { BotaoRetomarLote } from "./BotaoRetomarLote";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";

interface LiveRun {
  run_id: string;
  status: string;
  processados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
  erros: number;
  total_monitoramentos: number;
  total_paginas: number;
  total_resultados: number;
  duracao_segundos: number;
  iniciado_em: string;
}

interface Props {
  coordenacaoId: string;
}

interface TribunalStat {
  tribunal: string | null;
  paginas: number;
  resultados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
}

interface ExecutionResult {
  processados: number;
  novas: number;
  descartadas: number;
  duplicatas: number;
  totalPaginas: number;
  totalResultados: number;
  tribunaisStats: TribunalStat[];
  duracaoSegundos: number;
  executadoEm?: string;
}

// Helper para timeout de promises (fora do componente para não violar regras de hooks)
const withTimeout = async <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(t);
        reject(e);
      });
  });
};

export function MonitoramentoDjenCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const { 
    configuracaoDjen,
    isLoading, 
    atualizarConfiguracao 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const { runs } = useDjenRunsHistory();

  // Hook centralizado para executar via orquestrador
  const {
    executando,
    cancelando: cancelandoOrquestrador,
    executar: executarViaOrquestrador,
    cancelar: cancelarViaOrquestrador,
  } = useExecutarMonitoramento({
    tipo: 'djen',
    configId: configuracaoDjen?.id,
  });

  const [ultimoResultado, setUltimoResultado] = useState<ExecutionResult | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runsHistoryOpen, setRunsHistoryOpen] = useState(false);
  const [liveRun, setLiveRun] = useState<LiveRun | null>(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const { runDetails } = useDjenRunDetails(selectedRunId);
  
  // Estados para período de consulta
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date>(new Date());

  // Fetch last execution report from historico_monitoramento and new djen_runs table
  const { data: ultimoHistorico } = useQuery({
    queryKey: ['historico-monitoramento-djen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', 'djen')
        .gt('processos_verificados', 0)
        .order('executado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Latest run from the new table
  const latestRun = runs && runs.length > 0 ? runs[0] : null;

  // Fetch configured tribunals (from active DJEN terms) so the report can show
  // tribunals even when the last execution batch didn't reach those terms yet.
  const { data: monitoramentosTribunais } = useQuery({
    queryKey: ['djen-tribunais-configurados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('tribunais')
        .eq('ativo', true);

      if (error) throw error;
      return (data || []) as Array<{ tribunais: string[] | null }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Real-time subscription for djen_runs updates
  useEffect(() => {
    let disposed = false;

    const applyRun = (data: any | null) => {
      if (disposed) return;
      if (data) {
        setLiveRun({
          run_id: data.run_id,
          status: data.status,
          processados: data.processados || 0,
          novas: data.novas || 0,
          descartadas: data.descartadas || 0,
          duplicatas: data.duplicatas || 0,
          erros: data.erros || 0,
          total_monitoramentos: data.total_monitoramentos || 0,
          total_paginas: data.total_paginas || 0,
          total_resultados: data.total_resultados || 0,
          duracao_segundos: data.duracao_segundos || 0,
          iniciado_em: data.iniciado_em,
        });
        setLiveUpdatedAt(new Date());
      } else {
        setLiveRun(null);
        setLiveUpdatedAt(null);
      }
    };

    const isRunTrulyRunning = (row: any) => {
      if (!row || row.status !== 'em_andamento' || row.finalizado_em) {
        return false;
      }
      const iniciado = new Date(row.iniciado_em);
      const agora = new Date();
      const minutosDecorridos = (agora.getTime() - iniciado.getTime()) / 60000;
      if (minutosDecorridos > 15) {
        const duracaoMin = (row.duracao_segundos || 0) / 60;
        if (minutosDecorridos - duracaoMin > 5) {
          return false;
        }
      }
      return true;
    };

    const checkCurrentRun = async () => {
      const { data } = await supabase
        .from('djen_runs')
        .select('*')
        .eq('status', 'em_andamento')
        .is('finalizado_em', null)
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data && isRunTrulyRunning(data)) {
        applyRun(data);
      } else {
        applyRun(null);
        if (data && !isRunTrulyRunning(data)) {
          await supabase
            .from('djen_runs')
            .update({ status: 'cancelado', finalizado_em: new Date().toISOString() })
            .eq('run_id', data.run_id)
            .eq('status', 'em_andamento');
        }
      }
    };

    checkCurrentRun();

    const channel = supabase
      .channel('djen-runs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'djen_runs' },
        (payload) => {
          const newData = payload.new as any;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (isRunTrulyRunning(newData)) {
              applyRun(newData);
            } else if (['concluido', 'erro', 'cancelado'].includes(newData.status) || (newData.status === 'em_andamento' && newData.finalizado_em)) {
              setLiveRun(null);
              queryClient.invalidateQueries({ queryKey: ['djen-runs'] });
              queryClient.invalidateQueries({ queryKey: ['historico-monitoramento-djen'] });
              queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
              queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas-stats'] });
              queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
              if (newData.status === 'concluido') {
                toast.success(`Concluído: ${newData.processados || 0} verificados, ${newData.novas || 0} novas`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Salvar datas no metadata antes de executar
  const handleExecutarManual = async (retomar = false) => {
    if (liveRun) {
      toast.warning('Já existe uma execução DJEN em andamento. Aguarde ou cancele.');
      return;
    }

    // Salvar período no metadata para o orquestrador repassar
    if (configuracaoDjen?.id) {
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('metadata')
        .eq('id', configuracaoDjen.id)
        .maybeSingle();

      const currentMetadata = (config?.metadata as Record<string, any>) || {};
      
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            ...currentMetadata,
            dataInicio: format(dataInicio, 'yyyy-MM-dd'),
            dataFim: format(dataFim, 'yyyy-MM-dd'),
          },
        })
        .eq('id', configuracaoDjen.id);
    }

    // Executar via orquestrador (background job)
    await executarViaOrquestrador(retomar);
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoDjen) {
      atualizarConfiguracao.mutate({ id: configuracaoDjen.id, frequencia, tipo: 'djen' });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoDjen) {
      atualizarConfiguracao.mutate({ id: configuracaoDjen.id, ativo, tipo: 'djen' });
    }
  };

  const handleCancelarExecucao = async () => {
    if (!liveRun) return;
    
    setCancelando(true);
    try {
      // Cancelar via orquestrador (marca metadata + execucoes_agendadas)
      await cancelarViaOrquestrador();

      // Também marcar diretamente na djen_runs para UI refletir imediatamente
      await supabase
        .from('djen_runs')
        .update({ 
          status: 'cancelado', 
          finalizado_em: new Date().toISOString(),
          motivo_erro: 'Cancelado manualmente pelo usuário'
        })
        .eq('run_id', liveRun.run_id);
      
      toast.success('Execução cancelada com sucesso');
      setLiveRun(null);
      queryClient.invalidateQueries({ queryKey: ['djen-runs'] });
    } catch (error) {
      console.error('Erro ao cancelar execução:', error);
      toast.error('Erro ao cancelar execução');
    } finally {
      setCancelando(false);
    }
  };

  // Função separada: apenas limpa (cancela execução se houver, mas NÃO executa depois)
  const handleLimparApenas = async () => {
    if (!confirm('Isso vai limpar TODAS as publicações DJEN capturadas hoje. Deseja continuar?')) {
      return;
    }

    setLimpando(true);
    try {
      // Se houver execução "ao vivo" no banco, marcar como cancelada
      if (liveRun) {
        try {
          await handleCancelarExecucao();
        } catch {
          // best-effort
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      // Limpeza via SDK. Timeout para não "travar" a UI indefinidamente.
      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje'),
        60_000,
        'A limpeza demorou mais que 60s. Verifique o log da função e tente novamente.'
      );
      if (error) throw error;

      toast.success((data as any)?.message ?? 'Limpeza concluída! Agora você pode executar novamente.');
      
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['djen-runs'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
      queryClient.invalidateQueries({ queryKey: ['historico-monitoramento-djen'] });
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
    } catch (error) {
      console.error('Erro ao limpar:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLimpando(false);
    }
  };

  // Parse last execution from historico_monitoramento (persisted data)
  const lastRunFromHistorico: ExecutionResult | null = ultimoHistorico ? (() => {
    const detalhes = ultimoHistorico.detalhes as Record<string, any> | null;
    return {
      processados: ultimoHistorico.processos_verificados,
      novas: ultimoHistorico.novos_andamentos,
      descartadas: detalhes?.descartadas || 0,
      duplicatas: detalhes?.duplicatas || 0,
      totalPaginas: detalhes?.total_paginas || 0,
      totalResultados: detalhes?.total_resultados || 0,
      tribunaisStats: (detalhes?.tribunais_stats || []) as TribunalStat[],
      duracaoSegundos: detalhes?.duracao_s || 0,
      executadoEm: ultimoHistorico.executado_em,
    };
  })() : null;

  // Calcular progresso do metadata
  const metadata = configuracaoDjen?.metadata as Record<string, any> | null;
  const nextOffset = metadata?.next_offset || 0;
  const totalMonitoramentos = metadata?.djen_run?.totals?.total_monitoramentos || liveRun?.total_monitoramentos || 114;
  const progressPercent = liveRun 
    ? Math.round((liveRun.processados / Math.max(liveRun.total_monitoramentos, 1)) * 100)
    : 0;

  const statsToShow = ultimoResultado || lastRunFromHistorico;

  const termosPorTribunal = useMemo(() => {
    const map = new Map<string, number>();
    const keyOf = (tribunal: string | null) => tribunal ?? "__ALL__";

    for (const row of monitoramentosTribunais ?? []) {
      const tribunais = row.tribunais && row.tribunais.length > 0 ? row.tribunais : [null];
      for (const t of tribunais) {
        const key = keyOf(t);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }

    return map;
  }, [monitoramentosTribunais]);

  const linhasTribunais = useMemo(() => {
    const keyOf = (tribunal: string | null) => tribunal ?? "__ALL__";

    const execMap = new Map<string, TribunalStat>();
    for (const ts of statsToShow?.tribunaisStats ?? []) {
      execMap.set(keyOf(ts.tribunal ?? null), ts);
    }

    const allKeys = new Set<string>([
      ...termosPorTribunal.keys(),
      ...execMap.keys(),
    ]);

    const rows = Array.from(allKeys).map((key) => {
      const tribunal = key === "__ALL__" ? null : key;
      const termos = termosPorTribunal.get(key) ?? 0;
      const exec = execMap.get(key);

      return {
        tribunal,
        termos,
        paginas: exec?.paginas ?? 0,
        resultados: exec?.resultados ?? 0,
        novas: exec?.novas ?? 0,
        descartadas: exec?.descartadas ?? 0,
        duplicatas: exec?.duplicatas ?? 0,
      };
    });

    rows.sort((a, b) => {
      if (b.resultados !== a.resultados) return b.resultados - a.resultados;
      if (b.termos !== a.termos) return b.termos - a.termos;
      const ta = a.tribunal ?? "TODOS";
      const tb = b.tribunal ?? "TODOS";
      return ta.localeCompare(tb);
    });

    return rows;
  }, [statsToShow, termosPorTribunal]);

  // Live run progress
  const liveProcessedDisplay = liveRun
    ? Math.min(liveRun.processados ?? 0, liveRun.total_monitoramentos ?? 0)
    : 0;

  const livePercent = liveRun && liveRun.total_monitoramentos > 0
    ? Math.min(100, Math.round((liveProcessedDisplay / liveRun.total_monitoramentos) * 100))
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Monitoramento DJEN
          </CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Newspaper className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Monitoramento DJEN</CardTitle>
            <CardDescription>Busca publicações no Diário de Justiça Eletrônico</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Ativo/Inativo */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="djen-ativo">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoDjen?.ativo ? "Ativo" : "Pausado"}
            </p>
          </div>
          <Switch
            id="djen-ativo"
            checked={configuracaoDjen?.ativo ?? false}
            onCheckedChange={handleAtivoChange}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label>Frequência de Execução</Label>
          <Select
            value={configuracaoDjen?.frequencia ?? 'diario'}
            onValueChange={handleFrequenciaChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (9h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (9h e 14h BRT)</SelectItem>
              <SelectItem value="3x_dia">3x ao dia (8h, 12h e 17h BRT)</SelectItem>
              <SelectItem value="desativado">Desativado</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Execução automática às 09:00 BRT com retry automático se vazio
          </p>
        </div>

        {/* Horário agendado */}
        <HorarioAgendadoInfo 
          horariosExecucao={configuracaoDjen?.horarios_execucao}
          frequencia={configuracaoDjen?.frequencia}
        />

        {/* Última execução */}
        {configuracaoDjen?.ultima_execucao && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Última execução: {format(toZonedTime(new Date(configuracaoDjen.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        )}

        {/* Progresso ao vivo */}
        {liveRun && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                <span className="font-medium">Processando: {liveProcessedDisplay}/{liveRun.total_monitoramentos}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                +{liveRun.novas} novas
              </Badge>
            </div>
            <Progress value={livePercent} className="h-2" />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelarExecucao}
              disabled={cancelando}
              className="w-full"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              {cancelando ? 'Cancelando...' : 'Cancelar Execução'}
            </Button>
          </div>
        )}

        {/* Progresso durante execução via orquestrador (sem liveRun ainda) */}
        {executando && !liveRun && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Iniciando monitoramento DJEN...</span>
            </div>
            <Progress value={0} className="h-2" />
          </div>
        )}

        {/* Relatório por tribunal */}
        {linhasTribunais.length > 0 && (
          <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Relatório de Execução por Tribunal</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", statsOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 border rounded-lg">
                <ScrollArea className="h-[200px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Tribunal</th>
                        <th className="text-right p-2">Termos</th>
                        <th className="text-right p-2">Pág.</th>
                        <th className="text-right p-2">Result.</th>
                        <th className="text-right p-2">Novas</th>
                        <th className="text-right p-2">Desc.</th>
                        <th className="text-right p-2">Dup.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasTribunais.map((row, i) => (
                        <tr key={row.tribunal ?? 'todos'} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                          <td className="p-2 font-medium">{row.tribunal || 'TODOS'}</td>
                          <td className="p-2 text-right">{row.termos}</td>
                          <td className="p-2 text-right">{row.paginas}</td>
                          <td className="p-2 text-right">{row.resultados}</td>
                          <td className="p-2 text-right text-primary">{row.novas}</td>
                          <td className="p-2 text-right text-destructive">{row.descartadas}</td>
                          <td className="p-2 text-right text-muted-foreground">{row.duplicatas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Período de consulta */}
        <div className="space-y-2">
          <Label>Período de Consulta</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(date) => date && setDataInicio(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(date) => date && setDataFim(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Botões de execução */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => handleExecutarManual(false)} 
            disabled={executando || limpando || !!liveRun}
            className="flex-1"
          >
            {executando ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : liveRun ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-pulse" />
                Em Andamento...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Agora
              </>
            )}
          </Button>

          {/* Botão Retomar do Lote */}
          <BotaoRetomarLote
            nextOffset={nextOffset}
            total={totalMonitoramentos}
            onRetomar={() => handleExecutarManual(true)}
            disabled={executando || limpando || !!liveRun}
          />
          
          <Button 
            variant="outline"
            onClick={handleLimparApenas} 
            disabled={limpando}
            className="sm:w-auto"
          >
            {limpando ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Dados de Hoje
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
