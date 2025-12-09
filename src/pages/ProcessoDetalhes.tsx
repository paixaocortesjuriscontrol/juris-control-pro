import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Users,
  Edit,
  Save,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Database } from "@/integrations/supabase/types";

type StatusProcesso = Database["public"]["Enums"]["status_processo"];

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

const statusOptions: StatusProcesso[] = ["ativo", "pendente", "urgente", "encerrado", "arquivado"];

export default function ProcessoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editStatus, setEditStatus] = useState<StatusProcesso | "">("");
  const [editCoordenacao, setEditCoordenacao] = useState<string>("");
  const [editAdvogado, setEditAdvogado] = useState<string>("");
  const [editCliente, setEditCliente] = useState<string>("");

  const { data: processo, isLoading: loadingProcesso } = useQuery({
    queryKey: ["processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          *,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome, email),
          cliente:clientes!processos_cliente_id_fkey(id, nome, tipo, cpf_cnpj, email, telefone)
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

  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome, area")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: membrosCoordenacao = [] } = useQuery({
    queryKey: ["membros-coordenacao", editCoordenacao || processo?.coordenacao_id],
    queryFn: async () => {
      const coordId = editCoordenacao || processo?.coordenacao_id;
      if (!coordId) return [];
      
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          usuario_id,
          cargo,
          profiles:profiles!membros_coordenacao_usuario_id_fkey(id, nome)
        `)
        .eq("coordenacao_id", coordId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(editCoordenacao || processo?.coordenacao_id),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const handleIniciarEdicao = () => {
    if (processo) {
      setEditStatus(processo.status);
      setEditCoordenacao(processo.coordenacao_id || "");
      setEditAdvogado(processo.advogado_responsavel_id || "__none__");
      setEditCliente(processo.cliente_id || "__none__");
      setEditando(true);
    }
  };

  const handleCancelarEdicao = () => {
    setEditando(false);
    setEditStatus("");
    setEditCoordenacao("");
    setEditAdvogado("");
    setEditCliente("");
  };

  const handleSalvarEdicao = async () => {
    if (!processo) return;
    
    setSalvando(true);
    try {
      const updates: Record<string, any> = {};
      
      if (editStatus && editStatus !== processo.status) {
        updates.status = editStatus;
      }
      if (editCoordenacao !== (processo.coordenacao_id || "")) {
        updates.coordenacao_id = editCoordenacao || null;
      }
      const advogadoValue = editAdvogado === "__none__" ? null : editAdvogado;
      const originalAdvogado = processo.advogado_responsavel_id || null;
      if (advogadoValue !== originalAdvogado) {
        updates.advogado_responsavel_id = advogadoValue;
      }
      const clienteValue = editCliente === "__none__" ? null : editCliente;
      const originalCliente = processo.cliente_id || null;
      if (clienteValue !== originalCliente) {
        updates.cliente_id = clienteValue;
      }
      
      if (Object.keys(updates).length === 0) {
        toast({ title: "Nenhuma alteração detectada" });
        setEditando(false);
        setShowConfirmDialog(false);
        return;
      }
      
      const { error } = await supabase
        .from("processos")
        .update(updates)
        .eq("id", processo.id);
      
      if (error) throw error;
      
      toast({ title: "Processo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["processo", id] });
      setEditando(false);
      setShowConfirmDialog(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

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
                <div className="flex items-center gap-2">
                  <Badge className={`badge-area-${processo.area}`}>
                    {areaLabels[processo.area] || processo.area}
                  </Badge>
                  <Badge className={`badge-status-${processo.status}`}>
                    {statusLabels[processo.status] || processo.status}
                  </Badge>
                  {!editando && (
                    <Button variant="outline" size="sm" onClick={handleIniciarEdicao}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
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

              {/* Edit Section */}
              {editando && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Editar Processo</h4>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleCancelarEdicao} disabled={salvando}>
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => setShowConfirmDialog(true)} disabled={salvando}>
                        <Save className="w-4 h-4 mr-1" />
                        {salvando ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={(v) => setEditStatus(v as StatusProcesso)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabels[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select value={editCliente} onValueChange={setEditCliente}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum cliente</SelectItem>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome} ({cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Coordenação Responsável</Label>
                      <Select value={editCoordenacao} onValueChange={(v) => {
                        setEditCoordenacao(v);
                        setEditAdvogado(""); // Reset advogado when coordination changes
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a coordenação" />
                        </SelectTrigger>
                        <SelectContent>
                          {coordenacoes.map((coord) => (
                            <SelectItem key={coord.id} value={coord.id}>
                              {coord.nome} ({areaLabels[coord.area] || coord.area})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Distribuir para Advogado</Label>
                      <Select 
                        value={editAdvogado} 
                        onValueChange={setEditAdvogado}
                        disabled={!editCoordenacao && !processo.coordenacao_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !editCoordenacao && !processo.coordenacao_id 
                              ? "Selecione coordenação primeiro" 
                              : "Selecione o advogado"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não atribuído</SelectItem>
                          {membrosCoordenacao.map((membro) => (
                            <SelectItem key={membro.usuario_id} value={membro.usuario_id}>
                              {membro.profiles?.nome || "Usuário"} {membro.cargo ? `(${membro.cargo})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
              
              {processo.cliente && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                  <p className="font-medium">{processo.cliente.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {processo.cliente.tipo === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                    {processo.cliente.cpf_cnpj && ` • ${processo.cliente.cpf_cnpj}`}
                  </p>
                </div>
              )}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja salvar as alterações realizadas no processo?
              {editStatus && editStatus !== processo?.status && (
                <span className="block mt-2">
                  • Status: <strong>{statusLabels[processo?.status || ""]}</strong> → <strong>{statusLabels[editStatus]}</strong>
                </span>
              )}
              {editCoordenacao !== (processo?.coordenacao_id || "") && (
                <span className="block mt-1">
                  • Coordenação alterada
                </span>
              )}
              {editAdvogado !== (processo?.advogado_responsavel_id || "") && (
                <span className="block mt-1">
                  • Advogado responsável alterado
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSalvarEdicao} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
