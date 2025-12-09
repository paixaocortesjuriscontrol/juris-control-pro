import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, List } from "lucide-react";
import * as XLSX from "xlsx";
interface ValidationError {
  campo: string;
  mensagem: string;
}

interface ProcessoImport {
  numero: string;
  assunto: string | null;
  situacao: string | null;
  responsavel: string | null;
  descricao: string | null;
  justica: string | null;
  cidade: string | null;
  estado: string | null;
  instancia: string | null;
  orgao: string | null;
  orgaoJulgador: string | null;
  sistema: string | null;
  area: string | null;
  fase: string | null;
  dataDistribuicao: string | null;
  classeCNJ: string | null;
  valorAcao: number | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  cpfCnpjAtivo: string | null;
  cpfCnpjPassivo: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: ValidationError[];
  erroImport?: string;
  linhaOriginal: number;
}

const validAreas = ["civil", "trabalhista", "empresarial", "cível", "civel", "trabalho", "empresa"];
const validSituacoes = ["ativo", "pendente", "urgente", "encerrado", "arquivado", "em andamento", "finalizado"];

const mapAreaToEnum = (area: string | null): "civil" | "trabalhista" | "empresarial" => {
  if (!area) return "civil";
  const areaLower = area.toLowerCase().trim();
  if (areaLower.includes("trabalhista") || areaLower.includes("trabalho")) return "trabalhista";
  if (areaLower.includes("empresarial") || areaLower.includes("empresa")) return "empresarial";
  return "civil";
};

const mapStatusToEnum = (situacao: string | null): "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado" => {
  if (!situacao) return "ativo";
  const situacaoLower = situacao.toLowerCase().trim();
  if (situacaoLower.includes("encerrado") || situacaoLower.includes("finalizado")) return "encerrado";
  if (situacaoLower.includes("arquivado")) return "arquivado";
  if (situacaoLower.includes("urgente")) return "urgente";
  if (situacaoLower.includes("pendente")) return "pendente";
  return "ativo";
};

const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  if (typeof dateValue === "number") {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;
    
    // DD/MM/YYYY format
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY-MM-DD format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return trimmed;
    }
  }
  
  return null;
};

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
};

const validateNumeroProcesso = (numero: string): boolean => {
  if (!numero || numero.trim() === "") return false;
  // Basic validation - should have some structure
  return numero.trim().length >= 5;
};

const validateProcesso = (processo: ProcessoImport): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Required field: numero
  if (!processo.numero || processo.numero.trim() === "") {
    errors.push({ campo: "Número do processo", mensagem: "Campo obrigatório" });
  } else if (!validateNumeroProcesso(processo.numero)) {
    errors.push({ campo: "Número do processo", mensagem: "Formato inválido (mínimo 5 caracteres)" });
  }
  
  // Validate area if provided
  if (processo.area) {
    const areaLower = processo.area.toLowerCase().trim();
    const isValidArea = validAreas.some(a => areaLower.includes(a));
    if (!isValidArea) {
      errors.push({ campo: "Área", mensagem: `Valor inválido: "${processo.area}". Use: Civil, Trabalhista ou Empresarial` });
    }
  }
  
  // Validate situacao if provided
  if (processo.situacao) {
    const situacaoLower = processo.situacao.toLowerCase().trim();
    const isValidSituacao = validSituacoes.some(s => situacaoLower.includes(s));
    if (!isValidSituacao) {
      errors.push({ campo: "Situação", mensagem: `Valor inválido: "${processo.situacao}". Use: Ativo, Pendente, Urgente, Encerrado ou Arquivado` });
    }
  }
  
  // Validate date if provided
  if (processo.dataDistribuicao) {
    const parsedDate = parseDate(processo.dataDistribuicao);
    if (!parsedDate) {
      errors.push({ campo: "Distribuído", mensagem: `Data inválida: "${processo.dataDistribuicao}". Use formato DD/MM/AAAA` });
    }
  }
  
  // Validate valor if provided
  if (processo.valorAcao !== null && processo.valorAcao !== undefined) {
    const parsedValue = parseNumber(processo.valorAcao);
    if (parsedValue === null && String(processo.valorAcao) !== "") {
      errors.push({ campo: "Valor da ação", mensagem: `Valor numérico inválido: "${processo.valorAcao}"` });
    }
  }
  
  return errors;
};

interface BatchProcesso {
  numero: string;
  status: "pendente" | "processando" | "sucesso" | "erro";
  erroMensagem?: string;
  andamentosImportados?: number;
}

export default function ImportarProcessos() {
  const [file, setFile] = useState<File | null>(null);
  const [processos, setProcessos] = useState<ProcessoImport[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Batch import states
  const [batchText, setBatchText] = useState("");
  const [batchProcessos, setBatchProcessos] = useState<BatchProcesso[]>([]);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcel(selectedFile);
    }
  }, []);

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const parsed: ProcessoImport[] = jsonData.map((row: any, index: number): ProcessoImport => {
        const processo: ProcessoImport = {
          numero: String(row["Número do processo"] || row["Numero do processo"] || "").trim(),
          assunto: row["Assunto"] || null,
          situacao: row["Situação"] || row["Situacao"] || null,
          responsavel: row["Responsável"] || row["Responsavel"] || null,
          descricao: row["Descrição"] || row["Descricao"] || null,
          justica: row["Justiça"] || row["Justica"] || null,
          cidade: row["Cidade"] || null,
          estado: row["Estado"] || null,
          instancia: row["Instância"] || row["Instancia"] || null,
          orgao: row["Órgão (Comarca / Tribunal)"] || row["Orgao (Comarca / Tribunal)"] || null,
          orgaoJulgador: row["Órgão Julgador (Vara / Câmara)"] || row["Orgao Julgador (Vara / Camara)"] || null,
          sistema: row["Sistema"] || null,
          area: row["Área"] || row["Area"] || null,
          fase: row["Fase"] || null,
          dataDistribuicao: row["Distribuído"] || row["Distribuido"] || null,
          classeCNJ: row["Classe – CNJ"] || row["Classe - CNJ"] || row["Classe CNJ"] || null,
          valorAcao: row["Valor da ação"] || row["Valor da acao"] || null,
          parteAtiva: row["Parte Ativa"] || null,
          partePassiva: row["Parte Passiva"] || null,
          cpfCnpjAtivo: row["CPF/CNPJ Parte Ativa"] || null,
          cpfCnpjPassivo: row["CPF/CNPJ Parte Passiva"] || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2, // +2 because Excel is 1-indexed and has header row
        };
        
        // Validate the processo
        processo.erros = validateProcesso(processo);
        processo.status = processo.erros.length > 0 ? "invalido" : "valido";
        
        return processo;
      });

      setProcessos(parsed);
      
      const validCount = parsed.filter(p => p.status === "valido").length;
      const invalidCount = parsed.filter(p => p.status === "invalido").length;
      
      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados. Verifique se a primeira linha contém os cabeçalhos.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s): ${validCount} válida(s), ${invalidCount} com erro(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const validProcessos = processos.filter(p => p.status === "valido");
    if (validProcessos.length === 0) {
      toast({
        title: "Nenhum processo válido",
        description: "Corrija os erros de validação antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    const updatedProcessos = [...processos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      // Skip invalid processos
      if (processo.status === "invalido") {
        continue;
      }
      
      try {
        const { data: insertedProcesso, error } = await supabase.from("processos").insert({
          numero: processo.numero.trim(),
          assunto: processo.assunto,
          descricao: processo.descricao,
          area: mapAreaToEnum(processo.area),
          status: mapStatusToEnum(processo.situacao),
          tribunal: processo.orgao,
          vara: processo.orgaoJulgador,
          comarca: processo.cidade,
          classe: processo.classeCNJ,
          data_distribuicao: parseDate(processo.dataDistribuicao),
          valor_causa: parseNumber(processo.valorAcao),
          polo_ativo: processo.parteAtiva,
          polo_passivo: processo.partePassiva,
        }).select("id").single();

        if (error) {
          updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
          errorCount++;
        } else {
          // Buscar andamentos externos da API do DataJud/CNJ
          if (insertedProcesso?.id) {
            const andamentosResult = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            console.log(`Processo ${processo.numero}: ${andamentosResult.movimentosInseridos} andamentos importados`);
          }
          updatedProcessos[i] = { ...processo, status: "sucesso" };
          successCount++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCount++;
      }

      setProgress(((i + 1) / updatedProcessos.length) * 100);
      setProcessos([...updatedProcessos]);
    }

    setImporting(false);

    toast({
      title: "Importação concluída",
      description: `${successCount} processo(s) importado(s). ${errorCount} erro(s) de importação.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const downloadTemplate = () => {
    window.open("/templates/MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx", "_blank");
  };

  const downloadRejeitados = () => {
    const rejeitados = processos.filter(p => p.status === "invalido" || p.status === "erro");
    
    if (rejeitados.length === 0) {
      toast({
        title: "Nenhum rejeitado",
        description: "Não há processos rejeitados para exportar.",
      });
      return;
    }

    const exportData = rejeitados.map(p => ({
      "Linha": p.linhaOriginal,
      "Número do processo": p.numero,
      "Área": p.area,
      "Situação": p.situacao,
      "Parte Ativa": p.parteAtiva,
      "Parte Passiva": p.partePassiva,
      "Órgão (Comarca / Tribunal)": p.orgao,
      "Distribuído": p.dataDistribuicao,
      "Valor da ação": p.valorAcao,
      "Erros de Validação": p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; "),
      "Erro de Importação": p.erroImport || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rejeitados");
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws["!cols"] = colWidths;
    
    XLSX.writeFile(wb, `processos_rejeitados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} processo(s) rejeitado(s) exportado(s).`,
    });
  };

  // Batch import functions
  const parseBatchNumbers = () => {
    const lines = batchText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length >= 5);
    
    const uniqueNumbers = [...new Set(lines)];
    
    const parsed: BatchProcesso[] = uniqueNumbers.map(numero => ({
      numero,
      status: "pendente" as const,
    }));

    setBatchProcessos(parsed);
    
    if (parsed.length === 0) {
      toast({
        title: "Nenhum número válido",
        description: "Insira pelo menos um número de processo válido (mínimo 5 caracteres).",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Números carregados",
        description: `${parsed.length} número(s) de processo(s) encontrado(s).`,
      });
    }
  };

  const handleBatchImport = async () => {
    if (batchProcessos.length === 0) {
      toast({
        title: "Nenhum processo para importar",
        description: "Primeiro carregue os números dos processos.",
        variant: "destructive",
      });
      return;
    }

    setBatchImporting(true);
    setBatchProgress(0);

    const updatedProcessos = [...batchProcessos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      updatedProcessos[i] = { ...processo, status: "processando" };
      setBatchProcessos([...updatedProcessos]);

      try {
        // Insert process with minimal data - system will fetch details from API
        const { data: insertedProcesso, error } = await supabase.from("processos").insert({
          numero: processo.numero,
          area: "civil", // Default area
          status: "ativo",
        }).select("id").single();

        if (error) {
          updatedProcessos[i] = { 
            ...processo, 
            status: "erro", 
            erroMensagem: error.message.includes("duplicate") ? "Processo já cadastrado" : error.message 
          };
          errorCount++;
        } else {
          let andamentosImportados = 0;
          
          if (insertedProcesso?.id) {
            // Fetch process details and movements from external API
            const { data: apiData } = await supabase.functions.invoke("consultar-processo", {
              body: { numeroProcesso: processo.numero },
            });

            // Update process with API data if found
            if (apiData?.found && apiData?.processo) {
              const processoApi = apiData.processo;
              await supabase.from("processos").update({
                tribunal: processoApi.tribunal || null,
                vara: processoApi.orgaoJulgador || null,
                classe: processoApi.classe || null,
                assunto: processoApi.assunto || null,
                data_distribuicao: processoApi.dataAjuizamento 
                  ? new Date(processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')).toISOString().split('T')[0]
                  : null,
              }).eq("id", insertedProcesso.id);

              // Insert movements if available
              if (apiData.movimentos && apiData.movimentos.length > 0) {
                const movimentosToInsert = apiData.movimentos.map((mov: any) => ({
                  processo_id: insertedProcesso.id,
                  descricao: mov.nome || "Sem descrição",
                  data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                  tipo: "API Externa",
                  fonte: "DataJud/CNJ",
                }));

                await supabase.from("movimentacoes").insert(movimentosToInsert);
                andamentosImportados = movimentosToInsert.length;
              }
            }
          }
          
          updatedProcessos[i] = { 
            ...processo, 
            status: "sucesso",
            andamentosImportados,
          };
          successCount++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { 
          ...processo, 
          status: "erro", 
          erroMensagem: err.message 
        };
        errorCount++;
      }

      setBatchProgress(((i + 1) / updatedProcessos.length) * 100);
      setBatchProcessos([...updatedProcessos]);
    }

    setBatchImporting(false);

    toast({
      title: "Importação concluída",
      description: `${successCount} processo(s) importado(s). ${errorCount} erro(s).`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const clearBatch = () => {
    setBatchText("");
    setBatchProcessos([]);
    setBatchProgress(0);
  };

  const batchSuccessCount = batchProcessos.filter(p => p.status === "sucesso").length;
  const batchErrorCount = batchProcessos.filter(p => p.status === "erro").length;
  const batchPendingCount = batchProcessos.filter(p => p.status === "pendente").length;

  const validCount = processos.filter(p => p.status === "valido").length;
  const invalidCount = processos.filter(p => p.status === "invalido").length;
  const successCount = processos.filter(p => p.status === "sucesso").length;
  const errorCount = processos.filter(p => p.status === "erro").length;
  const totalRejeitados = invalidCount + errorCount;

  return (
    <MainLayout title="Importar Processos" subtitle="Importe processos em lote">
      <div className="space-y-6">
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista de Números</span>
              <span className="sm:hidden">Lista</span>
            </TabsTrigger>
            <TabsTrigger value="planilha" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Planilha Excel</span>
              <span className="sm:hidden">Planilha</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lista de Números */}
          <TabsContent value="lista" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Importação por Lista
                </CardTitle>
                <CardDescription>
                  Cole os números dos processos, um por linha. O sistema cadastrará todos e buscará os andamentos automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    placeholder={"Cole os números dos processos aqui, um por linha:\n\n0001234-56.2024.8.21.0001\n0002345-67.2024.8.21.0002\n0003456-78.2024.8.21.0003"}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    disabled={batchImporting}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={parseBatchNumbers} disabled={batchImporting || !batchText.trim()}>
                    Carregar Números
                  </Button>
                  {batchProcessos.length > 0 && (
                    <>
                      <Button 
                        onClick={handleBatchImport} 
                        disabled={batchImporting || batchPendingCount === 0}
                        variant="default"
                      >
                        {batchImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar ({batchPendingCount})
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={clearBatch} disabled={batchImporting}>
                        Limpar
                      </Button>
                    </>
                  )}
                </div>
                
                {batchImporting && (
                  <Progress value={batchProgress} className="mt-4" />
                )}
              </CardContent>
            </Card>

            {/* Batch Results */}
            {batchProcessos.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Processos</CardTitle>
                      <CardDescription>
                        {batchProcessos.length} número(s) carregado(s)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {batchPendingCount > 0 && (
                        <Badge variant="outline" className="bg-muted">
                          {batchPendingCount} pendentes
                        </Badge>
                      )}
                      {batchSuccessCount > 0 && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          {batchSuccessCount} importados
                        </Badge>
                      )}
                      {batchErrorCount > 0 && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                          {batchErrorCount} erros
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="w-[60px]">Status</TableHead>
                            <TableHead>Número do Processo</TableHead>
                            <TableHead>Andamentos</TableHead>
                            <TableHead>Observação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchProcessos.map((processo, index) => (
                            <TableRow 
                              key={index} 
                              className={
                                processo.status === "erro" ? "bg-red-50 dark:bg-red-950/20" : 
                                processo.status === "sucesso" ? "bg-green-50 dark:bg-green-950/20" : ""
                              }
                            >
                              <TableCell className="text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                {processo.status === "pendente" && (
                                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                                )}
                                {processo.status === "processando" && (
                                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                )}
                                {processo.status === "sucesso" && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                                {processo.status === "erro" && (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {processo.numero}
                              </TableCell>
                              <TableCell>
                                {processo.status === "sucesso" && processo.andamentosImportados !== undefined && (
                                  <span className="text-muted-foreground">
                                    {processo.andamentosImportados} importado(s)
                                  </span>
                                )}
                                {processo.status !== "sucesso" && "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {processo.status === "erro" && (
                                  <span className="text-red-600">{processo.erroMensagem}</span>
                                )}
                                {processo.status === "sucesso" && (
                                  <span className="text-green-600">Importado com sucesso</span>
                                )}
                                {processo.status === "pendente" && "-"}
                                {processo.status === "processando" && (
                                  <span className="text-muted-foreground">Processando...</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Planilha Excel */}
          <TabsContent value="planilha" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importação por Planilha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">1. Baixe o modelo</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Utilize o modelo padrão para preencher os dados dos processos.
                    </p>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo
                    </Button>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Após preencher, faça o upload do arquivo para validar e importar.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="max-w-xs"
                      />
                    </div>
                  </div>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Campos obrigatórios:</strong> Número do processo. <br />
                    <strong>Áreas válidas:</strong> Civil, Trabalhista, Empresarial. <br />
                    <strong>Situações válidas:</strong> Ativo, Pendente, Urgente, Encerrado, Arquivado. <br />
                    <strong>Formato de data:</strong> DD/MM/AAAA
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

        {/* File Preview */}
        {file && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Pré-visualização</CardTitle>
                  <CardDescription>
                    {processos.length} linha(s) encontrada(s) em "{file.name}"
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {processos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                        {validCount} válidos
                      </Badge>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                        {invalidCount} inválidos
                      </Badge>
                      {successCount > 0 && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                          {successCount} importados
                        </Badge>
                      )}
                      {errorCount > 0 && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                          {errorCount} erros
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {totalRejeitados > 0 && (
                      <Button variant="outline" onClick={downloadRejeitados}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Baixar Rejeitados ({totalRejeitados})
                      </Button>
                    )}
                    <Button 
                      onClick={handleImport} 
                      disabled={importing || validCount === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar ({validCount})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              {importing && (
                <Progress value={progress} className="mt-4" />
              )}
            </CardHeader>
            <CardContent>
              {processos.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum processo encontrado na planilha. Verifique se os cabeçalhos estão corretos.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[60px]">Linha</TableHead>
                          <TableHead className="w-[60px]">Status</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Parte Ativa</TableHead>
                          <TableHead>Parte Passiva</TableHead>
                          <TableHead>Órgão</TableHead>
                          <TableHead className="min-w-[300px]">Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processos.map((processo, index) => (
                          <TableRow key={index} className={processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
                            <TableCell className="text-muted-foreground">
                              {processo.linhaOriginal}
                            </TableCell>
                            <TableCell>
                              {processo.status === "valido" && (
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                              )}
                              {processo.status === "invalido" && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              {processo.status === "sucesso" && (
                                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                              )}
                              {processo.status === "erro" && (
                                <XCircle className="h-4 w-4 text-orange-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {processo.numero || <span className="text-red-500 italic">vazio</span>}
                            </TableCell>
                            <TableCell>{processo.area || "-"}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.parteAtiva || "-"}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.partePassiva || "-"}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.orgao || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {processo.erros.length > 0 && (
                                <div className="text-red-600 space-y-1">
                                  {processo.erros.map((erro, i) => (
                                    <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                  ))}
                                </div>
                              )}
                              {processo.erroImport && (
                                <div className="text-orange-600">• Importação: {processo.erroImport}</div>
                              )}
                              {processo.status === "valido" && "-"}
                              {processo.status === "sucesso" && <span className="text-blue-600">Importado com sucesso</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
