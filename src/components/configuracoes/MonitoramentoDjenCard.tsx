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
import { Newspaper, Play, Clock, RefreshCw, ChevronDown, FileText, Layers, CheckCircle2, Activity, History, Radio, StopCircle, Trash2, CalendarIcon, XCircle, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
import { getExecutionProgress } from "@/utils/executionProgress";

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
  const [cancelando, setCancelando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [ocultarErroAnterior, setOcultarErroAnterior] = useState(false);
  const [resetando, setResetando] = useState(false);
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

  // FONTE ÚNICA: execucoes_agendadas para progresso em tempo real
  const { data: execucaoAtiva } = useQuery({
    queryKey: ['execucao-ativa-djen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('*')
        .eq('tipo', 'djen')
        .eq('status', 'executando')
        // Evitar execução "fantasma" com finalizado_em preenchido
        .is('finalizado_em', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Verificar se a execução está realmente ativa (não mais de 30 min sem progresso)
      if (data) {
        const iniciadoEm = new Date(data.iniciado_em).getTime();
        const agora = Date.now();
        const tempoDecorridoMs = agora - iniciadoEm;
        
        // Se passou mais de 30 minutos sem finalizar, considerar como ghost
        // (execuções DJEN normalmente levam 12-15 minutos com 114 monitoramentos)
        if (tempoDecorridoMs > 30 * 60 * 1000) {
          // Atualizar para timeout automaticamente
          await supabase
            .from('execucoes_agendadas')
            .update({ 
              status: 'timeout', 
              finalizado_em: new Date().toISOString(),
              ultimo_erro: 'Execução expirou após 30 minutos (timeout automático)'
            })
            .eq('id', data.id);
          return null;
        }
      }
      
      return data;
    },
    refetchInterval: 2000, // Atualiza a cada 2s enquanto executa
  });

  // Buscar última execução com erro/falha para exibir alerta
  const { data: ultimaExecucaoErro } = useQuery({
    queryKey: ['ultima-execucao-erro-djen'],
    queryFn: async () => {
      // Buscar última execução (qualquer status)
      const { data: ultimaConcluida } = await supabase
        .from('execucoes_agendadas')
        .select('id, finalizado_em')
        .eq('tipo', 'djen')
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('*')
        .eq('tipo', 'djen')
        .in('status', ['falhou', 'timeout', 'cancelado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      // Se existe uma execução concluída com sucesso MAIS RECENTE, ocultar erro
      if (ultimaConcluida?.finalizado_em && data.finalizado_em) {
        const concluidaEm = new Date(ultimaConcluida.finalizado_em).getTime();
        const erroEm = new Date(data.finalizado_em).getTime();
        if (concluidaEm > erroEm) return null;
      }
      
      // Só mostrar se foi nos últimos 30 minutos
      const finalizadoEm = data.finalizado_em ? new Date(data.finalizado_em).getTime() : 0;
      if (Date.now() - finalizadoEm > 30 * 60 * 1000) {
        return null;
      }
      
      // Ocultar mensagens técnicas de signal/aborted
      const erroTecnico = data.ultimo_erro?.toLowerCase().includes('signal') ||
                          data.ultimo_erro?.toLowerCase().includes('aborted');
      if (erroTecnico) return null;
      
      return data;
    },
    refetchInterval: 30000,
  });

  // Latest run from the new table
  const latestRun = runs && runs.length > 0 ? runs[0] : null;

  // CONTADORES REAIS DO BANCO (publicações persistidas hoje)
  // Nota: usa contagem bruta do banco. A página Análise DJEN pode ter números diferentes
  // por aplicar deduplicação e filtros de coordenação.
  const { data: statsHoje } = useQuery({
    queryKey: ['djen-stats-hoje'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString();
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();

      // Publicações novas hoje (contagem bruta)
      const { count: novas, error: e1 } = await supabase
        .from('publicacoes_djen')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Descartadas hoje
      const { count: descartadas, error: e2 } = await supabase
        .from('publicacoes_djen_descartadas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      // Total de monitoramentos ativos
      const { count: monitoramentos, error: e3 } = await supabase
        .from('monitoramentos_djen')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      if (e1 || e2 || e3) console.warn('Erro ao buscar stats DJEN:', e1, e2, e3);
      
      return {
        novas: novas ?? 0,
        descartadas: descartadas ?? 0,
        monitoramentos: monitoramentos ?? 0,
      };
    },
    refetchInterval: 10000, // Atualiza a cada 10s
  });

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

  // Real-time subscription para execucoes_agendadas (FONTE ÚNICA DE VERDADE)
  useEffect(() => {
    const channel = supabase
      .channel('execucao-djen-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'execucoes_agendadas', filter: 'tipo=eq.djen' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['execucao-ativa-djen'] });
          queryClient.invalidateQueries({ queryKey: ['ultima-execucao-erro-djen'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Resetar ocultarErroAnterior quando mudar a última execução com erro
  useEffect(() => {
    setOcultarErroAnterior(false);
  }, [ultimaExecucaoErro?.id]);

  // Progresso ao vivo (monótono): evita percentual “voltar” quando detalhes.progress é sobrescrito por lote
  const { current: execProcessados, total: execTotal, percentage: execPercentRaw } = getExecutionProgress({
    detalhes: execucaoAtiva?.detalhes,
    registros_processados: execucaoAtiva?.registros_processados,
    total_lotes: execucaoAtiva?.total_lotes,
    lotes_processados: execucaoAtiva?.lotes_processados,
  });
  // Só mostra percentual se tiver um total válido (>0) e a execução iniciou há mais de 5s
  const execucaoIniciouHa = execucaoAtiva?.iniciado_em 
    ? Date.now() - new Date(execucaoAtiva.iniciado_em).getTime() 
    : 0;
  const hasValidProgress = execTotal > 0 && execPercentRaw !== null && execucaoIniciouHa > 5000;
  const execPercent = hasValidProgress ? execPercentRaw : 0;
  const execNovas = execucaoAtiva?.registros_encontrados ?? 0;
  const isExecuting = !!execucaoAtiva;

  // Salvar datas no metadata antes de executar
  const handleExecutarManual = async (retomar = false) => {
    if (isExecuting) {
      toast.warning('Já existe uma execução DJEN em andamento. Aguarde ou cancele.');
      return;
    }
    
    // Ocultar mensagens de erro da execução anterior ao iniciar nova
    setOcultarErroAnterior(true);

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
    if (!execucaoAtiva) return;
    
    setCancelando(true);
    try {
      // Cancelar via orquestrador (marca metadata + execucoes_agendadas)
      await cancelarViaOrquestrador();
      
      toast.success('Execução cancelada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['execucao-ativa-djen'] });
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
      // Se houver execução ativa, cancelar primeiro
      if (isExecuting) {
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

  // Reset completo do estado DJEN
  const handleResetCompleto = async () => {
    setResetando(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-djen-state');
      if (error) throw error;

      toast.success((data as any)?.message ?? 'Estado do DJEN resetado com sucesso!');
      
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['execucao-ativa-djen'] });
      queryClient.invalidateQueries({ queryKey: ['ultima-execucao-erro-djen'] });
      queryClient.invalidateQueries({ queryKey: ['djen-runs'] });
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['djen-stats-hoje'] });
    } catch (error) {
      console.error('Erro ao resetar DJEN:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setResetando(false);
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

  // Calcular progresso do metadata (para BotaoRetomarLote)
  const metadata = configuracaoDjen?.metadata as Record<string, any> | null;
  const nextOffset = metadata?.next_offset || 0;
  const totalMonitoramentos = execTotal || metadata?.djen_run?.totals?.total_monitoramentos || 114;

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

        {/* Alerta de erro na última execução */}
        {ultimaExecucaoErro && !isExecuting && !ocultarErroAnterior && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">
                {ultimaExecucaoErro.status === 'timeout' 
                  ? 'Execução expirou (timeout)' 
                  : ultimaExecucaoErro.status === 'cancelado'
                  ? 'Execução cancelada'
                  : 'Falha na última execução'}
              </span>
            </div>
            {ultimaExecucaoErro.ultimo_erro && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {ultimaExecucaoErro.ultimo_erro}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Você pode tentar executar novamente.
            </p>
          </div>
        )}

        {/* CONTADORES REAIS DO BANCO (sempre visíveis) */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Publicações Hoje</span>
            <Badge variant={isExecuting ? "secondary" : "outline"} className="text-xs">
              {isExecuting ? "Atualizando..." : "Atualizado"}
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold">{(statsHoje?.novas ?? 0) + (statsHoje?.descartadas ?? 0)}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-primary">{statsHoje?.novas ?? 0}</div>
              <div className="text-xs text-muted-foreground">Novas</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-destructive">{statsHoje?.descartadas ?? 0}</div>
              <div className="text-xs text-muted-foreground">Descartadas</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-muted-foreground">{statsHoje?.monitoramentos ?? 0}</div>
              <div className="text-xs text-muted-foreground">Termos</div>
            </div>
          </div>
        </div>

        {/* Progresso ao vivo (fonte única: execucoes_agendadas) */}
        {isExecuting && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                <span className="font-medium">
                  {hasValidProgress 
                    ? `Processando: ${execProcessados.toLocaleString('pt-BR')}/${execTotal.toLocaleString('pt-BR')}`
                    : 'Iniciando monitoramento...'}
                </span>
              </div>
              {hasValidProgress && (
                <Badge variant="secondary" className="text-xs">
                  {execPercent}%
                </Badge>
              )}
            </div>
            {hasValidProgress ? (
              <Progress value={execPercent} className="h-2" />
            ) : (
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary/50" />
                <style>{`
                  @keyframes indeterminate {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(200%); }
                    100% { transform: translateX(300%); }
                  }
                `}</style>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>+{execNovas} novas encontradas</span>
            </div>
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

        {/* Progresso durante inicialização (executando via hook mas ainda sem registro no banco) */}
        {executando && !isExecuting && (
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
            disabled={executando || limpando || isExecuting}
            className="flex-1"
          >
            {executando ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : isExecuting ? (
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
            disabled={executando || limpando || isExecuting}
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

          {/* Botão Reset Completo */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive"
                disabled={resetando}
                className="sm:w-auto"
              >
                {resetando ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Completo
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Completo do DJEN</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai cancelar todas as execuções ativas, limpar execuções fantasma e resetar completamente o estado do monitoramento DJEN para resolver travamentos.
                  <br /><br />
                  <strong>Use quando o monitoramento estiver travado em um percentual fixo.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetCompleto}>
                  Confirmar Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
