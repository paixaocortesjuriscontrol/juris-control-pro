import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  Building2,
  Clock,
  Settings,
  Mail,
  MessageCircle,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  ListTodo,
  Gavel,
  FileWarning,
  User,
  Newspaper,
  Scale,
  Radar,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfigAlertasCoordenacao } from "@/hooks/useConfigAlertasCoordenacao";
import { ConfigAlertasCoordenacaoDialog } from "./ConfigAlertasCoordenacaoDialog";
import { cn } from "@/lib/utils";
import { conteudoContemFraseExata } from "@/utils/djenTermoMatch";
import { startOfDay, parseISO, isBefore, isAfter } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotificacoesCountsByCoordenacao } from "@/hooks/useNotificacoesCounts";

interface MembroStats {
  id: string;
  nome: string;
  tarefas: number;
  prazos: number;
  total: number;
}

interface CoordenacaoStats {
  id: string;
  nome: string;
  djen: number;
  distribuicoes: number;
  alertas360: number;
  redistribuicoes: number;
  andamentos: number;
  prazos: number;
  tarefas: number;
  audiencias: number;
  intimacoes: number;
  total: number;
  emailHabilitado: boolean;
  whatsappHabilitado: boolean;
  membros: MembroStats[];
}

interface Props {
  onSelectCoordenacao: (id: string, category?: string) => void;
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
  const { user } = useAuth();
  const { isAdmin, loading: loadingRole } = useUserRole();
  
  const { data: coordenacoes = [], isLoading: loadingCoord } = useCoordenacoesFull();
  const { prazosUrgentes } = useNotificacoes();
  const { configs } = useConfigAlertasCoordenacao();

  // Buscar coordenações que o usuário é membro (para não-admins)
  const { data: minhasCoordenacoes = [] } = useQuery({
    queryKey: ["minhas-coordenacoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      if (error) throw error;
      return data?.map(m => m.coordenacao_id) || [];
    },
    enabled: !!user?.id && !isAdmin,
  });

  // Filtrar coordenações baseado no perfil do usuário
  const coordenacoesFiltradas = useMemo(() => {
    if (isAdmin) {
      // Admin vê todas as coordenações
      return coordenacoes;
    }
    // Outros perfis só veem coordenações onde são membros
    return coordenacoes.filter(c => minhasCoordenacoes.includes(c.id));
  }, [coordenacoes, minhasCoordenacoes, isAdmin]);

  // Counts por coordenação (server-side) — usado nos cards e garante consistência com os totalizadores
  const coordenacaoIdsKey = useMemo(
    () => coordenacoesFiltradas.map((c) => c.id),
    [coordenacoesFiltradas]
  );
  const { data: countsByCoord = undefined, isLoading: loadingCounts } = useNotificacoesCountsByCoordenacao({
    coordenacaoIds: coordenacaoIdsKey,
    periodoInicio,
    periodoFim,
    statusFilter,
    searchQuery,
  });

  // Helper para filtrar por período (usado nos breakdowns de membro)
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

  // Helper para filtrar por busca: FRASE EXATA (evita "Super" casar com "SUPERIOR")
  const matchesSearch = useMemo(() => {
    return (text: string | null | undefined) => {
      if (!searchQuery?.trim()) return true;
      return conteudoContemFraseExata(text, searchQuery);
    };
  }, [searchQuery]);

  // Buscar todos os membros de coordenações
  const { data: membrosCoordenacao = [] } = useQuery({
    queryKey: ["membros-todas-coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          coordenacao_id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar tarefas pendentes com coordenação via processo e responsável (para breakdown por membro)
  const { data: tarefasPendentes = [] } = useQuery({
    queryKey: ["tarefas-pendentes-coordenacao", statusFilter],
    queryFn: async () => {
      const pageSize = 1000;

      const buildQuery = () => {
        let q = supabase
          .from("tarefas")
          .select(
            `
            id,
            titulo,
            status,
            data_vencimento,
            responsavel_id,
            processo:processos!tarefas_processo_id_fkey(
              id,
              coordenacao_id
            )
          `
          )
          .order("created_at", { ascending: false });

        if (statusFilter !== "todas") {
          const status = statusFilter === "concluido" ? "cumprido" : statusFilter;
          q = q.eq("status", status as "pendente" | "cumprido" | "atrasado");
        }

        return q;
      };

      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        const chunk = data || [];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      return all;
    },
  });


  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpanded = (coordId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [coordId]: !prev[coordId]
    }));
  };

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedCoordConfig, setSelectedCoordConfig] = useState<{ id: string; nome: string } | null>(null);

  // Calcular estatísticas por coordenação - usando counts no banco (consistente e sem cap/timeout)
  const coordenacoesStats = useMemo<CoordenacaoStats[]>(() => {
    if (!coordenacoesFiltradas.length) return [];

    // Filtrar prazos por período (breakdown membro)
    const prazosFiltrados = prazosUrgentes.filter(p => {
      if (!matchesPeriodo(p.data_vencimento)) return false;
      if (!matchesSearch(p.titulo) && !matchesSearch(p.processo?.numero)) return false;
      return true;
    });

    // Filtrar tarefas por período (breakdown membro)
    const tarefasFiltradas = tarefasPendentes.filter(t => {
      if (!matchesPeriodo((t as any).data_vencimento)) return false;
      if (!matchesSearch((t as any).titulo)) return false;
      return true;
    });

    return coordenacoesFiltradas.map(coord => {
      // Membros da coordenação
      const membrosCoord = membrosCoordenacao.filter(m => m.coordenacao_id === coord.id);

      const c = countsByCoord?.[coord.id];
      const djen = c?.djen ?? 0;
      const distribuicoes = c?.distribuicoes ?? 0;
      const alertas360 = c?.alertas360 ?? 0;
      const redistribuicoes = c?.redistribuicoes ?? 0;
      const andamentos = c?.andamentos ?? 0;
      const prazos = c?.prazos ?? 0;
      const tarefas = c?.tarefas ?? 0;
      const audiencias = c?.audiencias ?? 0;
      const intimacoes = c?.intimacoes ?? 0;
      const total = c?.total ?? (djen + distribuicoes + alertas360 + redistribuicoes + andamentos + prazos + tarefas + audiencias + intimacoes);

      // Para breakdown de membros, usamos os datasets locais (tarefas/prazos)
      const tarefasCoord = tarefasFiltradas.filter(t => (t.processo as any)?.coordenacao_id === coord.id);

      // Config de alertas
      const config = configs.find(c => c.coordenacao_id === coord.id);

      // Calcular totais por membro
      const membros: MembroStats[] = membrosCoord.map(m => {
        const membroId = (m.usuario as any)?.id;
        const membroNome = (m.usuario as any)?.nome || "Sem nome";
        
        // Tarefas do membro nesta coordenação
        const tarefasMembro = tarefasCoord.filter(t => (t as any).responsavel_id === membroId).length;
        
        // Prazos do membro (tarefas com data de vencimento próxima)
        const prazosMembro = prazosFiltrados.filter(p => (p as any).responsavel_id === membroId && p.processo?.coordenacao_id === coord.id).length;
        
        return {
          id: membroId,
          nome: membroNome,
          tarefas: tarefasMembro,
          prazos: prazosMembro,
          total: tarefasMembro + prazosMembro,
        };
      }).filter(m => m.id);

      return {
        id: coord.id,
        nome: coord.nome,
        djen,
        distribuicoes,
        alertas360,
        redistribuicoes,
        andamentos,
        prazos,
        tarefas,
        audiencias,
        intimacoes,
        total,
        emailHabilitado: config?.email_habilitado || false,
        whatsappHabilitado: config?.whatsapp_habilitado || false,
        membros,
      };
    }).sort((a, b) => b.total - a.total);
  }, [coordenacoesFiltradas, countsByCoord, prazosUrgentes, tarefasPendentes, configs, matchesPeriodo, matchesSearch, membrosCoordenacao]);

  const handleOpenConfig = (coord: { id: string; nome: string }) => {
    setSelectedCoordConfig(coord);
    setConfigDialogOpen(true);
  };

  if (loadingCoord || loadingRole || loadingCounts) {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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

                    {/* Breakdown por tipo */}
                    {coord.total > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {coord.djen > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-blue-600/15 cursor-pointer hover:bg-blue-600/25 transition-colors" 
                            title="DJEN"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "djen");
                            }}
                          >
                            <Newspaper className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-600">{coord.djen}</span>
                          </div>
                        )}
                        {coord.distribuicoes > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-purple-600/15 cursor-pointer hover:bg-purple-600/25 transition-colors" 
                            title="Distribuições"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "distribuicoes");
                            }}
                          >
                            <Scale className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-600">{coord.distribuicoes}</span>
                          </div>
                        )}
                        {coord.alertas360 > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-amber-600/15 cursor-pointer hover:bg-amber-600/25 transition-colors" 
                            title="Alertas 360°"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "alertas");
                            }}
                          >
                            <Radar className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-600">{coord.alertas360}</span>
                          </div>
                        )}
                        {coord.redistribuicoes > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-cyan-600/15 cursor-pointer hover:bg-cyan-600/25 transition-colors" 
                            title="Redistribuições"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "redistribuicoes");
                            }}
                          >
                            <RefreshCw className="h-4 w-4 text-cyan-600" />
                            <span className="text-xs font-semibold text-cyan-600">{coord.redistribuicoes}</span>
                          </div>
                        )}
                        {coord.andamentos > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-violet-600/15 cursor-pointer hover:bg-violet-600/25 transition-colors" 
                            title="Andamentos"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "andamentos");
                            }}
                          >
                            <Activity className="h-4 w-4 text-violet-600" />
                            <span className="text-xs font-semibold text-violet-600">{coord.andamentos}</span>
                          </div>
                        )}
                        {coord.prazos > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-red-600/15 cursor-pointer hover:bg-red-600/25 transition-colors" 
                            title="Prazos"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "prazos");
                            }}
                          >
                            <Clock className="h-4 w-4 text-red-600" />
                            <span className="text-xs font-semibold text-red-600">{coord.prazos}</span>
                          </div>
                        )}
                        {coord.tarefas > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-green-600/15 cursor-pointer hover:bg-green-600/25 transition-colors" 
                            title="Tarefas"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "tarefas");
                            }}
                          >
                            <ListTodo className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-600">{coord.tarefas}</span>
                          </div>
                        )}
                        {coord.audiencias > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-indigo-600/15 cursor-pointer hover:bg-indigo-600/25 transition-colors" 
                            title="Audiências"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "audiencias");
                            }}
                          >
                            <Gavel className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-600">{coord.audiencias}</span>
                          </div>
                        )}
                        {coord.intimacoes > 0 && (
                          <div 
                            className="flex flex-col items-center p-1.5 rounded-md bg-orange-600/15 cursor-pointer hover:bg-orange-600/25 transition-colors" 
                            title="Intimações"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCoordenacao(coord.id, "intimacoes");
                            }}
                          >
                            <FileWarning className="h-4 w-4 text-orange-600" />
                            <span className="text-xs font-semibold text-orange-600">{coord.intimacoes}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Membros da coordenação */}
                    {coord.membros.length > 0 && (
                      <Collapsible 
                        open={expandedCards[coord.id]}
                        onOpenChange={() => toggleCardExpanded(coord.id)}
                      >
                        <CollapsibleTrigger 
                          className="w-full flex items-center justify-between py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            {coord.membros.length} membro{coord.membros.length !== 1 ? 's' : ''}
                          </span>
                          {expandedCards[coord.id] ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-1 animate-collapsible-down">
                          {coord.membros.map((membro) => (
                            <div 
                              key={membro.id} 
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                            >
                              <span className="truncate flex-1 text-sm font-medium">{membro.nome}</span>
                              <div className="flex items-center gap-2 ml-2">
                                {membro.tarefas > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-600/15" title="Tarefas">
                                    <ListTodo className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-600">{membro.tarefas}</span>
                                  </div>
                                )}
                                {membro.prazos > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600/15" title="Prazos">
                                    <Clock className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-semibold text-red-600">{membro.prazos}</span>
                                  </div>
                                )}
                                {membro.total === 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15">
                                    <span className="text-sm font-semibold text-emerald-600">0</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
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
