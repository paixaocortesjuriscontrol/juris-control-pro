import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Gavel, AlertCircle, ListTodo, FileText, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendenciasProcessoCardProps {
  audiencias: any[];
  intimacoes: any[];
  tarefas: any[];
  movimentacoes: any[];
}

export function PendenciasProcessoCard({ 
  audiencias, 
  intimacoes, 
  tarefas, 
  movimentacoes 
}: PendenciasProcessoCardProps) {
  const audienciasPendentes = audiencias.filter(a => a.status === 'pendente');
  const intimacoesPendentes = intimacoes.filter(i => i.status === 'pendente');
  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente');
  const movimentacoesRecentes = movimentacoes.slice(0, 3);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const totalPendencias = audienciasPendentes.length + intimacoesPendentes.length + tarefasPendentes.length;

  return (
    <Card className="border">
      <CardHeader className="py-3 px-4 bg-amber-50 dark:bg-amber-950/30 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Pendências do Processo
          {totalPendencias > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {totalPendencias}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {/* Audiências Pendentes */}
        {audienciasPendentes.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Gavel className="w-3 h-3" />
              Audiências ({audienciasPendentes.length})
            </div>
            {audienciasPendentes.slice(0, 3).map((aud) => (
              <div key={aud.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-amber-500">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{aud.tipo_audiencia || "Audiência"}</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {formatDate(aud.data_audiencia)}
                  </Badge>
                </div>
                {aud.hora_brasilia && (
                  <span className="text-muted-foreground">às {aud.hora_brasilia}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Intimações Pendentes */}
        {intimacoesPendentes.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              Intimações ({intimacoesPendentes.length})
            </div>
            {intimacoesPendentes.slice(0, 3).map((int) => (
              <div key={int.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-red-500">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[150px]">
                    {int.tipo_intimacao || "Intimação"}
                  </span>
                  {int.data_limite && (
                    <Badge variant="destructive" className="text-[10px] h-4">
                      <Clock className="w-2.5 h-2.5 mr-0.5" />
                      {formatDate(int.data_limite)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tarefas Pendentes */}
        {tarefasPendentes.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListTodo className="w-3 h-3" />
              Tarefas ({tarefasPendentes.length})
            </div>
            {tarefasPendentes.slice(0, 3).map((t) => (
              <div key={t.id} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-blue-500">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[150px]">{t.titulo}</span>
                  {t.data_vencimento && (
                    <Badge variant="outline" className="text-[10px] h-4">
                      {formatDate(t.data_vencimento)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Últimos Andamentos */}
        {movimentacoesRecentes.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="w-3 h-3" />
              Últimos Andamentos
            </div>
            {movimentacoesRecentes.map((mov) => (
              <div key={mov.id} className="text-xs p-2 bg-muted/30 rounded">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate max-w-[180px] text-muted-foreground">
                    {mov.tipo || mov.descricao?.substring(0, 30)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(mov.data_movimentacao)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sem pendências */}
        {totalPendencias === 0 && movimentacoesRecentes.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma pendência registrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
