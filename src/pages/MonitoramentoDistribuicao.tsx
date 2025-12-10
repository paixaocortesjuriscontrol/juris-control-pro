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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Pencil
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

const tribunais = [
  // Tribunais de Justiça Estaduais
  { value: "TJSP", label: "TJSP - São Paulo" },
  { value: "TJRJ", label: "TJRJ - Rio de Janeiro" },
  { value: "TJMG", label: "TJMG - Minas Gerais" },
  { value: "TJRS", label: "TJRS - Rio Grande do Sul" },
  { value: "TJPR", label: "TJPR - Paraná" },
  { value: "TJSC", label: "TJSC - Santa Catarina" },
  { value: "TJBA", label: "TJBA - Bahia" },
  { value: "TJPE", label: "TJPE - Pernambuco" },
  { value: "TJCE", label: "TJCE - Ceará" },
  { value: "TJGO", label: "TJGO - Goiás" },
  { value: "TJDFT", label: "TJDFT - DF e Territórios" },
  { value: "TJAL", label: "TJAL - Alagoas" },
  { value: "TJAM", label: "TJAM - Amazonas" },
  { value: "TJAP", label: "TJAP - Amapá" },
  { value: "TJES", label: "TJES - Espírito Santo" },
  { value: "TJMA", label: "TJMA - Maranhão" },
  { value: "TJMS", label: "TJMS - Mato Grosso do Sul" },
  { value: "TJMT", label: "TJMT - Mato Grosso" },
  { value: "TJPA", label: "TJPA - Pará" },
  { value: "TJPB", label: "TJPB - Paraíba" },
  { value: "TJPI", label: "TJPI - Piauí" },
  { value: "TJRN", label: "TJRN - Rio Grande do Norte" },
  { value: "TJRO", label: "TJRO - Rondônia" },
  { value: "TJRR", label: "TJRR - Roraima" },
  { value: "TJSE", label: "TJSE - Sergipe" },
  { value: "TJTO", label: "TJTO - Tocantins" },
  // Tribunais Regionais Federais
  { value: "TRF1", label: "TRF1 - 1ª Região (DF, GO, MT, TO, AC, AM, AP, BA, MA, MG, PA, PI, RO, RR)" },
  { value: "TRF2", label: "TRF2 - 2ª Região (RJ, ES)" },
  { value: "TRF3", label: "TRF3 - 3ª Região (SP, MS)" },
  { value: "TRF4", label: "TRF4 - 4ª Região (RS, PR, SC)" },
  { value: "TRF5", label: "TRF5 - 5ª Região (PE, CE, AL, PB, RN, SE)" },
  { value: "TRF6", label: "TRF6 - 6ª Região (MG)" },
  // Tribunais Regionais do Trabalho
  { value: "TRT1", label: "TRT1 - Rio de Janeiro" },
  { value: "TRT2", label: "TRT2 - São Paulo" },
  { value: "TRT3", label: "TRT3 - Minas Gerais" },
  { value: "TRT4", label: "TRT4 - Rio Grande do Sul" },
  { value: "TRT5", label: "TRT5 - Bahia" },
  { value: "TRT6", label: "TRT6 - Pernambuco" },
  { value: "TRT7", label: "TRT7 - Ceará" },
  { value: "TRT8", label: "TRT8 - Pará/Amapá" },
  { value: "TRT9", label: "TRT9 - Paraná" },
  { value: "TRT10", label: "TRT10 - DF/Tocantins" },
  { value: "TRT11", label: "TRT11 - Amazonas/Roraima" },
  { value: "TRT12", label: "TRT12 - Santa Catarina" },
  { value: "TRT13", label: "TRT13 - Paraíba" },
  { value: "TRT14", label: "TRT14 - Rondônia/Acre" },
  { value: "TRT15", label: "TRT15 - Campinas" },
  { value: "TRT16", label: "TRT16 - Maranhão" },
  { value: "TRT17", label: "TRT17 - Espírito Santo" },
  { value: "TRT18", label: "TRT18 - Goiás" },
  { value: "TRT19", label: "TRT19 - Alagoas" },
  { value: "TRT20", label: "TRT20 - Sergipe" },
  { value: "TRT21", label: "TRT21 - Rio Grande do Norte" },
  { value: "TRT22", label: "TRT22 - Piauí" },
  { value: "TRT23", label: "TRT23 - Mato Grosso" },
  { value: "TRT24", label: "TRT24 - Mato Grosso do Sul" },
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
  const [editingMonitoramento, setEditingMonitoramento] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<string>("");
  const [detailsDialog, setDetailsDialog] = useState<any>(null);

  // Form state
  const [tipo, setTipo] = useState<string>("nome");
  const [termoBusca, setTermoBusca] = useState("");
  const [uf, setUf] = useState<string>("");
  const [tribunaisSelecionados, setTribunaisSelecionados] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!termoBusca.trim()) return;
    
    if (editingMonitoramento) {
      await atualizarMonitoramento.mutateAsync({
        id: editingMonitoramento.id,
        tipo: tipo as any,
        termo_busca: termoBusca.trim(),
        uf: uf || null,
        tribunal: tribunaisSelecionados.length > 0 ? tribunaisSelecionados.join(',') : null,
      });
    } else {
      await criarMonitoramento.mutateAsync({
        tipo: tipo as any,
        termo_busca: termoBusca.trim(),
        uf: uf || null,
        tribunal: tribunaisSelecionados.length > 0 ? tribunaisSelecionados.join(',') : null,
      });
    }
    
    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMonitoramento(null);
    setTipo("nome");
    setTermoBusca("");
    setUf("");
    setTribunaisSelecionados([]);
  };

  const handleEdit = (mon: any) => {
    setEditingMonitoramento(mon);
    setTipo(mon.tipo);
    setTermoBusca(mon.termo_busca);
    setUf(mon.uf || "");
    setTribunaisSelecionados(mon.tribunal ? mon.tribunal.split(',') : []);
    setDialogOpen(true);
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
        coordenacaoId: selectedCoord && selectedCoord !== "none" ? selectedCoord : undefined 
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
            <Dialog open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : handleCloseDialog()}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Monitoramento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingMonitoramento ? "Editar Monitoramento" : "Criar Monitoramento"}</DialogTitle>
                  <DialogDescription>
                    {editingMonitoramento ? "Atualize os parâmetros do monitoramento" : "Configure um novo monitoramento de distribuição"}
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
                    <Select value={uf || "all"} onValueChange={(val) => setUf(val === "all" ? "" : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os estados</SelectItem>
                        {ufs.map((estado) => (
                          <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tribunais (opcional - selecione um ou mais)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                          {tribunaisSelecionados.length === 0 
                            ? "Todos os tribunais" 
                            : tribunaisSelecionados.length === 1 
                              ? tribunaisSelecionados[0]
                              : `${tribunaisSelecionados.length} tribunais selecionados`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-2 border-b flex justify-between items-center">
                          <span className="text-sm font-medium">Selecionar tribunais</span>
                          {tribunaisSelecionados.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setTribunaisSelecionados([])}
                              className="h-6 text-xs"
                            >
                              Limpar
                            </Button>
                          )}
                        </div>
                        <div className="p-2 border-b flex flex-wrap gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const tjs = tribunais.filter(t => t.value.startsWith('TJ')).map(t => t.value);
                              setTribunaisSelecionados(prev => {
                                const allSelected = tjs.every(tj => prev.includes(tj));
                                if (allSelected) {
                                  return prev.filter(t => !t.startsWith('TJ'));
                                }
                                return [...new Set([...prev, ...tjs])];
                              });
                            }}
                          >
                            Todos TJs
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const trfs = tribunais.filter(t => t.value.startsWith('TRF')).map(t => t.value);
                              setTribunaisSelecionados(prev => {
                                const allSelected = trfs.every(trf => prev.includes(trf));
                                if (allSelected) {
                                  return prev.filter(t => !t.startsWith('TRF'));
                                }
                                return [...new Set([...prev, ...trfs])];
                              });
                            }}
                          >
                            Todos TRFs
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const trts = tribunais.filter(t => t.value.startsWith('TRT')).map(t => t.value);
                              setTribunaisSelecionados(prev => {
                                const allSelected = trts.every(trt => prev.includes(trt));
                                if (allSelected) {
                                  return prev.filter(t => !t.startsWith('TRT'));
                                }
                                return [...new Set([...prev, ...trts])];
                              });
                            }}
                          >
                            Todos TRTs
                          </Button>
                        </div>
                        <ScrollArea className="h-[300px]">
                          <div className="p-2 space-y-1">
                            {tribunais.map((trib) => (
                              <div 
                                key={trib.value}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                                onClick={() => {
                                  setTribunaisSelecionados(prev => 
                                    prev.includes(trib.value)
                                      ? prev.filter(t => t !== trib.value)
                                      : [...prev, trib.value]
                                  );
                                }}
                              >
                                <Checkbox 
                                  checked={tribunaisSelecionados.includes(trib.value)}
                                  onCheckedChange={(checked) => {
                                    setTribunaisSelecionados(prev => 
                                      checked 
                                        ? [...prev, trib.value]
                                        : prev.filter(t => t !== trib.value)
                                    );
                                  }}
                                />
                                <span className="text-sm">{trib.label}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    {tribunaisSelecionados.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tribunaisSelecionados.map(t => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                            <button 
                              className="ml-1 hover:text-destructive"
                              onClick={() => setTribunaisSelecionados(prev => prev.filter(x => x !== t))}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={!termoBusca.trim() || criarMonitoramento.isPending || atualizarMonitoramento.isPending}>
                    {(criarMonitoramento.isPending || atualizarMonitoramento.isPending) 
                      ? (editingMonitoramento ? "Salvando..." : "Criando...") 
                      : (editingMonitoramento ? "Salvar" : "Criar")}
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
                        <TableHead>Tribunal</TableHead>
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
                          <TableCell>{mon.tribunal || "Todos"}</TableCell>
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
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(mon)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(mon.id)}
                              >
                                <Trash2 className="w-4 h-4" />
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
              <Select value={selectedCoord || "none"} onValueChange={(val) => setSelectedCoord(val === "none" ? "" : val)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecionar coordenação..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
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
