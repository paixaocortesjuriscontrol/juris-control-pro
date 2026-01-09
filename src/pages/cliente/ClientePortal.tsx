import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteProcessos, useClienteStats, useClienteInfo, useClienteMovimentacoes } from "@/hooks/useClientePortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
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

  const { data: clienteInfo, isLoading: loadingInfo } = useClienteInfo();
  const { data: stats, isLoading: loadingStats } = useClienteStats();
  const { data: processos, isLoading: loadingProcessos } = useClienteProcessos();
  const { data: movimentacoes, isLoading: loadingMovimentacoes } = useClienteMovimentacoes(
    selectedProcesso?.id
  );

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;

      // Check if user has client role
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
      <header className="sticky top-0 z-50 bg-navy-900 border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Scale className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold text-white">JurisControl</h1>
              <p className="text-xs text-gold">Portal do Cliente</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {clienteInfo && (
              <div className="text-right text-sm hidden sm:block">
                <p className="text-white font-medium">{clienteInfo.nome}</p>
                <p className="text-muted-foreground text-xs">{clienteInfo.email}</p>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/10">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
        </div>

        {/* Processes List */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Meus Processos
            </CardTitle>
            <CardDescription>
              Clique em um processo para ver as movimentações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProcessos ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : !processos || processos.length === 0 ? (
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
              </div>
            )}
          </CardContent>
        </Card>
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
