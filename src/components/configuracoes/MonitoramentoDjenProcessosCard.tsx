import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSearch, Loader2, RefreshCw, Clock, CalendarIcon, X, ExternalLink, ChevronDown, FileText, Layers, CheckCircle2, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useCallback } from "react";
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
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState<{ processados: number; total: number; novas: number } | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [statsOpen, setStatsOpen] = useState(false);
  const canceladoRef = useRef(false);
  const queryClient = useQueryClient();

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

  const executarLote = useCallback(
    async (
      continuarDe: number,
      dataInicioStr?: string,
      dataFimStr?: string
    ): Promise<{ novas: number; concluido: boolean; nextOffset: number; totalProcessos: number }> => {
      const { data, error } = await supabase.functions.invoke('monitorar-djen-processos', {
        body: {
          dataInicio: dataInicioStr,
          dataFim: dataFimStr,
          continuarDe,
        },
      });

      if (error) throw error;

      const novas = (data?.novas ?? data?.novasPublicacoes ?? 0) as number;
      const totalProcessos = (data?.totalProcessos ?? 0) as number;
      const hasMore = (data?.hasMore ?? false) as boolean;
      const concluido = (data?.concluido ?? !hasMore) as boolean;
      const nextOffset = (data?.nextOffset ?? 0) as number;

      return {
        novas,
        concluido,
        nextOffset,
        totalProcessos,
      };
    },
    []
  );

  const handleExecutarManual = async () => {
    if (executando) return; // Prevenir duplo clique
    setExecutando(true);
    canceladoRef.current = false;
    
    // Mostra progresso imediatamente com estado "iniciando"
    setProgresso({ processados: 0, total: 0, novas: 0 });

    // Limpa flag de cancelamento anterior
    if (config?.id) {
      const currentMetadata = (config.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...currentMetadata, cancelado: false, status: 'em_andamento', next_offset: 0 },
        })
        .eq('id', config.id);
    }

    const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined;
    const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined;

    let totalNovas = 0;
    let offset = 0;
    let totalProcessos = 0;

    try {
      // Loop para processar todos os lotes
      while (!canceladoRef.current) {
        const result = await executarLote(offset, dataInicioStr, dataFimStr);
        
        totalNovas += result.novas;
        totalProcessos = result.totalProcessos;
        offset = result.nextOffset;

        setProgresso({
          processados: result.concluido ? totalProcessos : offset,
          total: totalProcessos,
          novas: totalNovas
        });

        if (result.concluido) {
          break;
        }

        // Pequeno delay entre lotes
        await new Promise(r => setTimeout(r, 1000));
      }

      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });

      if (canceladoRef.current) {
        toast.info(`Busca cancelada. ${totalNovas} publicações encontradas até agora.`);
      } else {
        toast.success(`Busca concluída! ${totalNovas} novas publicações em ${totalProcessos} processos.`);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao executar monitoramento');
    } finally {
      setExecutando(false);
    }
  };

  const handleCancelar = async () => {
    canceladoRef.current = true;
    toast.info("Cancelando execução...");

    // Cancelamento persistente para parar auto-continuação no backend
    if (config?.id) {
      const currentMetadata = (config.metadata as Record<string, any>) || {};
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: { ...currentMetadata, cancelado: true, status: 'cancelando' },
        })
        .eq('id', config.id);
    }
  };

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

  const progressPercent = progresso && progresso.total > 0 
    ? Math.round((progresso.processados / progresso.total) * 100) 
    : 0;

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

        {/* Progresso */}
        {(executando || progresso) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              {progresso && progresso.total > 0 ? (
                <>
                  <span>{progresso.processados} de {progresso.total} processos</span>
                  <span className="text-green-600">+{progresso.novas} novas</span>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Iniciando busca...
                </span>
              )}
            </div>
            <Progress 
              value={progresso && progresso.total > 0 ? progressPercent : undefined} 
              className={cn("h-2", (!progresso || progresso.total === 0) && "animate-pulse")} 
            />
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
        <div className="flex gap-2">
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
              onClick={handleExecutarManual} 
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
