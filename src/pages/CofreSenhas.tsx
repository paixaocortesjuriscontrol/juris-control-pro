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
  History
} from "lucide-react";
import { useCofreSenhas } from "@/hooks/useCofreSenhas";
import { CredencialDialog } from "@/components/cofre/CredencialDialog";
import { CapturaDialog } from "@/components/cofre/CapturaDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export default function CofreSenhas() {
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
  } = useCofreSenhas();

  const [credencialDialogOpen, setCredencialDialogOpen] = useState(false);
  const [credencialSelecionada, setCredencialSelecionada] = useState<any>(null);
  const [capturaDialogOpen, setCapturaDialogOpen] = useState(false);
  const [capturaSelecionada, setCapturaSelecionada] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "credencial" | "captura"; id: string } | null>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valido":
      case "ativo":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Ativo</Badge>;
      case "invalido":
      case "erro_credencial":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro Credencial</Badge>;
      case "erro_captura":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Erro Captura</Badge>;
      case "pendente":
      case "aguardando_cadastro":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
      case "suspenso":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <MainLayout title="Cofre de Senhas" subtitle="Captura automática de intimações eletrônicas">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
                                onClick={() => { setCredencialSelecionada(cred); setCredencialDialogOpen(true); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
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
            <div className="flex justify-end">
              <Button 
                onClick={() => { setCapturaSelecionada(null); setCapturaDialogOpen(true); }}
                disabled={credenciais.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Configurar Captura
              </Button>
            </div>

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
                        <TableHead>Justiça</TableHead>
                        <TableHead>Órgão</TableHead>
                        <TableHead>Instância</TableHead>
                        <TableHead>Credencial</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Captura</TableHead>
                        <TableHead>Capturadas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capturas.map((cap) => (
                        <TableRow key={cap.id}>
                          <TableCell className="font-mono">
                            {cap.oab_numero}/{cap.oab_uf}
                          </TableCell>
                          <TableCell>{cap.justica}</TableCell>
                          <TableCell>{cap.orgao}</TableCell>
                          <TableCell>{cap.instancia}</TableCell>
                          <TableCell className="text-sm">
                            {cap.cofre_senha?.nome || "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(cap.status)}</TableCell>
                          <TableCell className="text-sm">
                            {cap.ultima_captura 
                              ? format(new Date(cap.ultima_captura), "dd/MM/yy HH:mm", { locale: ptBR })
                              : "-"
                            }
                          </TableCell>
                          <TableCell className="font-mono">
                            {cap.total_intimacoes_capturadas}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Histórico"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setCapturaSelecionada(cap); setCapturaDialogOpen(true); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
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
    </MainLayout>
  );
}
