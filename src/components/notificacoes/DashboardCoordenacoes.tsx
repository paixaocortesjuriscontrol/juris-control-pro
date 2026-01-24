import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Newspaper,
  Scale,
  Radar,
  RefreshCw,
  Clock,
  FileText,
  Settings,
  Mail,
  MessageCircle,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ListTodo,
  Gavel,
  FileWarning,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfigAlertasCoordenacao } from "@/hooks/useConfigAlertasCoordenacao";
import { ConfigAlertasCoordenacaoDialog } from "./ConfigAlertasCoordenacaoDialog";
import { cn } from "@/lib/utils";
import { startOfDay, parseISO, isBefore, isAfter } from "date-fns";

interface CoordenacaoStats {
  id: string;
  nome: string;
  djen: number;
  distribuicoes: number;
  alertas360: number;
  redistribuicoes: number;
  prazos: number;
  tarefas: number;
  audiencias: number;
  intimacoes: number;
  total: number;
  emailHabilitado: boolean;
  whatsappHabilitado: boolean;
}

interface Props {
  onSelectCoordenacao: (id: string) => void;
  selectedCoordenacaoId: string;
  periodoInicio?: Date;
  periodoFim?: Date;
  statusFilter?: string;
  searchQuery?: string;
}

export function DashboardCoordenacoes({ 
  onSelectCoordenacao, 
  selectedCoordenacaoId,
  periodoInicio,
  periodoFim,
  statusFilter = "pendente",
  searchQuery = ""
}: Props) {
  const { data: coordenacoes = [], isLoading: loadingCoord } = useCoordenacoesFull();
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes();
  const { prazosUrgentes } = useNotificacoes();
  const { configs } = useConfigAlertasCoordenacao();

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

  // Helper para filtrar por busca
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery) return true;
      return text?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    };
  }, [searchQuery]);

  // Buscar tarefas pendentes com coordenação via processo
  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-pendentes-coordenacao", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tarefas")
        .select(`
          id,
          titulo,
          status,
          data_vencimento,
          processo:processos!tarefas_processo_id_fkey(
            id,
            coordenacao_id
          )
        `);
      
      if (statusFilter !== "todas") {
        const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
        query = query.eq("status", status as "pendente" | "cumprido" | "atrasado");
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar audiências pendentes
  const { data: audienciasPendentes = [] } = useQuery({
    queryKey: ["audiencias-pendentes-coordenacao", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("audiencias_detectadas")
        .select(`
          id,
          processo_numero,
          status,
          data_audiencia,
          processo:processos!audiencias_detectadas_processo_id_fkey(
            id,
            coordenacao_id
          )
        `);
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar intimações pendentes
  const { data: intimacoesPendentes = [] } = useQuery({
    queryKey: ["intimacoes-pendentes-coordenacao", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("intimacoes_detectadas")
        .select(`
          id,
          processo_numero,
          status,
          data_intimacao,
          processo:processos!intimacoes_detectadas_processo_id_fkey(
            id,
            coordenacao_id
          )
        `);
      
      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter === "concluido" ? "tratado" : statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedCoordConfig, setSelectedCoordConfig] = useState<{ id: string; nome: string } | null>(null);

  // Calcular estatísticas por coordenação - aplicando filtros
  const coordenacoesStats = useMemo<CoordenacaoStats[]>(() => {
    if (!coordenacoes.length) return [];

    // Filtrar publicações DJEN por status e período
    const publicacoesFiltradas = publicacoes.filter(p => {
      if (statusFilter !== "todas" && p.lida) return false;
      if (!matchesPeriodo(p.data_publicacao)) return false;
      if (!matchesSearch(p.conteudo) && !matchesSearch(p.processo_numero)) return false;
      return true;
    });

    // Filtrar distribuições por status e período
    const distribuicoesFiltradas = distribuicoesEncontradas.filter(d => {
      if (statusFilter !== "todas" && d.status !== 'pendente') return false;
      if (!matchesPeriodo(d.data_distribuicao)) return false;
      if (!matchesSearch(d.numero_processo)) return false;
      return true;
    });

    // Filtrar alertas por status e período
    const alertasFiltrados = alertas.filter(a => {
      if (statusFilter !== "todas" && a.status !== 'pendente') return false;
      if (!matchesPeriodo(a.created_at)) return false;
      if (!matchesSearch(a.termo_encontrado)) return false;
      return true;
    });

    // Filtrar redistribuições por período
    const redistribuicoesFiltradas = redistribuicoesData.filter(r => {
      if (!matchesPeriodo(r.data_redistribuicao)) return false;
      if (!matchesSearch(r.processo_numero)) return false;
      return true;
    });

    // Filtrar prazos por período
    const prazosFiltrados = prazosUrgentes.filter(p => {
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesSearch(p.titulo) && !matchesSearch(p.processo?.numero)) return false;
      return true;
    });

    // Filtrar tarefas por período
    const tarefasFiltradas = tarefasPendentes.filter(t => {
      if (!matchesPeriodo((t as any).data_vencimento)) return false;
      if (!matchesSearch((t as any).titulo)) return false;
      return true;
    });

    // Filtrar audiências por período
    const audienciasFiltradas = audienciasPendentes.filter(a => {
      if (!matchesPeriodo((a as any).data_audiencia)) return false;
      if (!matchesSearch((a as any).processo_numero)) return false;
      return true;
    });

    // Filtrar intimações por período
    const intimacoesFiltradas = intimacoesPendentes.filter(i => {
      if (!matchesPeriodo((i as any).data_intimacao)) return false;
      if (!matchesSearch((i as any).processo_numero)) return false;
      return true;
    });

    return coordenacoes.map(coord => {
      // DJEN: via monitoramento
      const monIds = monitoramentosDjen
        .filter(m => m.coordenacao_id === coord.id)
        .map(m => m.id);
      const djen = publicacoesFiltradas.filter(p => monIds.includes(p.monitoramento_id)).length;

      // Distribuições
      const distribuicoes = distribuicoesFiltradas.filter(
        d => (d as any).monitoramento?.coordenacao_id === coord.id
      ).length;

      // Alertas 360
      const alertas360 = alertasFiltrados.filter(
        a => a.processo?.coordenacao_id === coord.id
      ).length;

      // Redistribuições
      const redistribuicoes = redistribuicoesFiltradas.filter(
        r => r.coordenacao_nome === coord.nome
      ).length;

      // Prazos
      const prazos = prazosFiltrados.filter(
        p => p.processo?.coordenacao_id === coord.id
      ).length;

      // Tarefas pendentes da agenda
      const tarefas = tarefasFiltradas.filter(
        t => (t.processo as any)?.coordenacao_id === coord.id
      ).length;

      // Audiências pendentes
      const audiencias = audienciasFiltradas.filter(
        a => (a.processo as any)?.coordenacao_id === coord.id
      ).length;

      // Intimações pendentes
      const intimacoes = intimacoesFiltradas.filter(
        i => (i.processo as any)?.coordenacao_id === coord.id
      ).length;

      // Config de alertas
      const config = configs.find(c => c.coordenacao_id === coord.id);

      return {
        id: coord.id,
        nome: coord.nome,
        djen,
        distribuicoes,
        alertas360,
        redistribuicoes,
        prazos,
        tarefas,
        audiencias,
        intimacoes,
        total: djen + distribuicoes + alertas360 + redistribuicoes + prazos + tarefas + audiencias + intimacoes,
        emailHabilitado: config?.email_habilitado || false,
        whatsappHabilitado: config?.whatsapp_habilitado || false,
      };
    }).sort((a, b) => b.total - a.total);
  }, [coordenacoes, publicacoes, monitoramentosDjen, distribuicoesEncontradas, alertas, redistribuicoesData, prazosUrgentes, tarefasPendentes, audienciasPendentes, intimacoesPendentes, configs, matchesPeriodo, matchesSearch, statusFilter]);

  const handleOpenConfig = (coord: { id: string; nome: string }) => {
    setSelectedCoordConfig(coord);
    setConfigDialogOpen(true);
  };

  if (loadingCoord) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Alertas por Coordenação
          </h3>
          <Badge variant="secondary">
            {coordenacoesStats.filter(c => c.total > 0).length} com pendências
          </Badge>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
            {coordenacoesStats.map((coord) => (
              <Card
                key={coord.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedCoordenacaoId === coord.id && "ring-2 ring-primary",
                  coord.total > 0 && coord.total <= 5 && "border-amber-500/50",
                  coord.total > 5 && "border-red-500/50"
                )}
                onClick={() => onSelectCoordenacao(coord.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <CardTitle className="text-sm font-medium truncate">
                        {coord.nome}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {coord.emailHabilitado && (
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                      )}
                      {coord.whatsappHabilitado && (
                        <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenConfig({ id: coord.id, nome: coord.nome });
                        }}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Total */}
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">
                        {coord.total}
                      </span>
                      <Badge 
                        variant={coord.total === 0 ? "secondary" : coord.total > 5 ? "destructive" : "default"}
                        className={coord.total === 0 ? "bg-emerald-500/10 text-emerald-500" : ""}
                      >
                        {coord.total === 0 ? "OK" : "Pendentes"}
                      </Badge>
                    </div>

                    {/* Breakdown */}
                    {coord.total > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {coord.djen > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-blue-500/10" title="DJEN">
                            <Newspaper className="h-3 w-3 text-blue-500" />
                            <span className="text-xs font-medium">{coord.djen}</span>
                          </div>
                        )}
                        {coord.distribuicoes > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-purple-500/10" title="Distribuições">
                            <Scale className="h-3 w-3 text-purple-500" />
                            <span className="text-xs font-medium">{coord.distribuicoes}</span>
                          </div>
                        )}
                        {coord.alertas360 > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-amber-500/10" title="Alertas 360°">
                            <Radar className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-medium">{coord.alertas360}</span>
                          </div>
                        )}
                        {coord.redistribuicoes > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-cyan-500/10" title="Redistribuições">
                            <RefreshCw className="h-3 w-3 text-cyan-500" />
                            <span className="text-xs font-medium">{coord.redistribuicoes}</span>
                          </div>
                        )}
                        {coord.prazos > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-red-500/10" title="Prazos">
                            <Clock className="h-3 w-3 text-red-500" />
                            <span className="text-xs font-medium">{coord.prazos}</span>
                          </div>
                        )}
                        {coord.tarefas > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-green-500/10" title="Tarefas">
                            <ListTodo className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium">{coord.tarefas}</span>
                          </div>
                        )}
                        {coord.audiencias > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-indigo-500/10" title="Audiências">
                            <Gavel className="h-3 w-3 text-indigo-500" />
                            <span className="text-xs font-medium">{coord.audiencias}</span>
                          </div>
                        )}
                        {coord.intimacoes > 0 && (
                          <div className="flex flex-col items-center p-1 rounded bg-orange-500/10" title="Intimações">
                            <FileWarning className="h-3 w-3 text-orange-500" />
                            <span className="text-xs font-medium">{coord.intimacoes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action hint */}
                    <div className="flex items-center justify-end pt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        Ver detalhes <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {coordenacoesStats.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Nenhuma coordenação cadastrada
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {selectedCoordConfig && (
        <ConfigAlertasCoordenacaoDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          coordenacaoId={selectedCoordConfig.id}
          coordenacaoNome={selectedCoordConfig.nome}
        />
      )}
    </>
  );
}
