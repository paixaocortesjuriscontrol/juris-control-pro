import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Clock, Search, CheckCircle, XCircle, AlertCircle, 
  CalendarDays, FileText, Eye, Plus, Building, AlertTriangle,
  Timer, PlayCircle, Download, Settings, Users, ClipboardList, User,
  ChevronsUpDown, ChevronDown, ChevronRight
} from "lucide-react";
import { useIntimacoesDetectadas, IntimacaoDetectada } from "@/hooks/useIntimacoesDetectadas";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";

export default function PainelIntimacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [statCardFilter, setStatCardFilter] = useState<string | null>("pendente"); // tracks which stat card is active
  const [coordenacaoFilter, setCoordenacaoFilter] = useState<string | null>(null);
  const [coordenacaoCarregada, setCoordenacaoCarregada] = useState(false);
  const [selectedIntimacao, setSelectedIntimacao] = useState<IntimacaoDetectada | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [providencias, setProvidencias] = useState("");
  const [novaIntimacaoOpen, setNovaIntimacaoOpen] = useState(false);
  const [expandedIntimacoes, setExpandedIntimacoes] = useState<Set<string>>(new Set());

  // Buscar coordenação do usuário logado
  const { data: userCoordData } = useQuery({
    queryKey: ['user-coordenacao', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Primeiro verifica se é coordenador
      const { data: coordenador } = await supabase
        .from('coordenacoes')
        .select('id')
        .eq('coordenador_id', user.id)
        .maybeSingle();
      
      if (coordenador) return coordenador.id;

      // Senão, verifica se é membro de alguma coordenação
      const { data: membro } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id)
        .maybeSingle();
      
      return membro?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });

  // Auto-selecionar coordenação do usuário ao carregar
  useEffect(() => {
    if (!coordenacaoCarregada && userCoordData !== undefined) {
      if (userCoordData) {
        setCoordenacaoFilter(userCoordData);
      } else {
        setCoordenacaoFilter("todas");
      }
      setCoordenacaoCarregada(true);
    }
  }, [userCoordData, coordenacaoCarregada]);

  // Função para criar tarefa a partir da intimação
  const handleCriarTarefa = async (intimacao: IntimacaoDetectada) => {
    // Buscar coordenação do processo se houver processo_id
    let coordenacaoId = "";
    if (intimacao.processo_id) {
      const { data: processo } = await supabase
        .from("processos")
        .select("coordenacao_id")
        .eq("id", intimacao.processo_id)
        .single();
      coordenacaoId = processo?.coordenacao_id || "";
    }

    const params = new URLSearchParams({
      tipo_tarefa: "ANÁLISE",
      titulo: "ANALISAR INTIMAÇÃO",
      ...(intimacao.processo_id && { processo: intimacao.processo_id }),
      ...(coordenacaoId && { coordenacao: coordenacaoId }),
      ...(intimacao.descricao && { descricao: intimacao.descricao }),
    });

    navigate(`/nova-tarefa?${params.toString()}`);
  };

  // Buscar coordenações
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ['coordenacoes-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      return data || [];
    },
  });

  // Form nova intimação
  const [novaIntimacao, setNovaIntimacao] = useState({
    processo_numero: "",
    tipo_intimacao: "",
    orgao_intimante: "",
    data_intimacao: "",
    data_limite: "",
    prazo_dias: "",
    descricao: "",
    prioridade: "normal",
  });

  const { 
    intimacoes, 
    isLoading, 
    atualizarIntimacao,
    criarIntimacao,
    pendentes,
    tratadas,
    ignoradas,
    emAndamento,
    proximas,
    vencidas,
  } = useIntimacoesDetectadas({ 
    status: statusFilter,
    search,
    coordenacaoId: coordenacaoFilter || "todas",
  });

  const handleMarcarTratado = async (id: string) => {
    await atualizarIntimacao.mutateAsync({ 
      id, 
      status: 'tratado',
      observacoes: observacoes || undefined,
      providencias_tomadas: providencias || undefined,
    });
    setSelectedIntimacao(null);
    setObservacoes("");
    setProvidencias("");
  };

  const handleMarcarEmAndamento = async (id: string) => {
    await atualizarIntimacao.mutateAsync({ 
      id, 
      status: 'em_andamento',
      observacoes: observacoes || undefined,
    });
    setSelectedIntimacao(null);
    setObservacoes("");
  };

  const handleIgnorar = async (id: string) => {
    await atualizarIntimacao.mutateAsync({ 
      id, 
      status: 'ignorado',
      observacoes: observacoes || 'Ignorado pelo usuário',
    });
    setSelectedIntimacao(null);
    setObservacoes("");
  };

  const handleCriarIntimacao = async () => {
    await criarIntimacao.mutateAsync({
      processo_numero: novaIntimacao.processo_numero || null,
      tipo_intimacao: novaIntimacao.tipo_intimacao || null,
      orgao_intimante: novaIntimacao.orgao_intimante || null,
      data_intimacao: novaIntimacao.data_intimacao || null,
      data_limite: novaIntimacao.data_limite || null,
      prazo_dias: novaIntimacao.prazo_dias ? parseInt(novaIntimacao.prazo_dias) : null,
      descricao: novaIntimacao.descricao || null,
      prioridade: novaIntimacao.prioridade,
      status: 'pendente',
    });
    setNovaIntimacaoOpen(false);
    setNovaIntimacao({
      processo_numero: "",
      tipo_intimacao: "",
      orgao_intimante: "",
      data_intimacao: "",
      data_limite: "",
      prazo_dias: "",
      descricao: "",
      prioridade: "normal",
    });
  };

  const toggleExpandIntimacao = (id: string) => {
    const newExpanded = new Set(expandedIntimacoes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIntimacoes(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandedIntimacoes.size === intimacoes.length && intimacoes.length > 0) {
      setExpandedIntimacoes(new Set());
    } else {
      setExpandedIntimacoes(new Set(intimacoes.map(i => i.id)));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Não informada";
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return "Data inválida";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return null;
      const days = differenceInDays(date, new Date());
      return days;
    } catch {
      return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">⏳ Pendente</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">🔄 Em Andamento</Badge>;
      case 'tratado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">✔️ Tratado</Badge>;
      case 'ignorado':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">🚫 Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (daysUntil: number | null) => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) {
      return <Badge variant="destructive">Vencida há {Math.abs(daysUntil)} dias</Badge>;
    }
    if (daysUntil === 0) {
      return <Badge variant="destructive">Vence hoje!</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge className="bg-orange-500">Vence em {daysUntil} dias</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge className="bg-yellow-500 text-yellow-950">Vence em {daysUntil} dias</Badge>;
    }
    return <Badge variant="secondary">Vence em {daysUntil} dias</Badge>;
  };

  const getPrioridadeBadge = (prioridade: string | null) => {
    switch (prioridade) {
      case 'urgente':
        return <Badge variant="destructive">🚨 Urgente</Badge>;
      case 'alta':
        return <Badge className="bg-orange-500">⚠️ Alta</Badge>;
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>;
      case 'baixa':
        return <Badge variant="outline">Baixa</Badge>;
      default:
        return null;
    }
  };

  const getOrigemBadge = (origem: string | null) => {
    if (origem === 'manual') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Manual</Badge>;
    }
    return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">Detectado</Badge>;
  };

  return (
    <MainLayout 
      title="Painel de Intimações" 
      subtitle="Controle de intimações detectadas e cadastradas manualmente"
    >
      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lista" className="gap-2">
            <FileText className="h-4 w-4" />
            Lista de Intimações
          </TabsTrigger>
          <TabsTrigger value="cadastro" className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Intimação
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "pendente" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('pendente'); setStatCardFilter('pendente'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Pendentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{pendentes}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "vencidas" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('vencidas'); setStatCardFilter('vencidas'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Vencidas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">{vencidas}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "proximas" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('proximas'); setStatCardFilter('proximas'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Próx. 7 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  <span className="text-2xl font-bold">{proximas}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "em_andamento" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('em_andamento'); setStatCardFilter('em_andamento'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Em Andamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{emAndamento}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "tratado" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('tratado'); setStatCardFilter('tratado'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Tratadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{tratadas}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                statCardFilter === "ignorado" && "border-primary ring-1 ring-primary"
              )} 
              onClick={() => { setStatusFilter('ignorado'); setStatCardFilter('ignorado'); setSearch(''); }}
            >
              <CardHeader className="pb-2">
                <CardDescription>Ignoradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{ignoradas}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por processo, tipo, órgão..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={coordenacaoFilter || ""} onValueChange={setCoordenacaoFilter}>
              <SelectTrigger className="w-full md:w-[280px]">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={statusFilter} 
              onValueChange={(value) => { 
                setStatusFilter(value); 
                setStatCardFilter(null); // Clear card selection when using dropdown 
              }}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">⏳ Pendentes</SelectItem>
                <SelectItem value="vencidas">⚠️ Vencidas</SelectItem>
                <SelectItem value="proximas">📅 Próx. 7 dias</SelectItem>
                <SelectItem value="em_andamento">🔄 Em Andamento</SelectItem>
                <SelectItem value="tratado">✔️ Tratados</SelectItem>
                <SelectItem value="ignorado">🚫 Ignorados</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              disabled={intimacoes.length === 0}
              className="text-xs h-9"
            >
              <ChevronsUpDown className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">
                {expandedIntimacoes.size === intimacoes.length && intimacoes.length > 0 ? "Recolher" : "Expandir"}
              </span>
            </Button>
            <Button variant="outline" onClick={() => setNovaIntimacaoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Intimação
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : intimacoes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma intimação encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Cadastre intimações manualmente ou aguarde a detecção automática
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {intimacoes.map((intimacao) => {
                const daysUntil = getDaysUntil(intimacao.data_limite);
                const isExpanded = expandedIntimacoes.has(intimacao.id);
                
                return (
                  <Card 
                    key={intimacao.id} 
                    className={cn(
                      "hover:shadow-md transition-shadow cursor-pointer",
                      isExpanded && "ring-1 ring-primary/20"
                    )}
                    onClick={() => toggleExpandIntimacao(intimacao.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              {getStatusBadge(intimacao.status)}
                              {getOrigemBadge(intimacao.origem)}
                              {intimacao.status === 'pendente' && getUrgencyBadge(daysUntil)}
                              {getPrioridadeBadge(intimacao.prioridade)}
                              {intimacao.tipo_intimacao && (
                                <Badge variant="secondary">{intimacao.tipo_intimacao}</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm flex-wrap ml-6">
                              {intimacao.data_limite && (
                                <div className="flex items-center gap-1 text-primary">
                                  <Timer className="h-4 w-4" />
                                  <span className="font-medium">Prazo: {formatDate(intimacao.data_limite)}</span>
                                </div>
                              )}
                              {intimacao.data_disponibilizacao && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <CalendarDays className="h-4 w-4" />
                                  <span>Disp.: {formatDate(intimacao.data_disponibilizacao)}</span>
                                </div>
                              )}
                              {intimacao.processo_numero && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                  <span className="font-mono text-xs">{intimacao.processo_numero}</span>
                                </div>
                              )}
                            </div>

                            {/* Partes do processo */}
                            {(intimacao.polo_ativo || intimacao.polo_passivo) && (
                              <div className="flex items-start gap-2 text-sm text-muted-foreground ml-6">
                                <User className="h-4 w-4 mt-0.5 shrink-0" />
                                <span className="line-clamp-1">
                                  {intimacao.polo_ativo && <><strong>Autor:</strong> {intimacao.polo_ativo}</>}
                                  {intimacao.polo_ativo && intimacao.polo_passivo && " × "}
                                  {intimacao.polo_passivo && <><strong>Réu:</strong> {intimacao.polo_passivo}</>}
                                </span>
                              </div>
                            )}

                            {!isExpanded && intimacao.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-2 ml-6">
                                {intimacao.descricao}
                              </p>
                            )}
                          </div>

                          {/* Botões */}
                          <div className="flex gap-2 flex-wrap flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" onClick={() => {
                              setSelectedIntimacao(intimacao);
                              setObservacoes(intimacao.observacoes || "");
                              setProvidencias(intimacao.providencias_tomadas || "");
                            }}>
                              <Eye className="h-4 w-4 mr-1" />
                              Detalhes
                            </Button>
                            {intimacao.processo_id && (
                              <Button variant="outline" size="sm" onClick={() => handleCriarTarefa(intimacao)}>
                                <ClipboardList className="h-4 w-4 mr-1" />
                                Criar Tarefa
                              </Button>
                            )}
                            {intimacao.status === 'pendente' && (
                              <>
                                <Button variant="default" size="sm" onClick={() => handleMarcarTratado(intimacao.id)} disabled={atualizarIntimacao.isPending}>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Tratado
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleIgnorar(intimacao.id)} disabled={atualizarIntimacao.isPending}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {intimacao.status === 'em_andamento' && (
                              <Button variant="default" size="sm" onClick={() => handleMarcarTratado(intimacao.id)} disabled={atualizarIntimacao.isPending}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Concluir
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Conteúdo expandido */}
                        {isExpanded && (
                          <div className="border-t pt-3 space-y-3 ml-6">
                            {intimacao.descricao && (
                              <div>
                                <strong className="text-xs text-muted-foreground">Descrição:</strong>
                                <p className="text-sm mt-1">{intimacao.descricao}</p>
                              </div>
                            )}
                            {intimacao.contexto && (
                              <div>
                                <strong className="text-xs text-muted-foreground">Contexto Detectado:</strong>
                                <p className="text-sm mt-1 p-2 bg-muted/50 rounded">{intimacao.contexto}</p>
                              </div>
                            )}
                            {intimacao.conteudo_publicacao && (
                              <div>
                                <strong className="text-xs text-muted-foreground">Conteúdo da Publicação:</strong>
                                <div className={cn("mt-1 p-3 bg-muted/50 rounded-lg text-sm", conteudoDisplayClasses)}>
                                  {formatConteudoParaExibicao(intimacao.conteudo_publicacao)}
                                </div>
                              </div>
                            )}
                            {intimacao.orgao_intimante && (
                              <div>
                                <strong className="text-xs text-muted-foreground">Órgão Intimante:</strong>
                                <p className="text-sm mt-1">{intimacao.orgao_intimante}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cadastro">
          <Card>
            <CardHeader>
              <CardTitle>Cadastrar Nova Intimação</CardTitle>
              <CardDescription>
                Registre manualmente uma intimação para acompanhamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do Processo</Label>
                  <Input
                    placeholder="0000000-00.0000.0.00.0000"
                    value={novaIntimacao.processo_numero}
                    onChange={(e) => setNovaIntimacao(prev => ({ ...prev, processo_numero: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Intimação</Label>
                  <Select 
                    value={novaIntimacao.tipo_intimacao} 
                    onValueChange={(v) => setNovaIntimacao(prev => ({ ...prev, tipo_intimacao: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intimação para Manifestação">Intimação para Manifestação</SelectItem>
                      <SelectItem value="Intimação de Sentença">Intimação de Sentença</SelectItem>
                      <SelectItem value="Intimação de Despacho">Intimação de Despacho</SelectItem>
                      <SelectItem value="Intimação para Audiência">Intimação para Audiência</SelectItem>
                      <SelectItem value="Intimação de Decisão">Intimação de Decisão</SelectItem>
                      <SelectItem value="Citação">Citação</SelectItem>
                      <SelectItem value="Notificação">Notificação</SelectItem>
                      <SelectItem value="Outra">Outra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Órgão Intimante</Label>
                  <Input
                    placeholder="Vara, Câmara, Tribunal..."
                    value={novaIntimacao.orgao_intimante}
                    onChange={(e) => setNovaIntimacao(prev => ({ ...prev, orgao_intimante: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo (dias)</Label>
                  <Input
                    type="number"
                    placeholder="15"
                    value={novaIntimacao.prazo_dias}
                    onChange={(e) => setNovaIntimacao(prev => ({ ...prev, prazo_dias: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data da Intimação</Label>
                  <Input
                    type="date"
                    value={novaIntimacao.data_intimacao}
                    onChange={(e) => setNovaIntimacao(prev => ({ ...prev, data_intimacao: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Limite</Label>
                  <Input
                    type="date"
                    value={novaIntimacao.data_limite}
                    onChange={(e) => setNovaIntimacao(prev => ({ ...prev, data_limite: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select 
                    value={novaIntimacao.prioridade} 
                    onValueChange={(v) => setNovaIntimacao(prev => ({ ...prev, prioridade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o teor da intimação..."
                  value={novaIntimacao.descricao}
                  onChange={(e) => setNovaIntimacao(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCriarIntimacao} disabled={criarIntimacao.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Intimação
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Alertas</CardTitle>
              <CardDescription>
                Configure alertas automáticos para intimações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                As intimações são detectadas automaticamente durante o monitoramento de andamentos processuais.
                Configure os termos de monitoramento na seção de Monitoramento 360º para personalizar a detecção.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Intimação
            </DialogTitle>
          </DialogHeader>

          {selectedIntimacao && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedIntimacao.status)}
                {getOrigemBadge(selectedIntimacao.origem)}
                {getPrioridadeBadge(selectedIntimacao.prioridade)}
                {selectedIntimacao.tipo_intimacao && (
                  <Badge variant="secondary">{selectedIntimacao.tipo_intimacao}</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Processo</p>
                  <p className="font-medium">{selectedIntimacao.processo_numero || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prazo</p>
                  <p className="font-medium">{selectedIntimacao.prazo_dias ? `${selectedIntimacao.prazo_dias} dias úteis` : "Não informado"}</p>
                </div>
                
                <div className="col-span-2 bg-muted/30 p-3 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datas</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">📅 Disponibilização</p>
                      <p className="font-medium text-sm">{formatDate(selectedIntimacao.data_disponibilizacao)}</p>
                      <p className="text-xs text-muted-foreground">Quando o DJEN lançou</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">📰 Publicação</p>
                      <p className="font-medium text-sm">{formatDate(selectedIntimacao.data_intimacao)}</p>
                      <p className="text-xs text-muted-foreground">1º dia útil seguinte</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">⏰ Data Limite</p>
                      <p className="font-medium text-sm text-primary">{formatDate(selectedIntimacao.data_limite)}</p>
                      <p className="text-xs text-muted-foreground">Pub + {selectedIntimacao.prazo_dias || '?'} dias úteis</p>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <p className="text-muted-foreground">Órgão Intimante</p>
                  <p className="font-medium">{selectedIntimacao.orgao_intimante || "Não informado"}</p>
                </div>
              </div>

              {selectedIntimacao.descricao && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedIntimacao.descricao}</p>
                </div>
              )}

              {selectedIntimacao.conteudo_publicacao && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Conteúdo da Publicação</p>
                  <div className={`text-sm bg-muted/50 p-3 rounded-lg ${conteudoDisplayClasses}`}>
                    {formatConteudoParaExibicao(selectedIntimacao.conteudo_publicacao)}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Adicione observações..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Providências Tomadas</Label>
                <Textarea
                  value={providencias}
                  onChange={(e) => setProvidencias(e.target.value)}
                  placeholder="Descreva as providências tomadas..."
                  rows={3}
                />
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {(selectedIntimacao.status === 'pendente' || selectedIntimacao.status === 'em_andamento') && (
                  <>
                    <Button
                      variant="default"
                      onClick={() => handleMarcarTratado(selectedIntimacao.id)}
                      disabled={atualizarIntimacao.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar como Tratado
                    </Button>
                    {selectedIntimacao.status === 'pendente' && (
                      <Button
                        variant="secondary"
                        onClick={() => handleMarcarEmAndamento(selectedIntimacao.id)}
                        disabled={atualizarIntimacao.isPending}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Em Andamento
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleIgnorar(selectedIntimacao.id)}
                      disabled={atualizarIntimacao.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Ignorar
                    </Button>
                  </>
                )}

                {(selectedIntimacao.status === 'tratado' || selectedIntimacao.status === 'ignorado') && (
                  <Button
                    variant="outline"
                    onClick={() => atualizarIntimacao.mutateAsync({ 
                      id: selectedIntimacao.id, 
                      status: 'pendente' 
                    })}
                    disabled={atualizarIntimacao.isPending}
                  >
                    Reabrir
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nova Intimação Dialog */}
      <Dialog open={novaIntimacaoOpen} onOpenChange={setNovaIntimacaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Intimação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número do Processo</Label>
              <Input
                placeholder="0000000-00.0000.0.00.0000"
                value={novaIntimacao.processo_numero}
                onChange={(e) => setNovaIntimacao(prev => ({ ...prev, processo_numero: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Intimação</Label>
              <Select 
                value={novaIntimacao.tipo_intimacao} 
                onValueChange={(v) => setNovaIntimacao(prev => ({ ...prev, tipo_intimacao: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Intimação para Manifestação">Intimação para Manifestação</SelectItem>
                  <SelectItem value="Intimação de Sentença">Intimação de Sentença</SelectItem>
                  <SelectItem value="Intimação de Despacho">Intimação de Despacho</SelectItem>
                  <SelectItem value="Intimação para Audiência">Intimação para Audiência</SelectItem>
                  <SelectItem value="Citação">Citação</SelectItem>
                  <SelectItem value="Outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Limite</Label>
                <Input
                  type="date"
                  value={novaIntimacao.data_limite}
                  onChange={(e) => setNovaIntimacao(prev => ({ ...prev, data_limite: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select 
                  value={novaIntimacao.prioridade} 
                  onValueChange={(v) => setNovaIntimacao(prev => ({ ...prev, prioridade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a intimação..."
                value={novaIntimacao.descricao}
                onChange={(e) => setNovaIntimacao(prev => ({ ...prev, descricao: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaIntimacaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarIntimacao} disabled={criarIntimacao.isPending}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
