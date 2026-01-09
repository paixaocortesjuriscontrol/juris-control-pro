import { useState, useEffect } from "react";
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
import { Newspaper, Play, Clock, RefreshCw, ChevronDown, FileText, Layers, CheckCircle2 } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function MonitoramentoDjenCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const { 
    configuracaoDjen,
    isLoading, 
    atualizarConfiguracao 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, novas: 0 });
  const [ultimoResultado, setUltimoResultado] = useState<ExecutionResult | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  
  // Fetch last execution report from historico_monitoramento
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
    refetchInterval: 60000, // Refresh every minute
  });

  const handleExecutarManual = async () => {
    setExecutando(true);
    setProgresso({ atual: 0, total: 0, novas: 0 });
    setUltimoResultado(null);
    
    let offset = 0;
    let totalProcessados = 0;
    let totalNovas = 0;
    let totalDescartadas = 0;
    let totalDuplicatas = 0;
    let totalPaginas = 0;
    let totalResultados = 0;
    let allTribunaisStats: TribunalStat[] = [];
    let hasMore = true;
    let totalDuration = 0;
    
    try {
      const { count } = await supabase
        .from('monitoramentos_djen')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      
      const total = count || 0;
      setProgresso(p => ({ ...p, total }));
      
      while (hasMore) {
        toast.info(`Processando lote ${Math.floor(offset / 10) + 1}...`);

        const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://bfxahrrvoqxcdmfsvnrk.supabase.co'}/functions/v1/monitorar-djen?offset=${offset}`;

        let response: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 120000);

            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
              signal: controller.signal,
            });

            window.clearTimeout(timeout);
            break;
          } catch (e) {
            // Network-level errors like "Failed to fetch"/timeouts.
            if (attempt === 2) throw e;
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          }
        }

        if (!response) {
          throw new Error('Falha ao executar o monitoramento (sem resposta do servidor)');
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        totalProcessados += result.processados || 0;
        totalNovas += result.novasPublicacoes || 0;
        totalDescartadas += result.descartadas || 0;
        totalDuplicatas += result.duplicatas || 0;
        totalPaginas += result.totalPaginas || 0;
        totalResultados += result.totalResultados || 0;
        totalDuration += result.duracaoSegundos || 0;
        
        // Merge tribunal stats
        if (result.tribunaisStats) {
          for (const ts of result.tribunaisStats) {
            const existing = allTribunaisStats.find(t => t.tribunal === ts.tribunal);
            if (existing) {
              existing.paginas += ts.paginas;
              existing.resultados += ts.resultados;
              existing.novas += ts.novas;
              existing.descartadas += ts.descartadas;
              existing.duplicatas += ts.duplicatas;
            } else {
              allTribunaisStats.push({ ...ts });
            }
          }
        }
        
        hasMore = result.hasMore || false;
        
        setProgresso({ 
          atual: totalProcessados, 
          total, 
          novas: totalNovas 
        });
        
        if (hasMore && result.nextOffset) {
          offset = result.nextOffset;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      // Sort by resultados
      allTribunaisStats.sort((a, b) => b.resultados - a.resultados);
      
      setUltimoResultado({
        processados: totalProcessados,
        novas: totalNovas,
        descartadas: totalDescartadas,
        duplicatas: totalDuplicatas,
        totalPaginas,
        totalResultados,
        tribunaisStats: allTribunaisStats,
        duracaoSegundos: totalDuration,
      });
      
      if (allTribunaisStats.length > 0) {
        setStatsOpen(true);
      }
      
      toast.success(`Monitoramento concluído: ${totalProcessados} verificados, ${totalNovas} novas, ${totalPaginas} páginas buscadas`);
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['historico-monitoramento-djen'] });
      
    } catch (error) {
      console.error('Erro no monitoramento:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutando(false);
      setProgresso({ atual: 0, total: 0, novas: 0 });
    }
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div>
            <CardTitle className="text-lg">Carregando...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const progressPercent = progresso.total > 0 
    ? Math.round((progresso.atual / progresso.total) * 100) 
    : 0;

  const statsToShow = ultimoResultado || lastRunFromHistorico;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Newspaper className="h-6 w-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoramento DJEN</CardTitle>
          <CardDescription>
            Busca publicações no Diário de Justiça Eletrônico
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ativo-djen">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoDjen?.ativo ? "Executando automaticamente" : "Pausado"}
            </p>
          </div>
          <Switch
            id="ativo-djen"
            checked={configuracaoDjen?.ativo ?? true}
            onCheckedChange={handleAtivoChange}
            disabled={atualizarConfiguracao.isPending}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequencia-djen">Frequência de Execução</Label>
          <Select 
            value={configuracaoDjen?.frequencia || '2x_dia'} 
            onValueChange={handleFrequenciaChange}
            disabled={atualizarConfiguracao.isPending}
          >
            <SelectTrigger id="frequencia-djen">
              <SelectValue placeholder="Selecione a frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (8h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (8h e 18h BRT)</SelectItem>
              <SelectItem value="semanal">Semanal (Segunda 8h BRT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última execução */}
        {configuracaoDjen?.ultima_execucao && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(configuracaoDjen.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {lastRunFromHistorico && lastRunFromHistorico.totalPaginas > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <Layers className="h-3 w-3" />
                  {lastRunFromHistorico.totalPaginas} páginas
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {lastRunFromHistorico.totalResultados} resultados
                </Badge>
                {lastRunFromHistorico.novas > 0 && (
                  <Badge variant="default" className="gap-1 bg-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    {lastRunFromHistorico.novas} novas
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {executando && progresso.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processando: {progresso.atual}/{progresso.total}</span>
              <span className="text-green-600">+{progresso.novas} novas</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Relatório de Execução Detalhado */}
        {statsToShow && statsToShow.tribunaisStats.length > 0 && (
          <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Relatório de Execução por Tribunal
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Páginas</p>
                    <p className="font-bold text-lg">{statsToShow.totalPaginas}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Resultados</p>
                    <p className="font-bold text-lg">{statsToShow.totalResultados}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Novas</p>
                    <p className="font-bold text-lg text-green-600">{statsToShow.novas}</p>
                  </div>
                  <div className="p-2 bg-background rounded text-center">
                    <p className="text-muted-foreground">Duração</p>
                    <p className="font-bold text-lg">{statsToShow.duracaoSegundos}s</p>
                  </div>
                </div>

                {/* Tribunais Table */}
                <ScrollArea className="h-[200px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b">
                        <th className="text-left p-1.5 font-medium">Tribunal</th>
                        <th className="text-right p-1.5 font-medium">Págs</th>
                        <th className="text-right p-1.5 font-medium">Res</th>
                        <th className="text-right p-1.5 font-medium text-green-600">Novas</th>
                        <th className="text-right p-1.5 font-medium text-yellow-600">Desc</th>
                        <th className="text-right p-1.5 font-medium text-muted-foreground">Dup</th>
                      </tr>
                    </thead>
                    <tbody>
                        {statsToShow.tribunaisStats.map((t, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="p-1.5 font-mono">{t.tribunal ?? 'TODOS'}</td>
                            <td className="p-1.5 text-right">{t.paginas}</td>
                            <td className="p-1.5 text-right">{t.resultados}</td>
                            <td className="p-1.5 text-right text-green-600 font-medium">{t.novas || '-'}</td>
                            <td className="p-1.5 text-right text-yellow-600">{t.descartadas || '-'}</td>
                            <td className="p-1.5 text-right text-muted-foreground">{t.duplicatas || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Botão de execução */}
        <Button 
          onClick={handleExecutarManual} 
          disabled={executando}
          className="w-full"
        >
          {executando ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processando... {progressPercent > 0 ? `${progressPercent}%` : ''}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
