import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Gavel, AlertCircle, ListTodo, FileText, Clock, MapPin, User, CalendarDays } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const movimentacoesRecentes = movimentacoes.slice(0, 5);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const getDaysLabel = (date: string | null) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      const diff = differenceInDays(d, new Date());
      if (diff < 0) return { label: `${Math.abs(diff)}d atrás`, urgent: true };
      if (diff === 0) return { label: "Hoje", urgent: true };
      if (diff === 1) return { label: "Amanhã", urgent: true };
      if (diff <= 3) return { label: `${diff} dias`, urgent: true };
      return { label: `${diff} dias`, urgent: false };
    } catch {
      return null;
    }
  };

  const totalPendencias = audienciasPendentes.length + intimacoesPendentes.length + tarefasPendentes.length;

  return (
    <Card className="border border-border/60 shadow-md">
      <CardHeader className="py-3 px-4 bg-amber-500/10 border-b border-border/50">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Pendências do Processo
          {totalPendencias > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs font-bold px-2 shadow-sm">
              {totalPendencias}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
        {/* Audiências Pendentes */}
        {audienciasPendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Gavel className="w-3.5 h-3.5" />
              Audiências ({audienciasPendentes.length})
            </div>
            {audienciasPendentes.slice(0, 5).map((aud) => {
              const days = getDaysLabel(aud.data_audiencia);
              return (
                <div key={aud.id} className="text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-amber-500 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{aud.tipo_audiencia || "Audiência"}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {days && (
                        <Badge className={cn(
                          "text-[10px] h-5 px-1.5 font-semibold",
                          days.urgent 
                            ? "bg-destructive/15 text-destructive border border-destructive/30" 
                            : "bg-muted text-muted-foreground border border-border"
                        )}>
                          {days.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(aud.data_audiencia)}
                      {aud.hora_brasilia && ` às ${aud.hora_brasilia}`}
                    </span>
                  </div>
                  {aud.local_audiencia && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{aud.local_audiencia}</span>
                    </div>
                  )}
                  {aud.advogado && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{aud.advogado}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Intimações Pendentes */}
        {intimacoesPendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" />
              Intimações ({intimacoesPendentes.length})
            </div>
            {intimacoesPendentes.slice(0, 5).map((int) => {
              const days = getDaysLabel(int.data_limite);
              return (
                <div key={int.id} className="text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-red-500 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {int.tipo_intimacao || int.resumo_objeto || "Intimação"}
                    </span>
                    {days && (
                      <Badge className={cn(
                        "text-[10px] h-5 px-1.5 font-semibold shrink-0",
                        days.urgent
                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                          : "bg-muted text-muted-foreground border border-border"
                      )}>
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {days.label}
                      </Badge>
                    )}
                  </div>
                  {int.data_limite && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      <span>Prazo: {formatDate(int.data_limite)}</span>
                    </div>
                  )}
                  {int.vara_camara && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Gavel className="w-3 h-3 shrink-0" />
                      <span className="truncate">{int.vara_camara}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tarefas Pendentes */}
        {tarefasPendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ListTodo className="w-3.5 h-3.5" />
              Tarefas ({tarefasPendentes.length})
            </div>
            {tarefasPendentes.slice(0, 5).map((t) => {
              const days = getDaysLabel(t.data_vencimento);
              const isOverdue = t.data_vencimento && isPast(new Date(t.data_vencimento));
              return (
                <div key={t.id} className={cn(
                  "text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] space-y-1",
                  isOverdue ? "border-l-destructive" : "border-l-blue-500"
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{t.titulo}</span>
                    {days && (
                      <Badge className={cn(
                        "text-[10px] h-5 px-1.5 font-semibold shrink-0",
                        days.urgent
                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                          : "bg-muted text-muted-foreground border border-border"
                      )}>
                        {days.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                    {t.data_vencimento && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Vence: {formatDate(t.data_vencimento)}
                      </span>
                    )}
                    {t.tipo && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium">
                        {t.tipo}
                      </Badge>
                    )}
                  </div>
                  {t.responsavel_nome && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{t.responsavel_nome}</span>
                    </div>
                  )}
                  {t.descricao && (
                    <p className="text-muted-foreground line-clamp-1 mt-0.5">{t.descricao}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Últimos Andamentos */}
        {movimentacoesRecentes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              Últimos Andamentos
            </div>
            {movimentacoesRecentes.map((mov) => (
              <div key={mov.id} className="text-xs p-2 bg-muted/30 rounded-lg border border-border/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-foreground font-medium line-clamp-2">
                    {mov.tipo || mov.descricao?.substring(0, 80)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {formatDate(mov.data_movimentacao)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sem pendências */}
        {totalPendencias === 0 && movimentacoesRecentes.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">Nenhuma pendência registrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
