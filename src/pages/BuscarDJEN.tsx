import { useState } from "react";
import {
  Search,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  User,
  Hash,
  Plus,
  Eye,
  Trash2,
  Power,
  PowerOff,
  Import,
  Sparkles,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";
import { useMonitoramentosDjen } from "@/hooks/useMonitoramentosDjen";
import { useCoordenacoes } from "@/hooks/useDashboardData";

type SearchType = "palavra-chave" | "advogado" | "processo";

interface Publicacao {
  id: string;
  data: string;
  tipo: string;
  conteudo: string;
  processo?: string;
  tribunal?: string;
  advogado?: string;
  partes?: string;
}

const estados = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

const BuscarDJEN = () => {
  const [searchType, setSearchType] = useState<SearchType>("palavra-chave");
  const [palavraChave, setPalavraChave] = useState("");
  const [oab, setOab] = useState("");
  const [uf, setUf] = useState("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [importing, setImporting] = useState(false);
  const [monitoramentoDialogOpen, setMonitoramentoDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedPublicacao, setSelectedPublicacao] = useState<Publicacao | null>(null);
  const [importCoordenacaoId, setImportCoordenacaoId] = useState<string>("");
  const [importingOne, setImportingOne] = useState(false);
  const [resumo, setResumo] = useState<string>("");
  const [loadingResumo, setLoadingResumo] = useState(false);

  const { 
    monitoramentos, 
    publicacoes: publicacoesMonitoradas,
    atualizarMonitoramento, 
    excluirMonitoramento 
  } = useMonitoramentosDjen();

  const { data: coordenacoes } = useCoordenacoes();

  const handleViewContent = (pub: Publicacao) => {
    setSelectedPublicacao(pub);
    setViewDialogOpen(true);
  };

  const handleOpenImportDialog = (pub: Publicacao) => {
    setSelectedPublicacao(pub);
    setImportCoordenacaoId("");
    setImportDialogOpen(true);
  };

  // Extract CNJ process numbers from text
  const extractProcessNumbers = (text: string): string[] => {
    // CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
    const cnjRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
    const matches = text.match(cnjRegex) || [];
    // Remove duplicates
    return [...new Set(matches)];
  };

  const handleImportOne = async () => {
    if (!selectedPublicacao) return;
    if (!importCoordenacaoId) {
      toast.error("Selecione uma coordenação");
      return;
    }

    setImportingOne(true);
    
    try {
      const pub = selectedPublicacao;
      
      // Extract all process numbers from the content
      const processNumbers = extractProcessNumbers(pub.conteudo);
      
      // If there's also a main process number in the publication, add it
      if (pub.processo && !processNumbers.includes(pub.processo)) {
        processNumbers.unshift(pub.processo);
      }

      if (processNumbers.length === 0) {
        toast.error("Nenhum número de processo encontrado na publicação");
        setImportingOne(false);
        return;
      }

      toast.info(`Encontrado(s) ${processNumbers.length} processo(s). Importando...`);

      let imported = 0;
      let errors = 0;

      for (const numero of processNumbers) {
        try {
          // Check if process already exists
          const { data: existingProcess } = await supabase
            .from("processos")
            .select("id")
            .eq("numero", numero)
            .maybeSingle();

          if (existingProcess) {
            // Add publication as movement
            await supabase
              .from("movimentacoes")
              .insert({
                processo_id: existingProcess.id,
                descricao: `Publicação DJEN: ${pub.conteudo.substring(0, 400)}`,
                tipo: "publicacao_djen",
                fonte: "DJEN",
                data_movimentacao: pub.data || new Date().toISOString(),
              });
            
            // Update coordination
            await supabase
              .from("processos")
              .update({ coordenacao_id: importCoordenacaoId })
              .eq("id", existingProcess.id);

            imported++;
          } else {
            // Fetch process data from external API
            let processData: any = null;
            try {
              const { data: apiData } = await supabase.functions.invoke('consultar-processo', {
                body: { numeroProcesso: numero }
              });
              if (apiData?.success && apiData?.processo) {
                processData = apiData.processo;
              }
            } catch (apiError) {
              console.log(`API error for ${numero}:`, apiError);
            }

            // Create new process
            const { data: newProcess, error: insertError } = await supabase
              .from("processos")
              .insert({
                numero,
                area: processData?.area || "civil",
                status: "ativo",
                tribunal: processData?.tribunal || pub.tribunal || "Não identificado",
                vara: processData?.vara,
                comarca: processData?.comarca,
                classe: processData?.classe,
                assunto: processData?.assunto || pub.conteudo.substring(0, 200),
                polo_ativo: processData?.polo_ativo || pub.partes || "A identificar",
                polo_passivo: processData?.polo_passivo,
                data_distribuicao: processData?.data_distribuicao,
                coordenacao_id: importCoordenacaoId,
              })
              .select("id")
              .single();

            if (insertError) throw insertError;

            // Add publication as first movement
            await supabase
              .from("movimentacoes")
              .insert({
                processo_id: newProcess.id,
                descricao: `Publicação DJEN: ${pub.conteudo.substring(0, 400)}`,
                tipo: "publicacao_djen",
                fonte: "DJEN",
                data_movimentacao: pub.data || new Date().toISOString(),
              });

            // Import movements from API if available
            if (processData?.movimentacoes?.length > 0) {
              const movimentacoes = processData.movimentacoes.map((mov: any) => ({
                processo_id: newProcess.id,
                descricao: mov.descricao || mov.nome || "Movimentação",
                tipo: mov.tipo || "andamento",
                fonte: "DataJud/CNJ",
                data_movimentacao: mov.data || new Date().toISOString(),
              }));

              await supabase
                .from("movimentacoes")
                .insert(movimentacoes);
            }

            imported++;
          }
        } catch (procError: any) {
          console.error(`Error importing ${numero}:`, procError);
          errors++;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} processo(s) importado(s) com sucesso`);
      }
      if (errors > 0) {
        toast.warning(`${errors} processo(s) não puderam ser importados`);
      }

      setImportDialogOpen(false);
      setSelectedPublicacao(null);
    } catch (error: any) {
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setImportingOne(false);
    }
  };

  const handleSearch = async () => {
    // Frontend validation
    if (searchType === "palavra-chave" && (!palavraChave || palavraChave.trim().length < 3)) {
      toast.error("Digite uma palavra-chave com pelo menos 3 caracteres");
      return;
    }
    if (searchType === "advogado" && (!oab || oab.trim().length < 3)) {
      toast.error("Digite um número OAB válido");
      return;
    }
    if (searchType === "processo" && (!numeroProcesso || numeroProcesso.trim().length < 10)) {
      toast.error("Digite um número de processo válido");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('buscar-djen', {
        body: {
          tipo: searchType,
          palavraChave: searchType === "palavra-chave" ? palavraChave.trim() : undefined,
          oab: searchType === "advogado" ? oab.trim() : undefined,
          uf: searchType === "advogado" ? uf : undefined,
          numeroProcesso: searchType === "processo" ? numeroProcesso.trim() : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }
      });

      if (error) throw error;

      if (data.success) {
        // Handle different response formats from the API
        const rawPubs = data.publicacoes || data.comunicacoes || data.items || [];
        const pubs = rawPubs.map((p: any, idx: number) => ({
          id: p.id || `pub-${idx}`,
          data: p.data || p.dataDisponibilizacao || p.dataPublicacao,
          tipo: p.tipo || p.tipoComunicacao || "Publicação",
          conteudo: p.conteudo || p.texto || p.teor || "",
          processo: p.processo || p.numeroProcesso,
          tribunal: p.tribunal || p.orgao,
          advogado: p.advogado,
          partes: p.partes || p.destinatario,
        }));
        setPublicacoes(pubs);
        
        if (pubs.length === 0) {
          toast.info(data.message || "Nenhuma publicação encontrada para os critérios informados");
        } else {
          toast.success(`${pubs.length} publicação(ões) encontrada(s)`);
        }
      } else {
        throw new Error(data.error || "Erro na busca");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Erro ao buscar publicações");
      setPublicacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResumir = async () => {
    if (publicacoes.length === 0) {
      toast.error("Não há publicações para resumir");
      return;
    }

    setLoadingResumo(true);
    setResumo("");

    try {
      const { data, error } = await supabase.functions.invoke('resumir-publicacoes', {
        body: { publicacoes }
      });

      if (error) throw error;

      if (data.resumo) {
        setResumo(data.resumo);
        toast.success("Resumo gerado com sucesso!");
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Erro ao resumir:", error);
      toast.error(error.message || "Erro ao gerar resumo com IA");
    } finally {
      setLoadingResumo(false);
    }
  };

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

  const handleImportSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma publicação para importar");
      return;
    }

    setImporting(true);
    
    try {
      const selectedPubs = publicacoes.filter(p => selectedIds.has(p.id));
      let imported = 0;
      let errors = 0;

      for (const pub of selectedPubs) {
        if (!pub.processo) {
          errors++;
          continue;
        }

        // Check if process already exists
        const { data: existingProcess } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", pub.processo)
          .maybeSingle();

        if (existingProcess) {
          // Add as movimentacao
          const { error } = await supabase
            .from("movimentacoes")
            .insert({
              processo_id: existingProcess.id,
              descricao: pub.conteudo.substring(0, 500),
              tipo: "publicacao_djen",
              fonte: "DJEN",
              data_movimentacao: pub.data || new Date().toISOString(),
            });

          if (!error) imported++;
          else errors++;
        } else {
          // Create new process
          const { error } = await supabase
            .from("processos")
            .insert({
              numero: pub.processo,
              area: "civil", // Default
              status: "ativo",
              tribunal: pub.tribunal || "Não identificado",
              assunto: pub.conteudo.substring(0, 200),
              polo_ativo: pub.partes || "A identificar",
            });

          if (!error) imported++;
          else errors++;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} publicação(ões) importada(s) com sucesso`);
        setSelectedIds(new Set());
      }
      if (errors > 0) {
        toast.warning(`${errors} publicação(ões) não puderam ser importadas`);
      }
    } catch (error: any) {
      toast.error("Erro ao importar publicações: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const truncateText = (text: string, maxLength = 150) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <MainLayout
      title="Buscar no DJEN"
      subtitle="Diário de Justiça Eletrônico Nacional"
    >
      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Pesquisar Publicações
          </CardTitle>
          <CardDescription>
            Busque publicações no Diário de Justiça Eletrônico Nacional por palavra-chave, OAB ou número do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as SearchType)}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="palavra-chave" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Palavra-chave</span>
                <span className="xs:hidden">Palavra</span>
              </TabsTrigger>
              <TabsTrigger value="advogado" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">OAB/Advogado</span>
                <span className="xs:hidden">OAB</span>
              </TabsTrigger>
              <TabsTrigger value="processo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Hash className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Nº Processo</span>
                <span className="xs:hidden">Processo</span>
              </TabsTrigger>
            </TabsList>

            <div className="grid gap-4">
              <TabsContent value="palavra-chave" className="mt-0">
                <div className="space-y-2">
                  <Label htmlFor="palavraChave">Palavra-chave</Label>
                  <Input
                    id="palavraChave"
                    placeholder="Digite termos para buscar (ex: nome da parte, empresa, etc.)"
                    value={palavraChave}
                    onChange={(e) => setPalavraChave(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </TabsContent>

              <TabsContent value="advogado" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="oab">Número OAB</Label>
                    <Input
                      id="oab"
                      placeholder="Ex: 123456"
                      value={oab}
                      onChange={(e) => setOab(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">Estado (UF)</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="processo" className="mt-0">
                <div className="space-y-2">
                  <Label htmlFor="numeroProcesso">Número do Processo</Label>
                  <Input
                    id="numeroProcesso"
                    placeholder="Ex: 0000123-45.2024.5.10.0001"
                    value={numeroProcesso}
                    onChange={(e) => setNumeroProcesso(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </TabsContent>

              {/* Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearch} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">
              {hasSearched 
                ? `Resultados (${publicacoes.length})` 
                : "Resultados da Busca"
              }
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleResumir} 
                disabled={loadingResumo || publicacoes.length === 0} 
                size="sm" 
                variant="outline"
                className="w-full sm:w-auto"
              >
                {loadingResumo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando resumo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Resumir com IA
                  </>
                )}
              </Button>
              {selectedIds.size > 0 && (
                <Button onClick={handleImportSelected} disabled={importing} size="sm" className="w-full sm:w-auto">
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Importar ({selectedIds.size})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Faça uma busca para ver os resultados</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Buscando publicações...</p>
            </div>
          ) : publicacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma publicação encontrada</p>
              <p className="text-sm mt-2">Tente ajustar os filtros de busca</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === publicacoes.length && publicacoes.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead className="max-w-[200px]">Conteúdo</TableHead>
                    <TableHead>Tribunal</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicacoes.map((pub) => (
                    <TableRow 
                      key={pub.id}
                      className={cn(
                        selectedIds.has(pub.id) && "bg-primary/5"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(pub.id)}
                          onCheckedChange={() => toggleSelect(pub.id)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(pub.data)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{pub.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        {pub.processo ? (
                          <span className="font-mono text-xs">{pub.processo}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {truncateText(pub.conteudo, 100)}
                        </p>
                      </TableCell>
                      <TableCell>
                        {pub.tribunal || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewContent(pub)}
                            title="Visualizar conteúdo"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenImportDialog(pub)}
                            title="Importar processo"
                          >
                            <Import className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Resumo IA */}
          {resumo && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h4 className="font-semibold">Resumo das Publicações (IA)</h4>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm font-sans">{resumo}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitoramentos Section */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                Monitoramentos Automáticos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Configure buscas automáticas no DJEN (verificação 2x ao dia)
              </CardDescription>
            </div>
            <Button onClick={() => setMonitoramentoDialogOpen(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Monitoramento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {monitoramentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum monitoramento configurado</p>
              <p className="text-sm mt-1">Crie um monitoramento para receber notificações de novas publicações</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Tipo</TableHead>
                    <TableHead>Termo</TableHead>
                    <TableHead className="hidden sm:table-cell">OAB/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Publicações</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoramentos.map((mon) => {
                    const pubCount = publicacoesMonitoradas.filter(p => p.monitoramento_id === mon.id).length;
                    const naoLidas = publicacoesMonitoradas.filter(p => p.monitoramento_id === mon.id && !p.lida).length;
                    
                    return (
                      <TableRow key={mon.id}>
                        <TableCell className="pl-6">
                          <Badge variant="outline">{mon.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[120px] truncate">{mon.termo_busca}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {mon.oab && mon.uf ? `${mon.oab}/${mon.uf}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mon.ativo ? "default" : "secondary"}>
                            {mon.ativo ? "Ativo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {pubCount > 0 && (
                            <span className="flex items-center gap-1">
                              {pubCount} 
                              {naoLidas > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </span>
                          )}
                          {pubCount === 0 && <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => atualizarMonitoramento.mutate({ 
                                id: mon.id, 
                                ativo: !mon.ativo 
                              })}
                              title={mon.ativo ? "Pausar" : "Ativar"}
                            >
                              {mon.ativo ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => excluirMonitoramento.mutate(mon.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MonitoramentoDialog
        open={monitoramentoDialogOpen}
        onOpenChange={setMonitoramentoDialogOpen}
      />

      {/* View Content Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Conteúdo da Publicação</DialogTitle>
            <DialogDescription>
              {selectedPublicacao?.processo && (
                <span className="font-mono">{selectedPublicacao.processo}</span>
              )}
              {selectedPublicacao?.data && ` - ${formatDate(selectedPublicacao.data)}`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-4 p-1">
              {selectedPublicacao?.tribunal && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tribunal</Label>
                  <p className="text-sm">{selectedPublicacao.tribunal}</p>
                </div>
              )}
              {selectedPublicacao?.partes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Partes</Label>
                  <p className="text-sm">{selectedPublicacao.partes}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Conteúdo</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedPublicacao?.conteudo}</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedPublicacao) handleOpenImportDialog(selectedPublicacao);
            }}>
              <Import className="w-4 h-4 mr-2" />
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Publicação</DialogTitle>
            <DialogDescription>
              {selectedPublicacao?.processo 
                ? `Processo: ${selectedPublicacao.processo}`
                : "Será criado um novo processo com os dados da publicação"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coordenacao">Coordenação *</Label>
              <Select value={importCoordenacaoId} onValueChange={setImportCoordenacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome} ({coord.area})
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
            <Button onClick={handleImportOne} disabled={importingOne || !importCoordenacaoId}>
              {importingOne ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Import className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default BuscarDJEN;
