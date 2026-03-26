import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface AnalysisResult {
  fileName: string;
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
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;

    const docxFiles = Array.from(selected).filter(f =>
      f.name.toLowerCase().endsWith(".docx")
    );

    if (docxFiles.length === 0) {
      toast.error("Selecione arquivos .docx");
      return;
    }

    setFiles(docxFiles);
    setResults(
      docxFiles.map(f => ({
        fileName: f.name,
        numero_processo: "",
        dossie: "",
        equipe: "",
        reclamante: "",
        reclamada: "",
        relator: "",
        turma: "",
        status: "pending" as const,
      }))
    );
    toast.success(`${docxFiles.length} arquivo(s) selecionado(s)`);
  };

  const handleAnalyzeAll = async () => {
    if (!files.length) return;
    setAnalyzing(true);
    setProgress(0);

    const updatedResults = [...results];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      updatedResults[i] = { ...updatedResults[i], status: "analyzing" };
      setResults([...updatedResults]);

      try {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        const { data, error } = await supabase.functions.invoke("analisar-prazos-drive", {
          body: { action: "analyze-upload", fileName: file.name, fileBase64: base64 },
        });

        if (error) throw error;

        const result = data.result || {};
        updatedResults[i] = {
          ...updatedResults[i],
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
        updatedResults[i] = {
          ...updatedResults[i],
          status: "error",
          error: err?.message || "Erro ao analisar",
        };
      }

      setResults([...updatedResults]);
      setProgress(((i + 1) / files.length) * 100);

      if (i < files.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setAnalyzing(false);
    toast.success("Análise concluída!");
  };

  const handleDownloadXLSX = () => {
    const doneResults = results.filter(r => r.status === "done");
    if (!doneResults.length) {
      toast.error("Nenhum resultado para exportar");
      return;
    }

    const wsData = [
      ["DATA DA DISTRIBUIÇÃO", "NÚMERO DO PROCESSO", "DOSSIÊ", "EQUIPE", "RECLAMANTE", "RECLAMADA", "RELATOR", "TURMA"],
      ...doneResults.map(r => [
        "",
        r.numero_processo,
        r.dossie,
        r.equipe,
        r.reclamante,
        r.reclamada,
        r.relator,
        r.turma,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 40 },
      { wch: 35 }, { wch: 35 }, { wch: 30 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Planilha");
    XLSX.writeFile(wb, "Planilha_Processos_TST.xlsx");
    toast.success("Planilha baixada com sucesso!");
  };

  const doneCount = results.filter(r => r.status === "done").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <MainLayout title="Analisar Prazos" subtitle="Análise automática de documentos com IA">
      <div className="space-y-6">
        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-5 h-5 text-primary" />
              Upload de Documentos
            </CardTitle>
            <CardDescription>
              Selecione os arquivos .docx da pasta de prazos TST para análise com IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".docx"
              className="hidden"
              onChange={handleFilesSelected}
            />
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Clique para selecionar arquivos .docx</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ou arraste os arquivos para cá • Apenas arquivos .docx
              </p>
              {files.length > 0 && (
                <Badge variant="secondary" className="mt-3">
                  {files.length} arquivo(s) selecionado(s)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Files & Analysis */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-primary" />
                    Documentos ({files.length})
                  </CardTitle>
                  {analyzing && (
                    <div className="mt-3 space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        Analisando... {doneCount + errorCount}/{files.length}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAnalyzeAll}
                    disabled={analyzing || doneCount === files.length}
                    className="gap-2"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {analyzing ? "Analisando..." : "Analisar Todos com IA"}
                  </Button>
                  {doneCount > 0 && (
                    <Button variant="outline" onClick={handleDownloadXLSX} className="gap-2">
                      <Download className="w-4 h-4" />
                      Baixar Planilha ({doneCount})
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
                        {r.status === "done" && (
                          <p className="text-xs text-muted-foreground truncate">
                            {r.numero_processo} • {r.reclamante} vs {r.reclamada}
                          </p>
                        )}
                        {r.status === "error" && <p className="text-xs text-destructive">{r.error}</p>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {r.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                      {r.status === "analyzing" && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analisando
                        </Badge>
                      )}
                      {r.status === "done" && (
                        <Badge className="gap-1 bg-emerald-600 text-white">
                          <CheckCircle2 className="w-3 h-3" /> Concluído
                        </Badge>
                      )}
                      {r.status === "error" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="w-3 h-3" /> Erro
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        {doneCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultados da Análise</CardTitle>
            </CardHeader>
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
