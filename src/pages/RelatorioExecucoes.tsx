import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Newspaper,
  FileSearch,
  Radar,
  Download,
  ChevronDown,
  ChevronRight,
  Building2,
  Globe
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useRelatorioExecucoes, 
  useDjenRunLotes, 
  useDjenTribunaisLote,
  useCoordenacoes
} from "@/hooks/useRelatorioExecucoes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TIPOS_MONITORAMENTO = [
  { id: 'andamentos', label: 'Andamentos', icon: Activity },
  { id: 'redistribuicoes', label: 'Redistribuições', icon: RefreshCw },
  { id: 'djen', label: 'DJEN Publicações', icon: Newspaper },
  { id: 'djen_processos', label: 'DJEN Processos', icon: FileSearch },
  { id: 'termos', label: 'Monitoramento 360°', icon: Radar },
  { id: 'distribuicoes', label: 'Distribuições', icon: Globe },
];

interface RelatorioExecucoesProps {
  embedded?: boolean;
}

export default function RelatorioExecucoes({ embedded = false }: RelatorioExecucoesProps) {
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [abaAtiva, setAbaAtiva] = useState('andamentos');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedLote, setExpandedLote] = useState<string | null>(null);

  const { historico, djenRuns, isLoading, porTipo } = useRelatorioExecucoes(
    dataInicio,
    dataFim,
    [] // Não filtramos aqui, filtramos pela aba
  );

  const { data: lotesExpanded } = useDjenRunLotes(expandedRun);
  const { data: tribunaisLote } = useDjenTribunaisLote(expandedLote);
  const { data: coordenacoes } = useCoordenacoes();

  // Estatísticas por aba selecionada
  const estatisticasAba = useMemo(() => {
    if (abaAtiva === 'djen') {
      const runs = djenRuns || [];
      return {
        execucoes: runs.length,
        sucesso: runs.filter(r => r.status === 'completed').length,
        erro: runs.filter(r => r.status === 'error' || (r.erros && r.erros > 0)).length,
        verificados: runs.reduce((acc, r) => acc + (r.processados || 0), 0),
        novos: runs.reduce((acc, r) => acc + (r.novas || 0), 0),
      };
    }
    
    const dados = porTipo[abaAtiva as keyof typeof porTipo] || [];
    if (abaAtiva === 'djen') return { execucoes: 0, sucesso: 0, erro: 0, verificados: 0, novos: 0 };
    
    const lista = dados as any[];
    return {
      execucoes: lista.length,
      sucesso: lista.filter(h => h.erros === 0).length,
      erro: lista.filter(h => h.erros > 0).length,
      verificados: lista.reduce((acc, h) => acc + (h.processos_verificados || 0), 0),
      novos: lista.reduce((acc, h) => acc + (h.novos_andamentos || 0), 0),
    };
  }, [abaAtiva, porTipo, djenRuns]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string, erros?: number) => {
    if (status === 'completed' || status === 'complete' || (erros !== undefined && erros === 0)) {
      return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Sucesso</Badge>;
    }
    if (status === 'error' || (erros && erros > 0)) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
    }
    if (status === 'running' || status === 'processing') {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Em Execução</Badge>;
    }
    if (status === 'cancelado') {
      return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getCoordenacaoNome = (id: string | null) => {
    if (!id) return 'Global';
    return coordenacoes?.find(c => c.id === id)?.nome || 'Desconhecida';
  };

  const exportarCSV = () => {
    const linhas = [
      ['Tipo', 'Data/Hora', 'Status', 'Verificados', 'Novos', 'Erros', 'Duração'].join(';')
    ];

    historico?.forEach(h => {
      linhas.push([
        h.tipo,
        format(new Date(h.executado_em), 'dd/MM/yyyy HH:mm'),
        h.erros === 0 ? 'Sucesso' : 'Com Erros',
        h.processos_verificados.toString(),
        h.novos_andamentos.toString(),
        h.erros.toString(),
        '-'
      ].join(';'));
    });

    djenRuns?.forEach(r => {
      linhas.push([
        'DJEN',
        format(new Date(r.iniciado_em), 'dd/MM/yyyy HH:mm'),
        r.status,
        (r.processados || 0).toString(),
        (r.novas || 0).toString(),
        (r.erros || 0).toString(),
        formatDuration(r.duracao_segundos)
      ].join(';'));
    });

    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_execucoes_${dataInicio}_${dataFim}.csv`;
    link.click();
  };

  // Renderiza tabela de histórico genérico
  const renderHistoricoTabela = (dados: any[]) => (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Verificados</TableHead>
            <TableHead className="text-right">Novos</TableHead>
            <TableHead className="text-right">Erros</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhuma execução no período selecionado.
              </TableCell>
            </TableRow>
          ) : (
            dados.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </TableCell>
                <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                <TableCell className="text-right">{item.processos_verificados}</TableCell>
                <TableCell className="text-right">
                  {item.novos_andamentos > 0 ? (
                    <Badge className="bg-green-600">{item.novos_andamentos}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.erros > 0 ? (
                    <Badge variant="destructive">{item.erros}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.detalhes && (
                    <span className="text-xs text-muted-foreground">
                      {item.detalhes.offset && `Offset: ${item.detalhes.offset}`}
                      {item.detalhes.tempoMs && ` | ${item.detalhes.tempoMs}ms`}
                      {item.detalhes.percentage && ` | ${item.detalhes.percentage}%`}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );

  // Renderiza histórico DJEN expandível
  const renderHistoricoDjen = () => (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2">
        {(djenRuns || []).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma execução DJEN no período selecionado.
          </p>
        ) : (
          (djenRuns || []).map(run => (
            <Collapsible 
              key={run.id} 
              open={expandedRun === run.run_id}
              onOpenChange={(open) => {
                setExpandedRun(open ? run.run_id : null);
                setExpandedLote(null);
              }}
            >
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {expandedRun === run.run_id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <div>
                          <p className="font-medium">
                            {format(new Date(run.iniciado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>Duração: {formatDuration(run.duracao_segundos)}</span>
                            {run.retry_count && run.retry_count > 0 && (
                              <span className="text-orange-600">• {run.retry_count} retentativas</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(run.status)}
                        <div className="text-right text-sm grid grid-cols-3 gap-4">
                          <div>
                            <span className="text-muted-foreground block">Processados</span>
                            <span className="font-medium">{run.processados || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Novas</span>
                            <span className="font-medium text-green-600">{run.novas || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Erros</span>
                            <span className="font-medium text-destructive">{run.erros || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {run.motivo_erro && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        {run.motivo_erro}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {lotesExpanded && expandedRun === run.run_id && (
                  <Card className="ml-6 mt-2 border-l-4 border-primary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Lotes Processados ({lotesExpanded.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible value={expandedLote || undefined} onValueChange={setExpandedLote}>
                        {lotesExpanded.map(lote => (
                          <AccordionItem key={lote.id} value={lote.id}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-4 w-full">
                                <Badge variant="outline">Lote #{lote.lote_numero}</Badge>
                                {getStatusBadge(lote.status)}
                                <span className="text-sm">Offset: {lote.offset_inicial}-{lote.offset_final}</span>
                                <div className="flex gap-4 text-sm ml-auto mr-4">
                                  <span>Proc: {lote.processados || 0}</span>
                                  <span className="text-green-600">Novas: {lote.novas || 0}</span>
                                  <span className="text-muted-foreground">Dup: {lote.duplicatas || 0}</span>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="pl-4 space-y-3">
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Iniciado:</span>
                                    <p>{format(new Date(lote.iniciado_em), "HH:mm:ss")}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Finalizado:</span>
                                    <p>{lote.finalizado_em ? format(new Date(lote.finalizado_em), "HH:mm:ss") : '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Duração:</span>
                                    <p>{formatDuration(lote.duracao_segundos)}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Total Resultados:</span>
                                    <p>{lote.total_resultados || 0}</p>
                                  </div>
                                </div>

                                {lote.erro_mensagem && (
                                  <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                                    {lote.erro_mensagem}
                                  </div>
                                )}

                                {/* Tribunais do lote */}
                                {tribunaisLote && expandedLote === lote.id && tribunaisLote.length > 0 && (
                                  <div className="mt-4">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Building2 className="w-4 h-4" />
                                      Detalhes por Tribunal
                                    </h5>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Tribunal</TableHead>
                                          <TableHead>Termos</TableHead>
                                          <TableHead>Páginas</TableHead>
                                          <TableHead>Resultados</TableHead>
                                          <TableHead>Novas</TableHead>
                                          <TableHead>Duplicatas</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {tribunaisLote.map(t => (
                                          <TableRow key={t.id}>
                                            <TableCell>
                                              <Badge variant="secondary">{t.tribunal}</Badge>
                                            </TableCell>
                                            <TableCell>{t.termos_buscados || 0}</TableCell>
                                            <TableCell>{t.paginas || 0}</TableCell>
                                            <TableCell>{t.resultados || 0}</TableCell>
                                            <TableCell>
                                              {(t.novas || 0) > 0 ? (
                                                <Badge className="bg-green-600">{t.novas}</Badge>
                                              ) : (
                                                <span className="text-muted-foreground">0</span>
                                              )}
                                            </TableCell>
                                            <TableCell>{t.duplicatas || 0}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </ScrollArea>
  );

  const content = (
      <div className="space-y-6">
        {/* Filtros e Abas no topo */}
        {/* Filtros e Abas no topo */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              {/* Filtros de Data */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <Button onClick={exportarCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>

              {/* Abas de tipo de monitoramento */}
              <Tabs value={abaAtiva} onValueChange={(v) => { setAbaAtiva(v); setExpandedRun(null); setExpandedLote(null); }}>
                <TabsList className="flex-wrap h-auto">
                  {TIPOS_MONITORAMENTO.map(tipo => (
                    <TabsTrigger key={tipo.id} value={tipo.id} className="flex items-center gap-2">
                      <tipo.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tipo.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Totalizadores da aba selecionada */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{estatisticasAba.execucoes}</div>
                <p className="text-sm text-muted-foreground">Execuções</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{estatisticasAba.sucesso}</div>
                <p className="text-sm text-muted-foreground">Com Sucesso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-destructive">{estatisticasAba.erro}</div>
                <p className="text-sm text-muted-foreground">Com Erros</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{estatisticasAba.verificados}</div>
                <p className="text-sm text-muted-foreground">Itens Verificados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{estatisticasAba.novos}</div>
                <p className="text-sm text-muted-foreground">Novos Encontrados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Histórico da aba selecionada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const tipo = TIPOS_MONITORAMENTO.find(t => t.id === abaAtiva);
                return tipo ? <tipo.icon className="w-5 h-5" /> : null;
              })()}
              Histórico - {TIPOS_MONITORAMENTO.find(t => t.id === abaAtiva)?.label}
            </CardTitle>
            <CardDescription>
              Últimas execuções no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : abaAtiva === 'djen' ? (
              renderHistoricoDjen()
            ) : (
              renderHistoricoTabela(porTipo[abaAtiva as keyof typeof porTipo] as any[] || [])
            )}
          </CardContent>
        </Card>
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <MainLayout title="Relatório de Execuções" subtitle="Histórico completo de todos os monitoramentos automáticos">
      {content}
    </MainLayout>
  );
}
