import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            coordenacao_id
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
    if (!processoIdOrNumero) return;
    
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
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'bg-red-500/10 text-red-500';
      case 'alta': return 'bg-orange-500/10 text-orange-500';
      case 'media': return 'bg-amber-500/10 text-amber-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const total = publicacoesFiltradas.length + distribuicoesFiltradas.length + alertasFiltrados.length +
    redistribuicoesFiltradas.length + prazosFiltrados.length + tarefasFiltradas.length +
    audienciasFiltradas.length + intimacoesFiltradas.length + andamentosFiltrados.length;

  // Componentes de cards para renderização condicional
  const renderDjenCard = () => publicacoesFiltradas.length > 0 && (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="w-4 h-4 text-blue-500" />
          Publicações DJEN ({publicacoesFiltradas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {publicacoesFiltradas.map((pub) => {
            const processoDisplay = pub.processo_numero || (() => {
              const match = pub.conteudo?.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
              return match ? match[1] : null;
            })();
            return (
              <div
                key={pub.id}
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNavigateProcesso(processoDisplay, "publicacoes")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{processoDisplay || 'Publicação DJEN'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{pub.conteudo?.substring(0, 200)}...</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{pub.data_publicacao && format(new Date(pub.data_publicacao), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {distribuicoesFiltradas.map((dist) => (
            <div
              key={dist.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso(dist.processo_id, "andamentos")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{dist.numero_processo}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dist.polo_ativo} x {dist.polo_passivo}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{dist.classe || 'Sem classe'}</span>
                    <span>•</span>
                    <span>{dist.vara || 'Vara não informada'}</span>
                    <span>•</span>
                    <span>{dist.tribunal}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {alertasFiltrados.map((alerta) => (
            <div
              key={alerta.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso(alerta.processo_id, "andamentos")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getPrioridadeColor(alerta.prioridade)} variant="outline">
                      {alerta.prioridade}
                    </Badge>
                    <span className="font-medium text-sm">{alerta.termo_encontrado}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Processo: {alerta.processo?.numero}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{alerta.contexto}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {prazosFiltrados.map((prazo) => (
            <div
              key={prazo.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso(prazo.processo?.id, "tarefas")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{prazo.titulo}</p>
                    <Badge 
                      variant={prazo.is_atrasado ? "destructive" : "outline"}
                      className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                    >
                      {prazo.is_atrasado ? 'Atrasado' : `${prazo.dias_restantes}d`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Processo: {prazo.processo?.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {tarefasFiltradas.map((tarefa) => (
            <div
              key={tarefa.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso((tarefa.processo as any)?.id, "tarefas")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{tarefa.titulo}</p>
                    <Badge className={getPrioridadeColor(tarefa.prioridade)} variant="outline">
                      {tarefa.prioridade}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Processo: {(tarefa.processo as any)?.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    Responsável: {(tarefa.responsavel as any)?.nome || 'Não atribuído'}
                  </p>
                  {tarefa.data_vencimento && (
                    <p className="text-xs text-muted-foreground">
                      Vencimento: {format(new Date(tarefa.data_vencimento), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {audienciasFiltradas.map((aud) => (
            <div
              key={aud.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso((aud.processo as any)?.id, "audiencias")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{aud.processo_numero}</p>
                    <Badge variant="outline">{aud.tipo_audiencia || 'Audiência'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Parte: {aud.polo_ativo || 'Não informado'}</p>
                  <p className="text-xs text-muted-foreground">
                    {aud.data_audiencia && format(new Date(aud.data_audiencia), 'dd/MM/yyyy')}
                    {aud.hora_brasilia && ` às ${aud.hora_brasilia}`}
                  </p>
                  {aud.local_audiencia && (
                    <p className="text-xs text-muted-foreground">Local: {aud.local_audiencia}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {intimacoesFiltradas.map((int) => (
            <div
              key={int.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso((int.processo as any)?.id, "intimacoes")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{int.processo_numero}</p>
                    <Badge variant="outline">{int.tipo_intimacao || 'Intimação'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{int.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {int.data_intimacao && format(new Date(int.data_intimacao), 'dd/MM/yyyy')}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {andamentosFiltrados.map((and) => (
            <div
              key={and.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso((and.processo as any)?.id, "andamentos")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{(and.processo as any)?.numero}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{and.descricao}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{and.tipo || 'Movimentação'}</Badge>
                    <span>•</span>
                    <span>{and.fonte}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(and.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {redistribuicoesFiltradas.map((red) => (
            <div
              key={red.id}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleNavigateProcesso(red.processo_id, "andamentos")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{red.processo_numero}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-red-500">{red.vara_antiga}</span>
                    {" → "}
                    <span className="text-green-500">{red.vara_nova}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Advogado: {red.advogado_nome || 'Não informado'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
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
