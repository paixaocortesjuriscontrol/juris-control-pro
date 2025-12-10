import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHistoricoMonitoramento } from "@/hooks/useHistoricoMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function RelatorioMonitoramentoCard() {
  const { data: historico, isLoading } = useHistoricoMonitoramento('andamentos');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalExecucoes = historico?.length || 0;
  const totalAndamentos = historico?.reduce((acc, h) => acc + h.novos_andamentos, 0) || 0;
  const totalProcessosVerificados = historico?.reduce((acc, h) => acc + h.processos_verificados, 0) || 0;
  const totalErros = historico?.reduce((acc, h) => acc + h.erros, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Relatório de Monitoramento de Andamentos
        </CardTitle>
        <CardDescription>
          Histórico de execuções e resultados do monitoramento automático
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary">{totalExecucoes}</div>
            <div className="text-sm text-muted-foreground">Execuções</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalAndamentos}</div>
            <div className="text-sm text-muted-foreground">Andamentos Encontrados</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totalProcessosVerificados}</div>
            <div className="text-sm text-muted-foreground">Processos Verificados</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{totalErros}</div>
            <div className="text-sm text-muted-foreground">Erros</div>
          </div>
        </div>

        {/* History List */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Execuções
          </h4>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {historico?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma execução registrada ainda.
                </p>
              ) : (
                historico?.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(new Date(item.executado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <div className="flex gap-2">
                        {item.novos_andamentos > 0 && (
                          <Badge variant="default" className="bg-green-600">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {item.novos_andamentos} novos
                          </Badge>
                        )}
                        {item.erros > 0 && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {item.erros} erros
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{item.processos_verificados} processos verificados</span>
                      <span>•</span>
                      <span>{item.processos_com_novos} com novos andamentos</span>
                    </div>
                    {item.detalhes?.details && item.detalhes.details.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Processos atualizados:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.detalhes.details.slice(0, 5).map((d: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {d.processo}: {d.novosAndamentos} andamentos
                            </Badge>
                          ))}
                          {item.detalhes.details.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.detalhes.details.length - 5} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
