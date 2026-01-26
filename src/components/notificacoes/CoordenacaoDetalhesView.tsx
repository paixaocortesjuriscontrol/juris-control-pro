import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Newspaper,
  Scale,
  Radar,
  RefreshCw,
  Clock,
  ListTodo,
  Gavel,
  FileWarning,
  Activity,
  ArrowLeft,
  ExternalLink,
  Building2,
  FileText,
  Calendar,
  MapPin,
  User,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { cn } from "@/lib/utils";
import { startOfDay, parseISO, isBefore, isAfter, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  coordenacaoId: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
  onBack: () => void;
}

export function CoordenacaoDetalhesView({
  coordenacaoId,
  periodoInicio,
  periodoFim,
  statusFilter = "pendente",
  searchQuery = "",
  onBack,
}: Props) {
  const navigate = useNavigate();
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacao = coordenacoes.find(c => c.id === coordenacaoId);
  
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes({
    dataInicio: periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined,
    dataFim: periodoFim ? format(periodoFim, "yyyy-MM-dd") : undefined,
  });
  const { prazosUrgentes } = useNotificacoes();

  // Buscar tarefas pendentes
  const { data: tarefasPendentesData = [] } = useQuery({
    queryKey: ["tarefas-detalhes-coord", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          data_vencimento,
          prioridade,
          descricao,
          tipo_tarefa,
          responsavel:profiles!tarefas_responsavel_id_fkey(nome),
          processo:processos!tarefas_processo_id_fkey(
            id,
            numero,
            coordenacao_id,
            polo_ativo
          )
        `)
        .order("data_vencimento", { ascending: true });
      
      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar audiências
  const { data: audienciasPendentesData = [] } = useQuery({
    queryKey: ["audiencias-detalhes-coord", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id,
          processo_numero,
          data_audiencia,
          hora,
          hora_brasilia,
          tipo_audiencia,
          status,
          local_audiencia,
          polo_ativo,
          cliente,
          vara_camara,
          comarca,
          advogado,
          processo:processos!audiencias_detectadas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_audiencia", { ascending: true });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar intimações
  const { data: intimacoesPendentesData = [] } = useQuery({
    queryKey: ["intimacoes-detalhes-coord", coordenacaoId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id,
          processo_numero,
          data_intimacao,
          data_limite,
          tipo_intimacao,
          status,
          descricao,
          processo:processos!intimacoes_detectadas_processo_id_fkey(
            id,
            numero,
            coordenacao_id
          )
        `)
        .order("data_intimacao", { ascending: true });
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar andamentos
  const { data: andamentosData = [] } = useQuery({
    queryKey: ["andamentos-detalhes-coord", coordenacaoId, periodoInicio, periodoFim],
    queryFn: async () => {
      const inicioDia = periodoInicio ? format(periodoInicio, "yyyy-MM-dd") : undefined;
      const fimDiaMaisUm = periodoFim ? format(new Date(periodoFim.getTime() + 86400000), "yyyy-MM-dd") : undefined;
      
      let query = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          data_movimentacao,
          created_at,
          tipo,
          fonte,
          processo:processos!movimentacoes_processo_id_fkey(
            id,
            numero,
            coordenacao_id,
            polo_ativo
          )
        `)
        .neq("tipo", "Redistribuição")
        .order("created_at", { ascending: false });
      
      if (inicioDia) query = query.gte("created_at", inicioDia);
      if (fimDiaMaisUm) query = query.lt("created_at", fimDiaMaisUm);
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Helper para filtrar por período
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

  // Helper para busca
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  // Monitoramentos da coordenação
  const monIds = monitoramentosDjen
    .filter(m => m.coordenacao_id === coordenacaoId)
    .map(m => m.id);

  // Filtrar dados
  const publicacoesFiltradas = useMemo(() => {
    return publicacoes.filter(p => {
      if (!monIds.includes(p.monitoramento_id)) return false;
      if (statusFilter !== "todas" && p.lida) return false;
      if (!matchesPeriodo(p.created_at)) return false;
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      return true;
    });
  }, [publicacoes, monIds, statusFilter, matchesPeriodo, matchesSearch]);

  const distribuicoesFiltradas = useMemo(() => {
    return distribuicoesEncontradas.filter(d => {
      if ((d as any).monitoramento?.coordenacao_id !== coordenacaoId) return false;
      if (statusFilter !== "todas" && d.status !== 'pendente') return false;
      if (!matchesPeriodo(d.data_distribuicao)) return false;
      if (!matchesSearch(d.numero_processo)) return false;
      return true;
    });
  }, [distribuicoesEncontradas, coordenacaoId, statusFilter, matchesPeriodo, matchesSearch]);

  const alertasFiltrados = useMemo(() => {
    return alertas.filter(a => {
      if (a.processo?.coordenacao_id !== coordenacaoId) return false;
      if (statusFilter !== "todas" && a.status !== 'pendente') return false;
      if (!matchesPeriodo(a.created_at)) return false;
      if (!matchesSearch(a.termo_encontrado)) return false;
      return true;
    });
  }, [alertas, coordenacaoId, statusFilter, matchesPeriodo, matchesSearch]);

  const redistribuicoesFiltradas = useMemo(() => {
    return redistribuicoesData.filter(r => {
      if (r.coordenacao_nome !== coordenacao?.nome) return false;
      if (!matchesSearch(r.processo_numero)) return false;
      return true;
    });
  }, [redistribuicoesData, coordenacao?.nome, matchesSearch]);

  const prazosFiltrados = useMemo(() => {
    return prazosUrgentes.filter(p => {
      if (p.processo?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesSearch(p.titulo)) return false;
      return true;
    });
  }, [prazosUrgentes, coordenacaoId, matchesPeriodo, matchesSearch]);

  const tarefasFiltradas = useMemo(() => {
    return tarefasPendentesData.filter(t => {
      if ((t.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesPeriodo(t.data_vencimento)) return false;
      if (!matchesSearch(t.titulo)) return false;
      return true;
    });
  }, [tarefasPendentesData, coordenacaoId, matchesPeriodo, matchesSearch]);

  const audienciasFiltradas = useMemo(() => {
    return audienciasPendentesData.filter(a => {
      if ((a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesPeriodo(a.data_audiencia)) return false;
      if (!matchesSearch(a.processo_numero)) return false;
      return true;
    });
  }, [audienciasPendentesData, coordenacaoId, matchesPeriodo, matchesSearch]);

  const intimacoesFiltradas = useMemo(() => {
    return intimacoesPendentesData.filter(i => {
      if ((i.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesPeriodo(i.data_intimacao)) return false;
      if (!matchesSearch(i.processo_numero)) return false;
      return true;
    });
  }, [intimacoesPendentesData, coordenacaoId, matchesPeriodo, matchesSearch]);

  const andamentosFiltrados = useMemo(() => {
    return andamentosData.filter(a => {
      if ((a.processo as any)?.coordenacao_id !== coordenacaoId) return false;
      if (!matchesSearch(a.descricao)) return false;
      return true;
    });
  }, [andamentosData, coordenacaoId, matchesSearch]);

  // Navegação para processo com aba específica
  const handleNavigateProcesso = async (processoIdOrNumero: string | null | undefined, tab: string) => {
    if (!processoIdOrNumero) {
      toast.error("Processo não encontrado");
      return;
    }
    
    // Se for um UUID, navega direto
    if (processoIdOrNumero.includes("-") && processoIdOrNumero.length === 36) {
      navigate(`/processos/${processoIdOrNumero}?tab=${tab}`);
      return;
    }
    
    // Se for número, busca o ID primeiro
    const { data } = await supabase
      .from("processos")
      .select("id")
      .eq("numero", processoIdOrNumero)
      .maybeSingle();
    
    if (data?.id) {
      navigate(`/processos/${data.id}?tab=${tab}`);
    } else {
      toast.error("Processo não encontrado na base de dados");
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'alta': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'media': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Em Andamento</Badge>;
      case 'tratado':
      case 'cumprido':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Tratado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const total = publicacoesFiltradas.length + distribuicoesFiltradas.length + alertasFiltrados.length +
    redistribuicoesFiltradas.length + prazosFiltrados.length + tarefasFiltradas.length +
    audienciasFiltradas.length + intimacoesFiltradas.length + andamentosFiltrados.length;

  // ============ RENDER CARDS COM DETALHES COMPLETOS ============

  const renderDjenCard = () => publicacoesFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="w-4 h-4 text-blue-500" />
          Publicações DJEN ({publicacoesFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {publicacoesFiltradas.map((pub) => {
              // Priorizar processo_id se existir, senão usar número
              const processoId = (pub as any).processo_id;
              const processoDisplay = pub.processo_numero || (() => {
                const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                return match ? match[1] : null;
              })();
              return (
                <div
                  key={pub.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleNavigateProcesso(processoId || processoDisplay, "publicacoes")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header com número e badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{processoDisplay || 'Publicação DJEN'}</span>
                        {!pub.lida && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Nova</Badge>
                        )}
                      </div>
                      
                      {/* Conteúdo resumido */}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {pub.conteudo?.substring(0, 250)}...
                      </p>
                      
                      {/* Data e fonte */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{pub.data_publicacao && formatDate(pub.data_publicacao)}</span>
                        </div>
                        {pub.fonte && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>{pub.fonte}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderDistribuicoesCard = () => distribuicoesFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="w-4 h-4 text-purple-500" />
          Distribuições ({distribuicoesFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {distribuicoesFiltradas.map((dist) => (
              <div
                key={dist.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso(dist.processo_id, "andamentos")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Número do processo e status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{dist.numero_processo}</span>
                      {getStatusBadge(dist.status)}
                    </div>
                    
                    {/* Partes */}
                    {(dist.polo_ativo || dist.polo_passivo) && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">
                          {dist.polo_ativo} × {dist.polo_passivo}
                        </span>
                      </div>
                    )}
                    
                    {/* Detalhes */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {dist.classe && (
                        <Badge variant="secondary" className="text-xs">{dist.classe}</Badge>
                      )}
                      {dist.vara && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{dist.vara}</span>
                        </div>
                      )}
                      {dist.tribunal && (
                        <span className="font-medium">{dist.tribunal}</span>
                      )}
                    </div>
                    
                    {/* Data */}
                    {dist.data_distribuicao && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(dist.data_distribuicao)}</span>
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderAlertasCard = () => alertasFiltrados.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="w-4 h-4 text-amber-500" />
          Alertas 360° ({alertasFiltrados.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {alertasFiltrados.map((alerta) => (
              <div
                key={alerta.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso(alerta.processo_id, "andamentos")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Termo e prioridade */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn(getPrioridadeColor(alerta.prioridade), "text-xs")} variant="outline">
                        {alerta.prioridade}
                      </Badge>
                      <span className="font-medium text-sm">{alerta.termo_encontrado}</span>
                    </div>
                    
                    {/* Processo */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="font-mono">{alerta.processo?.numero}</span>
                    </div>
                    
                    {/* Contexto */}
                    {alerta.contexto && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded">
                        {alerta.contexto}
                      </p>
                    )}
                    
                    {/* Data */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderPrazosCard = () => prazosFiltrados.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4 text-red-500" />
          Prazos Urgentes ({prazosFiltrados.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {prazosFiltrados.map((prazo) => (
              <div
                key={prazo.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso(prazo.processo?.id, "tarefas")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Título e badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{prazo.titulo}</span>
                      <Badge 
                        variant={prazo.is_atrasado ? "destructive" : "outline"}
                        className={cn(
                          "text-xs",
                          !prazo.is_atrasado && "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        )}
                      >
                        {prazo.is_atrasado ? 'Atrasado' : `${prazo.dias_restantes}d`}
                      </Badge>
                    </div>
                    
                    {/* Processo */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="font-mono">{prazo.processo?.numero}</span>
                    </div>
                    
                    {/* Vencimento */}
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Timer className="h-3 w-3" />
                      <span className="font-medium">
                        Vencimento: {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderTarefasCard = () => tarefasFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="w-4 h-4 text-green-500" />
          Tarefas ({tarefasFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {tarefasFiltradas.map((tarefa) => (
              <div
                key={tarefa.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso((tarefa.processo as any)?.id, "tarefas")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Título e badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {tarefa.tipo_tarefa && (
                        <Badge variant="secondary" className="text-xs">{tarefa.tipo_tarefa}</Badge>
                      )}
                      <span className="font-medium text-sm truncate">{tarefa.titulo}</span>
                      <Badge className={cn(getPrioridadeColor(tarefa.prioridade), "text-xs")} variant="outline">
                        {tarefa.prioridade}
                      </Badge>
                    </div>
                    
                    {/* Processo */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="font-mono">{(tarefa.processo as any)?.numero}</span>
                    </div>
                    
                    {/* Responsável */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{(tarefa.responsavel as any)?.nome || 'Não atribuído'}</span>
                    </div>
                    
                    {/* Vencimento */}
                    {tarefa.data_vencimento && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Vencimento: {formatDate(tarefa.data_vencimento)}</span>
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderAudienciasCard = () => audienciasFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="w-4 h-4 text-indigo-500" />
          Audiências ({audienciasFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {audienciasFiltradas.map((aud) => (
              <div
                key={aud.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso((aud.processo as any)?.id, "audiencias")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Processo e tipo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{aud.processo_numero}</span>
                      {aud.tipo_audiencia && (
                        <Badge variant="secondary" className="text-xs">{aud.tipo_audiencia}</Badge>
                      )}
                      {getStatusBadge(aud.status)}
                    </div>
                    
                    {/* Data e hora */}
                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {formatDate(aud.data_audiencia)}
                        {aud.hora_brasilia && ` às ${aud.hora_brasilia}`}
                        {!aud.hora_brasilia && aud.hora && ` às ${aud.hora}`}
                      </span>
                    </div>
                    
                    {/* Local */}
                    {(aud.vara_camara || aud.comarca || aud.local_audiencia) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{[aud.local_audiencia, aud.vara_camara, aud.comarca].filter(Boolean).join(' - ')}</span>
                      </div>
                    )}
                    
                    {/* Parte/Cliente */}
                    {(aud.polo_ativo || aud.cliente) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="truncate">{aud.cliente || aud.polo_ativo}</span>
                      </div>
                    )}
                    
                    {/* Advogado */}
                    {aud.advogado && (
                      <p className="text-xs text-muted-foreground">
                        Advogado: <span className="font-medium">{aud.advogado}</span>
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderIntimacoesCard = () => intimacoesFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileWarning className="w-4 h-4 text-orange-500" />
          Intimações ({intimacoesFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {intimacoesFiltradas.map((int) => (
              <div
                key={int.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso((int.processo as any)?.id, "intimacoes")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Processo e tipo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{int.processo_numero}</span>
                      {int.tipo_intimacao && (
                        <Badge variant="secondary" className="text-xs">{int.tipo_intimacao}</Badge>
                      )}
                    </div>
                    
                    {/* Prazo/Data limite */}
                    {int.data_limite && (
                      <div className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Timer className="h-3 w-3" />
                        <span>Prazo: {formatDate(int.data_limite)}</span>
                      </div>
                    )}
                    
                    {/* Descrição */}
                    {int.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{int.descricao}</p>
                    )}
                    
                    {/* Data intimação */}
                    {int.data_intimacao && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(int.data_intimacao)}</span>
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderAndamentosCard = () => andamentosFiltrados.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-violet-500" />
          Andamentos ({andamentosFiltrados.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {andamentosFiltrados.map((and) => (
              <div
                key={and.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso((and.processo as any)?.id, "andamentos")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Processo e tipo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{(and.processo as any)?.numero}</span>
                      {and.tipo && (
                        <Badge variant="secondary" className="text-xs">{and.tipo}</Badge>
                      )}
                    </div>
                    
                    {/* Descrição */}
                    <p className="text-xs text-muted-foreground line-clamp-2">{and.descricao}</p>
                    
                    {/* Parte ativa */}
                    {(and.processo as any)?.polo_ativo && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="truncate">{(and.processo as any)?.polo_ativo}</span>
                      </div>
                    )}
                    
                    {/* Metadados */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {and.fonte && (
                        <span className="font-medium">{and.fonte}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(and.created_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderRedistribuicoesCard = () => redistribuicoesFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="w-4 h-4 text-cyan-500" />
          Redistribuições ({redistribuicoesFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3 pt-2">
            {redistribuicoesFiltradas.map((red) => (
              <div
                key={red.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso(red.processo_id, "andamentos")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Processo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{red.processo_numero}</span>
                    </div>
                    
                    {/* Mudança de vara */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-500 font-medium">{red.vara_antiga}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-green-500 font-medium">{red.vara_nova}</span>
                    </div>
                    
                    {/* Advogado */}
                    {red.advogado_nome && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{red.advogado_nome}</span>
                      </div>
                    )}
                    
                    {/* Data */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // Montar array de cards na ordem: todos menos redistribuições, depois redistribuições por último
  const cardsComDados = [
    { key: 'djen', render: renderDjenCard, hasData: publicacoesFiltradas.length > 0 },
    { key: 'distribuicoes', render: renderDistribuicoesCard, hasData: distribuicoesFiltradas.length > 0 },
    { key: 'alertas', render: renderAlertasCard, hasData: alertasFiltrados.length > 0 },
    { key: 'prazos', render: renderPrazosCard, hasData: prazosFiltrados.length > 0 },
    { key: 'tarefas', render: renderTarefasCard, hasData: tarefasFiltradas.length > 0 },
    { key: 'audiencias', render: renderAudienciasCard, hasData: audienciasFiltradas.length > 0 },
    { key: 'intimacoes', render: renderIntimacoesCard, hasData: intimacoesFiltradas.length > 0 },
    { key: 'andamentos', render: renderAndamentosCard, hasData: andamentosFiltrados.length > 0 },
    { key: 'redistribuicoes', render: renderRedistribuicoesCard, hasData: redistribuicoesFiltradas.length > 0 },
  ].filter(card => card.hasData);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{coordenacao?.nome}</h2>
        </div>
        <Badge variant="secondary">{total} pendências</Badge>
      </div>

      {/* Grid de 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cardsComDados.map((card) => (
          <div key={card.key}>{card.render()}</div>
        ))}
      </div>

      {/* Mensagem quando não há pendências */}
      {total === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold">Tudo em dia!</h3>
            <p className="text-muted-foreground">Nenhuma pendência encontrada para esta coordenação.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
