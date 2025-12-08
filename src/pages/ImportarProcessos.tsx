import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

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
  status: "pendente" | "sucesso" | "erro";
  erro?: string;
}

const mapAreaToEnum = (area: string | null): "civil" | "trabalhista" | "empresarial" => {
  if (!area) return "civil";
  const areaLower = area.toLowerCase();
  if (areaLower.includes("trabalhista") || areaLower.includes("trabalho")) return "trabalhista";
  if (areaLower.includes("empresarial") || areaLower.includes("empresa")) return "empresarial";
  return "civil";
};

const mapStatusToEnum = (situacao: string | null): "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado" => {
  if (!situacao) return "ativo";
  const situacaoLower = situacao.toLowerCase();
  if (situacaoLower.includes("encerrado") || situacaoLower.includes("finalizado")) return "encerrado";
  if (situacaoLower.includes("arquivado")) return "arquivado";
  if (situacaoLower.includes("urgente")) return "urgente";
  if (situacaoLower.includes("pendente")) return "pendente";
  return "ativo";
};

const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  // Se for um número (Excel date serial)
  if (typeof dateValue === "number") {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  // Se for string, tenta parsear
  if (typeof dateValue === "string") {
    const parts = dateValue.split(/[\/\-]/);
    if (parts.length === 3) {
      // Assume DD/MM/YYYY ou DD-MM-YYYY
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      // Assume YYYY-MM-DD
      return dateValue;
    }
  }
  
  return null;
};

const parseNumber = (value: any): number | null => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
};

export default function ImportarProcessos() {
  const [file, setFile] = useState<File | null>(null);
  const [processos, setProcessos] = useState<ProcessoImport[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

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

      const parsed: ProcessoImport[] = jsonData.map((row: any): ProcessoImport => ({
        numero: row["Número do processo"] || row["Numero do processo"] || "",
        assunto: row["Assunto"],
        situacao: row["Situação"] || row["Situacao"],
        responsavel: row["Responsável"] || row["Responsavel"],
        descricao: row["Descrição"] || row["Descricao"],
        justica: row["Justiça"] || row["Justica"],
        cidade: row["Cidade"],
        estado: row["Estado"],
        instancia: row["Instância"] || row["Instancia"],
        orgao: row["Órgão (Comarca / Tribunal)"] || row["Orgao (Comarca / Tribunal)"],
        orgaoJulgador: row["Órgão Julgador (Vara / Câmara)"] || row["Orgao Julgador (Vara / Camara)"],
        sistema: row["Sistema"],
        area: row["Área"] || row["Area"],
        fase: row["Fase"],
        dataDistribuicao: row["Distribuído"] || row["Distribuido"],
        classeCNJ: row["Classe – CNJ"] || row["Classe - CNJ"] || row["Classe CNJ"],
        valorAcao: row["Valor da ação"] || row["Valor da acao"],
        parteAtiva: row["Parte Ativa"],
        partePassiva: row["Parte Passiva"],
        cpfCnpjAtivo: row["CPF/CNPJ Parte Ativa"],
        cpfCnpjPassivo: row["CPF/CNPJ Parte Passiva"],
        status: "pendente",
      })).filter((p: ProcessoImport) => p.numero && p.numero.trim() !== "");

      setProcessos(parsed);
      
      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém processos válidos. Verifique se a coluna 'Número do processo' está preenchida.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} processo(s) encontrado(s) para importação.`,
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (processos.length === 0) return;

    setImporting(true);
    setProgress(0);

    const updatedProcessos = [...processos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      try {
        const { error } = await supabase.from("processos").insert({
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
        });

        if (error) {
          updatedProcessos[i] = { ...processo, status: "erro", erro: error.message };
          errorCount++;
        } else {
          updatedProcessos[i] = { ...processo, status: "sucesso" };
          successCount++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erro: err.message };
        errorCount++;
      }

      setProgress(((i + 1) / updatedProcessos.length) * 100);
      setProcessos([...updatedProcessos]);
    }

    setImporting(false);

    toast({
      title: "Importação concluída",
      description: `${successCount} processo(s) importado(s) com sucesso. ${errorCount} erro(s).`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const downloadTemplate = () => {
    window.open("/templates/MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx", "_blank");
  };

  const successCount = processos.filter(p => p.status === "sucesso").length;
  const errorCount = processos.filter(p => p.status === "erro").length;
  const pendingCount = processos.filter(p => p.status === "pendente").length;

  return (
    <MainLayout title="Importar Processos" subtitle="Importe processos em lote utilizando uma planilha Excel">
      <div className="space-y-6">
        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Instruções
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
                  Após preencher, faça o upload do arquivo para visualizar e importar.
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
          </CardContent>
        </Card>

        {/* File Preview */}
        {file && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pré-visualização</CardTitle>
                  <CardDescription>
                    {processos.length} processo(s) encontrado(s) em "{file.name}"
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {processos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                        {pendingCount} pendentes
                      </Badge>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        {successCount} sucesso
                      </Badge>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">
                        {errorCount} erros
                      </Badge>
                    </div>
                  )}
                  <Button 
                    onClick={handleImport} 
                    disabled={importing || processos.length === 0 || pendingCount === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar Processos
                      </>
                    )}
                  </Button>
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
                    Nenhum processo válido encontrado na planilha. Verifique se a coluna "Número do processo" está preenchida.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[50px]">Status</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Assunto</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Parte Ativa</TableHead>
                          <TableHead>Parte Passiva</TableHead>
                          <TableHead>Órgão</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processos.map((processo, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {processo.status === "pendente" && (
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
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
                            <TableCell className="max-w-[200px] truncate">
                              {processo.assunto || "-"}
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
                            <TableCell className="max-w-[200px] text-red-500 text-sm">
                              {processo.erro || "-"}
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
      </div>
    </MainLayout>
  );
}
