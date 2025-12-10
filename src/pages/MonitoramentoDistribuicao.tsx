import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitoramentoDistribuicao } from "@/hooks/useMonitoramentoDistribuicao";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Search, 
  Radar, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Play, 
  Download,
  Eye,
  Clock,
  Building2,
  User,
  FileText
} from "lucide-react";

const tipoLabels: Record<string, string> = {
  nome: "Nome",
  cpf_cnpj: "CPF/CNPJ",
  oab: "OAB",
  termo_chave: "Termo-chave",
};

const ufs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function MonitoramentoDistribuicao() {
  const {
    monitoramentos,
    distribuicoesEncontradas,
    pendentes,
    isLoading,
    loadingDistribuicoes,
    criarMonitoramento,
    atualizarMonitoramento,
    excluirMonitoramento,
    importarDistribuicao,
    ignorarDistribuicao,
    executarMonitoramento,
  } = useMonitoramentoDistribuicao();
  
  const { data: coordenacoes = [] } = useCoordenacoesFull();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<string>("");
  const [detailsDialog, setDetailsDialog] = useState<any>(null);

  // Form state
  const [tipo, setTipo] = useState<string>("nome");
  const [termoBusca, setTermoBusca] = useState("");
  const [uf, setUf] = useState<string>("");

  const handleCreate = async () => {
    if (!termoBusca.trim()) return;
    
    await criarMonitoramento.mutateAsync({
      tipo: tipo as any,
      termo_busca: termoBusca.trim(),
      uf: uf || null,
      tribunal: null,
    });
    
    setDialogOpen(false);
    setTipo("nome");
    setTermoBusca("");
    setUf("");
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    await atualizarMonitoramento.mutateAsync({ id, ativo });
  };

  const handleDelete = async () => {
    if (deleteId) {
      await excluirMonitoramento.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleImport = async () => {
    if (importDialog) {
      await importarDistribuicao.mutateAsync({ 
        distribuicaoId: importDialog, 
        coordenacaoId: selectedCoord || undefined 
      });
      setImportDialog(null);
      setSelectedCoord("");
    }
  };

  const handleIgnore = async (id: string) => {
    await ignorarDistribuicao.mutateAsync(id);
  };

  return (
    <MainLayout title="Monitoramento de Distribuição">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Radar className="w-7 h-7 text-primary" />
              Monitoramento de Distribuição
            </h1>
            <p className="text-muted-foreground mt-1">
              Rastreie novos processos antes da citação oficial
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => executarMonitoramento.mutate()}
              disabled={executarMonitoramento.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {executarMonitoramento.isPending ? "Executando..." : "Executar Agora"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Monitoramento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Monitoramento</DialogTitle>
                  <DialogDescription>
                    Configure um novo monitoramento de distribuição
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo de Busca</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nome">Nome</SelectItem>
                        <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                        <SelectItem value="oab">OAB</SelectItem>
                        <SelectItem value="termo_chave">Termo-chave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Termo de Busca</Label>
                    <Input 
                      placeholder={tipo === 'cpf_cnpj' ? "000.000.000-00" : tipo === 'oab' ? "OAB/SP 123456" : "Digite o termo..."}
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UF (opcional)</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os estados</SelectItem>
                        {ufs.map((estado) => (
                          <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={!termoBusca.trim() || criarMonitoramento.isPending}>
                    {criarMonitoramento.isPending ? "Criando..." : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Radar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monitoramentos.length}</p>
                  <p className="text-sm text-muted-foreground">Monitoramentos Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendentes.length}</p>
                  <p className="text-sm text-muted-foreground">Pendentes de Ação</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {distribuicoesEncontradas.filter(d => d.status === 'importado').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Importados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-full">
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {distribuicoesEncontradas.filter(d => d.status === 'ignorado').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Ignorados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="encontradas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="encontradas" className="relative">
              Distribuições Encontradas
              {pendentes.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                  {pendentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monitoramentos">Monitoramentos Configurados</TabsTrigger>
          </TabsList>

          <TabsContent value="encontradas">
            <Card>
              <CardHeader>
                <CardTitle>Distribuições Encontradas</CardTitle>
                <CardDescription>
                  Novos processos detectados que podem envolver seus clientes ou palavras-chave monitoradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDistribuicoes ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : distribuicoesEncontradas.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma distribuição encontrada ainda</p>
                    <p className="text-sm">Configure monitoramentos e execute a busca</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processo</TableHead>
                        <TableHead>Tribunal / Vara</TableHead>
                        <TableHead>Partes</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distribuicoesEncontradas.map((dist) => (
                        <TableRow key={dist.id}>
                          <TableCell className="font-mono text-sm">
                            {dist.numero_processo}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{dist.tribunal || "-"}</p>
                              <p className="text-muted-foreground">{dist.vara || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm max-w-[200px]">
                              <p className="truncate" title={dist.polo_ativo || ""}>
                                <span className="text-muted-foreground">A:</span> {dist.polo_ativo || "-"}
                              </p>
                              <p className="truncate" title={dist.polo_passivo || ""}>
                                <span className="text-muted-foreground">P:</span> {dist.polo_passivo || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {dist.data_distribuicao 
                              ? format(new Date(dist.data_distribuicao), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                dist.status === 'pendente' ? 'destructive' : 
                                dist.status === 'importado' ? 'default' : 'secondary'
                              }
                            >
                              {dist.status === 'pendente' ? 'Pendente' : 
                               dist.status === 'importado' ? 'Importado' : 'Ignorado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setDetailsDialog(dist)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {dist.status === 'pendente' && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => setImportDialog(dist.id)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => handleIgnore(dist.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
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

          <TabsContent value="monitoramentos">
            <Card>
              <CardHeader>
                <CardTitle>Monitoramentos Configurados</CardTitle>
                <CardDescription>
                  Termos e parâmetros sendo monitorados nos tribunais
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : monitoramentos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Radar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum monitoramento configurado</p>
                    <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Monitoramento
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Termo de Busca</TableHead>
                        <TableHead>UF</TableHead>
                        <TableHead>Última Execução</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monitoramentos.map((mon) => (
                        <TableRow key={mon.id}>
                          <TableCell>
                            <Badge variant="outline">{tipoLabels[mon.tipo]}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{mon.termo_busca}</TableCell>
                          <TableCell>{mon.uf || "Todos"}</TableCell>
                          <TableCell>
                            {mon.ultima_execucao 
                              ? format(new Date(mon.ultima_execucao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "Nunca executado"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={mon.ativo}
                                onCheckedChange={(checked) => handleToggleAtivo(mon.id, checked)}
                              />
                              <span className="text-sm text-muted-foreground">
                                {mon.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(mon.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir monitoramento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. As distribuições encontradas também serão excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Dialog */}
        <Dialog open={!!importDialog} onOpenChange={() => setImportDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar como Processo</DialogTitle>
              <DialogDescription>
                Este processo será criado no sistema e poderá ser distribuído para uma coordenação
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Coordenação (opcional)</Label>
              <Select value={selectedCoord} onValueChange={setSelectedCoord}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecionar coordenação..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {coordenacoes.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialog(null)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={importarDistribuicao.isPending}>
                {importarDistribuicao.isPending ? "Importando..." : "Importar Processo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={!!detailsDialog} onOpenChange={() => setDetailsDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Distribuição</DialogTitle>
            </DialogHeader>
            {detailsDialog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Número do Processo</Label>
                    <p className="font-mono mt-1">{detailsDialog.numero_processo}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data de Distribuição</Label>
                    <p className="mt-1">
                      {detailsDialog.data_distribuicao 
                        ? format(new Date(detailsDialog.data_distribuicao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Tribunal</Label>
                    <p className="mt-1">{detailsDialog.tribunal || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Vara</Label>
                    <p className="mt-1">{detailsDialog.vara || "-"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Classe</Label>
                  <p className="mt-1">{detailsDialog.classe || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assunto</Label>
                  <p className="mt-1">{detailsDialog.assunto || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Polo Ativo</Label>
                  <p className="mt-1">{detailsDialog.polo_ativo || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Polo Passivo</Label>
                  <p className="mt-1">{detailsDialog.polo_passivo || "-"}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
