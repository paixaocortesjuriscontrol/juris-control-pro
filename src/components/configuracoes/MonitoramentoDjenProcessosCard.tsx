import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileSearch, Loader2, RefreshCw, Clock, CalendarIcon, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoDjenProcessosCard({ coordenacaoId }: Props) {
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState<{ processados: number; total: number; novas: number } | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
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

  const executarLote = useCallback(async (continuarDe: number, dataInicioStr?: string, dataFimStr?: string): Promise<{ novas: number; concluido: boolean; nextOffset: number; totalProcessos: number }> => {
    const { data, error } = await supabase.functions.invoke('monitorar-djen-processos', {
      body: { 
        dataInicio: dataInicioStr, 
        dataFim: dataFimStr,
        continuarDe 
      }
    });

    if (error) throw error;
    return {
      novas: data.novas || 0,
      concluido: data.concluido || false,
      nextOffset: data.nextOffset || 0,
      totalProcessos: data.totalProcessos || 0
    };
  }, []);

  const handleExecutarManual = async () => {
    setExecutando(true);
    canceladoRef.current = false;
    setProgresso(null);

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

  const handleCancelar = () => {
    canceladoRef.current = true;
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

        {/* Frequência */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Frequência automática</span>
          <Select
            value={config?.frequencia || 'diario'}
            onValueChange={handleFrequenciaChange}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="2x_dia">2x ao dia</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última execução */}
        {ultimoHistorico && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Última: {format(new Date(ultimoHistorico.executado_em), "dd/MM HH:mm", { locale: ptBR })}
            </span>
            {ultimoHistorico.novos_andamentos > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{ultimoHistorico.novos_andamentos}
              </Badge>
            )}
          </div>
        )}

        {/* Progresso */}
        {progresso && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>{progresso.processados} de {progresso.total} processos</span>
              <span className="text-green-600">+{progresso.novas} novas</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2">
          {executando ? (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={handleCancelar}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleExecutarManual}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Executar Agora
            </Button>
          )}
        </div>

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
