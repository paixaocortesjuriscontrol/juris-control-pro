import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  Upload,
  FolderSearch,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

interface AnalysisResult {
  fileName: string;
  fileId?: string;
  data_distribuicao: string;
  numero_processo: string;
  dossie: string;
  equipe: string;
  reclamante: string;
  reclamada: string;
  relator: string;
  turma: string;
  status: "pending" | "analyzing" | "done" | "error";
  error?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function AnalisarPrazos() {
  const [driveUrl, setDriveUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"drive" | "upload">("drive");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const handleListFiles = async () => {
    if (!driveUrl.trim()) {
      toast.error("Informe a URL da pasta do Google Drive");
      return;
    }
    setLoading(true);
    setDriveFiles([]);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-prazos-drive", {
        body: { action: "list", driveUrl },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!data.files?.length) {
        toast.warning("Nenhum arquivo .docx encontrado na pasta");
        return;
      }
      setDriveFiles(data.files);
      setResults(
        data.files.map((f: DriveFile) => ({
          fileName: f.name, fileId: f.id,
          data_distribuicao: "", numero_processo: "", dossie: "", equipe: "", reclamante: "", reclamada: "", relator: "", turma: "",
          status: "pending" as const,
        }))
      );
      toast.success(`${data.files.length} arquivo(s) encontrado(s)`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao listar arquivos");
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const docxFiles = Array.from(selected).filter(f => f.name.toLowerCase().endsWith(".docx"));
    if (docxFiles.length === 0) { toast.error("Selecione arquivos .docx"); return; }
    setUploadedFiles(docxFiles);
    setResults(
      docxFiles.map(f => ({
        fileName: f.name,
        data_distribuicao: "", numero_processo: "", dossie: "", equipe: "", reclamante: "", reclamada: "", relator: "", turma: "",
        status: "pending" as const,
      }))
    );
    toast.success(`${docxFiles.length} arquivo(s) selecionado(s)`);
  };

  const handleCancelAnalysis = () => {
    cancelledRef.current = true;
    setAnalyzing(false);
    toast.info("Análise cancelada");
  };

  const runAnalysis = async (indices: number[]) => {
    const isDrive = mode === "drive";
    if (!indices.length) return;
    setAnalyzing(true);
    setProgress(0);
    cancelledRef.current = false;
    const updatedResults = [...results];
    let processed = 0;

    for (const i of indices) {
      if (cancelledRef.current) {
        for (const j of indices.slice(processed)) {
          if (updatedResults[j].status === "pending" || updatedResults[j].status === "analyzing") {
            updatedResults[j] = { ...updatedResults[j], status: "pending" };
          }
        }
        setResults([...updatedResults]);
        break;
      }

      updatedResults[i] = { ...updatedResults[i], status: "analyzing" };
      setResults([...updatedResults]);

      try {
        let data: any;
        if (isDrive) {
          const file = driveFiles[i];
          const resp = await supabase.functions.invoke("analisar-prazos-drive", {
            body: { action: "analyze", fileId: file.id, fileName: file.name },
          });
          if (resp.error) throw resp.error;
          data = resp.data;
        } else {
          const file = uploadedFiles[i];
          const buffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const resp = await supabase.functions.invoke("analisar-prazos-drive", {
            body: { action: "analyze-upload", fileName: file.name, fileBase64: base64 },
          });
          if (resp.error) throw resp.error;
          data = resp.data;
        }

        const result = data.result || {};
        updatedResults[i] = {
          ...updatedResults[i],
          data_distribuicao: result.data_distribuicao || result.data_disponibilizacao || "(Não localizado)",
          numero_processo: result.numero_processo || "(Não localizado)",
          dossie: result.dossie || "(Não localizado)",
          equipe: result.equipe || "(Não localizado)",
          reclamante: result.reclamante || "(Não localizado)",
          reclamada: result.reclamada || "(Não localizado)",
          relator: result.relator || "(Não localizado)",
          turma: result.turma || "(Não localizado)",
          status: "done",
          error: data.error || undefined,
        };
      } catch (err: any) {
        updatedResults[i] = { ...updatedResults[i], status: "error", error: err?.message || "Erro ao analisar" };
      }

      setResults([...updatedResults]);
      processed++;
      setProgress((processed / indices.length) * 100);
      if (processed < indices.length && !cancelledRef.current) await new Promise(r => setTimeout(r, 1000));
    }
    setAnalyzing(false);
    if (!cancelledRef.current) toast.success("Análise concluída!");
  };

  const handleAnalyzeAll = () => {
    const count = mode === "drive" ? driveFiles.length : uploadedFiles.length;
    const indices = Array.from({ length: count }, (_, i) => i);
    runAnalysis(indices);
  };

  const handleRetryErrors = () => {
    const errorIndices = results.map((r, i) => r.status === "error" ? i : -1).filter(i => i !== -1);
    if (!errorIndices.length) { toast.info("Nenhum documento com erro"); return; }
    runAnalysis(errorIndices);
  };

  const handleDownloadXLSX = () => {
    const doneResults = results.filter(r => r.status === "done");
    if (!doneResults.length) { toast.error("Nenhum resultado para exportar"); return; }
    const wsData = [
      ["DATA DA DISTRIBUIÇÃO", "NÚMERO DO PROCESSO", "DOSSIÊ", "EQUIPE", "RECLAMANTE", "RECLAMADA", "RELATOR", "TURMA"],
      ...doneResults.map(r => [r.data_distribuicao || "", r.numero_processo, r.dossie, r.equipe, r.reclamante, r.reclamada, r.relator, r.turma]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 35 }, { wch: 35 }, { wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Planilha");
    XLSX.writeFile(wb, "Planilha_Processos_TST.xlsx");
    toast.success("Planilha baixada com sucesso!");
  };

  const doneCount = results.filter(r => r.status === "done").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const hasFiles = mode === "drive" ? driveFiles.length > 0 : uploadedFiles.length > 0;

  return (
    <MainLayout title="Analisar Prazos" subtitle="Análise automática de documentos com IA">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Origem dos Documentos</CardTitle>
            <CardDescription>Escolha como enviar os arquivos .docx para análise</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "drive" | "upload"); setResults([]); setDriveFiles([]); setUploadedFiles([]); }}>
              <TabsList className="mb-4">
                <TabsTrigger value="drive" className="gap-2"><FolderSearch className="w-4 h-4" />Google Drive</TabsTrigger>
                <TabsTrigger value="upload" className="gap-2"><Upload className="w-4 h-4" />Upload Manual</TabsTrigger>
              </TabsList>

              <TabsContent value="drive">
                <div className="flex gap-3">
                  <Input
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleListFiles} disabled={loading || analyzing}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FolderSearch className="w-4 h-4 mr-2" />}
                    Listar Arquivos
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload">
                <input ref={fileInputRef} type="file" multiple accept=".docx" className="hidden" onChange={handleFilesSelected} />
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Clique para selecionar arquivos .docx</p>
                  <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .docx</p>
                  {uploadedFiles.length > 0 && (
                    <Badge variant="secondary" className="mt-3">{uploadedFiles.length} arquivo(s)</Badge>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {hasFiles && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-primary" />
                    Documentos ({results.length})
                  </CardTitle>
                  {analyzing && (
                    <div className="mt-3 space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-sm text-muted-foreground">Analisando... {doneCount + errorCount}/{results.length}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {analyzing ? (
                    <Button onClick={handleCancelAnalysis} variant="destructive" className="gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Cancelar
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleAnalyzeAll} disabled={doneCount === results.length} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Analisar Todos com IA
                      </Button>
                      {errorCount > 0 && (
                        <Button onClick={handleRetryErrors} variant="secondary" className="gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Reprocessar Erros ({errorCount})
                        </Button>
                      )}
                    </>
                  )}
                  {doneCount > 0 && (
                    <Button variant="outline" onClick={handleDownloadXLSX} className="gap-2">
                      <Download className="w-4 h-4" /> Baixar Planilha ({doneCount})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {results.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.fileName}</p>
                        {r.status === "done" && <p className="text-xs text-muted-foreground truncate">{r.numero_processo} • {r.reclamante} vs {r.reclamada}</p>}
                        {r.status === "error" && <p className="text-xs text-destructive">{r.error}</p>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {r.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                      {r.status === "analyzing" && <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Analisando</Badge>}
                      {r.status === "done" && <Badge className="gap-1 bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" /> Concluído</Badge>}
                      {r.status === "error" && <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Erro</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {doneCount > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Resultados da Análise</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Nº Processo</th>
                      <th className="text-left p-2 font-medium">Dossiê</th>
                      <th className="text-left p-2 font-medium">Equipe</th>
                      <th className="text-left p-2 font-medium">Reclamante</th>
                      <th className="text-left p-2 font-medium">Reclamada</th>
                      <th className="text-left p-2 font-medium">Relator</th>
                      <th className="text-left p-2 font-medium">Turma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.filter(r => r.status === "done").map((r, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{r.numero_processo}</td>
                        <td className="p-2 text-xs">{r.dossie}</td>
                        <td className="p-2 text-xs">{r.equipe}</td>
                        <td className="p-2 text-xs">{r.reclamante}</td>
                        <td className="p-2 text-xs">{r.reclamada}</td>
                        <td className="p-2 text-xs">{r.relator}</td>
                        <td className="p-2 text-xs">{r.turma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
