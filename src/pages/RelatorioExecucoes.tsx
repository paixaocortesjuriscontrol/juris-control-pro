import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Building2,
  Search,
  FileText,
  Users
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useRelatorioExecucoes, 
  useDjenRunLotes, 
  useDjenTribunaisLote,
  useEstatisticasDjenPeriodo,
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
  { id: 'distribuicoes', label: 'Distribuições', icon: TrendingUp },
];

export default function RelatorioExecucoes() {
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tiposFiltro, setTiposFiltro] = useState<string[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedLote, setExpandedLote] = useState<string | null>(null);

  const { historico, djenRuns, isLoading, estatisticas, porTipo } = useRelatorioExecucoes(
    dataInicio,
    dataFim,
    tiposFiltro
  );

  const { data: lotesExpanded } = useDjenRunLotes(expandedRun);
  const { data: tribunaisLote } = useDjenTribunaisLote(expandedLote);
  const { porTermo, porTribunal, isLoading: isLoadingEstatisticas } = useEstatisticasDjenPeriodo(dataInicio, dataFim);
  const { data: coordenacoes } = useCoordenacoes();

  const toggleTipo = (tipo: string) => {
    setTiposFiltro(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo) 
        : [...prev, tipo]
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string, erros?: number) => {
    if (status === 'completed' || status === 'complete' || erros === 0) {
      return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Sucesso</Badge>;
    }
    if (status === 'error' || (erros && erros > 0)) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
    }
    if (status === 'running' || status === 'processing') {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Em Execução</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getCoordenacaoNome = (id: string | null) => {
    if (!id) return 'Global';
    return coordenacoes?.find(c => c.id === id)?.nome || 'Desconhecida';
  };

  const exportarCSV = () => {
    const linhas = [
      ['Tipo', 'Data/Hora', 'Status', 'Itens Verificados', 'Novos Encontrados', 'Erros', 'Duração', 'Detalhes'].join(';')
    ];

    historico?.forEach(h => {
      linhas.push([
        h.tipo,
        format(new Date(h.executado_em), 'dd/MM/yyyy HH:mm'),
        h.erros === 0 ? 'Sucesso' : 'Com Erros',
        h.processos_verificados.toString(),
        h.novos_andamentos.toString(),
        h.erros.toString(),
        '-',
        JSON.stringify(h.detalhes || {})
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
        formatDuration(r.duracao_segundos),
        `Páginas: ${r.total_paginas || 0}, Resultados: ${r.total_resultados || 0}`
      ].join(';'));
    });

    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_execucoes_${dataInicio}_${dataFim}.csv`;
    link.click();
  };

  return (
    <MainLayout title="Relatório de Execuções" subtitle="Histórico completo de todos os monitoramentos automáticos do sistema">
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={exportarCSV} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Tipos de Monitoramento</Label>
              <div className="flex flex-wrap gap-3">
                {TIPOS_MONITORAMENTO.map(tipo => (
                  <div key={tipo.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={tipo.id}
                      checked={tiposFiltro.includes(tipo.id)}
                      onCheckedChange={() => toggleTipo(tipo.id)}
                    />
                    <label htmlFor={tipo.id} className="text-sm cursor-pointer flex items-center gap-1">
                      <tipo.icon className="w-4 h-4" />
                      {tipo.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Gerais */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{estatisticas.totalExecucoes}</div>
                <p className="text-sm text-muted-foreground">Total de Execuções</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{estatisticas.execucoesSucesso}</div>
                <p className="text-sm text-muted-foreground">Com Sucesso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-destructive">{estatisticas.execucoesErro}</div>
                <p className="text-sm text-muted-foreground">Com Erros</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{estatisticas.totalItensProcessados}</div>
                <p className="text-sm text-muted-foreground">Itens Processados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{estatisticas.totalNovosEncontrados}</div>
                <p className="text-sm text-muted-foreground">Novos Encontrados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico Detalhado de Execuções</CardTitle>
            <CardDescription>
              Detalhamento completo por tipo de monitoramento com estatísticas e métricas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="djen">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="todos">Visão Geral</TabsTrigger>
                <TabsTrigger value="djen">DJEN Publicações</TabsTrigger>
                <TabsTrigger value="djen_processos">DJEN Processos</TabsTrigger>
                <TabsTrigger value="andamentos">Andamentos</TabsTrigger>
                <TabsTrigger value="redistribuicoes">Redistribuições</TabsTrigger>
                <TabsTrigger value="termos">Monit. 360°</TabsTrigger>
                <TabsTrigger value="distribuicoes">Distribuições</TabsTrigger>
              </TabsList>

              {/* Tab Visão Geral */}
              <TabsContent value="todos">
                <div className="space-y-6">
                  {/* Resumo por tipo */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {TIPOS_MONITORAMENTO.map(tipo => {
                      const dados = tipo.id === 'djen' ? porTipo.djen : (porTipo[tipo.id as keyof typeof porTipo] || []);
                      return (
                        <Card key={tipo.id} className="text-center">
                          <CardContent className="pt-4">
                            <tipo.icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                            <div className="text-lg font-bold">{dados.length}</div>
                            <p className="text-xs text-muted-foreground">{tipo.label}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Tabela unificada */}
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Verificados</TableHead>
                          <TableHead>Novos</TableHead>
                          <TableHead>Erros</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Skeleton className="h-8 w-full" />
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {historico?.map(item => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <Badge variant="outline">{item.tipo}</Badge>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </TableCell>
                                <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                                <TableCell>{item.processos_verificados}</TableCell>
                                <TableCell>
                                  {item.novos_andamentos > 0 ? (
                                    <Badge className="bg-green-600">{item.novos_andamentos}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>{item.erros}</TableCell>
                                <TableCell>
                                  {item.detalhes && Object.keys(item.detalhes).length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {item.detalhes.offset && `Offset: ${item.detalhes.offset}`}
                                      {item.detalhes.tempoMs && ` | ${item.detalhes.tempoMs}ms`}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {djenRuns?.map(run => (
                              <TableRow key={run.id}>
                                <TableCell>
                                  <Badge variant="outline" className="bg-orange-50">DJEN Publicações</Badge>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(run.iniciado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </TableCell>
                                <TableCell>{getStatusBadge(run.status)}</TableCell>
                                <TableCell>{run.processados || 0}</TableCell>
                                <TableCell>
                                  {(run.novas || 0) > 0 ? (
                                    <Badge className="bg-green-600">{run.novas}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>{run.erros || 0}</TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {run.total_paginas && `${run.total_paginas} págs`}
                                    {run.duracao_segundos && ` | ${formatDuration(run.duracao_segundos)}`}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Tab DJEN Publicações - com detalhes expandíveis */}
              <TabsContent value="djen">
                <div className="space-y-6">
                  {/* Estatísticas por Termo */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Publicações por Termo de Busca no Período
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingEstatisticas ? (
                        <Skeleton className="h-32 w-full" />
                      ) : porTermo.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          Nenhuma publicação encontrada no período.
                        </p>
                      ) : (
                        <ScrollArea className="h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Termo de Busca</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Tribunais</TableHead>
                                <TableHead>Coordenação</TableHead>
                                <TableHead className="text-right">Publicações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {porTermo.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{item.termo_busca}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{item.tipo}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                      {item.tribunais?.slice(0, 3).map((t, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                                      ))}
                                      {item.tribunais?.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">+{item.tribunais.length - 3}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">{getCoordenacaoNome(item.coordenacao_id)}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge className="bg-primary">{item.total_publicacoes}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {/* Estatísticas por Tribunal */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Publicações por Tribunal no Período
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingEstatisticas ? (
                        <Skeleton className="h-32 w-full" />
                      ) : porTribunal.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          Nenhuma publicação encontrada no período.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {porTribunal.slice(0, 12).map((item, idx) => (
                            <div key={idx} className="bg-muted/50 rounded-lg p-3 text-center">
                              <div className="text-lg font-bold">{item.total}</div>
                              <p className="text-sm text-muted-foreground">{item.tribunal}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Histórico de Runs */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Histórico de Execuções DJEN
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {porTipo.djen.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              Nenhuma execução DJEN no período selecionado.
                            </p>
                          ) : (
                            porTipo.djen.map(run => (
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
                                              <span>• {run.total_monitoramentos || 0} monitoramentos</span>
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
                                              <span className="text-muted-foreground block">Páginas</span>
                                              <span className="font-medium">{run.total_paginas || 0}</span>
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
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab DJEN Processos */}
              <TabsContent value="djen_processos">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold">{porTipo.djen_processos.length}</div>
                        <p className="text-sm text-muted-foreground">Execuções</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {porTipo.djen_processos.reduce((acc, h) => acc + h.processos_verificados, 0)}
                        </div>
                        <p className="text-sm text-muted-foreground">Processos Verificados</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {porTipo.djen_processos.reduce((acc, h) => acc + h.novos_andamentos, 0)}
                        </div>
                        <p className="text-sm text-muted-foreground">Novas Publicações</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-destructive">
                          {porTipo.djen_processos.reduce((acc, h) => acc + h.erros, 0)}
                        </div>
                        <p className="text-sm text-muted-foreground">Erros</p>
                      </CardContent>
                    </Card>
                  </div>

                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Processos</TableHead>
                          <TableHead>Publicações</TableHead>
                          <TableHead>Com Resultados</TableHead>
                          <TableHead>Duplicadas</TableHead>
                          <TableHead>Offset</TableHead>
                          <TableHead>Tempo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porTipo.djen_processos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              Nenhuma execução de DJEN Processos no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          porTipo.djen_processos.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                              <TableCell>{item.processos_verificados}</TableCell>
                              <TableCell>
                                {item.novos_andamentos > 0 ? (
                                  <Badge className="bg-green-600">{item.novos_andamentos}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell>{item.detalhes?.comResultados || 0}</TableCell>
                              <TableCell>{item.detalhes?.duplicadas || 0}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.detalhes?.offset || '-'}</Badge>
                              </TableCell>
                              <TableCell>{item.detalhes?.tempoMs ? `${item.detalhes.tempoMs}ms` : '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Tabs genéricas para outros tipos */}
              {['andamentos', 'redistribuicoes', 'termos', 'distribuicoes'].map(tipo => (
                <TabsContent key={tipo} value={tipo}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <div className="text-2xl font-bold">
                            {(porTipo[tipo as keyof typeof porTipo] as any[])?.length || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Execuções</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {(porTipo[tipo as keyof typeof porTipo] as any[])?.reduce((acc, h) => acc + h.processos_verificados, 0) || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Processos Verificados</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(porTipo[tipo as keyof typeof porTipo] as any[])?.reduce((acc, h) => acc + h.novos_andamentos, 0) || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Novos Encontrados</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4 text-center">
                          <div className="text-2xl font-bold text-destructive">
                            {(porTipo[tipo as keyof typeof porTipo] as any[])?.reduce((acc, h) => acc + h.erros, 0) || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Erros</p>
                        </CardContent>
                      </Card>
                    </div>

                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Processos Verificados</TableHead>
                            <TableHead>Novos Encontrados</TableHead>
                            <TableHead>Processos Atualizados</TableHead>
                            <TableHead>Erros</TableHead>
                            <TableHead>Detalhes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(porTipo[tipo as keyof typeof porTipo] as any[])?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                Nenhuma execução de {TIPOS_MONITORAMENTO.find(t => t.id === tipo)?.label} no período.
                              </TableCell>
                            </TableRow>
                          ) : (
                            (porTipo[tipo as keyof typeof porTipo] as any[])?.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </TableCell>
                                <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                                <TableCell>{item.processos_verificados}</TableCell>
                                <TableCell>
                                  {item.novos_andamentos > 0 ? (
                                    <Badge className="bg-green-600">{item.novos_andamentos}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>{item.processos_com_novos}</TableCell>
                                <TableCell>
                                  {item.erros > 0 ? (
                                    <Badge variant="destructive">{item.erros}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.detalhes && (
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <FileText className="w-4 h-4 mr-1" />
                                          Ver
                                        </Button>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-w-[300px]">
                                          {JSON.stringify(item.detalhes, null, 2)}
                                        </pre>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
