import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CapturaIntimacao, HistoricoCaptura } from "@/hooks/useCofreSenhas";

interface HistoricoCapturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captura: CapturaIntimacao | null;
  buscarHistorico: (capturaId: string) => Promise<HistoricoCaptura[]>;
}

export function HistoricoCapturaDialog({ 
  open, 
  onOpenChange, 
  captura, 
  buscarHistorico 
}: HistoricoCapturaDialogProps) {
  const [historico, setHistorico] = useState<HistoricoCaptura[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && captura) {
      loadHistorico();
    }
  }, [open, captura]);

  const loadHistorico = async () => {
    if (!captura) return;
    setLoading(true);
    try {
      const data = await buscarHistorico(captura.id);
      setHistorico(data);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Capturas
            {captura && (
              <Badge variant="outline" className="ml-2">
                {captura.oab_numero}/{captura.oab_uf}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          {captura && (
            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {captura.total_intimacoes_capturadas}
                </p>
                <p className="text-xs text-muted-foreground">Total Capturadas</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {captura.ultima_captura
                    ? format(new Date(captura.ultima_captura), "dd/MM/yy HH:mm", { locale: ptBR })
                    : "-"
                  }
                </p>
                <p className="text-xs text-muted-foreground">Última Execução</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {captura.proxima_captura
                    ? format(new Date(captura.proxima_captura), "dd/MM/yy HH:mm", { locale: ptBR })
                    : "-"
                  }
                </p>
                <p className="text-xs text-muted-foreground">Próxima Execução</p>
              </div>
            </div>
          )}

          {/* Lista de execuções */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Últimas Execuções</p>
            <Button variant="ghost" size="sm" onClick={loadHistorico} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          <ScrollArea className="h-[400px] rounded-lg border">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : historico.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma execução registrada</p>
                <p className="text-sm">As capturas aparecerão aqui após a execução</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {historico.map((item) => (
                  <div 
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      item.sucesso
                        ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                        : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {item.sucesso ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(item.executado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </p>
                          {item.sucesso ? (
                            <p className="text-sm text-muted-foreground">
                              Encontradas: {item.intimacoes_encontradas} | Novas: {item.intimacoes_novas}
                            </p>
                          ) : (
                            <p className="text-sm text-red-600">{item.erro}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDuration(item.tempo_execucao_ms)}
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {item.detalhes && (
                      <div className="mt-2 pt-2 border-t border-dashed text-xs text-muted-foreground">
                        {typeof item.detalhes === 'object' && (
                          <>
                            {(item.detalhes as any).paginas && (
                              <span className="mr-3">Páginas: {(item.detalhes as any).paginas}</span>
                            )}
                            {(item.detalhes as any).tempo_login && (
                              <span className="mr-3">Login: {(item.detalhes as any).tempo_login}ms</span>
                            )}
                            {(item.detalhes as any).mensagem && (
                              <span>{(item.detalhes as any).mensagem}</span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
