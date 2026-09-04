import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Gavel, AlertCircle, ListTodo, FileText, Clock, MapPin, User, CalendarDays, Check, X, CalendarClock, Loader2 } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { parseDateSafe as parseDateSafeUtil } from "@/utils/date";

// Parse "YYYY-MM-DD" como data local para evitar deslocamento por timezone.
function parseDateSafe(value: string): Date {
  return parseDateSafeUtil(value) ?? new Date(value);
}

const isPrazoTarefa = (tipo: string | null | undefined) =>
  (tipo || "").toString().trim().toUpperCase() === "PRAZO";

interface PendenciasProcessoCardProps {
  audiencias: any[];
  intimacoes: any[];
  tarefas: any[];
  movimentacoes: any[];
  eventosAgenda?: any[];
  processoId?: string;
  processoNumero?: string;
  onNavigate?: (section: string) => void;
}

export function PendenciasProcessoCard({ 
  audiencias, 
  intimacoes, 
  tarefas, 
  movimentacoes,
  eventosAgenda = [],
  processoId,
  processoNumero,
  onNavigate,
}: PendenciasProcessoCardProps) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Um item só é pendência se o status for "pendente" E não houver marca de
  // conclusão/tratamento (o status pode ficar desatualizado em fluxos antigos).
  const tarefaEmAberto = (t: any) =>
    t.status === 'pendente' && !t.data_cumprimento && !t.tratado_em && !t.concluido_em;
  const eventoEmAberto = (e: any) =>
    e.status === 'pendente' && !e.concluido_em && !e.tratado_em && !e.data_cumprimento;

  const audienciasPendentes = audiencias.filter(a => a.status === 'pendente' && !a.concluido_em);
  const intimacoesPendentes = intimacoes.filter(i => i.status === 'pendente');
  const prazosPendentes = tarefas.filter(t => tarefaEmAberto(t) && isPrazoTarefa(t.tipo_tarefa));
  const tarefasPendentes = tarefas.filter(t => tarefaEmAberto(t) && !isPrazoTarefa(t.tipo_tarefa));
  const eventosPendentes = eventosAgenda.filter(eventoEmAberto);
  const isParcelamento = (ev: any) => (ev?.tipo || "").toString().toLowerCase() === "parcelamento";
  const eventosSemParcelamento = eventosPendentes.filter((e: any) => !isParcelamento(e));
  const parcelamentosPendentes = eventosPendentes.filter((e: any) => isParcelamento(e));
  const movimentacoesRecentes = movimentacoes.slice(0, 5);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["audiencias-processo"] }),
      queryClient.invalidateQueries({ queryKey: ["tarefas-processo"] }),
      queryClient.invalidateQueries({ queryKey: ["eventos-processo"] }),
      queryClient.invalidateQueries({ queryKey: ["prazos"] }),
    ]);
  };

  const updateStatus = async (
    table: "audiencias_detectadas" | "tarefas" | "eventos_agenda",
    id: string,
    novoStatus: string,
  ) => {
    setBusyId(id);
    try {
      const patch: Record<string, any> = { status: novoStatus, updated_at: new Date().toISOString() };
      if (table === "tarefas" && novoStatus === "cumprido") {
        patch.data_cumprimento = new Date().toISOString();
      }
      if (table === "eventos_agenda" && novoStatus === "concluido") {
        patch.concluido_em = new Date().toISOString();
      }
      const { error } = await supabase.from(table).update(patch as any).eq("id", id);
      if (error) throw error;
      toast.success(novoStatus === "cancelado" ? "Cancelado" : "Concluído");
      await invalidateAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar status");
    } finally {
      setBusyId(null);
    }
  };

  const StatusActions = ({
    id,
    onConcluir,
    onCancelar,
  }: {
    id: string;
    onConcluir: () => void;
    onCancelar: () => void;
  }) => (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        title="Marcar como Concluída"
        onClick={onConcluir}
        disabled={busyId === id}
      >
        {busyId === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-destructive hover:bg-red-50 hover:text-red-700"
        title="Cancelar"
        onClick={onCancelar}
        disabled={busyId === id}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(parseDateSafe(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const getDaysLabel = (date: string | null) => {
    if (!date) return null;
    try {
      const d = parseDateSafe(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = differenceInDays(d, today);
      if (diff < 0) return { label: `${Math.abs(diff)}d atrás`, urgent: true };
      if (diff === 0) return { label: "Hoje", urgent: true };
      if (diff === 1) return { label: "Amanhã", urgent: true };
      if (diff <= 3) return { label: `${diff} dias`, urgent: true };
      return { label: `${diff} dias`, urgent: false };
    } catch {
      return null;
    }
  };

  const totalPendencias =
    audienciasPendentes.length + intimacoesPendentes.length + prazosPendentes.length + tarefasPendentes.length + eventosPendentes.length;

  const navigateCard = (section: string) => {
    onNavigate?.(section);
  };

  const clickableCardClass = () =>
    cn(onNavigate && "cursor-pointer hover:bg-muted/60 transition-colors");

  // Identifica de qual pasta/processo é a pendência (processos distintos podem
  // ter itens com títulos idênticos).
  const ProcTag = () =>
    processoNumero ? (
      <div className="text-[10px] text-muted-foreground/80 font-mono truncate">
        Processo {processoNumero}
      </div>
    ) : null;

  return (
    <>
    <Card className="border border-border/60 shadow-md">
      <CardHeader className="py-2.5 px-4 bg-sidebar border-b border-border/50">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-gold" />
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
                <div
                  key={aud.id}
                  className={cn("text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-yellow-500 space-y-1", clickableCardClass())}
                  onClick={() => navigateCard("audiencias")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{aud.titulo || aud.tipo_audiencia || "Audiência"}</span>
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
                      <StatusActions
                        id={aud.id}
                        onConcluir={() => updateStatus("audiencias_detectadas", aud.id, "concluida")}
                        onCancelar={() => updateStatus("audiencias_detectadas", aud.id, "cancelada")}
                      />
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
                <div
                  key={int.id}
                  className={cn("text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-red-500 space-y-1", clickableCardClass())}
                  onClick={() => navigateCard("intimacoes")}
                >
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

        {/* Prazos Pendentes */}
        {prazosPendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Prazos ({prazosPendentes.length})
            </div>
            {prazosPendentes.slice(0, 5).map((t) => {
              const days = getDaysLabel(t.data_vencimento || t.data_fatal);
              return (
                <div
                  key={t.id}
                  className={cn("text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-destructive space-y-1", clickableCardClass())}
                  onClick={() => navigateCard("prazo")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{t.titulo}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {days && (
                        <Badge className="text-[10px] h-5 px-1.5 font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                          {days.label}
                        </Badge>
                      )}
                      <StatusActions
                        id={t.id}
                        onConcluir={() => updateStatus("tarefas", t.id, "cumprido")}
                        onCancelar={() => updateStatus("tarefas", t.id, "cancelado")}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                    {t.data_vencimento && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Limite: {formatDate(t.data_vencimento)}
                      </span>
                    )}
                    {t.data_fatal && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Fatal: {formatDate(t.data_fatal)}
                      </span>
                    )}
                  </div>
                  {t.descricao && (
                    <p className="text-muted-foreground line-clamp-1 mt-0.5">{t.descricao}</p>
                  )}
                  <ProcTag />
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
              return (
                <div
                  key={t.id}
                  className={cn(
                    "text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-blue-500 space-y-1",
                    clickableCardClass()
                  )}
                  onClick={() => navigateCard("tarefas")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{t.titulo}</span>
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
                      <StatusActions
                        id={t.id}
                        onConcluir={() => updateStatus("tarefas", t.id, "cumprido")}
                        onCancelar={() => updateStatus("tarefas", t.id, "cancelado")}
                      />
                    </div>
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
                  <ProcTag />
                </div>
              );
            })}
          </div>
        )}

        {/* Eventos Pendentes */}
        {eventosSemParcelamento.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <CalendarClock className="w-3.5 h-3.5" />
              Eventos ({eventosSemParcelamento.length})
            </div>
            {eventosSemParcelamento.slice(0, 5).map((ev: any) => {
              const days = getDaysLabel(ev.data_inicio);
              return (
                <div
                  key={ev.id}
                  className={cn("text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-violet-500 space-y-1", clickableCardClass())}
                  onClick={() => navigateCard("agenda")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{ev.titulo}</span>
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
                      <StatusActions
                        id={ev.id}
                        onConcluir={() => updateStatus("eventos_agenda", ev.id, "concluido")}
                        onCancelar={() => updateStatus("eventos_agenda", ev.id, "cancelado")}
                      />
                    </div>
                  </div>
                  {ev.data_inicio && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(ev.data_inicio)}
                    </div>
                  )}
                  {ev.local && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{ev.local}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Parcelamentos Pendentes */}
        {parcelamentosPendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <CalendarClock className="w-3.5 h-3.5" />
              Parcelamentos ({parcelamentosPendentes.length})
            </div>
            {parcelamentosPendentes.slice(0, 5).map((ev: any) => {
              const days = getDaysLabel(ev.data_inicio);
              return (
                <div
                  key={ev.id}
                  className={cn("text-xs p-2.5 bg-muted/40 rounded-lg border border-border/40 border-l-[3px] border-l-green-500 space-y-1", clickableCardClass())}
                  onClick={() => navigateCard("parcelamento")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{ev.titulo}</span>
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
                      <StatusActions
                        id={ev.id}
                        onConcluir={() => updateStatus("eventos_agenda", ev.id, "concluido")}
                        onCancelar={() => updateStatus("eventos_agenda", ev.id, "cancelado")}
                      />
                    </div>
                  </div>
                  {ev.data_inicio && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(ev.data_inicio)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sem pendências */}
        {totalPendencias === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">Nenhuma pendência registrada</p>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
