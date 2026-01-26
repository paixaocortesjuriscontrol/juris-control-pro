import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  ArrowLeft,
  Building2,
  Clock,
  FileWarning,
  Gavel,
  ListTodo,
  Mail,
  MessageCircle,
  Newspaper,
  Radar,
  RefreshCw,
  Scale,
  Settings,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfigAlertasCoordenacao } from "@/hooks/useConfigAlertasCoordenacao";
import { ConfigAlertasCoordenacaoDialog } from "./ConfigAlertasCoordenacaoDialog";
import { cn } from "@/lib/utils";
import { startOfDay, parseISO, isBefore, isAfter, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Props {
  coordenacaoId: string;
  coordenacaoNome: string;
  onBack: () => void;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}

export function CoordenacaoDetalhesView({
  coordenacaoId,
  coordenacaoNome,
  onBack,
  periodoInicio,
  periodoFim,
  statusFilter = "pendente",
  searchQuery = "",
}: Props) {
  const navigate = useNavigate();
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });
  const { prazosUrgentes } = useNotificacoes();
  const { configs } = useConfigAlertasCoordenacao();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const matchesPeriodo = useMemo(() => {
    return (dateStr: string | null | undefined) => {
      if (!dateStr) return true;
      if (!periodoInicio && !periodoFim) return true;
      try {
        const date = startOfDay(parseISO(dateStr));
        if (periodoInicio && isBefore(date, startOfDay(periodoInicio))) return false;
        if (periodoFim && isAfter(date, startOfDay(periodoFim))) return false;
        return true;
      } catch {
        return true;
      }
    };
  }, [periodoInicio, periodoFim]);

  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-coordenacao-detalhes", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id, titulo, status, data_vencimento, prioridade,
          responsavel:profiles!tarefas_responsavel_id_fkey(id, nome),
          processo:processos!tarefas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order("data_vencimento", { ascending: true });

      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((t: any) => t.processo?.coordenacao_id === coordenacaoId);
    },
  });

  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-coordenacao-detalhes", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id, processo_numero, data_audiencia, hora, tipo_audiencia, local_audiencia, status,
          processo:processos!audiencias_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order("data_audiencia", { ascending: true });

      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((a: any) => a.processo?.coordenacao_id === coordenacaoId);
    },
  });

  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-coordenacao-detalhes", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id, processo_numero, data_intimacao, tipo_intimacao, prazo_dias, data_limite, status,
          processo:processos!intimacoes_detectadas_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .order("data_limite", { ascending: true });

      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((i: any) => i.processo?.coordenacao_id === coordenacaoId);
    },
  });

  const { data: andamentosData = [] } = useQuery({
    queryKey: ["andamentos-coordenacao-detalhes", coordenacaoId, periodoInicio, periodoFim],
    queryFn: async () => {
      const inicioDia = periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined;
      const fimDiaMaisUm = periodoFim ? format(new Date(periodoFim.getTime() + 86400000), "yyyy-MM-dd") : undefined;

      let query = supabase
        .from("movimentacoes")
        .select(`
          id, descricao, data_movimentacao, created_at, tipo,
          processo:processos!movimentacoes_processo_id_fkey(id, numero, coordenacao_id)
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false });

      if (inicioDia) query = query.gte("created_at", inicioDia);
      if (fimDiaMaisUm) query = query.lt("created_at", fimDiaMaisUm);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((a: any) => a.processo?.coordenacao_id === coordenacaoId);
    },
  });

  const monIds = monitoramentosDjen.filter(m => m.coordenacao_id === coordenacaoId).map(m => m.id);
  const publicacoesFiltradas = publicacoes.filter(p => {
    if (!monIds.includes(p.monitoramento_id)) return false;
    if (statusFilter !== "todas" && p.lida) return false;
    if (!matchesPeriodo(p.created_at)) return false;
    if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
    return true;
  });

  const distribuicoesFiltradas = distribuicoesEncontradas.filter(d => {
    if ((d as any).monitoramento?.coordenacao_id !== coordenacaoId) return false;
    if (statusFilter !== "todas" && d.status !== 'pendente') return false;
    if (!matchesPeriodo(d.data_distribuicao)) return false;
    if (!matchesSearch(d.numero_processo)) return false;
    return true;
  });

  const alertasFiltrados = alertas.filter(a => {
    if (a.processo?.coordenacao_id !== coordenacaoId) return false;
    if (statusFilter !== "todas" && a.status !== 'pendente') return false;
    if (!matchesPeriodo(a.created_at)) return false;
    if (!matchesSearch(a.termo_encontrado)) return false;
    return true;
  });

  const redistribuicoesFiltradas = redistribuicoesData.filter(r => matchesSearch(r.processo_numero));

  const config = configs.find(c => c.coordenacao_id === coordenacaoId);

  const stats = {
    djen: publicacoesFiltradas.length,
    distribuicoes: distribuicoesFiltradas.length,
    alertas360: alertasFiltrados.length,
    redistribuicoes: redistribuicoesFiltradas.length,
    andamentos: andamentosData.length,
    prazos: prazosUrgentes.filter(p => p.processo?.coordenacao_id === coordenacaoId).length,
    tarefas: tarefasPendentes.length,
    audiencias: audienciasPendentes.length,
    intimacoes: intimacoesPendentes.length,
  };
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const getPrioridadeColor = (prioridade: string | null | undefined) => {
    switch (prioridade) {
      case 'urgente': return 'bg-destructive text-destructive-foreground';
      case 'alta': return 'bg-orange-500 text-white';
      case 'media': return 'bg-amber-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">{coordenacaoNome}</h2>
          </div>
          <Badge variant={total === 0 ? "secondary" : "destructive"} className="ml-2">
            {total} pendências
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {config?.email_habilitado && (
            <Badge variant="outline" className="gap-1">
              <Mail className="h-3 w-3 text-blue-500" /> Email
            </Badge>
          )}
          {config?.whatsapp_habilitado && (
            <Badge variant="outline" className="gap-1">
              <MessageCircle className="h-3 w-3 text-green-500" /> WhatsApp
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex flex-wrap gap-2">
        {stats.djen > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-600/10 border border-blue-600/20">
            <Newspaper className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-600">{stats.djen} DJEN</span>
          </div>
        )}
        {stats.distribuicoes > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-600/10 border border-purple-600/20">
            <Scale className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-600">{stats.distribuicoes} Distrib.</span>
          </div>
        )}
        {stats.alertas360 > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
            <Radar className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-600">{stats.alertas360} Alertas 360°</span>
          </div>
        )}
        {stats.redistribuicoes > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-600/10 border border-cyan-600/20">
            <RefreshCw className="h-4 w-4 text-cyan-600" />
            <span className="text-sm font-semibold text-cyan-600">{stats.redistribuicoes} Redist.</span>
          </div>
        )}
        {stats.andamentos > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-600/10 border border-violet-600/20">
            <Activity className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-600">{stats.andamentos} Andamentos</span>
          </div>
        )}
        {stats.prazos > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-600/20">
            <Clock className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-600">{stats.prazos} Prazos</span>
          </div>
        )}
        {stats.tarefas > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-600/10 border border-green-600/20">
            <ListTodo className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-600">{stats.tarefas} Tarefas</span>
          </div>
        )}
        {stats.audiencias > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-600/10 border border-indigo-600/20">
            <Gavel className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-600">{stats.audiencias} Audiências</span>
          </div>
        )}
        {stats.intimacoes > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-600/10 border border-orange-600/20">
            <FileWarning className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-semibold text-orange-600">{stats.intimacoes} Intimações</span>
          </div>
        )}
      </div>

      {/* Content Grid - Full Width */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Tarefas */}
        {stats.tarefas > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-green-600" />
                Tarefas Pendentes ({stats.tarefas})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {tarefasPendentes.map((tarefa: any) => (
                    <div
                      key={tarefa.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/processo/${tarefa.processo?.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{tarefa.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            Processo: {tarefa.processo?.numero || "N/A"}
                          </p>
                          {tarefa.responsavel && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              {tarefa.responsavel.nome}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={cn("text-xs", getPrioridadeColor(tarefa.prioridade))}>
                            {tarefa.prioridade || "normal"}
                          </Badge>
                          {tarefa.data_vencimento && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(tarefa.data_vencimento), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Audiências */}
        {stats.audiencias > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="h-4 w-4 text-indigo-600" />
                Audiências ({stats.audiencias})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {audienciasPendentes.map((aud: any) => (
                    <div
                      key={aud.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => aud.processo?.id && navigate(`/processo/${aud.processo.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{aud.tipo_audiencia || "Audiência"}</p>
                          <p className="text-xs text-muted-foreground">
                            {aud.processo_numero || aud.processo?.numero}
                          </p>
                          {aud.local_audiencia && (
                            <p className="text-xs text-muted-foreground mt-1">{aud.local_audiencia}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {aud.data_audiencia && (
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(aud.data_audiencia), "dd/MM/yyyy")}
                            </Badge>
                          )}
                          {aud.hora && (
                            <span className="text-xs text-muted-foreground">{aud.hora}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Intimações */}
        {stats.intimacoes > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-orange-600" />
                Intimações ({stats.intimacoes})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {intimacoesPendentes.map((intim: any) => (
                    <div
                      key={intim.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => intim.processo?.id && navigate(`/processo/${intim.processo.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{intim.tipo_intimacao || "Intimação"}</p>
                          <p className="text-xs text-muted-foreground">
                            {intim.processo_numero || intim.processo?.numero}
                          </p>
                          {intim.prazo_dias && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Prazo: {intim.prazo_dias} dias
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {intim.data_limite && (
                            <Badge variant="outline" className="text-xs">
                              Limite: {format(new Date(intim.data_limite), "dd/MM/yyyy")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* DJEN */}
        {stats.djen > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-blue-600" />
                Publicações DJEN ({stats.djen})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {publicacoesFiltradas.slice(0, 20).map((pub) => (
                    <div
                      key={pub.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/analise-djen")}
                    >
                      <p className="font-medium text-sm truncate">
                        {pub.processo_numero || "Publicação DJEN"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {pub.conteudo?.substring(0, 150)}...
                      </p>
                      {pub.data_publicacao && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(pub.data_publicacao), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Alertas 360 */}
        {stats.alertas360 > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Radar className="h-4 w-4 text-amber-600" />
                Alertas 360° ({stats.alertas360})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {alertasFiltrados.slice(0, 20).map((alerta) => (
                    <div
                      key={alerta.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => alerta.processo_id && navigate(`/processo/${alerta.processo_id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{alerta.termo_encontrado}</p>
                          <p className="text-xs text-muted-foreground">
                            {alerta.processo?.numero}
                          </p>
                          {alerta.contexto && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {alerta.contexto.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <Badge className={cn("text-xs", getPrioridadeColor(alerta.prioridade))}>
                          {alerta.prioridade}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Andamentos */}
        {stats.andamentos > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-600" />
                Andamentos ({stats.andamentos})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                <div className="p-4 space-y-2">
                  {andamentosData.slice(0, 20).map((mov: any) => (
                    <div
                      key={mov.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => mov.processo?.id && navigate(`/processo/${mov.processo.id}`)}
                    >
                      <p className="font-medium text-sm truncate">{mov.processo?.numero}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {mov.descricao?.substring(0, 150)}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        {mov.tipo && (
                          <Badge variant="outline" className="text-xs">{mov.tipo}</Badge>
                        )}
                        {mov.created_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(mov.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {total === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
            <Building2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium">Tudo em dia!</h3>
          <p className="text-muted-foreground">
            Não há pendências para esta coordenação no período selecionado.
          </p>
        </div>
      )}

      <ConfigAlertasCoordenacaoDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        coordenacaoId={coordenacaoId}
        coordenacaoNome={coordenacaoNome}
      />
    </div>
  );
}
