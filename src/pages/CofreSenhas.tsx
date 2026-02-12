import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  KeyRound, 
  Plus, 
  Radio, 
  Shield, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  History,
  Play,
  Loader2,
  RefreshCw,
  TestTube,
  Zap,
  Calendar,
  Pause
} from "lucide-react";
import { useCofreSenhas, CapturaIntimacao } from "@/hooks/useCofreSenhas";
import { CredencialDialog } from "@/components/cofre/CredencialDialog";
import { CapturaDialog } from "@/components/cofre/CapturaDialog";
import { HistoricoCapturaDialog } from "@/components/cofre/HistoricoCapturaDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CofreSenhasProps {
  embedded?: boolean;
}

export default function CofreSenhas({ embedded = false }: CofreSenhasProps) {
  const {
    credenciais,
    capturas,
    loadingCredenciais,
    loadingCapturas,
    criarCredencial,
    atualizarCredencial,
    excluirCredencial,
    criarCaptura,
    atualizarCaptura,
    excluirCaptura,
    buscarHistorico,
  } = useCofreSenhas();

  const [credencialDialogOpen, setCredencialDialogOpen] = useState(false);
  const [credencialSelecionada, setCredencialSelecionada] = useState<any>(null);
  const [capturaDialogOpen, setCapturaDialogOpen] = useState(false);
  const [capturaSelecionada, setCapturaSelecionada] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "credencial" | "captura"; id: string } | null>(null);
  const [executingCaptura, setExecutingCaptura] = useState(false);
  const [capturaResult, setCapturaResult] = useState<any>(null);
  
  // Estados para teste de conexão
  const [testingCredencial, setTestingCredencial] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  
  // Estado para histórico
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [capturaHistorico, setCapturaHistorico] = useState<CapturaIntimacao | null>(null);

  const handleSaveCredencial = async (dados: any) => {
    if (credencialSelecionada) {
      await atualizarCredencial.mutateAsync({ id: credencialSelecionada.id, ...dados });
    } else {
      await criarCredencial.mutateAsync(dados);
    }
    setCredencialDialogOpen(false);
    setCredencialSelecionada(null);
  };

  const handleSaveCaptura = async (dados: any) => {
    if (capturaSelecionada) {
      await atualizarCaptura.mutateAsync({ id: capturaSelecionada.id, ...dados });
    } else {
      await criarCaptura.mutateAsync(dados);
    }
    setCapturaDialogOpen(false);
    setCapturaSelecionada(null);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "credencial") {
      await excluirCredencial.mutateAsync(itemToDelete.id);
    } else {
      await excluirCaptura.mutateAsync(itemToDelete.id);
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  // Testar conexão com o tribunal via Browserless
  const handleTestarConexao = async (credencialId: string) => {
    setTestingCredencial(credencialId);
    setTestResult(null);
    setTestDialogOpen(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("capturar-processo-tribunal", {
        body: { 
          cofre_senha_id: credencialId,
          capturar_intimacoes: false,
          capturar_processos: false
        },
      });

      if (error) throw error;
      setTestResult(data);
      
      if (data.success) {
        toast.success("Teste de conexão realizado!");
      }
    } catch (err: any) {
      console.error("Erro no teste:", err);
      setTestResult({ 
        success: false, 
        error: err.message || "Erro ao testar conexão" 
      });
      toast.error("Erro no teste: " + err.message);
    } finally {
      setTestingCredencial(null);
    }
  };

  const handleExecutarCaptura = async (capturaId?: string) => {
    setExecutingCaptura(true);
    setCapturaResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("capturar-intimacoes", {
        body: capturaId ? { capturaId, forceAll: true } : { forceAll: true },
      });

      if (error) throw error;

      setCapturaResult(data);
      
      if (data.success) {
        toast.success(`Captura finalizada: ${data.sucessos} sucesso(s), ${data.falhas} falha(s)`);
      } else {
        toast.error("Erro na captura: " + data.error);
      }
    } catch (err: any) {
      console.error("Erro ao executar captura:", err);
      toast.error("Erro ao executar captura: " + err.message);
    } finally {
      setExecutingCaptura(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valido":
      case "ativo":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Ativo</Badge>;
      case "invalido":
      case "erro_credencial":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro Credencial</Badge>;
      case "erro_captura":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Erro Captura</Badge>;
      case "pendente":
      case "aguardando_cadastro":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
      case "suspenso":
        return <Badge variant="outline"><Pause className="h-3 w-3 mr-1" />Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getModoCapturaBadge = (captura: any) => {
    const modo = captura.modo_captura || "agendado";
    switch (modo) {
      case "agendado":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {captura.horarios_execucao?.length || 0}x/dia
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Horários: {captura.horarios_execucao?.join(", ") || "-"}</p>
                <p>Dias: {formatDiasSemana(captura.dias_semana)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "intervalo":
        return (
          <Badge variant="outline" className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            {formatIntervalo(captura.intervalo_minutos)}
          </Badge>
        );
      case "manual":
        return (
          <Badge variant="secondary" className="text-xs">
            <Play className="h-3 w-3 mr-1" />
            Manual
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDiasSemana = (dias: number[] | null) => {
    if (!dias || dias.length === 0) return "-";
    const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return dias.map(d => nomes[d]).join(", ");
  };

  const formatIntervalo = (minutos: number | null) => {
    if (!minutos) return "-";
    if (minutos < 60) return `${minutos}min`;
    if (minutos === 60) return "1h";
    if (minutos < 1440) return `${minutos / 60}h`;
    return `${minutos / 1440}d`;
  };

  const handleOpenHistorico = (captura: CapturaIntimacao) => {
    setCapturaHistorico(captura);
    setHistoricoDialogOpen(true);
  };

  const content = (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cofre de Senhas</h1>
              <p className="text-muted-foreground">
                Gerencie suas credenciais para captura automática de intimações
              </p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">Suas credenciais estão protegidas</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  O Cofre de Senhas armazena suas credenciais de forma segura para acessar automaticamente 
                  os portais dos tribunais e capturar intimações eletrônicas. As senhas são criptografadas 
                  e nunca são exibidas após o cadastro.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="credenciais">
          <TabsList>
            <TabsTrigger value="credenciais" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Credenciais ({credenciais.length})
            </TabsTrigger>
            <TabsTrigger value="capturas" className="gap-2">
              <Radio className="h-4 w-4" />
              Capturas ({capturas.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Credenciais */}
          <TabsContent value="credenciais" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setCredencialSelecionada(null); setCredencialDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Credencial
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Credenciais Cadastradas</CardTitle>
                <CardDescription>
                  Credenciais de acesso aos portais dos tribunais
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCredenciais ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : credenciais.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <KeyRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma credencial cadastrada</p>
                    <p className="text-sm">Adicione sua primeira credencial para começar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Sistema</TableHead>
                        <TableHead>Tribunal</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Certificado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credenciais.map((cred) => (
                        <TableRow key={cred.id}>
                          <TableCell className="font-medium">{cred.nome}</TableCell>
                          <TableCell>{cred.sistema}</TableCell>
                          <TableCell>{cred.tribunal}</TableCell>
                          <TableCell className="font-mono text-sm">{cred.login}</TableCell>
                          <TableCell>{getStatusBadge(cred.status_validacao)}</TableCell>
                          <TableCell>
                            {cred.certificado_a1_path ? (
                              <Badge variant="outline" className="text-green-600">A1</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Verificar se o portal está acessível"
                                onClick={() => handleTestarConexao(cred.id)}
                                disabled={testingCredencial === cred.id}
                              >
                                {testingCredencial === cred.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Zap className="h-4 w-4 text-amber-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar"
                                onClick={() => { setCredencialSelecionada(cred); setCredencialDialogOpen(true); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                title="Excluir"
                                onClick={() => { setItemToDelete({ type: "credencial", id: cred.id }); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Capturas */}
          <TabsContent value="capturas" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handleExecutarCaptura()}
                  disabled={executingCaptura || capturas.length === 0}
                >
                  {executingCaptura ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Executar Todas as Capturas
                </Button>
              </div>
              <Button 
                onClick={() => { setCapturaSelecionada(null); setCapturaDialogOpen(true); }}
                disabled={credenciais.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Configurar Captura
              </Button>
            </div>

            {/* Resultado da última captura */}
            {capturaResult && (
              <Card className={capturaResult.success ? "border-green-200 bg-green-50 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:bg-red-950/30"}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {capturaResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {capturaResult.success ? "Captura executada" : "Erro na captura"}
                      </p>
                      {capturaResult.success ? (
                        <p className="text-sm text-muted-foreground">
                          Processadas: {capturaResult.processed} | Sucessos: {capturaResult.sucessos} | Falhas: {capturaResult.falhas}
                        </p>
                      ) : (
                        <p className="text-sm text-red-600">{capturaResult.error}</p>
                      )}
                      {capturaResult.results?.some((r: any) => r.erro) && (
                        <div className="mt-2 text-xs">
                          {capturaResult.results.filter((r: any) => r.erro).map((r: any, i: number) => (
                            <p key={i} className="text-red-600">• {r.erro}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCapturaResult(null)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Capturas Configuradas</CardTitle>
                <CardDescription>
                  Capturas automáticas de intimações por OAB e tribunal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCapturas ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : capturas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Radio className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma captura configurada</p>
                    <p className="text-sm">
                      {credenciais.length === 0 
                        ? "Cadastre uma credencial primeiro" 
                        : "Configure sua primeira captura de intimações"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OAB</TableHead>
                        <TableHead>Justiça / Órgão</TableHead>
                        <TableHead>Credencial</TableHead>
                        <TableHead>Agendamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Execução</TableHead>
                        <TableHead className="text-center">Capturadas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capturas.map((cap) => (
                        <TableRow key={cap.id} className={!cap.ativo ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="font-mono font-medium">{cap.oab_numero}/{cap.oab_uf}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{cap.justica}</span>
                              <span className="text-muted-foreground"> · {cap.orgao}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{cap.instancia}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{cap.cofre_senha?.nome || "-"}</div>
                            <div className="text-xs text-muted-foreground">{cap.cofre_senha?.sistema}</div>
                          </TableCell>
                          <TableCell>
                            {getModoCapturaBadge(cap)}
                          </TableCell>
                          <TableCell>{getStatusBadge(cap.status)}</TableCell>
                          <TableCell className="text-sm">
                            {cap.ultima_captura 
                              ? format(new Date(cap.ultima_captura), "dd/MM/yy HH:mm", { locale: ptBR })
                              : <span className="text-muted-foreground">Nunca</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono text-lg font-bold text-primary">
                              {cap.total_intimacoes_capturadas}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Executar captura"
                                onClick={() => handleExecutarCaptura(cap.id)}
                                disabled={executingCaptura || !cap.ativo}
                              >
                                {executingCaptura ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Histórico"
                                onClick={() => handleOpenHistorico(cap)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar"
                                onClick={() => { setCapturaSelecionada(cap); setCapturaDialogOpen(true); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                title="Excluir"
                                onClick={() => { setItemToDelete({ type: "captura", id: cap.id }); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CredencialDialog
        open={credencialDialogOpen}
        onOpenChange={setCredencialDialogOpen}
        credencial={credencialSelecionada}
        onSave={handleSaveCredencial}
        saving={criarCredencial.isPending || atualizarCredencial.isPending}
      />

      <CapturaDialog
        open={capturaDialogOpen}
        onOpenChange={setCapturaDialogOpen}
        captura={capturaSelecionada}
        credenciais={credenciais}
        onSave={handleSaveCaptura}
        saving={criarCaptura.isPending || atualizarCaptura.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "credencial" 
                ? "Ao excluir esta credencial, todas as capturas vinculadas também serão removidas. Esta ação não pode ser desfeita."
                : "Tem certeza que deseja excluir esta captura? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Teste de Conexão */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Verificação do Portal do Tribunal
            </DialogTitle>
            <DialogDescription>
              Verifica apenas se o portal do tribunal está acessível. Não valida login/senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {testingCredencial && !testResult && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">Verificando portal do tribunal...</p>
                </div>
              </div>
            )}

            {testResult && (
              <div className="space-y-4">
                {/* Status */}
                <div className={`p-4 rounded-lg border ${
                  testResult.success 
                    ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900" 
                    : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                }`}>
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {testResult.success ? "Portal acessível" : "Portal indisponível"}
                      </p>
                      {testResult.success && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ Isso confirma apenas que o site do tribunal está no ar. A validação do login/senha não é realizada.
                        </p>
                      )}
                      {testResult.error && (
                        <p className="text-sm text-red-600 mt-1">{testResult.error}</p>
                      )}
                      {testResult.mensagem && (
                        <p className="text-sm text-muted-foreground mt-1">{testResult.mensagem}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalhes do resultado */}
                {testResult.sistema && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Sistema</p>
                      <p className="font-medium uppercase">{testResult.sistema}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Tribunal</p>
                      <p className="font-medium">{testResult.tribunal || "-"}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Processos Capturados</p>
                      <p className="font-medium">{testResult.processosCapturados || 0}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Intimações Capturadas</p>
                      <p className="font-medium">{testResult.intimacoesCapturadas || 0}</p>
                    </div>
                  </div>
                )}

                {/* Logs se houver */}
                {testResult.logs && testResult.logs.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Logs</p>
                    <ScrollArea className="h-32 rounded border bg-muted/30 p-2">
                      {testResult.logs.map((log: string, i: number) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">{log}</p>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico de Capturas */}
      <HistoricoCapturaDialog
        open={historicoDialogOpen}
        onOpenChange={setHistoricoDialogOpen}
        captura={capturaHistorico}
        buscarHistorico={buscarHistorico}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <MainLayout title="Cofre de Senhas" subtitle="Captura automática de intimações eletrônicas">
      {content}
    </MainLayout>
  );
}
