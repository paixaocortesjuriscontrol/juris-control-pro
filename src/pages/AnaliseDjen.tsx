import { useState } from "react";
import {
  FileText,
  Filter,
  Eye,
  Import,
  Sparkles,
  CheckCircle,
  Loader2,
  Search,
  Calendar,
  Trash2,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAnaliseDjen, PublicacaoAnalise } from "@/hooks/useAnaliseDjen";
import { useDescartadasDjen, PublicacaoDescartada } from "@/hooks/useDescartadasDjen";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";

const AnaliseDjen = () => {
  // Filtros
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [monitoramentoId, setMonitoramentoId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);
  const [activeTab, setActiveTab] = useState("publicacoes");
  
  // States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDescartadasIds, setSelectedDescartadasIds] = useState<Set<string>>(new Set());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoAnalise | null>(null);
  const [viewDescartadaDialogOpen, setViewDescartadaDialogOpen] = useState(false);
  const [selectedDescartada, setSelectedDescartada] = useState<PublicacaoDescartada | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCoordenacaoId, setImportCoordenacaoId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const { publicacoes, isLoading, ultimoResumo, loadingResumo, gerarResumoIA, marcarComoLida } = useAnaliseDjen({
    coordenacaoId: coordenacaoId || undefined,
    monitoramentoId: monitoramentoId || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    termoBusca: termoBusca || undefined,
    apenasNaoLidas,
  });

  const { descartadas, isLoading: loadingDescartadas, importarDescartada, descartarDefinitivamente } = useDescartadasDjen({
    coordenacaoId: coordenacaoId || undefined,
    monitoramentoId: monitoramentoId || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    termoBusca: termoBusca || undefined,
  });

  const { data: coordenacoes } = useCoordenacoes();
  
  const { monitoramentos: todosMonitoramentos } = useMonitoramentosDjen();
  
  const monitoramentos = coordenacaoId 
    ? todosMonitoramentos?.filter(m => m.coordenacao_id === coordenacaoId)
    : todosMonitoramentos;

  const monitoramentoSelecionado = monitoramentos?.find(m => m.id === monitoramentoId);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === publicacoes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(publicacoes.map(p => p.id)));
    }
  };

  const toggleSelectDescartada = (id: string) => {
    const newSelected = new Set(selectedDescartadasIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDescartadasIds(newSelected);
  };

  const toggleSelectAllDescartadas = () => {
    if (selectedDescartadasIds.size === descartadas.length) {
      setSelectedDescartadasIds(new Set());
    } else {
      setSelectedDescartadasIds(new Set(descartadas.map(d => d.id)));
    }
  };

  const handleView = (pub: PublicacaoAnalise) => {
    setSelectedPublicacao(pub);
    setViewDialogOpen(true);
  };

  const handleViewDescartada = (pub: PublicacaoDescartada) => {
    setSelectedDescartada(pub);
    setViewDescartadaDialogOpen(true);
  };

  const handleGerarResumo = async () => {
    if (!monitoramentoId) {
      toast.error("Selecione um monitoramento para gerar o resumo");
      return;
    }
    await gerarResumoIA.mutateAsync(monitoramentoId);
  };

  const handleMarcarLidas = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    await marcarComoLida.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleOpenImportDialog = () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação para importar");
      return;
    }
    setImportCoordenacaoId("");
    setImportDialogOpen(true);
  };

  const handleImportarDescartadas = async () => {
    if (selectedDescartadasIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    
    for (const id of selectedDescartadasIds) {
      await importarDescartada.mutateAsync(id);
    }
    setSelectedDescartadasIds(new Set());
  };

  const handleDescartarDefinitivamente = async () => {
    if (selectedDescartadasIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    await descartarDefinitivamente.mutateAsync(Array.from(selectedDescartadasIds));
    setSelectedDescartadasIds(new Set());
  };

  const extractProcessNumbers = (text: string): string[] => {
    const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
    const matches = text.match(cnjRegex) || [];
    return [...new Set(matches)];
  };

  const handleImportSelected = async () => {
    if (!importCoordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }

    setImporting(true);

    try {
      const selectedPubs = publicacoes.filter(p => selectedIds.has(p.id));
      let imported = 0;
      let movimentacoesAdded = 0;
      let errors = 0;

      for (const pub of selectedPubs) {
        try {
          let processNumbers: string[] = [];
          
          if (pub.processo_numero) {
            processNumbers = [pub.processo_numero];
          } else if (pub.conteudo) {
            processNumbers = extractProcessNumbers(pub.conteudo);
          }

          if (processNumbers.length === 0) {
            errors++;
            continue;
          }

          for (const numero of processNumbers) {
            const { data: existingProcess } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", numero)
              .maybeSingle();

            if (existingProcess) {
              await supabase
                .from("movimentacoes")
                .insert({
                  processo_id: existingProcess.id,
                  descricao: `Intimação DJEN: ${pub.conteudo?.substring(0, 500) || ""}`,
                  tipo: "intimacao",
                  fonte: "DJEN",
                  data_movimentacao: pub.data_publicacao || new Date().toISOString(),
                });
              movimentacoesAdded++;
            } else {
              const { data: newProcess, error: createError } = await supabase
                .from("processos")
                .insert({
                  numero,
                  area: "civil",
                  status: "ativo",
                  tribunal: pub.fonte || "Não identificado",
                  assunto: pub.conteudo?.substring(0, 200) || "Publicação DJEN",
                  polo_ativo: "A identificar",
                  coordenacao_id: importCoordenacaoId,
                })
                .select("id")
                .single();

              if (!createError && newProcess) {
                await supabase
                  .from("movimentacoes")
                  .insert({
                    processo_id: newProcess.id,
                    descricao: `Intimação DJEN: ${pub.conteudo?.substring(0, 500) || ""}`,
                    tipo: "intimacao",
                    fonte: "DJEN",
                    data_movimentacao: pub.data_publicacao || new Date().toISOString(),
                  });
                imported++;
              } else {
                errors++;
              }
            }
          }

          await supabase
            .from('publicacoes_djen')
            .update({ lida: true })
            .eq('id', pub.id);

        } catch (e) {
          errors++;
        }
      }

      let msg = "";
      if (imported > 0) msg += `${imported} processo(s) criado(s). `;
      if (movimentacoesAdded > 0) msg += `${movimentacoesAdded} intimação(ões) adicionada(s). `;
      if (errors > 0) msg += `${errors} sem número de processo.`;
      
      if (imported > 0 || movimentacoesAdded > 0) {
        toast.success(msg);
      } else {
        toast.warning(msg || "Nenhuma publicação importada");
      }

      setImportDialogOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getMonitoramentoLabel = () => {
    if (!monitoramentoSelecionado) return "";
    return monitoramentoSelecionado.tipo === 'advogado' 
      ? `OAB ${monitoramentoSelecionado.oab || ''} ${monitoramentoSelecionado.uf || ''}`
      : monitoramentoSelecionado.termo_busca;
  };

  return (
    <MainLayout title="Análise DJEN" subtitle="Resultados dos monitoramentos com análise de IA">
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Coordenação</Label>
                <Select 
                  value={coordenacaoId || "__all__"} 
                  onValueChange={(val) => {
                    setCoordenacaoId(val === "__all__" ? "" : val);
                    setMonitoramentoId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione primeiro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {coordenacoes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monitoramento</Label>
                <div className="flex gap-2">
                  <Select 
                    value={monitoramentoId || "__all__"} 
                    onValueChange={(val) => setMonitoramentoId(val === "__all__" ? "" : val)}
                    disabled={!coordenacaoId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={coordenacaoId ? "Todos" : "Selecione coordenação"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {monitoramentos?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.tipo === 'advogado' 
                            ? `OAB ${m.oab || ''} ${m.uf || ''}`
                            : m.termo_busca
                          }
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {monitoramentoSelecionado && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditDialogOpen(true)}
                      title="Editar monitoramento"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Termo, processo..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Checkbox 
                id="naoLidas"
                checked={apenasNaoLidas}
                onCheckedChange={(checked) => setApenasNaoLidas(checked as boolean)}
              />
              <Label htmlFor="naoLidas" className="cursor-pointer">
                Apenas não lidas
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Resumo IA */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                <Sparkles className="w-5 h-5" />
                Resumo IA {monitoramentoId && `- ${getMonitoramentoLabel()}`}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGerarResumo}
                disabled={!monitoramentoId || gerarResumoIA.isPending || publicacoes.length === 0}
                className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300"
              >
                {gerarResumoIA.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {ultimoResumo ? "Atualizar Resumo" : "Gerar Resumo"}
              </Button>
            </div>
            {ultimoResumo && (
              <CardDescription className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Gerado em: {formatDate(ultimoResumo.data_busca)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!monitoramentoId ? (
              <div className="text-center py-6 text-green-600 dark:text-green-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Selecione uma coordenação e um monitoramento para gerar o resumo de IA.</p>
              </div>
            ) : loadingResumo ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              </div>
            ) : ultimoResumo ? (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-green-800 dark:prose-headings:text-green-200">
                <div className="whitespace-pre-wrap text-green-700 dark:text-green-300">
                  {ultimoResumo.resumo}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-green-600 dark:text-green-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum resumo gerado ainda para este monitoramento.</p>
                <p className="text-sm mt-1">
                  Clique em "Gerar Resumo" para analisar as {publicacoes.length} publicação(ões) com IA.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Publicacoes and Descartadas */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="publicacoes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Publicações ({publicacoes.length})
            </TabsTrigger>
            <TabsTrigger value="descartadas" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Descartadas ({descartadas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="publicacoes" className="space-y-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={publicacoes.length === 0}
              >
                {selectedIds.size === publicacoes.length && publicacoes.length > 0
                  ? "Desmarcar Todos"
                  : "Selecionar Todos"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleMarcarLidas}
                disabled={selectedIds.size === 0 || marcarComoLida.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Marcar como Lida
              </Button>

              <Button
                size="sm"
                onClick={handleOpenImportDialog}
                disabled={selectedIds.size === 0}
              >
                <Import className="w-4 h-4 mr-2" />
                Importar ({selectedIds.size})
              </Button>
            </div>

            {/* Results */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Publicações ({publicacoes.length})
                </CardTitle>
                <CardDescription>
                  Resultados dos monitoramentos DJEN configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : publicacoes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma publicação encontrada</p>
                    <p className="text-sm mt-1">
                      Configure monitoramentos DJEN em "Buscar DJEN" para receber publicações
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publicacoes.map((pub) => (
                      <div
                        key={pub.id}
                        className={cn(
                          "border rounded-lg p-4 transition-colors",
                          selectedIds.has(pub.id) && "bg-primary/5 border-primary/30",
                          !pub.lida && "border-l-4 border-l-primary"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(pub.id)}
                            onCheckedChange={() => toggleSelect(pub.id)}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                {pub.monitoramento?.tipo === 'advogado' 
                                  ? `OAB ${pub.monitoramento?.oab || ''} ${pub.monitoramento?.uf || ''}`
                                  : pub.monitoramento?.tipo === 'processo'
                                    ? `Processo: ${pub.monitoramento?.termo_busca}`
                                    : pub.monitoramento?.termo_busca || "Monitoramento"
                                }
                              </Badge>
                              {pub.monitoramento?.coordenacao?.nome && (
                                <Badge variant="outline">
                                  {pub.monitoramento.coordenacao.nome}
                                </Badge>
                              )}
                              {!pub.lida && (
                                <Badge variant="default" className="bg-primary">
                                  Nova
                                </Badge>
                              )}
                            </div>

                            {pub.processo_numero && (
                              <p className="text-sm font-medium text-primary mb-1">
                                Processo: {pub.processo_numero}
                              </p>
                            )}

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {pub.conteudo?.substring(0, 200) || "Sem conteúdo"}...
                            </p>

                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              <span>
                                <strong className="text-foreground">Diário:</strong> {pub.data_publicacao ? formatDate(pub.data_publicacao) : "Não informado"}
                              </span>
                              <span>
                                <strong className="text-foreground">Capturado:</strong> {formatDate(pub.created_at)}
                              </span>
                              {pub.fonte && <span><strong className="text-foreground">Fonte:</strong> {pub.fonte}</span>}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(pub)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="descartadas" className="space-y-4">
            {/* Actions for Descartadas */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAllDescartadas}
                disabled={descartadas.length === 0}
              >
                {selectedDescartadasIds.size === descartadas.length && descartadas.length > 0
                  ? "Desmarcar Todos"
                  : "Selecionar Todos"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleImportarDescartadas}
                disabled={selectedDescartadasIds.size === 0 || importarDescartada.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar ({selectedDescartadasIds.size})
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDescartarDefinitivamente}
                disabled={selectedDescartadasIds.size === 0 || descartarDefinitivamente.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Definitivamente
              </Button>
            </div>

            {/* Descartadas Results */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Publicações Descartadas ({descartadas.length})
                </CardTitle>
                <CardDescription>
                  Publicações excluídas pelos critérios de exclusão configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDescartadas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : descartadas.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma publicação descartada</p>
                    <p className="text-sm mt-1">
                      Publicações que contiverem os termos de exclusão aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {descartadas.map((pub) => (
                      <div
                        key={pub.id}
                        className={cn(
                          "border rounded-lg p-4 transition-colors border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800",
                          selectedDescartadasIds.has(pub.id) && "bg-orange-100 border-orange-400"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedDescartadasIds.has(pub.id)}
                            onCheckedChange={() => toggleSelectDescartada(pub.id)}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300">
                                Descartada: {pub.motivo_descarte}
                              </Badge>
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                {pub.monitoramento?.tipo === 'advogado' 
                                  ? `OAB ${pub.monitoramento?.oab || ''} ${pub.monitoramento?.uf || ''}`
                                  : pub.monitoramento?.termo_busca || "Monitoramento"
                                }
                              </Badge>
                              {pub.monitoramento?.coordenacao?.nome && (
                                <Badge variant="outline">
                                  {pub.monitoramento.coordenacao.nome}
                                </Badge>
                              )}
                            </div>

                            {pub.processo_numero && (
                              <p className="text-sm font-medium text-orange-700 mb-1">
                                Processo: {pub.processo_numero}
                              </p>
                            )}

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {pub.conteudo?.substring(0, 200) || "Sem conteúdo"}...
                            </p>

                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              <span>
                                <strong className="text-foreground">Capturado:</strong> {formatDate(pub.created_at)}
                              </span>
                              {pub.fonte && <span><strong className="text-foreground">Fonte:</strong> {pub.fonte}</span>}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDescartada(pub)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Publicação</DialogTitle>
              <DialogDescription>
                {selectedPublicacao?.processo_numero && (
                  <span className="font-medium">
                    Processo: {selectedPublicacao.processo_numero}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedPublicacao?.monitoramento?.coordenacao?.nome && (
                    <Badge variant="outline">
                      {selectedPublicacao.monitoramento.coordenacao.nome}
                    </Badge>
                  )}
                  {selectedPublicacao?.fonte && (
                    <Badge variant="secondary">{selectedPublicacao.fonte}</Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Conteúdo Original</h4>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedPublicacao?.conteudo || "Sem conteúdo"}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Capturado em: {formatDate(selectedPublicacao?.created_at || null)}</p>
                  {selectedPublicacao?.data_publicacao && (
                    <p>Data publicação: {formatDate(selectedPublicacao.data_publicacao)}</p>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Descartada Dialog */}
        <Dialog open={viewDescartadaDialogOpen} onOpenChange={setViewDescartadaDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Publicação Descartada</DialogTitle>
              <DialogDescription>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 mt-2">
                  Motivo: {selectedDescartada?.motivo_descarte}
                </Badge>
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedDescartada?.monitoramento?.coordenacao?.nome && (
                    <Badge variant="outline">
                      {selectedDescartada.monitoramento.coordenacao.nome}
                    </Badge>
                  )}
                  {selectedDescartada?.fonte && (
                    <Badge variant="secondary">{selectedDescartada.fonte}</Badge>
                  )}
                </div>

                {selectedDescartada?.processo_numero && (
                  <p className="text-sm font-medium text-orange-700">
                    Processo: {selectedDescartada.processo_numero}
                  </p>
                )}

                <div>
                  <h4 className="font-medium mb-2">Conteúdo Original</h4>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedDescartada?.conteudo || "Sem conteúdo"}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Capturado em: {formatDate(selectedDescartada?.created_at || null)}</p>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={async () => {
                  if (selectedDescartada) {
                    await importarDescartada.mutateAsync(selectedDescartada.id);
                    setViewDescartadaDialogOpen(false);
                  }
                }}
                disabled={importarDescartada.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar
              </Button>
              <Button variant="outline" onClick={() => setViewDescartadaDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Publicações</DialogTitle>
              <DialogDescription>
                {selectedIds.size} publicação(ões) selecionada(s). Selecione a coordenação para atribuir os processos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Coordenação</Label>
                <Select value={importCoordenacaoId} onValueChange={setImportCoordenacaoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordenacoes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImportSelected} 
                disabled={!importCoordenacaoId || importing}
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Importar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Monitoramento Dialog */}
        <MonitoramentoDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          monitoramento={monitoramentoSelecionado as MonitoramentoDjen | undefined}
        />
      </div>
    </MainLayout>
  );
};

export default AnaliseDjen;
