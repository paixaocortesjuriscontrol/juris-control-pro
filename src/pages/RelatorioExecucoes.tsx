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
  Download
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRelatorioExecucoes, useDjenRunLotes } from "@/hooks/useRelatorioExecucoes";
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

  const { historico, djenRuns, isLoading, estatisticas, porTipo } = useRelatorioExecucoes(
    dataInicio,
    dataFim,
    tiposFiltro
  );

  const { data: lotesExpanded } = useDjenRunLotes(expandedRun);

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

  const exportarCSV = () => {
    const linhas = [
      ['Tipo', 'Data/Hora', 'Status', 'Itens Verificados', 'Novos Encontrados', 'Erros', 'Duração'].join(';')
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
              <div className="flex flex-wrap gap-2">
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

        {/* Estatísticas */}
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
            <CardTitle>Histórico de Execuções</CardTitle>
            <CardDescription>
              Detalhamento por tipo de monitoramento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="todos">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="djen">DJEN Publicações</TabsTrigger>
                <TabsTrigger value="djen_processos">DJEN Processos</TabsTrigger>
                <TabsTrigger value="andamentos">Andamentos</TabsTrigger>
                <TabsTrigger value="redistribuicoes">Redistribuições</TabsTrigger>
                <TabsTrigger value="termos">Monit. 360°</TabsTrigger>
                <TabsTrigger value="distribuicoes">Distribuições</TabsTrigger>
              </TabsList>

              {/* Tab Todos */}
              <TabsContent value="todos">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verificados</TableHead>
                        <TableHead>Novos</TableHead>
                        <TableHead>Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6}>
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
                                {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                              <TableCell>{item.processos_verificados}</TableCell>
                              <TableCell>{item.novos_andamentos}</TableCell>
                              <TableCell>{item.erros}</TableCell>
                            </TableRow>
                          ))}
                          {djenRuns?.map(run => (
                            <TableRow key={run.id}>
                              <TableCell>
                                <Badge variant="outline">DJEN</Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(run.iniciado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{getStatusBadge(run.status)}</TableCell>
                              <TableCell>{run.processados || 0}</TableCell>
                              <TableCell>{run.novas || 0}</TableCell>
                              <TableCell>{run.erros || 0}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              {/* Tab DJEN Publicações - com detalhes expandíveis */}
              <TabsContent value="djen">
                <ScrollArea className="h-[500px]">
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
                          onOpenChange={(open) => setExpandedRun(open ? run.run_id : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="font-medium">
                                        {format(new Date(run.iniciado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Duração: {formatDuration(run.duracao_segundos)}
                                        {run.retry_count && run.retry_count > 0 && ` • ${run.retry_count} retentativas`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {getStatusBadge(run.status)}
                                    <div className="text-right text-sm">
                                      <p><span className="text-muted-foreground">Processados:</span> {run.processados || 0}</p>
                                      <p><span className="text-muted-foreground">Novas:</span> {run.novas || 0}</p>
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
                              <Card className="ml-4 mt-2 border-l-4 border-primary">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Lotes Processados</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Lote</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Offset</TableHead>
                                        <TableHead>Processados</TableHead>
                                        <TableHead>Novas</TableHead>
                                        <TableHead>Duplicatas</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {lotesExpanded.map(lote => (
                                        <TableRow key={lote.id}>
                                          <TableCell>#{lote.lote_numero}</TableCell>
                                          <TableCell>{getStatusBadge(lote.status)}</TableCell>
                                          <TableCell>{lote.offset_inicial}-{lote.offset_final}</TableCell>
                                          <TableCell>{lote.processados || 0}</TableCell>
                                          <TableCell>{lote.novas || 0}</TableCell>
                                          <TableCell>{lote.duplicatas || 0}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              </Card>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tabs genéricas para outros tipos */}
              {['djen_processos', 'andamentos', 'redistribuicoes', 'termos', 'distribuicoes'].map(tipo => (
                <TabsContent key={tipo} value={tipo}>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Processos Verificados</TableHead>
                          <TableHead>Novos Encontrados</TableHead>
                          <TableHead>Processos Atualizados</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porTipo[tipo as keyof typeof porTipo]?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma execução de {tipo} no período selecionado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (porTipo[tipo as keyof typeof porTipo] as any[])?.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {format(new Date(item.executado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{getStatusBadge('', item.erros)}</TableCell>
                              <TableCell>{item.processos_verificados}</TableCell>
                              <TableCell>{item.novos_andamentos}</TableCell>
                              <TableCell>{item.processos_com_novos}</TableCell>
                              <TableCell>
                                {item.erros > 0 ? (
                                  <Badge variant="destructive">{item.erros}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
