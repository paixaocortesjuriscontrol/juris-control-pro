import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, AlertCircle, CheckCircle, FileSearch, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditoriaDjenProcessos, LoteDjenProcessos } from "@/hooks/useAuditoriaDjenProcessos";

export default function AuditoriaDjenProcessos() {
  const { lotes, reprocessarLote } = useAuditoriaDjenProcessos();

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatPeriodo = (lote: LoteDjenProcessos) => {
    if (!lote.detalhes?.dataInicio || !lote.detalhes?.dataFim) return "-";
    return `${lote.detalhes.dataInicio} a ${lote.detalhes.dataFim}`;
  };

  const getLoteStatus = (lote: LoteDjenProcessos) => {
    if (lote.erros > 0) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Erros</Badge>;
    }
    if (lote.novos_andamentos > 0) {
      return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Com Resultados</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><FileSearch className="h-3 w-3" /> Sem Novas</Badge>;
  };

  const handleReprocessar = (lote: LoteDjenProcessos) => {
    reprocessarLote.mutate(lote);
  };

  // Agrupar lotes por período
  const lotesAgrupados = lotes.data?.reduce((acc, lote) => {
    const periodo = formatPeriodo(lote);
    if (!acc[periodo]) acc[periodo] = [];
    acc[periodo].push(lote);
    return acc;
  }, {} as Record<string, LoteDjenProcessos[]>) || {};

  return (
    <MainLayout title="Auditoria DJEN por Processo" subtitle="Histórico de execuções do monitoramento">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Lotes Executados
            </CardTitle>
            <CardDescription>
              Cada lote processa até 50 processos. Você pode reprocessar qualquer lote específico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lotes.isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : lotes.data && lotes.data.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Executado em</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Offset</TableHead>
                      <TableHead className="text-center">Verificados</TableHead>
                      <TableHead className="text-center">Com Resultado</TableHead>
                      <TableHead className="text-center">Novas</TableHead>
                      <TableHead className="text-center">Duplicadas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotes.data.map((lote) => (
                      <TableRow key={lote.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(lote.executado_em)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatPeriodo(lote)}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {lote.detalhes?.offset ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {lote.processos_verificados}
                          {lote.detalhes?.totalProcessos && (
                            <span className="text-muted-foreground text-xs ml-1">
                              /{lote.detalhes.totalProcessos}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {lote.detalhes?.processosComResultados ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={lote.novos_andamentos > 0 ? "text-green-600 font-semibold" : ""}>
                            {lote.novos_andamentos}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {lote.detalhes?.duplicadas ?? 0}
                        </TableCell>
                        <TableCell>{getLoteStatus(lote)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocessar(lote)}
                            disabled={reprocessarLote.isPending}
                          >
                            {reprocessarLote.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Reprocessar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum lote executado ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo por período */}
        {Object.keys(lotesAgrupados).length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(lotesAgrupados).map(([periodo, lotesP]) => {
                  const totalVerificados = lotesP.reduce((sum, l) => sum + l.processos_verificados, 0);
                  const totalNovas = lotesP.reduce((sum, l) => sum + l.novos_andamentos, 0);
                  const totalDuplicadas = lotesP.reduce((sum, l) => sum + (l.detalhes?.duplicadas ?? 0), 0);
                  const totalComResultados = lotesP.reduce((sum, l) => sum + (l.detalhes?.processosComResultados ?? 0), 0);

                  return (
                    <div key={periodo} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{periodo}</p>
                        <p className="text-sm text-muted-foreground">{lotesP.length} lotes executados</p>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{totalVerificados}</p>
                          <p className="text-muted-foreground">Verificados</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{totalComResultados}</p>
                          <p className="text-muted-foreground">Com Resultado</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-green-600">{totalNovas}</p>
                          <p className="text-muted-foreground">Novas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-muted-foreground">{totalDuplicadas}</p>
                          <p className="text-muted-foreground">Duplicadas</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
