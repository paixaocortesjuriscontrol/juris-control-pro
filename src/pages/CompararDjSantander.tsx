import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Upload, FileText, FileCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, Download, Database, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as mammoth from "mammoth";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface ComparisonResult {
  processos_doc: string[];
  processos_pdf: string[];
  comuns: string[];
  somente_doc: string[];
  somente_pdf: string[];
}

interface Coordenacao {
  id: string;
  nome: string;
}

function formatarCNJ(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return numero;
}

// Captura processos em dois formatos comuns nos documentos do Santander:
// 1) "COMUNICAÇÃO PJE #<CNJ>" (formato antigo)
// 2) "Processo <CNJ>" (formato DJEN/TST - títulos das publicações)
const COMUNICACAO_PJE_REGEX = /COMUNICA[CÇ][AÃ]O\s+PJE\s+#?\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/gi;
const PROCESSO_TITULO_REGEX = /Processo[\s:]+(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/gi;
const CNJ_GENERICO_REGEX = /\b(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\b/g;

function extrairProcessos(texto: string): string[] {
  const matches: string[] = [];
  const runRegex = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) matches.push(m[1]);
    re.lastIndex = 0;
  };
  runRegex(COMUNICACAO_PJE_REGEX);
  runRegex(PROCESSO_TITULO_REGEX);
  // Fallback: se nenhuma das marcações específicas encontrou nada,
  // captura qualquer CNJ presente no texto (cobre PDFs/DOCXs sem rótulo).
  if (matches.length === 0) runRegex(CNJ_GENERICO_REGEX);
  return [...new Set(matches)];
}

function compararListas(processosDoc: string[], processosPdf: string[]): ComparisonResult {
  const normalize = (p: string) => p.replace(/\D/g, "");
  const setDoc = new Set(processosDoc.map(normalize));
  const setPdf = new Set(processosPdf.map(normalize));
  const docMap = new Map<string, string>();
  processosDoc.forEach(p => docMap.set(normalize(p), p));
  const pdfMap = new Map<string, string>();
  processosPdf.forEach(p => pdfMap.set(normalize(p), p));

  const comuns: string[] = [];
  const somente_doc: string[] = [];
  const somente_pdf: string[] = [];

  for (const [norm, orig] of docMap) {
    if (setPdf.has(norm)) comuns.push(orig);
    else somente_doc.push(orig);
  }
  for (const [norm, orig] of pdfMap) {
    if (!setDoc.has(norm)) somente_pdf.push(orig);
  }

  return { processos_doc: processosDoc, processos_pdf: processosPdf, comuns, somente_doc, somente_pdf };
}

function exportarPdf(result: ComparisonResult, docFileName: string, pdfFileName: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 280) { doc.addPage(); y = 20; }
  };

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório - Comparar DJ Santander", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.text(`DOC: ${docFileName}  |  Fonte: ${pdfFileName}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", 14, y); y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Processos no DOC: ${result.processos_doc.length}`, 14, y); y += 5;
  doc.text(`Processos na Fonte: ${result.processos_pdf.length}`, 14, y); y += 5;
  doc.text(`Em Comum: ${result.comuns.length}`, 14, y); y += 5;
  doc.text(`Somente no DOC: ${result.somente_doc.length}`, 14, y); y += 5;
  doc.text(`Somente na Fonte: ${result.somente_pdf.length}`, 14, y); y += 12;

  const columns = [
    { title: "Em Comum", items: result.comuns },
    { title: "Somente no DOC", items: result.somente_doc },
    { title: "Somente na Fonte", items: result.somente_pdf },
  ];
  const colWidth = (pageWidth - 28) / 3;
  const colX = [14, 14 + colWidth, 14 + colWidth * 2];
  const maxRows = Math.max(...columns.map(c => c.items.length));

  checkPage(12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  columns.forEach((col, i) => {
    doc.text(`${col.title} (${col.items.length})`, colX[i], y);
  });
  y += 6;
  doc.setDrawColor(180);
  doc.line(14, y, pageWidth - 14, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let row = 0; row < maxRows; row++) {
    checkPage(5);
    columns.forEach((col, i) => {
      if (row < col.items.length) {
        doc.text(col.items[row], colX[i], y);
      }
    });
    y += 4.5;
  }

  doc.save(`comparacao_dj_santander_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function CompararDjSantander() {
  const [mode, setMode] = useState<"pdf" | "djen">("pdf");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docProcessos, setDocProcessos] = useState<string[]>([]);
  const [pdfProcessos, setPdfProcessos] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  // DJEN mode state
  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([]);
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [djenProcessos, setDjenProcessos] = useState<string[]>([]);
  const [loadingDjen, setLoadingDjen] = useState(false);
  const [djenLoaded, setDjenLoaded] = useState(false);

  // Load coordenações
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      if (data) setCoordenacoes(data);
    };
    load();
  }, []);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const processos = extrairProcessos(value);
      setDocProcessos(processos);
      toast.success(`DOC carregado: ${processos.length} processos encontrados`);
    } catch (err) {
      console.error("Erro ao ler DOC:", err);
      toast.error("Erro ao ler arquivo DOC/DOCX");
    }
  }, []);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      const processos = extrairProcessos(text);
      setPdfProcessos(processos);
      toast.success(`PDF carregado: ${processos.length} processos encontrados`);
    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      toast.error("Erro ao ler arquivo PDF");
    }
  }, []);

  const handleBuscarDjen = async () => {
    if (!selectedCoordenacao || !selectedDate) {
      toast.error("Selecione a coordenação e a data");
      return;
    }
    setLoadingDjen(true);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
    try {
      // Format date for query - data_disponibilizacao is stored as timestamptz
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const startOfDay = `${dateStr}T00:00:00.000Z`;
      const endOfDay = `${dateStr}T23:59:59.999Z`;

      // Get monitoramento IDs for the selected coordenação
      const { data: monitoramentos } = await supabase
        .from("monitoramentos_djen")
        .select("id")
        .eq("coordenacao_id", selectedCoordenacao);

      if (!monitoramentos || monitoramentos.length === 0) {
        toast.error("Nenhum monitoramento encontrado para esta coordenação");
        setLoadingDjen(false);
        return;
      }

      const monIds = monitoramentos.map(m => m.id);

      // Fetch all publications for those monitoramentos on the selected date
      // Use pagination to get all results
      let allProcessos: string[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: publicacoes, error } = await supabase
          .from("publicacoes_djen")
          .select("processo_numero")
          .in("monitoramento_id", monIds)
          .gte("data_disponibilizacao", startOfDay)
          .lte("data_disponibilizacao", endOfDay)
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error("Erro ao buscar publicações:", error);
          toast.error("Erro ao buscar publicações do DJEN");
          break;
        }

        if (publicacoes && publicacoes.length > 0) {
          const numeros = publicacoes
            .map(p => p.processo_numero)
            .filter((n): n is string => !!n);
          allProcessos = [...allProcessos, ...numeros];
        }

        if (!publicacoes || publicacoes.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }

      // Deduplicate
      const unique = [...new Set(allProcessos)].map(formatarCNJ);
      setDjenProcessos(unique);
      setDjenLoaded(true);
      toast.success(`${unique.length} processos encontrados nas publicações DJEN`);
    } catch (err) {
      console.error("Erro ao buscar DJEN:", err);
      toast.error("Erro ao buscar publicações do DJEN");
    } finally {
      setLoadingDjen(false);
    }
  };

  const handleComparar = () => {
    if (mode === "pdf") {
      if (docProcessos.length === 0 || pdfProcessos.length === 0) {
        toast.error("Carregue ambos os arquivos antes de comparar");
        return;
      }
      const res = compararListas(docProcessos, pdfProcessos);
      setResult(res);
    } else {
      if (docProcessos.length === 0 || djenProcessos.length === 0) {
        toast.error("Carregue o DOC e busque as publicações antes de comparar");
        return;
      }
      const res = compararListas(docProcessos, djenProcessos);
      setResult(res);
    }
    toast.success("Comparação concluída!");
  };

  const canCompare = mode === "pdf"
    ? docProcessos.length > 0 && pdfProcessos.length > 0
    : docProcessos.length > 0 && djenProcessos.length > 0;

  const sourceLabel = mode === "pdf" ? "PDF" : "DJEN";
  const sourceFileName = mode === "pdf"
    ? (pdfFile?.name || "PDF")
    : `DJEN - ${coordenacoes.find(c => c.id === selectedCoordenacao)?.nome || ""} - ${selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}`;

  return (
    <MainLayout title="Comparar DJ Santander" subtitle="Compare o documento do advogado com o PDF Resumo ou diretamente com as publicações DJEN">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* DOC Upload - always visible */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Documento do Advogado (DOC/DOCX)
            </CardTitle>
            <CardDescription>Arquivo da Coordenação Santander</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {docFile ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{docFile.name}</p>
                    <p className="text-xs text-muted-foreground">{docProcessos.length} processos encontrados</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo DOC</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".doc,.docx" onChange={handleDocUpload} />
            </label>
          </CardContent>
        </Card>

        {/* Right side - tabs for PDF or DJEN */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fonte de Comparação</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "pdf" | "djen"); setResult(null); }}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="pdf" className="flex-1 gap-2">
                  <FileText className="w-4 h-4" />
                  PDF Resumo
                </TabsTrigger>
                <TabsTrigger value="djen" className="flex-1 gap-2">
                  <Database className="w-4 h-4" />
                  Publicações DJEN
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pdf">
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
                  <div className="flex flex-col items-center justify-center py-4">
                    {pdfFile ? (
                      <>
                        <FileCheck className="w-7 h-7 mb-2 text-green-500" />
                        <p className="text-sm font-medium">{pdfFile.name}</p>
                        <p className="text-xs text-muted-foreground">{pdfProcessos.length} processos encontrados</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                </label>
              </TabsContent>

              <TabsContent value="djen">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Coordenação</label>
                      <Select value={selectedCoordenacao} onValueChange={(v) => { setSelectedCoordenacao(v); setDjenLoaded(false); setDjenProcessos([]); setResult(null); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {coordenacoes.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Data Disponibilização</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => { setSelectedDate(d); setDjenLoaded(false); setDjenProcessos([]); setResult(null); }}
                            locale={ptBR}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button
                    onClick={handleBuscarDjen}
                    disabled={!selectedCoordenacao || !selectedDate || loadingDjen}
                    className="w-full gap-2"
                  >
                    {loadingDjen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {loadingDjen ? "Buscando..." : "Buscar Publicações"}
                  </Button>
                  {djenLoaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">{djenProcessos.length} processos encontrados nas publicações</span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-3 mb-6">
        <Button
          size="lg"
          onClick={handleComparar}
          disabled={!canCompare}
          className="gap-2"
        >
          <ArrowRightLeft className="w-5 h-5" />
          Comparar Documentos
        </Button>
        {result && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => exportarPdf(result, docFile?.name || "DOC", sourceFileName)}
            className="gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar PDF
          </Button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.processos_doc.length}</p>
                <p className="text-xs text-muted-foreground">Processos no DOC</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-red-600">{result.processos_pdf.length}</p>
                <p className="text-xs text-muted-foreground">Processos no {sourceLabel}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{result.comuns.length}</p>
                <p className="text-xs text-muted-foreground">Em Comum</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.somente_doc.length}</p>
                <p className="text-xs text-muted-foreground">Somente no DOC</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{result.somente_pdf.length}</p>
                <p className="text-xs text-muted-foreground">Somente no {sourceLabel}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Processos em Comum ({result.comuns.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.comuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum processo em comum</p>
                  ) : (
                    result.comuns.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Badge variant="outline" className="text-xs font-mono bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200">
                          {p}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Somente no DOC Advogado ({result.somente_doc.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.somente_doc.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum processo exclusivo</p>
                  ) : (
                    result.somente_doc.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Badge variant="outline" className="text-xs font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200">
                          {p}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-orange-500" />
                  Somente no {sourceLabel} ({result.somente_pdf.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {result.somente_pdf.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum processo exclusivo</p>
                  ) : (
                    result.somente_pdf.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Badge variant="outline" className="text-xs font-mono bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200">
                          {p}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
