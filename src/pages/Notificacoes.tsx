import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Newspaper, 
  Scale, 
  RefreshCw, 
  Radar,
  Eye,
  Trash2,
  CheckCheck,
  Filter,
  TrendingUp,
  Calendar
} from "lucide-react";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Notificacoes() {
  // Central de Notificações
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");
  const [activeTab, setActiveTab] = useState("todos");
  const navigate = useNavigate();

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { 
    notificacoes, 
    naoLidas, 
    prazosPendentes,
    prazosUrgentes,
    marcarComoLida, 
    marcarTodasComoLidas,
    excluirNotificacao 
  } = useNotificacoes();
  
  const { publicacoes, monitoramentos: monitoramentosDjen } = useMonitoramentosDjen();
  const { distribuicoesEncontradas } = useMonitoramentoDistribuicao();
  const { alertas } = useMonitoramento360();
  const { data: redistribuicoesData = [] } = useRedistribuicoes();

  // Filter DJEN publications by coordination
  const publicacoesNaoLidas = publicacoes.filter(p => !p.lida);
  const publicacoesFiltradas = coordenacaoId === "todas" 
    ? publicacoesNaoLidas 
    : publicacoesNaoLidas.filter(p => {
        const mon = monitoramentosDjen.find(m => m.id === p.monitoramento_id);
        return mon?.coordenacao_id === coordenacaoId;
      });

  // Filter distributions
  const distribuicoesPendentes = distribuicoesEncontradas.filter(d => d.status === 'pendente');

  // Filter alerts by coordination
  const alertasPendentes = alertas.filter(a => a.status === 'pendente');
  const alertasFiltrados = coordenacaoId === "todas"
    ? alertasPendentes
    : alertasPendentes.filter(a => a.processo?.coordenacao_id === coordenacaoId);

  // Redistribuições recentes (últimos 7 dias)
  const redistribuicoesRecentes = redistribuicoesData.slice(0, 10);

  // Stats
  const stats = {
    djen: publicacoesFiltradas.length,
    distribuicoes: distribuicoesPendentes.length,
    alertas360: alertasFiltrados.length,
    redistribuicoes: redistribuicoesRecentes.length,
    prazos: prazosUrgentes.length,
    notificacoes: naoLidas.length,
    total: publicacoesFiltradas.length + distribuicoesPendentes.length + alertasFiltrados.length + 
           redistribuicoesRecentes.length + prazosUrgentes.length + naoLidas.length
  };

  const getIconByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return <Newspaper className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getColorByType = (tipo: string) => {
    switch (tipo) {
      case 'djen': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'warning': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'success': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
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

  return (
    <MainLayout title="Central de Notificações" subtitle="Painel inteligente de monitoramentos e alertas">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por coordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as coordenações</SelectItem>
              {coordenacoes.map((coord) => (
                <SelectItem key={coord.id} value={coord.id}>
                  {coord.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {naoLidas.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => marcarTodasComoLidas.mutate()}
            disabled={marcarTodasComoLidas.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Cards de resumo por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "djen" && "ring-2 ring-blue-500"
          )}
          onClick={() => setActiveTab("djen")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Newspaper className="w-5 h-5 text-blue-500" />
              </div>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                {stats.djen}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">DJEN</p>
            <p className="text-xs text-muted-foreground">Publicações</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "distribuicoes" && "ring-2 ring-purple-500"
          )}
          onClick={() => setActiveTab("distribuicoes")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Scale className="w-5 h-5 text-purple-500" />
              </div>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-500">
                {stats.distribuicoes}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">Distribuições</p>
            <p className="text-xs text-muted-foreground">Novas encontradas</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "alertas360" && "ring-2 ring-amber-500"
          )}
          onClick={() => setActiveTab("alertas360")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Radar className="w-5 h-5 text-amber-500" />
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
                {stats.alertas360}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">Alertas 360°</p>
            <p className="text-xs text-muted-foreground">Termos encontrados</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "redistribuicoes" && "ring-2 ring-cyan-500"
          )}
          onClick={() => setActiveTab("redistribuicoes")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <RefreshCw className="w-5 h-5 text-cyan-500" />
              </div>
              <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-500">
                {stats.redistribuicoes}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">Redistribuições</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "prazos" && "ring-2 ring-red-500"
          )}
          onClick={() => setActiveTab("prazos")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Clock className="w-5 h-5 text-red-500" />
              </div>
              <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                {stats.prazos}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">Prazos</p>
            <p className="text-xs text-muted-foreground">Urgentes</p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
            activeTab === "todos" && "ring-2 ring-primary"
          )}
          onClick={() => setActiveTab("todos")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {stats.total}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-medium">Total</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Área de conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="todos" className="data-[state=active]:bg-background">
            Todos
          </TabsTrigger>
          <TabsTrigger value="djen" className="data-[state=active]:bg-background">
            DJEN
          </TabsTrigger>
          <TabsTrigger value="distribuicoes" className="data-[state=active]:bg-background">
            Distribuições
          </TabsTrigger>
          <TabsTrigger value="alertas360" className="data-[state=active]:bg-background">
            Alertas 360°
          </TabsTrigger>
          <TabsTrigger value="redistribuicoes" className="data-[state=active]:bg-background">
            Redistribuições
          </TabsTrigger>
          <TabsTrigger value="prazos" className="data-[state=active]:bg-background">
            Prazos
          </TabsTrigger>
        </TabsList>

        {/* Todos */}
        <TabsContent value="todos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DJEN resumido */}
            {stats.djen > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-blue-500" />
                    Publicações DJEN ({stats.djen})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {publicacoesFiltradas.slice(0, 5).map((pub) => (
                      <div key={pub.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{pub.processo_numero || 'Sem número'}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{pub.conteudo?.substring(0, 100)}...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pub.data_publicacao && formatDistanceToNow(new Date(pub.data_publicacao), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("djen")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Alertas 360 resumido */}
            {stats.alertas360 > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radar className="w-4 h-4 text-amber-500" />
                    Alertas 360° ({stats.alertas360})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {alertasFiltrados.slice(0, 5).map((alerta) => (
                      <div key={alerta.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge className={getPrioridadeColor(alerta.prioridade)} variant="outline">
                            {alerta.prioridade}
                          </Badge>
                          <span className="text-sm font-medium truncate">{alerta.termo_encontrado}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Processo: {alerta.processo?.numero}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("alertas360")}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Prazos urgentes */}
            {stats.prazos > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    Prazos Urgentes ({stats.prazos})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {prazosUrgentes.slice(0, 5).map((prazo) => (
                      <div key={prazo.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{prazo.titulo}</p>
                          <Badge 
                            variant={prazo.is_atrasado ? "destructive" : "outline"}
                            className={prazo.is_atrasado ? "" : "bg-amber-500/10 text-amber-500"}
                          >
                            {prazo.is_atrasado ? 'Atrasado' : `${prazo.dias_restantes}d`}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Processo: {prazo.processo?.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate('/prazos')}>
                    Ver todos
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Distribuições resumido */}
            {stats.distribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-500" />
                    Distribuições ({stats.distribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {distribuicoesPendentes.slice(0, 5).map((dist) => (
                      <div key={dist.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{dist.numero_processo}</p>
                        <p className="text-xs text-muted-foreground">{dist.classe || 'Sem classe'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dist.tribunal || 'Tribunal não informado'}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("distribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Redistribuições resumido */}
            {stats.redistribuicoes > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-cyan-500" />
                    Redistribuições ({stats.redistribuicoes})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {redistribuicoesRecentes.slice(0, 5).map((red) => (
                      <div key={red.id} className="py-2 border-b last:border-0">
                        <p className="text-sm font-medium truncate">{red.processo_numero}</p>
                        <p className="text-xs text-muted-foreground">{red.vara_antiga} → {red.vara_nova}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setActiveTab("redistribuicoes")}>
                    Ver todas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Notificações do sistema */}
            {naoLidas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    Notificações ({naoLidas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {naoLidas.slice(0, 5).map((notif) => (
                      <div key={notif.id} className="py-2 border-b last:border-0 flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1 rounded", getColorByType(notif.tipo))}>
                              {getIconByType(notif.tipo)}
                            </div>
                            <p className="text-sm font-medium">{notif.titulo}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.mensagem}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => marcarComoLida.mutate(notif.id)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => marcarTodasComoLidas.mutate()}>
                    Marcar todas como lidas
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {stats.total === 0 && (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold">Tudo em dia!</h3>
                <p className="text-muted-foreground">Não há notificações ou alertas pendentes.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DJEN */}
        <TabsContent value="djen">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-blue-500" />
                Publicações DJEN não lidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {publicacoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma publicação pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {publicacoesFiltradas.map((pub) => {
                      const monitoramento = monitoramentosDjen.find(m => m.id === pub.monitoramento_id);
                      return (
                        <Card key={pub.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                                    {monitoramento?.termo_busca || 'Monitoramento'}
                                  </Badge>
                                  {pub.fonte && (
                                    <Badge variant="secondary">{pub.fonte}</Badge>
                                  )}
                                </div>
                                <p className="font-medium">{pub.processo_numero || 'Sem número de processo'}</p>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                                  {pub.conteudo}
                                </p>
                                {(pub as any).resumo_ia && (
                                  <div className="mt-2 p-2 bg-primary/5 rounded text-sm">
                                    <strong>Resumo IA:</strong> {(pub as any).resumo_ia}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {pub.data_publicacao && format(new Date(pub.data_publicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate('/analise-djen')}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Analisar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribuições */}
        <TabsContent value="distribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-500" />
                Distribuições Encontradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicoesPendentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma distribuição pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {distribuicoesPendentes.map((dist) => (
                      <Card key={dist.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{dist.numero_processo}</p>
                              <p className="text-sm text-muted-foreground">{dist.classe}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Polo ativo:</span>
                                  <p className="truncate">{dist.polo_ativo || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Polo passivo:</span>
                                  <p className="truncate">{dist.polo_passivo || '-'}</p>
                                </div>
                              </div>
                              {dist.tribunal && (
                                <Badge variant="secondary" className="mt-2">{dist.tribunal}</Badge>
                              )}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-distribuicao')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas 360 */}
        <TabsContent value="alertas360">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-amber-500" />
                Alertas de Monitoramento 360°
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertasFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum alerta pendente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {alertasFiltrados.map((alerta) => (
                      <Card key={alerta.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getPrioridadeColor(alerta.prioridade)}>
                                  {alerta.prioridade.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="font-medium">Termo: {alerta.termo_encontrado}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {alerta.processo?.numero}
                              </p>
                              {alerta.contexto && (
                                <p className="text-sm mt-2 p-2 bg-muted rounded line-clamp-2">
                                  {alerta.contexto}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/monitoramento-360')}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redistribuições */}
        <TabsContent value="redistribuicoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-500" />
                Redistribuições Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redistribuicoesRecentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma redistribuição recente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {redistribuicoesRecentes.map((red) => (
                      <Card key={red.id} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{red.processo_numero}</p>
                              <p className="text-sm text-muted-foreground">
                                {red.vara_antiga} → {red.vara_nova}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(red.data_redistribuicao), { addSuffix: true, locale: ptBR })}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/redistribuicoes')}
                            >
                              Gerenciar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prazos */}
        <TabsContent value="prazos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Prazos Urgentes (próximos 3 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prazosUrgentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum prazo urgente
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {prazosUrgentes.map((prazo) => (
                      <Card key={prazo.id} className={cn(
                        "bg-muted/30",
                        prazo.is_atrasado && "border-red-500/50"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant={prazo.is_atrasado ? "destructive" : "outline"}
                                  className={!prazo.is_atrasado ? getPrioridadeColor(prazo.prioridade) : ""}
                                >
                                  {prazo.is_atrasado ? 'ATRASADO' : prazo.prioridade.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy')}
                                </Badge>
                              </div>
                              <p className="font-medium">{prazo.titulo}</p>
                              <p className="text-sm text-muted-foreground">
                                Processo: {prazo.processo?.numero}
                              </p>
                              <p className="text-xs mt-2">
                                {prazo.is_atrasado 
                                  ? <span className="text-red-500">Atrasado há {Math.abs(prazo.dias_restantes)} dia(s)</span>
                                  : prazo.dias_restantes === 0 
                                    ? <span className="text-amber-500">Vence hoje!</span>
                                    : <span className="text-muted-foreground">Vence em {prazo.dias_restantes} dia(s)</span>
                                }
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate('/prazos')}
                            >
                              Ver prazo
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
