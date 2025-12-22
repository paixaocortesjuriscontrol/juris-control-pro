import { useState } from "react";
import {
  FileText,
  Filter,
  Download,
  Eye,
  Import,
  Sparkles,
  CheckCircle,
  Loader2,
  Search,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAnaliseDjen, PublicacaoAnalise } from "@/hooks/useAnaliseDjen";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";

const AnaliseDjen = () => {
  // Filtros
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");
  const [monitoramentoId, setMonitoramentoId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);
  
  // States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<PublicacaoAnalise | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCoordenacaoId, setImportCoordenacaoId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  
  const { publicacoes, isLoading, gerarResumoIA, marcarComoLida } = useAnaliseDjen({
    coordenacaoId: coordenacaoId || undefined,
    monitoramentoId: monitoramentoId || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    termoBusca: termoBusca || undefined,
    apenasNaoLidas,
  });

  const { data: coordenacoes } = useCoordenacoes();
  
  // Buscar monitoramentos para o filtro
  const { monitoramentos: todosMonitoramentos } = useMonitoramentosDjen();
  
  // Filtrar monitoramentos pela coordenação selecionada
  const monitoramentos = coordenacaoId 
    ? todosMonitoramentos?.filter(m => m.coordenacao_id === coordenacaoId)
    : todosMonitoramentos;

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

  const handleView = (pub: PublicacaoAnalise) => {
    setSelectedPublicacao(pub);
    setViewDialogOpen(true);
  };

  const handleGerarResumo = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação");
      return;
    }
    await gerarResumoIA.mutateAsync(Array.from(selectedIds));
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

  // Extract CNJ process numbers from text
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

          // Marcar como lida
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
                    setMonitoramentoId(""); // Limpar monitoramento ao mudar coordenação
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
                <Select 
                  value={monitoramentoId || "__all__"} 
                  onValueChange={(val) => setMonitoramentoId(val === "__all__" ? "" : val)}
                  disabled={!coordenacaoId}
                >
                  <SelectTrigger>
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
            onClick={handleGerarResumo}
            disabled={selectedIds.size === 0 || gerarResumoIA.isPending}
          >
            {gerarResumoIA.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Gerar Resumo IA
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
                          {/* Monitoramento que encontrou */}
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
                          {pub.resumo_ia && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Resumo IA
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

                        {pub.resumo_ia && (
                          <div className="bg-green-50 dark:bg-green-950/20 rounded p-2 mb-2">
                            <p className="text-sm text-green-800 dark:text-green-200 line-clamp-2">
                              <strong>Resumo IA:</strong> {pub.resumo_ia.substring(0, 150)}...
                            </p>
                          </div>
                        )}

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

                {selectedPublicacao?.resumo_ia && (
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4" />
                      Resumo da IA
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
                      {selectedPublicacao.resumo_ia}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Gerado em: {formatDate(selectedPublicacao.resumo_gerado_em)}
                    </p>
                  </div>
                )}

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
      </div>
    </MainLayout>
  );
};

export default AnaliseDjen;
