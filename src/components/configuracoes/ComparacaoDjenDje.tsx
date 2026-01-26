import { useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Download, 
  FileText, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CalendarIcon,
  BarChart3,
  FileSearch,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDjePdfs,
  useDjeResultados,
  useComparacaoStats,
  useBaixarDjePdf,
  useProcessarDjePdf,
  useBuscarDjeInterno,
  TRIBUNAIS_DJE_PDF,
  type DjePdfDiario,
} from "@/hooks/useDjePdfComparacao";

export default function ComparacaoDjenDje() {
  const [dataRef, setDataRef] = useState<Date>(new Date());
  const [tribunalSelecionado, setTribunalSelecionado] = useState<string>("all");
  
  const dataFormatada = format(dataRef, "yyyy-MM-dd");
  
  const { data: pdfs, isLoading: loadingPdfs, refetch: refetchPdfs } = useDjePdfs(
    format(subDays(dataRef, 7), "yyyy-MM-dd"),
    dataFormatada
  );
  
  const { data: stats, isLoading: loadingStats } = useComparacaoStats(dataFormatada);
  const { data: resultados, isLoading: loadingResultados } = useDjeResultados(dataFormatada);
  
  const baixarPdf = useBaixarDjePdf();
  const processarPdf = useProcessarDjePdf();
  const buscarInterno = useBuscarDjeInterno();

  const handleBaixarTodos = async () => {
    for (const tribunal of TRIBUNAIS_DJE_PDF) {
      await baixarPdf.mutateAsync({ 
        tribunal: tribunal.id, 
        data_publicacao: dataFormatada 
      });
    }
    refetchPdfs();
  };

  const handleProcessarPendentes = () => {
    processarPdf.mutate({ limit: 10 });
  };

  const handleBuscarTermos = () => {
    buscarInterno.mutate({ data_publicacao: dataFormatada });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processado":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Processado</Badge>;
      case "baixado":
        return <Badge className="bg-sky-600 hover:bg-sky-700"><FileText className="h-3 w-3 mr-1" />Baixado</Badge>;
      case "baixando":
      case "processando":
        return <Badge className="bg-amber-600 hover:bg-amber-700"><Clock className="h-3 w-3 mr-1" />Em andamento</Badge>;
      case "erro":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparação DJE-PDF vs DJEN API
              </CardTitle>
              <CardDescription>
                Sistema experimental para comparar resultados de busca via PDF vs API
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataRef, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dataRef}
                    onSelect={(date) => date && setDataRef(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleBaixarTodos}
              disabled={baixarPdf.isPending}
            >
              {baixarPdf.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Baixar PDFs do Dia
            </Button>
            <Button 
              variant="secondary"
              onClick={handleProcessarPendentes}
              disabled={processarPdf.isPending}
            >
              {processarPdf.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4 mr-2" />
              )}
              Processar Pendentes
            </Button>
            <Button 
              variant="secondary"
              onClick={handleBuscarTermos}
              disabled={buscarInterno.isPending}
            >
              {buscarInterno.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar Termos
            </Button>
            <Button 
              variant="ghost"
              onClick={() => refetchPdfs()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              DJE-PDF (Sistema Novo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{stats?.dje_pdf.total_matches || 0}</div>
                <p className="text-xs text-muted-foreground">
                  matches em {stats?.dje_pdf.pdfs_processados || 0}/{stats?.dje_pdf.total_pdfs || 0} PDFs
                  ({stats?.dje_pdf.total_paginas || 0} páginas)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              DJEN API (Sistema Atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{stats?.djen_api.total_publicacoes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  publicações encontradas via API
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sobreposição
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{stats?.sobreposicao.matches_comuns || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{stats?.sobreposicao.exclusivos_dje_pdf || 0} exclusivos PDF |
                  +{stats?.sobreposicao.exclusivos_djen_api || 0} exclusivos API
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs com detalhes */}
      <Tabs defaultValue="pdfs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pdfs">PDFs Baixados</TabsTrigger>
          <TabsTrigger value="resultados">Resultados DJE-PDF</TabsTrigger>
          <TabsTrigger value="comparacao">Comparação</TabsTrigger>
        </TabsList>

        <TabsContent value="pdfs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PDFs do Período</CardTitle>
              <CardDescription>
                PDFs baixados dos tribunais nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPdfs ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tribunal</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Caderno</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Páginas</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pdfs?.map((pdf) => (
                        <TableRow key={pdf.id}>
                          <TableCell className="font-medium">{pdf.tribunal}</TableCell>
                          <TableCell>
                            {format(new Date(pdf.data_publicacao), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{pdf.caderno}</TableCell>
                          <TableCell>{getStatusBadge(pdf.status)}</TableCell>
                          <TableCell>{formatBytes(pdf.tamanho_bytes)}</TableCell>
                          <TableCell>{pdf.total_paginas || "-"}</TableCell>
                          <TableCell>
                            {pdf.status === "baixado" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => processarPdf.mutate({ pdf_id: pdf.id })}
                                disabled={processarPdf.isPending}
                              >
                                <FileSearch className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!pdfs || pdfs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum PDF baixado no período
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultados da Busca DJE-PDF</CardTitle>
              <CardDescription>
                Termos encontrados nos PDFs processados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingResultados ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Termo</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Página</TableHead>
                        <TableHead>Contexto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados?.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.termo_encontrado}</TableCell>
                          <TableCell className="font-mono text-xs">{r.processo_numero || "-"}</TableCell>
                          <TableCell>{r.pagina || "-"}</TableCell>
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {r.contexto || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!resultados || resultados.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum resultado encontrado. Execute a busca de termos.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparacao">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparação Lado a Lado</CardTitle>
              <CardDescription>
                Análise de sobreposição entre os dois sistemas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DJE-PDF Stats */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    DJE-PDF (Novo)
                  </h3>
                  {loadingStats ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="space-y-2">
                      {stats?.dje_pdf.tribunais.map(t => (
                        <div key={t.tribunal} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span>{t.tribunal}</span>
                          <Badge variant="secondary">{t.matches} matches</Badge>
                        </div>
                      ))}
                      {(!stats?.dje_pdf.tribunais || stats.dje_pdf.tribunais.length === 0) && (
                        <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                      )}
                    </div>
                  )}
                </div>

                {/* DJEN API Stats */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    DJEN API (Atual)
                  </h3>
                  {loadingStats ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="space-y-2">
                      {stats?.djen_api.tribunais.map(t => (
                        <div key={t.tribunal} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span>{t.tribunal}</span>
                          <Badge variant="secondary">{t.count} publicações</Badge>
                        </div>
                      ))}
                      {(!stats?.djen_api.tribunais || stats.djen_api.tribunais.length === 0) && (
                        <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
