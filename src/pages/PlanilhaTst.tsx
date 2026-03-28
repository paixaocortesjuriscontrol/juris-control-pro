import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  Table2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProcessRow {
  originalIndex: number;
  originalData: Record<string, any>;
  numero_processo: string;
  dossie: string;
  equipe: string;
  reclamante: string;
  reclamada: string;
  relator: string;
  origem_dossie?: string;
  origem_equipe?: string;
  origem_reclamante?: string;
  origem_reclamada?: string;
  origem_relator?: string;
}

interface SheetData {
  headers: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
}

interface Stats {
  total: number;
  passo1: number;
  passo2: number;
  ia: number;
  naoEncontrados: number;
}

const NOT_FOUND = "(Não localizado)";

function normalizeProcesso(val: string): string {
  return String(val || "").replace(/[\.\-\s\/]/g, "").trim();
}

function findColumnIndex(headers: string[], ...terms: string[]): number {
  return headers.findIndex(h => {
    const lower = (h || "").toString().toLowerCase().trim();
    return terms.some(t => lower.includes(t));
  });
}

function readSheetData(file: File): Promise<SheetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, rawNumbers: false }) as any[][];

        let headerIdx = 0;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i];
          if (row && row.some(c => c && String(c).toLowerCase().includes("processo"))) {
            headerIdx = i;
            break;
          }
        }

        const headers = (json[headerIdx] || []).map(h => String(h || ""));
        const rows: Record<string, any>[] = [];
        for (let i = headerIdx + 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.every(c => !c && c !== 0)) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            let val = row[idx];
            // Convert Date objects to dd/mm/yyyy string
            if (val instanceof Date && !isNaN(val.getTime())) {
              const d = val.getDate().toString().padStart(2, '0');
              const m = (val.getMonth() + 1).toString().padStart(2, '0');
              const y = val.getFullYear();
              val = `${d}/${m}/${y}`;
            }
            obj[h] = val;
          });
          rows.push(obj);
        }
        resolve({ headers, rows, headerRowIndex: headerIdx });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readOriginalFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function getProcessoFromRow(row: Record<string, any>, headers: string[]): string {
  const idx = findColumnIndex(headers, "processo", "nº processo", "numero");
  if (idx >= 0) {
    const key = headers[idx];
    return String(row[key] || "");
  }
  // Try any key with "processo"
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes("processo")) return String(row[key] || "");
  }
  return "";
}

function getFieldFromRow(row: Record<string, any>, headers: string[], ...terms: string[]): string {
  const idx = findColumnIndex(headers, ...terms);
  if (idx >= 0) {
    const val = row[headers[idx]];
    return val ? String(val).trim() : "";
  }
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase();
    if (terms.some(t => lower.includes(t))) {
      const val = row[key];
      return val ? String(val).trim() : "";
    }
  }
  return "";
}

function isEmpty(val: string): boolean {
  return !val || val === NOT_FOUND || val.trim() === "" || val.trim() === "-";
}

export default function PlanilhaTst() {
  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [results, setResults] = useState<ProcessRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, passo1: 0, passo2: 0, ia: 0, naoEncontrados: 0 });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [originalWb, setOriginalWb] = useState<XLSX.WorkBook | null>(null);
  const [input1Meta, setInput1Meta] = useState<{ headers: string[]; headerRowIndex: number } | null>(null);
  const cancelledRef = useRef(false);

  const fileLabels = [
    { label: "Input 1 — Distribuições TST 2025", desc: "Planilha base que será complementada", required: true },
    { label: "Input 2 — Relatório de Prazos TST", desc: "Fonte prioritária de DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA, RELATOR" },
    { label: "Input 3 — Processos TST", desc: "Fonte secundária (fallback do Input 2)" },
    { label: "Input 4 — Dossiês Ativos", desc: "Complementa DOSSIÊ, EQUIPE, RECLAMANTE, RECLAMADA" },
  ];

  const handleFileChange = (index: number, file: File | null) => {
    setFiles(prev => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const buildLookup = (rows: Record<string, any>[], headers: string[]): Map<string, Record<string, any>> => {
    const map = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const proc = normalizeProcesso(getProcessoFromRow(row, headers));
      if (proc) map.set(proc, row);
    }
    return map;
  };

  const processarPlanilhas = async () => {
    if (!files[0]) {
      toast.error("Selecione pelo menos o Input 1 (Distribuições)");
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProgressLabel("Lendo planilhas...");
    cancelledRef.current = false;

    try {
      // Read all files + preserve original workbook for export
      const [input1, wb] = await Promise.all([
        readSheetData(files[0]),
        readOriginalWorkbook(files[0]),
      ]);
      setOriginalWb(wb);
      setInput1Meta({ headers: input1.headers, headerRowIndex: input1.headerRowIndex });
      const input2 = files[1] ? await readSheetData(files[1]) : null;
      const input3 = files[2] ? await readSheetData(files[2]) : null;
      const input4 = files[3] ? await readSheetData(files[3]) : null;

      const lookup2 = input2 ? buildLookup(input2.rows, input2.headers) : new Map();
      const lookup3 = input3 ? buildLookup(input3.rows, input3.headers) : new Map();
      const lookup4 = input4 ? buildLookup(input4.rows, input4.headers) : new Map();

      setProgress(10);
      setProgressLabel("Cruzando dados (Passo 1.1)...");

      const processRows: ProcessRow[] = [];
      let countPasso1 = 0;
      let countPasso2 = 0;

      for (let i = 0; i < input1.rows.length; i++) {
        const row = input1.rows[i];
        const proc = getProcessoFromRow(row, input1.headers);
        const procNorm = normalizeProcesso(proc);

        const pr: ProcessRow = {
          originalIndex: i,
          originalData: { ...row },
          numero_processo: proc,
          dossie: getFieldFromRow(row, input1.headers, "dossi", "dossie", "dossiê") || NOT_FOUND,
          equipe: getFieldFromRow(row, input1.headers, "equipe") || NOT_FOUND,
          reclamante: getFieldFromRow(row, input1.headers, "reclamante") || NOT_FOUND,
          reclamada: getFieldFromRow(row, input1.headers, "reclamada") || NOT_FOUND,
          relator: getFieldFromRow(row, input1.headers, "relator") || NOT_FOUND,
        };

        // Passo 1.1: Input 2 (priority) then Input 3
        const row2 = lookup2.get(procNorm);
        const row3 = lookup3.get(procNorm);
        let complemented1 = false;

        const fields1: Array<{ key: keyof ProcessRow; terms: string[]; includeRelator: boolean }> = [
          { key: "dossie", terms: ["dossi", "dossie", "dossiê"], includeRelator: true },
          { key: "equipe", terms: ["equipe"], includeRelator: true },
          { key: "reclamante", terms: ["reclamante"], includeRelator: true },
          { key: "reclamada", terms: ["reclamada"], includeRelator: true },
          { key: "relator", terms: ["relator"], includeRelator: true },
        ];

        for (const f of fields1) {
          if (isEmpty(pr[f.key] as string)) {
            // Try Input 2 first
            if (row2 && input2) {
              const val = getFieldFromRow(row2, input2.headers, ...f.terms);
              if (!isEmpty(val)) {
                (pr as any)[f.key] = val;
                (pr as any)[`origem_${f.key}`] = "input2";
                complemented1 = true;
              }
            }
            // Fallback to Input 3
            if (isEmpty(pr[f.key] as string) && row3 && input3) {
              const val = getFieldFromRow(row3, input3.headers, ...f.terms);
              if (!isEmpty(val)) {
                (pr as any)[f.key] = val;
                (pr as any)[`origem_${f.key}`] = "input3";
                complemented1 = true;
              }
            }
          }
        }

        if (complemented1) countPasso1++;
        processRows.push(pr);
      }

      setProgress(40);
      setProgressLabel("Cruzando dados (Passo 1.2 — Dossiês Ativos)...");

      // Passo 1.2: Input 4 for remaining empty fields (except RELATOR)
      for (const pr of processRows) {
        const procNorm = normalizeProcesso(pr.numero_processo);
        const row4 = lookup4.get(procNorm);
        if (!row4 || !input4) continue;

        let complemented2 = false;
        const fields2: Array<{ key: keyof ProcessRow; terms: string[] }> = [
          { key: "dossie", terms: ["dossi", "dossie", "dossiê"] },
          { key: "equipe", terms: ["equipe"] },
          { key: "reclamante", terms: ["reclamante"] },
          { key: "reclamada", terms: ["reclamada"] },
        ];

        for (const f of fields2) {
          if (isEmpty(pr[f.key] as string)) {
            const val = getFieldFromRow(row4, input4.headers, ...f.terms);
            if (!isEmpty(val)) {
              (pr as any)[f.key] = val;
              (pr as any)[`origem_${f.key}`] = "input4";
              complemented2 = true;
            }
          }
        }

        if (complemented2) countPasso2++;
      }

      setProgress(60);
      setProgressLabel("Enviando processos incompletos para IA...");

      // Passo 2: AI for remaining incomplete
      const incomplete = processRows.filter(pr =>
        isEmpty(pr.dossie) || isEmpty(pr.equipe) || isEmpty(pr.reclamante) || isEmpty(pr.reclamada) || isEmpty(pr.relator)
      );

      let countIA = 0;

      if (incomplete.length > 0) {
        const batchSize = 10;
        for (let b = 0; b < incomplete.length; b += batchSize) {
          if (cancelledRef.current) break;

          const batch = incomplete.slice(b, b + batchSize);
          const pct = 60 + Math.round((b / incomplete.length) * 30);
          setProgress(pct);
          setProgressLabel(`IA analisando lote ${Math.floor(b / batchSize) + 1}/${Math.ceil(incomplete.length / batchSize)}...`);

          try {
            const { data, error } = await supabase.functions.invoke("complementar-planilha-tst", {
              body: {
                processos: batch.map(pr => ({
                  numero_processo: pr.numero_processo,
                  dossie: pr.dossie,
                  equipe: pr.equipe,
                  reclamante: pr.reclamante,
                  reclamada: pr.reclamada,
                  relator: pr.relator,
                })),
              },
            });

            if (!error && data?.resultados) {
              for (const res of data.resultados) {
                const norm = normalizeProcesso(res.numero_processo);
                const pr = batch.find(p => normalizeProcesso(p.numero_processo) === norm);
                if (!pr) continue;

                let iaUsed = false;
                for (const field of ["dossie", "equipe", "reclamante", "reclamada", "relator"] as const) {
                  if (isEmpty(pr[field]) && res[field] && !isEmpty(res[field])) {
                    (pr as any)[field] = res[field];
                    (pr as any)[`origem_${field}`] = "ia";
                    iaUsed = true;
                  }
                }
                if (iaUsed) countIA++;
              }
            }
          } catch (err) {
            console.error("Erro no lote IA:", err);
          }

          // Throttle
          if (b + batchSize < incomplete.length) {
            await new Promise(r => setTimeout(r, 800));
          }
        }
      }

      const naoEncontrados = processRows.filter(pr =>
        isEmpty(pr.dossie) && isEmpty(pr.equipe) && isEmpty(pr.reclamante) && isEmpty(pr.reclamada) && isEmpty(pr.relator)
      ).length;

      setStats({
        total: processRows.length,
        passo1: countPasso1,
        passo2: countPasso2,
        ia: countIA,
        naoEncontrados,
      });

      setResults(processRows);
      setProgress(100);
      setProgressLabel("Concluído!");
      toast.success(`Processamento concluído! ${processRows.length} processos analisados.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao processar planilhas");
    } finally {
      setProcessing(false);
    }
  };

  const baixarPlanilha = () => {
    if (results.length === 0) return;

    if (originalWb && input1Meta) {
      // Modify the original workbook in-place to preserve formatting
      const ws = originalWb.Sheets[originalWb.SheetNames[0]];
      const headers = input1Meta.headers;
      const dataStartRow = input1Meta.headerRowIndex + 2; // 1-indexed, after header

      const findOrAddCol = (terms: string[]): number => {
        let colIdx = findColumnIndex(headers, ...terms);
        if (colIdx < 0) {
          // Add new column
          const label = terms[0].charAt(0).toUpperCase() + terms[0].slice(1);
          headers.push(label.toUpperCase());
          colIdx = headers.length - 1;
          // Write header cell
          const cellRef = XLSX.utils.encode_cell({ r: input1Meta.headerRowIndex, c: colIdx });
          ws[cellRef] = { t: 's', v: label.toUpperCase() };
        }
        return colIdx;
      };

      const colDossie = findOrAddCol(["dossi", "dossie", "dossiê"]);
      const colEquipe = findOrAddCol(["equipe"]);
      const colReclamante = findOrAddCol(["reclamante"]);
      const colReclamada = findOrAddCol(["reclamada"]);
      const colRelator = findOrAddCol(["relator"]);

      for (const pr of results) {
        const excelRow = dataStartRow + pr.originalIndex;
        const writeIfEmpty = (colIdx: number, value: string) => {
          if (isEmpty(value)) return;
          const cellRef = XLSX.utils.encode_cell({ r: excelRow - 1, c: colIdx });
          const existing = ws[cellRef];
          if (!existing || isEmpty(String(existing.v || ""))) {
            ws[cellRef] = { t: 's', v: value };
          }
        };

        writeIfEmpty(colDossie, pr.dossie);
        writeIfEmpty(colEquipe, pr.equipe);
        writeIfEmpty(colReclamante, pr.reclamante);
        writeIfEmpty(colReclamada, pr.reclamada);
        writeIfEmpty(colRelator, pr.relator);
      }

      // Update sheet range
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      range.e.c = Math.max(range.e.c, headers.length - 1);
      ws['!ref'] = XLSX.utils.encode_range(range);

      XLSX.writeFile(originalWb, "Distribuicoes_TST_Complementada.xlsx");
    } else {
      // Fallback: simple export
      const output = results.map(pr => {
        const row = { ...pr.originalData };
        const setField = (terms: string[], value: string) => {
          const key = Object.keys(row).find(k => terms.some(t => k.toLowerCase().includes(t)));
          if (key) {
            if (isEmpty(String(row[key] || ""))) row[key] = value;
          } else {
            const label = terms[0].charAt(0).toUpperCase() + terms[0].slice(1);
            row[label.toUpperCase()] = value;
          }
        };
        if (!isEmpty(pr.dossie)) setField(["dossi", "dossie", "dossiê"], pr.dossie);
        if (!isEmpty(pr.equipe)) setField(["equipe"], pr.equipe);
        if (!isEmpty(pr.reclamante)) setField(["reclamante"], pr.reclamante);
        if (!isEmpty(pr.reclamada)) setField(["reclamada"], pr.reclamada);
        if (!isEmpty(pr.relator)) setField(["relator"], pr.relator);
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(output);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Distribuições Complementadas");
      XLSX.writeFile(wb, "Distribuicoes_TST_Complementada.xlsx");
    }

    toast.success("Planilha baixada com sucesso!");
  };

  const origemBadge = (origem?: string) => {
    if (!origem) return null;
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      input2: { label: "Prazos", variant: "default" },
      input3: { label: "Processos", variant: "secondary" },
      input4: { label: "Dossiês", variant: "outline" },
      ia: { label: "IA", variant: "destructive" },
    };
    const info = map[origem];
    if (!info) return null;
    return <Badge variant={info.variant} className="text-[10px] ml-1">{info.label}</Badge>;
  };

  return (
    <MainLayout title="Planilha TST — Cruzamento de Dados" subtitle="Carregue 4 planilhas para cruzar e complementar automaticamente os dados de distribuições do TST">
      <div className="space-y-6">

        {/* File Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fileLabels.map((fl, idx) => (
            <Card key={idx} className={files[idx] ? "border-green-500/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-sky-500" />
                  {fl.label}
                  {fl.required && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">{fl.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                      {files[idx] ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm truncate">{files[idx]!.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">Selecionar arquivo .xlsx</span>
                        </>
                      )}
                    </div>
                  </label>
                  {files[idx] && (
                    <Button variant="ghost" size="sm" onClick={() => handleFileChange(idx, null)}>✕</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Process Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={processarPlanilhas}
            disabled={processing || !files[0]}
            className="gap-2"
            size="lg"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {processing ? "Processando..." : "Processar Planilhas"}
          </Button>

          {processing && (
            <Button variant="outline" size="sm" onClick={() => { cancelledRef.current = true; }}>
              Cancelar
            </Button>
          )}
        </div>

        {/* Progress */}
        {processing && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{progressLabel}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Processos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.passo1}</div>
                <div className="text-xs text-muted-foreground">Passo 1.1</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-purple-500">{stats.passo2}</div>
                <div className="text-xs text-muted-foreground">Passo 1.2</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-amber-500">{stats.ia}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" /> IA
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-red-500">{stats.naoEncontrados}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Não Encontrados
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Download */}
        {results.length > 0 && (
          <Button onClick={baixarPlanilha} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Baixar Planilha Complementada
          </Button>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resultados do Cruzamento</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Nº Processo</TableHead>
                      <TableHead className="text-xs">Dossiê</TableHead>
                      <TableHead className="text-xs">Equipe</TableHead>
                      <TableHead className="text-xs">Reclamante</TableHead>
                      <TableHead className="text-xs">Reclamada</TableHead>
                      <TableHead className="text-xs">Relator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((pr, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{pr.numero_processo}</TableCell>
                        <TableCell className="text-xs">
                          <span className={isEmpty(pr.dossie) ? "text-muted-foreground" : ""}>{pr.dossie}</span>
                          {origemBadge(pr.origem_dossie)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={isEmpty(pr.equipe) ? "text-muted-foreground" : ""}>{pr.equipe}</span>
                          {origemBadge(pr.origem_equipe)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={isEmpty(pr.reclamante) ? "text-muted-foreground" : ""}>{pr.reclamante}</span>
                          {origemBadge(pr.origem_reclamante)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={isEmpty(pr.reclamada) ? "text-muted-foreground" : ""}>{pr.reclamada}</span>
                          {origemBadge(pr.origem_reclamada)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className={isEmpty(pr.relator) ? "text-muted-foreground" : ""}>{pr.relator}</span>
                          {origemBadge(pr.origem_relator)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
