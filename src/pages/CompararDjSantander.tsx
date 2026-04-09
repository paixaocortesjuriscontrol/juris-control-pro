import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, FileCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, Download } from "lucide-react";
import { toast } from "sonner";
import * as mammoth from "mammoth";
import jsPDF from "jspdf";

interface ComparisonResult {
  processos_doc: string[];
  processos_pdf: string[];
  comuns: string[];
  somente_doc: string[];
  somente_pdf: string[];
}

const COMUNICACAO_PJE_REGEX = /COMUNICA[CÇ][AÃ]O\s+PJE\s+#?\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/gi;

function extrairProcessos(texto: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = COMUNICACAO_PJE_REGEX.exec(texto)) !== null) {
    matches.push(match[1]);
  }
  COMUNICACAO_PJE_REGEX.lastIndex = 0;
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

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório - Comparar DJ Santander", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.text(`DOC: ${docFileName}  |  PDF: ${pdfFileName}`, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Summary
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", 14, y); y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Processos no DOC: ${result.processos_doc.length}`, 14, y); y += 5;
  doc.text(`Processos no PDF: ${result.processos_pdf.length}`, 14, y); y += 5;
  doc.text(`Em Comum: ${result.comuns.length}`, 14, y); y += 5;
  doc.text(`Somente no DOC: ${result.somente_doc.length}`, 14, y); y += 5;
  doc.text(`Somente no PDF: ${result.somente_pdf.length}`, 14, y); y += 12;

  const printList = (title: string, items: string[]) => {
    checkPage(15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${title} (${items.length})`, 14, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (items.length === 0) {
      doc.text("Nenhum processo", 14, y); y += 6;
    } else {
      for (const p of items) {
        checkPage(6);
        doc.text(p, 14, y); y += 5;
      }
    }
    y += 6;
  };

  printList("Processos em Comum", result.comuns);
  printList("Somente no DOC Advogado", result.somente_doc);
  printList("Somente no PDF Resumo", result.somente_pdf);

  doc.save(`comparacao_dj_santander_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function CompararDjSantander() {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docProcessos, setDocProcessos] = useState<string[]>([]);
  const [pdfProcessos, setPdfProcessos] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);

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

  const handleComparar = () => {
    if (docProcessos.length === 0 || pdfProcessos.length === 0) {
      toast.error("Carregue ambos os arquivos antes de comparar");
      return;
    }
    const res = compararListas(docProcessos, pdfProcessos);
    setResult(res);
    toast.success("Comparação concluída!");
  };

  return (
    <MainLayout title="Comparar DJ Santander" subtitle="Compare o documento do advogado com o PDF Resumo gerado pela Análise DJEN">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              PDF Resumo (Análise DJEN)
            </CardTitle>
            <CardDescription>PDF gerado pela tela Análise DJEN</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {pdfFile ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">{pdfProcessos.length} processos encontrados</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-3 mb-6">
        <Button
          size="lg"
          onClick={handleComparar}
          disabled={docProcessos.length === 0 || pdfProcessos.length === 0}
          className="gap-2"
        >
          <ArrowRightLeft className="w-5 h-5" />
          Comparar Documentos
        </Button>
        {result && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => exportarPdf(result, docFile?.name || "DOC", pdfFile?.name || "PDF")}
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
                <p className="text-xs text-muted-foreground">Processos no PDF</p>
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
                <p className="text-xs text-muted-foreground">Somente no PDF</p>
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
                  Somente no PDF Resumo ({result.somente_pdf.length})
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
