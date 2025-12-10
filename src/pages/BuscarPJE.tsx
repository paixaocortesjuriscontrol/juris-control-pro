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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonitoramentoPjeDialog } from "@/components/pje/MonitoramentoPjeDialog";
import { useMonitoramentosPje } from "@/hooks/useMonitoramentosPje";

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

const BuscarPJE = () => {
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

  const { 
    monitoramentos, 
    publicacoes: publicacoesMonitoradas,
    atualizarMonitoramento, 
    excluirMonitoramento 
  } = useMonitoramentosPje();

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('buscar-pje', {
        body: {
          tipo: searchType,
          palavraChave: searchType === "palavra-chave" ? palavraChave : undefined,
          oab: searchType === "advogado" ? oab : undefined,
          uf: searchType === "advogado" ? uf : undefined,
          numeroProcesso: searchType === "processo" ? numeroProcesso : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }
      });

      if (error) throw error;

      if (data.success) {
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

        const { data: existingProcess } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", pub.processo)
          .maybeSingle();

        if (existingProcess) {
          const { error } = await supabase
            .from("movimentacoes")
            .insert({
              processo_id: existingProcess.id,
              descricao: pub.conteudo.substring(0, 500),
              tipo: "publicacao_pje",
              fonte: "PJE",
              data_movimentacao: pub.data || new Date().toISOString(),
            });

          if (!error) imported++;
          else errors++;
        } else {
          const { error } = await supabase
            .from("processos")
            .insert({
              numero: pub.processo,
              area: "civil",
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
      title="Buscar no PJE"
      subtitle="Portal de Comunicações Eletrônicas do PJe"
    >
      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Pesquisar Publicações
          </CardTitle>
          <CardDescription>
            Busque publicações no Portal de Comunicações Eletrônicas do PJe por palavra-chave, OAB ou número do processo
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
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">
              {hasSearched 
                ? `Resultados (${publicacoes.length})` 
                : "Resultados da Busca"
              }
            </CardTitle>
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
                    <TableHead className="max-w-[300px]">Conteúdo</TableHead>
                    <TableHead>Tribunal</TableHead>
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
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {truncateText(pub.conteudo)}
                        </p>
                      </TableCell>
                      <TableCell>
                        {pub.tribunal || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Monitoramento Automático PJE
              </CardTitle>
              <CardDescription>
                Configure alertas para receber notificações de novas publicações
              </CardDescription>
            </div>
            <Button onClick={() => setMonitoramentoDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Monitoramento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {monitoramentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum monitoramento configurado</p>
              <p className="text-sm mt-2">Crie um monitoramento para receber alertas automáticos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monitoramentos.map((mon) => (
                <div
                  key={mon.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    mon.ativo ? "bg-background" : "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={mon.ativo ? "default" : "secondary"}>
                      {mon.tipo === 'palavra-chave' ? 'Palavra-chave' : 
                       mon.tipo === 'advogado' ? 'OAB' : 'Processo'}
                    </Badge>
                    <span className="font-medium">{mon.termo_busca}</span>
                    {!mon.ativo && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => atualizarMonitoramento.mutate({ 
                        id: mon.id, 
                        ativo: !mon.ativo 
                      })}
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
                      onClick={() => excluirMonitoramento.mutate(mon.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MonitoramentoPjeDialog 
        open={monitoramentoDialogOpen}
        onOpenChange={setMonitoramentoDialogOpen}
      />
    </MainLayout>
  );
};

export default BuscarPJE;
