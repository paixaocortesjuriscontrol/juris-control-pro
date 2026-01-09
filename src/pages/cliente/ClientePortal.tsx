import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useClienteProcessosPaginados, 
  useClienteStats, 
  useClienteInfo, 
  useClienteMovimentacoes 
} from "@/hooks/useClientePortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scale,
  LogOut,
  Briefcase,
  Activity,
  CheckCircle2,
  FileText,
  Clock,
  ChevronRight,
  User,
  Calendar,
  MapPin,
  Search,
  BarChart3,
  Bell,
  Gavel,
  TrendingUp,
  PieChart,
} from "lucide-react";
import { 
  PieChart as RechartsPie, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ProcessoCliente } from "@/hooks/useClientePortal";

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

const statusColors: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-600",
  pendente: "bg-amber-500/10 text-amber-600",
  urgente: "bg-destructive/10 text-destructive",
  encerrado: "bg-muted text-muted-foreground",
  arquivado: "bg-muted text-muted-foreground",
};

export default function ClientePortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoCliente | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("processos");

  const { data: clienteInfo, isLoading: loadingInfo } = useClienteInfo();
  const { data: stats, isLoading: loadingStats } = useClienteStats();
  const { 
    data: processosData, 
    isLoading: loadingProcessos,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useClienteProcessosPaginados({ search: searchTerm });
  const { data: movimentacoes, isLoading: loadingMovimentacoes } = useClienteMovimentacoes(
    selectedProcesso?.id
  );

  // Flatten pages
  const processos = processosData?.pages.flatMap(p => p.processos) || [];
  const totalCount = processosData?.pages[0]?.totalCount || 0;

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isCliente = roles?.some(r => r.role === "cliente");
      if (!isCliente) {
        navigate("/auth");
      }
    };

    if (!authLoading && user) {
      checkAccess();
    } else if (!authLoading && !user) {
      navigate("/cliente/login");
    }
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/cliente/login");
  };

  const openDetalhes = (processo: ProcessoCliente) => {
    setSelectedProcesso(processo);
    setDetalhesOpen(true);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Scale className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold text-primary-foreground">JurisControl</h1>
              <p className="text-xs text-accent">Portal do Cliente</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {clienteInfo && (
              <div className="text-right text-sm hidden sm:block">
                <p className="text-primary-foreground font-medium">{clienteInfo.nome}</p>
                <p className="text-primary-foreground/70 text-xs">{clienteInfo.email}</p>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-foreground">
            Olá, {clienteInfo?.nome?.split(" ")[0] || "Cliente"}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus processos e movimentações
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Processos</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalProcessos || 0}</p>
                  )}
                </div>
                <Briefcase className="w-8 h-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600">{stats?.ativos || 0}</p>
                  )}
                </div>
                <Activity className="w-8 h-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Encerrados</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground">{stats?.encerrados || 0}</p>
                  )}
                </div>
                <CheckCircle2 className="w-8 h-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Movimentações</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalMovimentacoes || 0}</p>
                  )}
                </div>
                <FileText className="w-8 h-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Audiências (30d)</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-amber-600">{stats?.audienciasProximas || 0}</p>
                  )}
                </div>
                <Gavel className="w-8 h-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Intimações</p>
                  {loadingStats ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-rose-600">{stats?.intimacoesPendentes || 0}</p>
                  )}
                </div>
                <Bell className="w-8 h-8 text-rose-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="processos" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Meus Processos
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Processes Tab */}
          <TabsContent value="processos">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-primary" />
                      Meus Processos
                      {totalCount > 0 && (
                        <Badge variant="secondary" className="ml-2">{totalCount}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Clique em um processo para ver as movimentações
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar processo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingProcessos ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : processos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum processo encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processos.map((processo) => (
                      <div
                        key={processo.id}
                        onClick={() => openDetalhes(processo)}
                        className="p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-mono text-sm font-medium text-foreground truncate">
                                {processo.numero}
                              </p>
                              <Badge className={cn("text-xs", statusColors[processo.status])}>
                                {statusLabels[processo.status] || processo.status}
                              </Badge>
                            </div>
                            {processo.assunto && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {processo.assunto}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {processo.tribunal && (
                                <span>{processo.tribunal}</span>
                              )}
                              {processo.vara && (
                                <span>{processo.vara}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                    
                    {/* Load More Button */}
                    {hasNextPage && (
                      <div className="text-center pt-4">
                        <Button
                          variant="outline"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? "Carregando..." : "Carregar mais processos"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="relatorios">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Processes by Status */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Processos por Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : stats?.processosPorStatus && stats.processosPorStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPie>
                        <Pie
                          data={stats.processosPorStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.processosPorStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      <p>Sem dados disponíveis</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Processes by Area */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Processos por Área
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : stats?.processosPorArea && stats.processosPorArea.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats.processosPorArea} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" name="Processos" radius={[0, 4, 4, 0]}>
                          {stats.processosPorArea.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      <p>Sem dados disponíveis</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Movements Trend */}
              <Card className="border-border/50 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Movimentações nos Últimos 6 Meses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : stats?.movimentacoesPorMes && stats.movimentacoesPorMes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats.movimentacoesPorMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis />
                        <Tooltip />
                        <Bar 
                          dataKey="total" 
                          name="Movimentações" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      <p>Sem dados disponíveis</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Process Details Dialog */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedProcesso?.numero}</DialogTitle>
            <DialogDescription>
              Detalhes e movimentações do processo
            </DialogDescription>
          </DialogHeader>

          {selectedProcesso && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Process Info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn("text-xs", statusColors[selectedProcesso.status])}>
                    {statusLabels[selectedProcesso.status] || selectedProcesso.status}
                  </Badge>
                </div>
                {selectedProcesso.advogado_responsavel?.nome && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Advogado Responsável</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {selectedProcesso.advogado_responsavel.nome}
                    </p>
                  </div>
                )}
                {selectedProcesso.tribunal && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Tribunal</p>
                    <p className="text-sm">{selectedProcesso.tribunal}</p>
                  </div>
                )}
                {selectedProcesso.vara && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vara</p>
                    <p className="text-sm">{selectedProcesso.vara}</p>
                  </div>
                )}
                {selectedProcesso.comarca && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Comarca</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedProcesso.comarca}
                    </p>
                  </div>
                )}
                {selectedProcesso.data_distribuicao && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Data Distribuição</p>
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(selectedProcesso.data_distribuicao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              {selectedProcesso.assunto && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                  <p className="text-sm">{selectedProcesso.assunto}</p>
                </div>
              )}

              <Separator className="my-4" />

              {/* Movements */}
              <div className="flex-1 min-h-0">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Últimas Movimentações
                </h4>

                <ScrollArea className="h-[300px]">
                  {loadingMovimentacoes ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : !movimentacoes || movimentacoes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma movimentação registrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {movimentacoes.map((mov) => (
                        <div key={mov.id} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(mov.data_movimentacao), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {mov.tipo && (
                              <Badge variant="outline" className="text-xs">
                                {mov.tipo}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{mov.descricao}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
