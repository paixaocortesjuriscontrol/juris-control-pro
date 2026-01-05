import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, differenceInDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus,
  Search,
  ListChecks,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { TarefaDetalhesPanel } from "@/components/delegacao/TarefaDetalhesPanel";
import { AcoesEmLoteDialog } from "@/components/delegacao/AcoesEmLoteDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TipoAtividade = "todos" | "tarefas" | "audiencias" | "compromissos";
type StatusFiltro = "todos" | "pendente" | "cumprido" | "atrasado";

export default function CentralDelegacao() {
  const { user } = useAuth();
  const { isAdminOrCoordinator, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State
  const [search, setSearch] = useState("");
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [membroId, setMembroId] = useState<string>("todos");
  const [tipoAtividade, setTipoAtividade] = useState<TipoAtividade>("todos");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("todas");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [acoesLoteOpen, setAcoesLoteOpen] = useState(false);
  const [ordenacao, setOrdenacao] = useState<string>("mais-antigas");

  // Fetch coordenações
  const { data: coordenacoes, isLoading: loadingCoord } = useQuery({
    queryKey: ["coordenacoes-delegacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area, coordenador_id")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch membros based on selected coordination
  const { data: membros } = useQuery({
    queryKey: ["membros-delegacao", coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from("membros_coordenacao")
        .select(`
          id,
          usuario_id,
          cargo,
          coordenacao_id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome, email)
        `);

      if (coordenacaoId !== "todas") {
        query = query.eq("coordenacao_id", coordenacaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch atividades (tarefas/prazos + eventos)
  const { data: atividades, isLoading: loadingAtividades } = useQuery({
    queryKey: ["atividades-delegacao", coordenacaoId, membroId, tipoAtividade, statusFiltro, prioridadeFiltro, ordenacao],
    queryFn: async () => {
      // Fetch prazos
      let prazosQuery = supabase
        .from("prazos")
        .select(`
          id,
          titulo,
          descricao,
          data_vencimento,
          data_fatal,
          prioridade,
          status,
          tipo_tarefa,
          created_at,
          responsavel:profiles!prazos_responsavel_id_fkey(id, nome, email),
          processo:processos!prazos_processo_id_fkey(id, numero, polo_ativo, coordenacao_id, cliente:clientes!processos_cliente_id_fkey(id, nome))
        `);

      if (membroId !== "todos") {
        prazosQuery = prazosQuery.eq("responsavel_id", membroId);
      }

      if (statusFiltro === "pendente") {
        prazosQuery = prazosQuery.eq("status", "pendente");
      } else if (statusFiltro === "cumprido") {
        prazosQuery = prazosQuery.eq("status", "cumprido");
      }

      if (prioridadeFiltro !== "todas" && ["baixa", "media", "alta", "urgente"].includes(prioridadeFiltro)) {
        prazosQuery = prazosQuery.eq("prioridade", prioridadeFiltro as "baixa" | "media" | "alta" | "urgente");
      }

      // Ordenação
      if (ordenacao === "mais-antigas") {
        prazosQuery = prazosQuery.order("data_vencimento", { ascending: true, nullsFirst: false });
      } else if (ordenacao === "mais-recentes") {
        prazosQuery = prazosQuery.order("data_vencimento", { ascending: false });
      } else if (ordenacao === "prioridade") {
        prazosQuery = prazosQuery.order("prioridade", { ascending: false });
      }

      const { data: prazos, error: prazosError } = await prazosQuery.limit(200);
      if (prazosError) throw prazosError;

      // Filter by coordination if needed
      // Importante: tarefas "sem vínculo" (processo_id null) não possuem coordenacao_id,
      // então devem continuar visíveis mesmo quando um filtro de coordenação estiver ativo.
      let filteredPrazos = prazos || [];
      if (coordenacaoId !== "todas") {
        filteredPrazos = filteredPrazos.filter((p) => !p.processo || p.processo.coordenacao_id === coordenacaoId);
      }

      // Mark atrasados
      const hoje = new Date();
      const prazosProcessados = filteredPrazos.map(p => {
        const dataVenc = p.data_vencimento ? parseISO(p.data_vencimento) : null;
        const isAtrasado = dataVenc && isBefore(dataVenc, hoje) && p.status !== "cumprido";
        return {
          ...p,
          tipo: "tarefa" as const,
          isAtrasado,
        };
      });

      // Filter atrasados if needed
      if (statusFiltro === "atrasado") {
        return prazosProcessados.filter(p => p.isAtrasado);
      }

      return prazosProcessados;
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!atividades) return { total: 0, pendentes: 0, atrasadas: 0, concluidas: 0 };
    return {
      total: atividades.length,
      pendentes: atividades.filter(a => a.status === "pendente" && !a.isAtrasado).length,
      atrasadas: atividades.filter(a => a.isAtrasado).length,
      concluidas: atividades.filter(a => a.status === "cumprido").length,
    };
  }, [atividades]);

  // Filtered atividades
  const atividadesFiltradas = useMemo(() => {
    if (!atividades) return [];
    return atividades.filter(a => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        a.titulo?.toLowerCase().includes(searchLower) ||
        a.descricao?.toLowerCase().includes(searchLower) ||
        a.processo?.numero?.toLowerCase().includes(searchLower) ||
        a.responsavel?.nome?.toLowerCase().includes(searchLower)
      );
    });
  }, [atividades, search]);

  const selectedTarefa = useMemo(() => {
    if (!selectedTarefaId || !atividades) return null;
    return atividades.find(a => a.id === selectedTarefaId) || null;
  }, [selectedTarefaId, atividades]);

  // Unique membros for filter
  const membrosUnicos = useMemo(() => {
    if (!membros) return [];
    const uniqueMap = new Map();
    membros.forEach(m => {
      if (m.usuario?.id && !uniqueMap.has(m.usuario.id)) {
        uniqueMap.set(m.usuario.id, m.usuario);
      }
    });
    return Array.from(uniqueMap.values());
  }, [membros]);

  // Handlers
  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === atividadesFiltradas.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(atividadesFiltradas.map(a => a.id));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const classes: Record<string, string> = {
      urgente: "bg-red-500/10 text-red-600 border-red-200",
      alta: "bg-orange-500/10 text-orange-600 border-orange-200",
      media: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
      baixa: "bg-green-500/10 text-green-600 border-green-200",
    };
    const labels: Record<string, string> = {
      urgente: "Urgente",
      alta: "Alta",
      media: "Média",
      baixa: "Baixa",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", classes[prioridade] || "")}>
        {labels[prioridade] || prioridade}
      </Badge>
    );
  };

  const getStatusBadge = (tarefa: any) => {
    if (tarefa.status === "cumprido") {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Concluído
        </Badge>
      );
    }
    if (tarefa.isAtrasado) {
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Atrasada
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getDiasRestantes = (tarefa: any) => {
    if (!tarefa.data_vencimento) return null;
    const dataVenc = parseISO(tarefa.data_vencimento);
    const dias = differenceInDays(dataVenc, new Date());
    if (dias < 0) return <span className="text-red-500 font-medium">{Math.abs(dias)} dias atrasado</span>;
    if (dias === 0) return <span className="text-orange-500 font-medium">Vence hoje</span>;
    if (dias <= 3) return <span className="text-yellow-600 font-medium">{dias} dias restantes</span>;
    return <span className="text-muted-foreground">{dias} dias restantes</span>;
  };

  if (roleLoading) {
    return (
      <MainLayout title="Central de Delegação">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Central de Delegação" subtitle="Gerencie e delegue atividades para sua equipe">
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
              Central de Delegação
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e delegue atividades para sua equipe
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Atividade
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNovaTarefaOpen(true)}>
                  <ListChecks className="w-4 h-4 mr-2" />
                  Nova Tarefa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNovoCompromissoOpen(true)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Novo Compromisso
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFiltro("todos")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setStatusFiltro("pendente")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendentes</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.pendentes}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:border-red-500/50 transition-colors" onClick={() => setStatusFiltro("atrasado")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Atrasadas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.atrasadas}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setStatusFiltro("cumprido")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Concluídas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.concluidas}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, descrição, processo ou responsável..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas Coordenações</SelectItem>
                    {coordenacoes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={membroId} onValueChange={setMembroId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Membros</SelectItem>
                    {membrosUnicos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ordenacao} onValueChange={setOrdenacao}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mais-antigas">Mais antigas</SelectItem>
                    <SelectItem value="mais-recentes">Mais recentes</SelectItem>
                    <SelectItem value="prioridade">Prioridade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <Tabs value={tipoAtividade} onValueChange={(v) => setTipoAtividade(v as TipoAtividade)}>
                <TabsList>
                  <TabsTrigger value="todos" className="gap-2">
                    <Badge variant="secondary" className="text-xs">{stats.total}</Badge>
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="tarefas" className="gap-2">
                    <Badge variant="secondary" className="text-xs">{stats.total}</Badge>
                    Tarefas
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {selectedItems.length > 0 && (
                <Button 
                  variant="outline" 
                  className="text-primary"
                  onClick={() => setAcoesLoteOpen(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Ações em lote ({selectedItems.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Lista de Atividades */}
          <div className="flex-1">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Lista de Atividades
                    <Badge variant="secondary">{atividadesFiltradas.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedItems.length === atividadesFiltradas.length && atividadesFiltradas.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">Selecionar todos</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAtividades ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : atividadesFiltradas.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma atividade encontrada</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="divide-y">
                      {atividadesFiltradas.map((atividade) => (
                        <div
                          key={atividade.id}
                          className={cn(
                            "p-4 hover:bg-muted/50 cursor-pointer transition-colors flex gap-4",
                            selectedTarefaId === atividade.id && "bg-muted/80",
                            atividade.isAtrasado && "border-l-4 border-l-red-500"
                          )}
                          onClick={() => setSelectedTarefaId(atividade.id)}
                        >
                          <div className="pt-1">
                            <Checkbox 
                              checked={selectedItems.includes(atividade.id)}
                              onCheckedChange={() => toggleSelectItem(atividade.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getStatusBadge(atividade)}
                                  {getPrioridadeBadge(atividade.prioridade)}
                                  {atividade.tipo_tarefa && (
                                    <Badge variant="outline" className="text-xs">
                                      {atividade.tipo_tarefa}
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="font-medium truncate">
                                  {atividade.titulo || "Sem título"}
                                </h3>
                              </div>
                              <Avatar className="w-8 h-8 shrink-0">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {atividade.responsavel?.nome ? getInitials(atividade.responsavel.nome) : "?"}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            {atividade.processo && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-mono text-xs">{atividade.processo.numero}</span>
                                {atividade.processo.cliente?.nome && (
                                  <span className="ml-2">• {atividade.processo.cliente.nome}</span>
                                )}
                              </div>
                            )}

                            {atividade.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {atividade.descricao}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-4 text-muted-foreground">
                                {atividade.data_vencimento && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Prevista: {format(parseISO(atividade.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                                {atividade.data_fatal && (
                                  <span className="flex items-center gap-1 text-red-500">
                                    <AlertTriangle className="w-3 h-3" />
                                    Fatal: {format(parseISO(atividade.data_fatal), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              {getDiasRestantes(atividade)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Painel de Detalhes */}
          {selectedTarefa && (
            <div className="lg:w-[420px] shrink-0">
              <TarefaDetalhesPanel
                tarefa={selectedTarefa}
                onClose={() => setSelectedTarefaId(null)}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <NovaTarefaDialog
        open={novaTarefaOpen}
        onOpenChange={setNovaTarefaOpen}
        coordenacoes={coordenacoes || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
        }}
      />

      <AcoesEmLoteDialog
        open={acoesLoteOpen}
        onOpenChange={setAcoesLoteOpen}
        selectedIds={selectedItems}
        onSuccess={() => {
          setSelectedItems([]);
          queryClient.invalidateQueries({ queryKey: ["atividades-delegacao"] });
        }}
      />

      <EventoDialog
        open={novoCompromissoOpen}
        onOpenChange={setNovoCompromissoOpen}
      />
    </MainLayout>
  );
}
