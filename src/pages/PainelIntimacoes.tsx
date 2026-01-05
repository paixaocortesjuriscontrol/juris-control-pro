import { useState } from "react";
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
  Timer, PlayCircle, Download, Settings
} from "lucide-react";
import { useIntimacoesDetectadas, IntimacaoDetectada } from "@/hooks/useIntimacoesDetectadas";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

export default function PainelIntimacoes() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [selectedIntimacao, setSelectedIntimacao] = useState<IntimacaoDetectada | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [providencias, setProvidencias] = useState("");
  const [novaIntimacaoOpen, setNovaIntimacaoOpen] = useState(false);

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
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('pendente')}>
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('todos')}>
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('todos')}>
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('em_andamento')}>
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('tratado')}>
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

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('ignorado')}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">⏳ Pendentes</SelectItem>
                <SelectItem value="em_andamento">🔄 Em Andamento</SelectItem>
                <SelectItem value="tratado">✔️ Tratados</SelectItem>
                <SelectItem value="ignorado">🚫 Ignorados</SelectItem>
              </SelectContent>
            </Select>
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
                
                return (
                  <Card key={intimacao.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(intimacao.status)}
                            {getOrigemBadge(intimacao.origem)}
                            {intimacao.status === 'pendente' && getUrgencyBadge(daysUntil)}
                            {getPrioridadeBadge(intimacao.prioridade)}
                            {intimacao.tipo_intimacao && (
                              <Badge variant="secondary">{intimacao.tipo_intimacao}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            {intimacao.data_limite && (
                              <div className="flex items-center gap-1 text-primary">
                                <Timer className="h-4 w-4" />
                                <span className="font-medium">Prazo: {formatDate(intimacao.data_limite)}</span>
                              </div>
                            )}

                            {intimacao.data_intimacao && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>Intimação: {formatDate(intimacao.data_intimacao)}</span>
                              </div>
                            )}
                            
                            {intimacao.processo_numero && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{intimacao.processo_numero}</span>
                              </div>
                            )}

                            {intimacao.prazo_dias && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{intimacao.prazo_dias} dias</span>
                              </div>
                            )}
                          </div>

                          {intimacao.orgao_intimante && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Building className="h-4 w-4" />
                              <span>{intimacao.orgao_intimante}</span>
                            </div>
                          )}

                          {intimacao.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {intimacao.descricao}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedIntimacao(intimacao);
                              setObservacoes(intimacao.observacoes || "");
                              setProvidencias(intimacao.providencias_tomadas || "");
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                          
                          {intimacao.status === 'pendente' && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMarcarEmAndamento(intimacao.id)}
                                disabled={atualizarIntimacao.isPending}
                              >
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Iniciar
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleMarcarTratado(intimacao.id)}
                                disabled={atualizarIntimacao.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Tratado
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleIgnorar(intimacao.id)}
                                disabled={atualizarIntimacao.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {intimacao.status === 'em_andamento' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleMarcarTratado(intimacao.id)}
                              disabled={atualizarIntimacao.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Concluir
                            </Button>
                          )}
                        </div>
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
                  <p className="text-muted-foreground">Data da Intimação</p>
                  <p className="font-medium">{formatDate(selectedIntimacao.data_intimacao)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data Limite</p>
                  <p className="font-medium text-primary">{formatDate(selectedIntimacao.data_limite)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prazo</p>
                  <p className="font-medium">{selectedIntimacao.prazo_dias ? `${selectedIntimacao.prazo_dias} dias` : "Não informado"}</p>
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
                  <p className="text-sm bg-muted/50 p-3 rounded-lg max-h-40 overflow-y-auto">
                    {selectedIntimacao.conteudo_publicacao}
                  </p>
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
