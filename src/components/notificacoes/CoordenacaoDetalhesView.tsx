import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
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
import { startOfDay, parseISO, isBefore, isAfter, format } from "date-fns";
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
  periodoInicio: periodoInicioExterno,
  periodoFim: periodoFimExterno,
  statusFilter = "pendente",
  searchQuery = "",
}: Props) {
  const navigate = useNavigate();
  
  // Estado local para filtros de data (inicializa com valores externos)
  const [periodoInicio, setPeriodoInicio] = useState<Date | undefined>(periodoInicioExterno);
  const [periodoFim, setPeriodoFim] = useState<Date | undefined>(periodoFimExterno);
  
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
    queryKey: ["tarefas-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
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
      return (data || []).filter((t: any) => {
        if (t.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(t.data_vencimento)) return false;
        return true;
      });
    },
  });

  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
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
      return (data || []).filter((a: any) => {
        if (a.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(a.data_audiencia)) return false;
        return true;
      });
    },
  });

  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-coordenacao-detalhes", coordenacaoId, statusFilter, periodoInicio, periodoFim],
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
      return (data || []).filter((i: any) => {
        if (i.processo?.coordenacao_id !== coordenacaoId) return false;
        if (!matchesPeriodo(i.data_intimacao)) return false;
        return true;
      });
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
    prazos: prazosUrgentes.filter(p => p.processo?.coordenacao_id === coordenacaoId && matchesPeriodo(p.data_vencimento)).length,
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
    <div className="space-y-3 animate-fade-in">
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-card rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{coordenacaoNome}</h2>
          <Badge variant={total === 0 ? "secondary" : "destructive"} className="text-xs">
            {total} pendências
          </Badge>
        </div>
        
        {/* Filtros de data inline */}
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs", periodoInicio && "bg-primary/10")}>
                <CalendarDays className="w-3.5 h-3.5" />
                De: {periodoInicio ? format(periodoInicio, "dd/MM/yy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={periodoInicio}
                onSelect={setPeriodoInicio}
                locale={ptBR}
                className="p-2 pointer-events-auto"
              />
              <div className="p-2 border-t flex justify-between">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoInicio(startOfDay(new Date()))}>Hoje</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoInicio(undefined)}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs", periodoFim && "bg-primary/10")}>
                <CalendarDays className="w-3.5 h-3.5" />
                Até: {periodoFim ? format(periodoFim, "dd/MM/yy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={periodoFim}
                onSelect={setPeriodoFim}
                locale={ptBR}
                className="p-2 pointer-events-auto"
              />
              <div className="p-2 border-t flex justify-between">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoFim(startOfDay(new Date()))}>Hoje</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPeriodoFim(undefined)}>Limpar</Button>
              </div>
            </PopoverContent>
          </Popover>

          {config?.email_habilitado && (
            <Badge variant="outline" className="gap-1 h-8 text-xs">
              <Mail className="h-3 w-3 text-blue-500" /> Email
            </Badge>
          )}
          {config?.whatsapp_habilitado && (
            <Badge variant="outline" className="gap-1 h-8 text-xs">
              <MessageCircle className="h-3 w-3 text-green-500" /> WhatsApp
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfigDialogOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Stats Summary - mais compacto */}
      <div className="flex flex-wrap gap-1.5">
        {stats.redistribuicoes > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-600/10 border border-cyan-600/20">
            <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
            <span className="text-xs font-semibold text-cyan-600">{stats.redistribuicoes} Redist.</span>
          </div>
        )}
        {stats.prazos > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-600/10 border border-red-600/20">
            <Clock className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs font-semibold text-red-600">{stats.prazos} Prazos</span>
          </div>
        )}
        {stats.tarefas > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-600/10 border border-green-600/20">
            <ListTodo className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-600">{stats.tarefas} Tarefas</span>
          </div>
        )}
        {stats.audiencias > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-indigo-600/10 border border-indigo-600/20">
            <Gavel className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-600">{stats.audiencias} Audiências</span>
          </div>
        )}
        {stats.intimacoes > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-orange-600/10 border border-orange-600/20">
            <FileWarning className="h-3.5 w-3.5 text-orange-600" />
            <span className="text-xs font-semibold text-orange-600">{stats.intimacoes} Intimações</span>
          </div>
        )}
        {stats.djen > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-600/10 border border-blue-600/20">
            <Newspaper className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-600">{stats.djen} DJEN</span>
          </div>
        )}
        {stats.distribuicoes > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-purple-600/10 border border-purple-600/20">
            <Scale className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-xs font-semibold text-purple-600">{stats.distribuicoes} Distrib.</span>
          </div>
        )}
        {stats.alertas360 > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-600/10 border border-amber-600/20">
            <Radar className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-600">{stats.alertas360} Alertas 360°</span>
          </div>
        )}
        {stats.andamentos > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-violet-600/10 border border-violet-600/20">
            <Activity className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-600">{stats.andamentos} Andamentos</span>
          </div>
        )}
      </div>

      {/* Content Grid - Full Width, mais compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Tarefas */}
        {stats.tarefas > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-green-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-green-600" />
                Tarefas Pendentes ({stats.tarefas})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {tarefasPendentes.map((tarefa: any) => (
                    <div
                      key={tarefa.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/processo/${tarefa.processo?.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{tarefa.titulo}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {tarefa.processo?.numero || "N/A"}
                          </p>
                          {tarefa.responsavel && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              {tarefa.responsavel.nome}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge className={cn("text-[10px] px-1.5 py-0", getPrioridadeColor(tarefa.prioridade))}>
                            {tarefa.prioridade || "normal"}
                          </Badge>
                          {tarefa.data_vencimento && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(tarefa.data_vencimento), "dd/MM/yy")}
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
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-indigo-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gavel className="h-4 w-4 text-indigo-600" />
                Audiências ({stats.audiencias})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {audienciasPendentes.map((aud: any) => (
                    <div
                      key={aud.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => aud.processo?.id && navigate(`/processo/${aud.processo.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs">{aud.tipo_audiencia || "Audiência"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {aud.processo_numero || aud.processo?.numero}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          {aud.data_audiencia && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {format(new Date(aud.data_audiencia), "dd/MM/yy")}
                            </Badge>
                          )}
                          {aud.hora && <span className="text-[10px] text-muted-foreground">{aud.hora}</span>}
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
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-orange-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-orange-600" />
                Intimações ({stats.intimacoes})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {intimacoesPendentes.map((intim: any) => (
                    <div
                      key={intim.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => intim.processo?.id && navigate(`/processo/${intim.processo.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs">{intim.tipo_intimacao || "Intimação"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {intim.processo_numero || intim.processo?.numero}
                          </p>
                          {intim.prazo_dias && (
                            <p className="text-[11px] text-muted-foreground">Prazo: {intim.prazo_dias} dias</p>
                          )}
                        </div>
                        {intim.data_limite && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                            Limite: {format(new Date(intim.data_limite), "dd/MM/yy")}
                          </Badge>
                        )}
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
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-blue-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-blue-600" />
                Publicações DJEN ({stats.djen})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {publicacoesFiltradas.slice(0, 50).map((pub: any) => (
                    <div
                      key={pub.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/analise-djen`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{pub.processo_numero || "Sem número"}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {pub.conteudo?.substring(0, 120)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Redistribuições */}
        {stats.redistribuicoes > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-cyan-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-cyan-600" />
                Redistribuições ({stats.redistribuicoes})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {redistribuicoesFiltradas.slice(0, 50).map((redist: any) => (
                    <div
                      key={redist.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/redistribuicoes`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs">{redist.processo_numero}</p>
                          <p className="text-[11px] text-muted-foreground">{redist.vara_destino}</p>
                        </div>
                        {redist.data_redistribuicao && (
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(redist.data_redistribuicao), "dd/MM/yy")}
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

        {/* Alertas 360 */}
        {stats.alertas360 > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-amber-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radar className="h-4 w-4 text-amber-600" />
                Alertas 360° ({stats.alertas360})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {alertasFiltrados.slice(0, 50).map((alerta: any) => (
                    <div
                      key={alerta.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => alerta.processo?.id && navigate(`/processo/${alerta.processo.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs">{alerta.termo_encontrado}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {alerta.processo?.numero || "N/A"}
                        </p>
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
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-violet-600/5 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-600" />
                Andamentos ({stats.andamentos})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56">
                <div className="divide-y">
                  {andamentosData.slice(0, 50).map((and: any) => (
                    <div
                      key={and.id}
                      className="px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => and.processo?.id && navigate(`/processo/${and.processo.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs line-clamp-1">{and.descricao}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {and.processo?.numero || "N/A"}
                          </p>
                        </div>
                        {and.data_movimentacao && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(and.data_movimentacao), "dd/MM/yy")}
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

      <ConfigAlertasCoordenacaoDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        coordenacaoId={coordenacaoId}
        coordenacaoNome={coordenacaoNome}
      />
    </div>
  );
}
