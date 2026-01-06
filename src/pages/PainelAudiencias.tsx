import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Search, CheckCircle, XCircle, AlertCircle, CalendarDays, FileText, Eye, Plus, User, Building, Upload, Download, Pencil, Settings, FileSpreadsheet, Users } from "lucide-react";
import { useAudienciasDetectadas, AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { useExportarAudiencias } from "@/hooks/useExportarAudiencias";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CadastroAudienciaForm } from "@/components/audiencias/CadastroAudienciaForm";
import { ImportarAudienciasDialog } from "@/components/audiencias/ImportarAudienciasDialog";
import { EditarAudienciaDialog } from "@/components/audiencias/EditarAudienciaDialog";
import { ConfigAlertasAudienciasTab } from "@/components/audiencias/ConfigAlertasAudienciasTab";
import { RelatorioAudienciasDiretoria } from "@/components/audiencias/RelatorioAudienciasDiretoria";
import { supabase } from "@/integrations/supabase/client";

export default function PainelAudiencias() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [coordenacaoFilter, setCoordenacaoFilter] = useState("todas");
  const [selectedAudiencia, setSelectedAudiencia] = useState<AudienciaDetectada | null>(null);
  const [editingAudiencia, setEditingAudiencia] = useState<AudienciaDetectada | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { exportarExcel } = useExportarAudiencias();

  // Buscar coordenações
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ['coordenacoes-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      return data || [];
    },
  });

  const { 
    audiencias, 
    isLoading, 
    atualizarAudiencia,
    pendentes,
    tratadas,
    ignoradas,
    proximas,
  } = useAudienciasDetectadas({ 
    status: statusFilter,
    search,
    coordenacaoId: coordenacaoFilter,
  });

  const handleMarcarTratado = async (id: string) => {
    await atualizarAudiencia.mutateAsync({ 
      id, 
      status: 'tratado',
      observacoes: observacoes || undefined,
    });
    setSelectedAudiencia(null);
    setObservacoes("");
  };

  const handleIgnorar = async (id: string) => {
    await atualizarAudiencia.mutateAsync({ 
      id, 
      status: 'ignorado',
      observacoes: observacoes || 'Ignorado pelo usuário',
    });
    setSelectedAudiencia(null);
    setObservacoes("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Data não identificada";
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
      case 'confirmado':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">✅ Confirmado</Badge>;
      case 'reagendado':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">🔄 Reagendado</Badge>;
      case 'tratado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">✔️ Tratado</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">❌ Cancelado</Badge>;
      case 'ignorado':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">🚫 Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (daysUntil: number | null) => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) {
      return <Badge variant="destructive">Passou</Badge>;
    }
    if (daysUntil === 0) {
      return <Badge variant="destructive">Hoje!</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge className="bg-orange-500">Em {daysUntil} dias</Badge>;
    }
    if (daysUntil <= 7) {
      return <Badge className="bg-yellow-500 text-yellow-950">Em {daysUntil} dias</Badge>;
    }
    return <Badge variant="secondary">Em {daysUntil} dias</Badge>;
  };

  const getOrigemBadge = (origem: string | null) => {
    if (origem === 'manual') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Manual</Badge>;
    }
    return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">Detectado</Badge>;
  };

  return (
    <MainLayout 
      title="Painel de Audiências" 
      subtitle="Controle de audiências detectadas e cadastradas manualmente"
    >
      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lista" className="gap-2">
            <Calendar className="h-4 w-4" />
            Lista de Audiências
          </TabsTrigger>
          <TabsTrigger value="cadastro" className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Audiência
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Relatório Diretoria
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
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

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Próximos 7 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  <span className="text-2xl font-bold">{proximas}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
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

            <Card>
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

          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por processo, cliente, advogado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={coordenacaoFilter} onValueChange={setCoordenacaoFilter}>
              <SelectTrigger className="w-full md:w-[220px]">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">⏳ Pendentes</SelectItem>
                <SelectItem value="confirmado">✅ Confirmados</SelectItem>
                <SelectItem value="reagendado">🔄 Reagendados</SelectItem>
                <SelectItem value="tratado">✔️ Tratados</SelectItem>
                <SelectItem value="cancelado">❌ Cancelados</SelectItem>
                <SelectItem value="ignorado">🚫 Ignorados</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => exportarExcel(audiencias)}
                disabled={audiencias.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Audiências List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : audiencias.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma audiência encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Cadastre audiências manualmente ou aguarde a detecção automática
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {audiencias.map((audiencia) => {
                const daysUntil = getDaysUntil(audiencia.data_audiencia);
                
                return (
                  <Card key={audiencia.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(audiencia.status)}
                            {getOrigemBadge(audiencia.origem)}
                            {audiencia.status === 'pendente' && getUrgencyBadge(daysUntil)}
                            {audiencia.tipo_audiencia && (
                              <Badge variant="secondary">{audiencia.tipo_audiencia}</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div className="flex items-center gap-1 text-primary">
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">{formatDate(audiencia.data_audiencia)}</span>
                              {audiencia.hora && (
                                <span className="text-muted-foreground">às {audiencia.hora}</span>
                              )}
                            </div>
                            
                            {audiencia.processo_numero && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{audiencia.processo_numero}</span>
                              </div>
                            )}
                            
                            {(audiencia.vara_camara || audiencia.comarca) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{[audiencia.vara_camara, audiencia.comarca].filter(Boolean).join(' - ')}</span>
                              </div>
                            )}
                          </div>

                          {/* Cliente e Polo Ativo */}
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            {audiencia.cliente && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Building className="h-4 w-4" />
                                <span className="truncate max-w-[250px]">{audiencia.cliente}</span>
                              </div>
                            )}
                            {audiencia.polo_ativo && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="truncate max-w-[200px]">{audiencia.polo_ativo}</span>
                              </div>
                            )}
                          </div>

                          {audiencia.resumo_objeto && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {audiencia.resumo_objeto}
                            </p>
                          )}

                          {audiencia.advogado && (
                            <p className="text-xs text-muted-foreground">
                              Advogado: <span className="font-medium">{audiencia.advogado}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAudiencia(audiencia)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAudiencia(audiencia);
                              setObservacoes(audiencia.observacoes || "");
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                          
                          {audiencia.status === 'pendente' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleMarcarTratado(audiencia.id)}
                                disabled={atualizarAudiencia.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Tratado
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleIgnorar(audiencia.id)}
                                disabled={atualizarAudiencia.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
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
          <CadastroAudienciaForm />
        </TabsContent>

        <TabsContent value="relatorio">
          <RelatorioAudienciasDiretoria />
        </TabsContent>

        <TabsContent value="configuracoes">
          <ConfigAlertasAudienciasTab />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAudiencia} onOpenChange={() => setSelectedAudiencia(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Detalhes da Audiência
            </DialogTitle>
          </DialogHeader>

          {selectedAudiencia && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data</label>
                  <p className="font-medium">
                    {formatDate(selectedAudiencia.data_audiencia)}
                    {selectedAudiencia.hora && ` às ${selectedAudiencia.hora}`}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedAudiencia.status)}
                    {getOrigemBadge(selectedAudiencia.origem)}
                  </div>
                </div>
                {selectedAudiencia.tipo_audiencia && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <p>{selectedAudiencia.tipo_audiencia}</p>
                  </div>
                )}
                {selectedAudiencia.processo_numero && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Processo</label>
                    <p className="font-mono text-sm">{selectedAudiencia.processo_numero}</p>
                  </div>
                )}
                {selectedAudiencia.vara_camara && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">VT / Câmara</label>
                    <p>{selectedAudiencia.vara_camara}</p>
                  </div>
                )}
                {selectedAudiencia.comarca && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Comarca</label>
                    <p>{selectedAudiencia.comarca}</p>
                  </div>
                )}
              </div>

              {/* Partes */}
              {(selectedAudiencia.polo_ativo || selectedAudiencia.cliente) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedAudiencia.polo_ativo && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Polo Ativo</label>
                      <p>{selectedAudiencia.polo_ativo}</p>
                    </div>
                  )}
                  {selectedAudiencia.cliente && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                      <p>{selectedAudiencia.cliente}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedAudiencia.terceirizado && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Terceirizado</label>
                  <p>{selectedAudiencia.terceirizado}</p>
                </div>
              )}

              {selectedAudiencia.resumo_objeto && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resumo do Objeto</label>
                  <p className="text-sm p-3 bg-muted rounded-md mt-1">{selectedAudiencia.resumo_objeto}</p>
                </div>
              )}

              {selectedAudiencia.funcao && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Função do Reclamante</label>
                  <p>{selectedAudiencia.funcao}</p>
                </div>
              )}

              {/* Participantes */}
              <div className="grid gap-4 md:grid-cols-3">
                {selectedAudiencia.preposto && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Preposto</label>
                    <p className="text-sm">{selectedAudiencia.preposto}</p>
                  </div>
                )}
                {selectedAudiencia.testemunhas && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Testemunhas</label>
                    <p className="text-sm">{selectedAudiencia.testemunhas}</p>
                  </div>
                )}
                {selectedAudiencia.advogado && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Advogado</label>
                    <p className="text-sm">{selectedAudiencia.advogado}</p>
                  </div>
                )}
              </div>

              {selectedAudiencia.contexto && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contexto Detectado</label>
                  <p className="text-sm p-3 bg-muted rounded-md mt-1">{selectedAudiencia.contexto}</p>
                </div>
              )}

              {selectedAudiencia.conteudo_publicacao && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Conteúdo da Publicação</label>
                  <div className="text-sm p-3 bg-muted rounded-md mt-1 max-h-48 overflow-y-auto">
                    {selectedAudiencia.conteudo_publicacao}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Observações</label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Adicione observações..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedAudiencia?.status === 'pendente' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleIgnorar(selectedAudiencia.id)}
                  disabled={atualizarAudiencia.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Ignorar
                </Button>
                <Button
                  onClick={() => handleMarcarTratado(selectedAudiencia.id)}
                  disabled={atualizarAudiencia.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Marcar como Tratado
                </Button>
              </>
            )}
            {selectedAudiencia?.status !== 'pendente' && (
              <Button
                variant="outline"
                onClick={() => atualizarAudiencia.mutateAsync({ 
                  id: selectedAudiencia!.id, 
                  status: 'pendente',
                  observacoes,
                })}
                disabled={atualizarAudiencia.isPending}
              >
                Reabrir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportarAudienciasDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      {/* Edit Dialog */}
      <EditarAudienciaDialog
        audiencia={editingAudiencia}
        open={!!editingAudiencia}
        onOpenChange={(open) => !open && setEditingAudiencia(null)}
      />
    </MainLayout>
  );
}