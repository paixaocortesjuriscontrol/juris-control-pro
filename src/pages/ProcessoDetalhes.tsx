import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Scale, 
  Calendar, 
  User, 
  MapPin, 
  Building2, 
  FileText, 
  RefreshCw,
  Clock,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

export default function ProcessoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [atualizando, setAtualizando] = useState(false);

  const { data: processo, isLoading: loadingProcesso } = useQuery({
    queryKey: ["processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          *,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome, email)
        `)
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: movimentacoes, isLoading: loadingMovimentacoes, refetch: refetchMovimentacoes } = useQuery({
    queryKey: ["movimentacoes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", id!)
        .order("data_movimentacao", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleAtualizarAndamentos = async () => {
    if (!processo) return;
    
    setAtualizando(true);
    try {
      const result = await buscarAndamentosExternos(processo.id, processo.numero);
      
      if (result.success) {
        toast({
          title: "Andamentos atualizados",
          description: `${result.movimentosInseridos} novo(s) andamento(s) importado(s).`,
        });
        refetchMovimentacoes();
      } else {
        toast({
          title: "Erro ao atualizar",
          description: result.error || "Não foi possível buscar os andamentos.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAtualizando(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loadingProcesso) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!processo) {
    return (
      <MainLayout title="Processo não encontrado" subtitle="">
        <div className="text-center py-12">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Processo não encontrado</h3>
          <p className="text-muted-foreground mb-4">O processo solicitado não existe ou você não tem acesso.</p>
          <Button onClick={() => navigate("/processos")}>Voltar para Processos</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={`Processo ${processo.numero}`}
      subtitle={processo.assunto || "Sem assunto definido"}
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/processos")} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Processos
        </Button>

        {/* Process Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Informações do Processo
                </CardTitle>
                <div className="flex gap-2">
                  <Badge className={`badge-area-${processo.area}`}>
                    {areaLabels[processo.area] || processo.area}
                  </Badge>
                  <Badge className={`badge-status-${processo.status}`}>
                    {statusLabels[processo.status] || processo.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Número do Processo</p>
                  <p className="font-mono font-medium">{processo.numero}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Classe</p>
                  <p className="font-medium">{processo.classe || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Data de Distribuição
                  </p>
                  <p className="font-medium">{formatDate(processo.data_distribuicao)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Valor da Causa</p>
                  <p className="font-medium">{formatCurrency(processo.valor_causa)}</p>
                </div>
              </div>

              {processo.descricao && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                  <p>{processo.descricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location & Responsible */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tribunal</p>
                <p className="font-medium">{processo.tribunal || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Vara</p>
                <p className="font-medium">{processo.vara || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> Comarca
                </p>
                <p className="font-medium">{processo.comarca || "—"}</p>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                  <User className="w-4 h-4" /> Advogado Responsável
                </p>
                <p className="font-medium">
                  {processo.advogado_responsavel?.nome || "Não atribuído"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Partes do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Polo Ativo</p>
                <p className="font-medium text-foreground">{processo.polo_ativo || "Não informado"}</p>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Polo Passivo</p>
                <p className="font-medium text-foreground">{processo.polo_passivo || "Não informado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Movements / Andamentos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Andamentos ({movimentacoes?.length || 0})
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAtualizarAndamentos}
                disabled={atualizando}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${atualizando ? "animate-spin" : ""}`} />
                {atualizando ? "Atualizando..." : "Atualizar da API"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMovimentacoes ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : movimentacoes && movimentacoes.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {movimentacoes.map((mov) => {
                    // Parse description to extract nome and complemento if combined
                    const parts = mov.descricao.split(' - ');
                    const nomeMovimento = parts[0];
                    const complemento = parts.length > 1 ? parts.slice(1).join(' - ') : null;
                    
                    return (
                      <div 
                        key={mov.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground">{nomeMovimento}</p>
                              {mov.tipo && mov.tipo !== nomeMovimento && (
                                <Badge variant="secondary" className="text-xs">
                                  {mov.tipo}
                                </Badge>
                              )}
                            </div>
                            {complemento && (
                              <p className="text-sm text-muted-foreground mt-1 break-words">
                                {complemento}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(mov.data_movimentacao)}
                            </p>
                            {mov.fonte && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {mov.fonte}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">Nenhum andamento registrado</p>
                <Button variant="outline" onClick={handleAtualizarAndamentos} disabled={atualizando}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${atualizando ? "animate-spin" : ""}`} />
                  Buscar Andamentos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
