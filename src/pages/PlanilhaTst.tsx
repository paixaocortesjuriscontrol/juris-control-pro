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
import jsPDF from "jspdf";
import { Checkbox } from "@/components/ui/checkbox";
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
  Info,
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

interface FieldFillDetail {
  total: number;
  input2: number;
  input3: number;
  input4: number;
  ia: number;
}

interface Stats {
  total: number;
  passo1: number;
  passo2: number;
  ia: number;
  naoEncontrados: number;
  matchInput2: number;
  matchInput3: number;
  matchInput4: number;
  fieldFills: Record<string, FieldFillDetail>;
  unmatchedSamples: string[];
}

const NOT_FOUND = "(Não localizado)";

function normalizeText(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeProcesso(val: string): string {
  // Remove everything except digits, then zero-pad to 20 digits (CNJ standard)
  const digits = String(val || "").replace(/\D/g, "").trim();
  if (digits.length < 7) return digits;
  return digits.padStart(20, "0");
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
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeText(header),
  }));

  const pickFromHeader = (matcher: (header: string) => boolean) => {
    const match = normalizedHeaders.find(({ normalized }) => matcher(normalized));
    if (!match) return "";

    const val = String(row[match.raw] || "").trim();
    return val && val.replace(/\D/g, "").length >= 7 ? val : "";
  };

  const explicitProcess = pickFromHeader(
    (header) =>
      header.includes("numero do processo") ||
      header.includes("número do processo") ||
      header.includes("num processo") ||
      header.includes("processo") ||
      header.includes("cnj")
  );
  if (explicitProcess) return explicitProcess;

  const genericNumber = pickFromHeader(
    (header) =>
      (header === "numero" || header === "número" || header === "nº" || header === "no") &&
      !header.includes("dossie") &&
      !header.includes("dossiê")
  );
  if (genericNumber) return genericNumber;

  // No regex fallback — only use explicitly matched header columns

  return "";
}

function getFieldFromRow(row: Record<string, any>, headers: string[], ...terms: string[]): string {
  // First try exact header index match
  const idx = findColumnIndex(headers, ...terms);
  if (idx >= 0) {
    const val = row[headers[idx]];
    return val ? String(val).trim() : "";
  }
  // Then try all keys
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (terms.some(t => lower.includes(t))) {
      const val = row[key];
      return val ? String(val).trim() : "";
    }
  }
  return "";
}

function isEmpty(val: string): boolean {
  const normalized = normalizeText(val);
  return (
    !normalized ||
    normalized === normalizeText(NOT_FOUND) ||
    normalized === "-" ||
    normalized === "—" ||
    normalized.includes("nao localizado") ||
    normalized.includes("nao encontrado") ||
    normalized === "null" ||
    normalized === "undefined"
  );
}

function extractCnjCore(digits: string): string {
  // CNJ format: NNNNNNN-DD.AAAA.J.TT.OOOO = 20 digits
  // Core = first 7 digits (sequential number) + digits 10-13 (year) + digit 14 (justice) + digits 15-16 (tribunal)
  // This gives us a unique-enough key: sequential + year + justice + tribunal
  if (digits.length >= 16) {
    return digits.slice(0, 7) + digits.slice(9, 16); // 7 + 7 = 14 digit core
  }
  if (digits.length >= 13) {
    return digits.slice(0, 7) + digits.slice(9, 13); // 7 + 4 = 11 digit core
  }
  return digits;
}

function buildAllLookups(rows: Record<string, any>[], headers: string[]): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const proc = normalizeProcesso(getProcessoFromRow(row, headers));
    if (!proc || proc.length < 7) continue;
    if (!map.has(proc)) map.set(proc, row);
  }
  return map;
}

function lookupProcess(procNorm: string, lookup: Map<string, Record<string, any>>): Record<string, any> | undefined {
  if (!procNorm || procNorm.length < 7) return undefined;
  return lookup.get(procNorm);
}

export default function PlanilhaTst() {
  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [results, setResults] = useState<ProcessRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, passo1: 0, passo2: 0, ia: 0, naoEncontrados: 0, matchInput2: 0, matchInput3: 0, matchInput4: 0, fieldFills: {}, unmatchedSamples: [] });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [originalFileBuffer, setOriginalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [input1Meta, setInput1Meta] = useState<{ headers: string[]; headerRowIndex: number } | null>(null);
  const cancelledRef = useRef(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [input1FileName, setInput1FileName] = useState("");

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
      const [input1, buf] = await Promise.all([
        readSheetData(files[0]),
        readOriginalFileBuffer(files[0]),
      ]);
      setOriginalFileBuffer(buf);
      setInput1Meta({ headers: input1.headers, headerRowIndex: input1.headerRowIndex });
      setInput1FileName(files[0].name.replace(/\.(xlsx|xls)$/i, ""));
      const input2 = files[1] ? await readSheetData(files[1]) : null;
      const input3 = files[2] ? await readSheetData(files[2]) : null;
      const input4 = files[3] ? await readSheetData(files[3]) : null;

      const lookup2 = input2 ? buildAllLookups(input2.rows, input2.headers) : new Map();
      const lookup3 = input3 ? buildAllLookups(input3.rows, input3.headers) : new Map();
      const lookup4 = input4 ? buildAllLookups(input4.rows, input4.headers) : new Map();

      // Diagnostic logging
      console.log("[PlanilhaTST] Input1:", input1.rows.length, "rows | Headers:", input1.headers.join(", "));
      if (input2) console.log("[PlanilhaTST] Input2:", input2.rows.length, "rows | Headers:", input2.headers.join(", ") , "| Lookup keys:", lookup2.size);
      if (input3) console.log("[PlanilhaTST] Input3:", input3.rows.length, "rows | Headers:", input3.headers.join(", "), "| Lookup keys:", lookup3.size);
      if (input4) console.log("[PlanilhaTST] Input4:", input4.rows.length, "rows | Headers:", input4.headers.join(", "), "| Lookup keys:", lookup4.size);

      // Log first 3 process numbers from each input for debugging
      const logSample = (label: string, rows: Record<string, any>[], headers: string[]) => {
        const samples = rows.slice(0, 3).map(r => `"${getProcessoFromRow(r, headers)}" → norm: "${normalizeProcesso(getProcessoFromRow(r, headers))}"`);
        console.log(`[PlanilhaTST] ${label} sample processes:`, samples);
      };
      logSample("Input1", input1.rows, input1.headers);
      if (input2) logSample("Input2", input2.rows, input2.headers);
      if (input3) logSample("Input3", input3.rows, input3.headers);
      if (input4) logSample("Input4", input4.rows, input4.headers);

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
        const row2 = lookupProcess(procNorm, lookup2);
        const row3 = lookupProcess(procNorm, lookup3);
        let complemented1 = false;

        const fields1: Array<{ key: keyof ProcessRow; terms: string[] }> = [
          { key: "dossie", terms: ["dossi", "dossie", "dossiê"] },
          { key: "equipe", terms: ["equipe", "nucleo", "núcleo", "coordenação", "coordenacao"] },
          { key: "reclamante", terms: ["reclamante", "autor", "polo ativo", "requerente"] },
          { key: "reclamada", terms: ["reclamada", "reu", "réu", "polo passivo", "requerido", "empresa", "cliente"] },
          { key: "relator", terms: ["relator", "ministro", "desembargador"] },
        ];

        for (const f of fields1) {
          if (forceOverwrite || isEmpty(pr[f.key] as string)) {
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
            if ((forceOverwrite || isEmpty(pr[f.key] as string)) && row3 && input3) {
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

      console.log(`[PlanilhaTST] Passo 1.1: ${countPasso1}/${processRows.length} processos complementados via Input 2/3`);
      
      // Log headers para diagnóstico de colunas
      if (input2) console.log(`[PlanilhaTST] Input2 headers:`, input2.headers.filter(h => h.trim()));
      if (input3) console.log(`[PlanilhaTST] Input3 headers:`, input3.headers.filter(h => h.trim()));
      if (input4) console.log(`[PlanilhaTST] Input4 headers:`, input4.headers.filter(h => h.trim()));
      
      // Detailed match diagnostics
      let matchCount2 = 0, matchCount3 = 0;
      const unmatchedSamples: string[] = [];
      for (const pr of processRows) {
        const norm = normalizeProcesso(pr.numero_processo);
        if (lookupProcess(norm, lookup2)) matchCount2++;
        if (lookupProcess(norm, lookup3)) matchCount3++;
        if (!lookupProcess(norm, lookup2) && !lookupProcess(norm, lookup3) && unmatchedSamples.length < 5) {
          unmatchedSamples.push(`"${pr.numero_processo}" (norm: "${norm}")`);
        }
      }
      console.log(`[PlanilhaTST] Match rates: Input2: ${matchCount2}/${processRows.length}, Input3: ${matchCount3}/${processRows.length}`);
      if (unmatchedSamples.length > 0) {
        console.log(`[PlanilhaTST] Unmatched samples:`, unmatchedSamples);
      }
      // Log first successful match to verify field extraction
      const firstMatched = processRows.find(pr => !isEmpty(pr.dossie) || !isEmpty(pr.equipe) || !isEmpty(pr.reclamante));
      if (firstMatched) {
        console.log(`[PlanilhaTST] First filled row:`, { proc: firstMatched.numero_processo, dossie: firstMatched.dossie, equipe: firstMatched.equipe, reclamante: firstMatched.reclamante, reclamada: firstMatched.reclamada, relator: firstMatched.relator });
      }

      setProgress(40);
      setProgressLabel("Cruzando dados (Passo 1.2 — Dossiês Ativos)...");

      // Passo 1.2: Input 4 for remaining empty fields (except RELATOR)
      for (const pr of processRows) {
        const procNorm = normalizeProcesso(pr.numero_processo);
        const row4 = lookupProcess(procNorm, lookup4);
        if (!row4 || !input4) continue;

        let complemented2 = false;
        const fields2: Array<{ key: keyof ProcessRow; terms: string[] }> = [
          { key: "dossie", terms: ["dossi", "dossie", "dossiê"] },
          { key: "equipe", terms: ["equipe", "nucleo", "núcleo", "coordenação", "coordenacao"] },
          { key: "reclamante", terms: ["reclamante", "autor", "polo ativo", "requerente"] },
          { key: "reclamada", terms: ["reclamada", "reu", "réu", "polo passivo", "requerido", "empresa", "cliente"] },
        ];

        for (const f of fields2) {
          if (forceOverwrite || isEmpty(pr[f.key] as string)) {
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

      // Input 4 diagnostics
      let matchCount4 = 0;
      for (const pr of processRows) {
        if (lookupProcess(normalizeProcesso(pr.numero_processo), lookup4)) matchCount4++;
      }
      console.log(`[PlanilhaTST] Passo 1.2: ${countPasso2}/${processRows.length} processos complementados via Input 4`);
      console.log(`[PlanilhaTST] Match rate Input4: ${matchCount4}/${processRows.length}`);

      setProgress(60);

      // Compute field fill counts per source
      const emptyDetail = (): FieldFillDetail => ({ total: 0, input2: 0, input3: 0, input4: 0, ia: 0 });
      const fieldFills: Record<string, FieldFillDetail> = {
        dossie: emptyDetail(), equipe: emptyDetail(), reclamante: emptyDetail(), reclamada: emptyDetail(), relator: emptyDetail(),
      };
      const fieldKeys = ["dossie", "equipe", "reclamante", "reclamada", "relator"] as const;
      for (const pr of processRows) {
        for (const fk of fieldKeys) {
          const origem = (pr as any)[`origem_${fk}`] as string | undefined;
          if (!isEmpty(pr[fk] as string) && origem) {
            fieldFills[fk].total++;
            if (origem === "input2") fieldFills[fk].input2++;
            else if (origem === "input3") fieldFills[fk].input3++;
            else if (origem === "input4") fieldFills[fk].input4++;
            else if (origem === "ia") fieldFills[fk].ia++;
          }
        }
      }

      // Passo 2: AI for remaining incomplete (only if enabled)
      const incomplete = processRows.filter(pr =>
        isEmpty(pr.dossie) || isEmpty(pr.equipe) || isEmpty(pr.reclamante) || isEmpty(pr.reclamada) || isEmpty(pr.relator)
      );

      let countIA = 0;

      if (useAI && incomplete.length > 0) {
        setProgressLabel("Enviando processos incompletos para IA...");
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
        matchInput2: matchCount2,
        matchInput3: matchCount3,
        matchInput4: matchCount4,
        fieldFills,
        unmatchedSamples,
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

  const gerarRelatorioPDF = () => {
    if (results.length === 0) return;

    const doc = new jsPDF();
    const now = new Date();
    const dataHora = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Cruzamento — Planilha TST", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${dataHora}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Arquivo base: ${input1FileName || "N/A"}`, pageWidth / 2, y, { align: "center" });
    y += 12;

    // Separator
    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 10;

    // Totalizadores
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Totalizadores", 14, y);
    y += 8;

    const totals = [
      { label: "Total de Processos", value: stats.total, color: [0, 0, 0] as [number, number, number] },
      { label: "Complementados via Passo 1.1 (Rel. Prazos / Processos)", value: stats.passo1, color: [59, 130, 246] as [number, number, number] },
      { label: "Complementados via Passo 1.2 (Dossiês Ativos)", value: stats.passo2, color: [147, 51, 234] as [number, number, number] },
      { label: "Complementados via IA", value: stats.ia, color: [245, 158, 11] as [number, number, number] },
      { label: "Não Encontrados", value: stats.naoEncontrados, color: [239, 68, 68] as [number, number, number] },
    ];

    doc.setFontSize(10);
    for (const t of totals) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(t.color[0], t.color[1], t.color[2]);
      doc.text(`• ${t.label}: `, 18, y);
      doc.setFont("helvetica", "bold");
      doc.text(String(t.value), 18 + doc.getTextWidth(`• ${t.label}: `), y);
      y += 6;
    }
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Matches por Planilha
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Matches por Planilha", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const matchRate = (val: number) => stats.total > 0 ? `${((val / stats.total) * 100).toFixed(1)}%` : "0%";
    doc.text(`• Rel. Prazos: ${stats.matchInput2}/${stats.total} (${matchRate(stats.matchInput2)})`, 18, y); y += 6;
    doc.text(`• Processos: ${stats.matchInput3}/${stats.total} (${matchRate(stats.matchInput3)})`, 18, y); y += 6;
    doc.text(`• Dossiês Ativos: ${stats.matchInput4}/${stats.total} (${matchRate(stats.matchInput4)})`, 18, y); y += 10;

    // Campos preenchidos detalhado por fonte
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Campos Preenchidos — Detalhamento por Fonte", 14, y);
    y += 10;

    const fieldLabels: Record<string, string> = {
      dossie: "Dossiê",
      equipe: "Equipe",
      reclamante: "Reclamante",
      reclamada: "Reclamada",
      relator: "Relator",
    };

    // Table header
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const colX = [18, 60, 95, 130, 160, 185];
    doc.text("Campo", colX[0], y);
    doc.text("Total", colX[1], y);
    doc.text("Rel. Prazos", colX[2], y);
    doc.text("Processos", colX[3], y);
    doc.text("Dossiês At.", colX[4], y);
    doc.text("IA", colX[5], y);
    y += 2;
    doc.setDrawColor(180);
    doc.line(colX[0], y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const [field, detail] of Object.entries(stats.fieldFills)) {
      if (y > 270) { doc.addPage(); y = 20; }
      const pct = stats.total > 0 ? `${((detail.total / stats.total) * 100).toFixed(1)}%` : "0%";
      doc.text(fieldLabels[field] || field, colX[0], y);
      doc.text(`${detail.total} (${pct})`, colX[1], y);
      doc.setTextColor(59, 130, 246);
      doc.text(String(detail.input2), colX[2], y);
      doc.setTextColor(147, 51, 234);
      doc.text(String(detail.input3), colX[3], y);
      doc.setTextColor(107, 114, 128);
      doc.text(String(detail.input4), colX[4], y);
      doc.setTextColor(245, 158, 11);
      doc.text(String(detail.ia), colX[5], y);
      doc.setTextColor(0, 0, 0);
      y += 6;
    }
    y += 6;

    // Processos não encontrados (amostras)
    if (stats.unmatchedSamples.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Amostras de Processos Não Encontrados", 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("courier", "normal");
      for (const s of stats.unmatchedSamples) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${s}`, 18, y);
        y += 5;
      }
    }

    // Configurações utilizadas
    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Configurações", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`• Sobrescrever campos já preenchidos: ${forceOverwrite ? "Sim" : "Não"}`, 18, y); y += 6;
    doc.text(`• IA habilitada: ${useAI ? "Sim" : "Não"}`, 18, y); y += 6;

    // Files used
    y += 4;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Arquivos Utilizados", 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    files.forEach((f, i) => {
      if (f) {
        doc.text(`• Input ${i + 1}: ${f.name}`, 18, y);
        y += 5;
      }
    });

    doc.save(`${input1FileName || "Distribuicoes_TST"} - Relatório.pdf`);
    toast.success("Relatório PDF gerado com sucesso!");
  };

  const baixarPlanilha = async () => {
    if (results.length === 0) return;

    if (originalFileBuffer && input1Meta) {
      try {
        // Modifica apenas os valores nas células, preservando os estilos originais
        const zip = await JSZip.loadAsync(originalFileBuffer);
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
        const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

        let worksheetPath = "xl/worksheets/sheet1.xml";

        if (workbookXml && workbookRelsXml) {
          const workbookDoc = parser.parseFromString(workbookXml, "application/xml");
          const relsDoc = parser.parseFromString(workbookRelsXml, "application/xml");
          const workbookNs = workbookDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
          const relsNs = relsDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/package/2006/relationships";
          const firstSheet = workbookDoc.getElementsByTagNameNS(workbookNs, "sheet")[0];
          const relationId = firstSheet?.getAttribute("r:id") || firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
          const relation = relationId
            ? Array.from(relsDoc.getElementsByTagNameNS(relsNs, "Relationship")).find((node) => node.getAttribute("Id") === relationId)
            : null;
          const target = relation?.getAttribute("Target");

          if (target) {
            worksheetPath = `xl/${target.replace(/^\/+/, "").replace(/^xl\//, "")}`;
          }
        }

        const sheetXml = await zip.file(worksheetPath)?.async("string");

        if (!sheetXml) {
          toast.error("Erro ao ler a planilha original");
          return;
        }

        const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
        const sheetNs = sheetDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const sheetData = sheetDoc.getElementsByTagNameNS(sheetNs, "sheetData")[0];

        if (!sheetData) {
          toast.error("Estrutura da planilha original inválida");
          return;
        }

        const headers = input1Meta.headers;
        const dataStartRow = input1Meta.headerRowIndex + 2; // 1-indexed

        const getColIdx = (terms: string[]): number => findColumnIndex(headers, ...terms);
        const colDossie = getColIdx(["dossi", "dossie", "dossiê"]);
        const colEquipe = getColIdx(["equipe"]);
        const colReclamante = getColIdx(["reclamante"]);
        const colReclamada = getColIdx(["reclamada"]);
        const colRelator = getColIdx(["relator"]);

        const rowMap = new Map<number, Element>();
        for (const rowEl of Array.from(sheetData.getElementsByTagNameNS(sheetNs, "row"))) {
          const rowNumber = Number(rowEl.getAttribute("r"));
          if (!Number.isNaN(rowNumber)) {
            rowMap.set(rowNumber, rowEl);
          }
        }

        const getRowCells = (rowEl: Element) =>
          Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter((cell) => cell.parentNode === rowEl);

        const getColumnLetters = (cellRef: string) => cellRef.replace(/\d+/g, "");

        const columnLettersToIndex = (letters: string) => {
          let value = 0;
          for (const char of letters) {
            value = value * 26 + (char.charCodeAt(0) - 64);
          }
          return value - 1;
        };

        const getCell = (rowEl: Element, cellRef: string) =>
          getRowCells(rowEl).find((cell) => cell.getAttribute("r") === cellRef) || null;

        const ensureRow = (rowNumber: number) => {
          const existing = rowMap.get(rowNumber);
          if (existing) return existing;

          const rowEl = sheetDoc.createElementNS(sheetNs, "row");
          rowEl.setAttribute("r", String(rowNumber));

          const allRows = Array.from(sheetData.getElementsByTagNameNS(sheetNs, "row")).filter((row) => row.parentNode === sheetData);
          const nextRow = allRows.find((row) => Number(row.getAttribute("r")) > rowNumber);
          if (nextRow) {
            sheetData.insertBefore(rowEl, nextRow);
          } else {
            sheetData.appendChild(rowEl);
          }

          rowMap.set(rowNumber, rowEl);
          return rowEl;
        };

        const createInlineStringChildren = (cellEl: Element, value: string) => {
          while (cellEl.firstChild) {
            cellEl.removeChild(cellEl.firstChild);
          }

          cellEl.setAttribute("t", "inlineStr");

          const isEl = sheetDoc.createElementNS(sheetNs, "is");
          const tEl = sheetDoc.createElementNS(sheetNs, "t");
          if (/^\s|\s$| {2,}|\n/.test(value)) {
            tEl.setAttribute("xml:space", "preserve");
          }
          tEl.textContent = value;
          isEl.appendChild(tEl);
          cellEl.appendChild(isEl);
        };

        const findStyleForNewCell = (rowEl: Element, rowNumber: number, colIdx: number) => {
          const sameRowStyle = getRowCells(rowEl)
            .map((cell) => ({
              style: cell.getAttribute("s"),
              distance: Math.abs(columnLettersToIndex(getColumnLetters(cell.getAttribute("r") || "A")) - colIdx),
            }))
            .filter((item): item is { style: string; distance: number } => Boolean(item.style))
            .sort((a, b) => a.distance - b.distance)[0]?.style;

          if (sameRowStyle) return sameRowStyle;

          const colLetters = XLSX.utils.encode_col(colIdx);
          for (let offset = 1; offset <= results.length; offset++) {
            for (const candidateRowNumber of [rowNumber - offset, rowNumber + offset]) {
              const candidateRow = rowMap.get(candidateRowNumber);
              if (!candidateRow) continue;

              const sameColumnCell = getCell(candidateRow, `${colLetters}${candidateRowNumber}`);
              const sameColumnStyle = sameColumnCell?.getAttribute("s");
              if (sameColumnStyle) return sameColumnStyle;

              const fallbackRowStyle = getRowCells(candidateRow)
                .map((cell) => cell.getAttribute("s"))
                .find((style): style is string => Boolean(style));
              if (fallbackRowStyle) return fallbackRowStyle;
            }
          }

          return null;
        };

        const upsertCellValue = (rowNumber: number, colIdx: number, value: string) => {
          if (colIdx < 0 || isEmpty(value)) return;

          const rowEl = ensureRow(rowNumber);
          const cellRef = XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIdx });
          const existingCell = getCell(rowEl, cellRef);

          if (existingCell) {
            createInlineStringChildren(existingCell, value);
            return;
          }

          const newCell = sheetDoc.createElementNS(sheetNs, "c");
          newCell.setAttribute("r", cellRef);

          const inheritedStyle = findStyleForNewCell(rowEl, rowNumber, colIdx);
          if (inheritedStyle) {
            newCell.setAttribute("s", inheritedStyle);
          }

          createInlineStringChildren(newCell, value);

          const rowCells = getRowCells(rowEl);
          const nextCell = rowCells.find((cell) => {
            const ref = cell.getAttribute("r") || "";
            return columnLettersToIndex(getColumnLetters(ref)) > colIdx;
          });

          if (nextCell) {
            rowEl.insertBefore(newCell, nextCell);
          } else {
            rowEl.appendChild(newCell);
          }
        };

        for (const pr of results) {
          const excelRow = dataStartRow + pr.originalIndex;
          const tryWrite = (colIdx: number, value: string, origemKey: string) => {
            if (colIdx < 0 || isEmpty(value)) return;
            // Write if the field was filled by the system (has origem)
            if (!(pr as any)[origemKey]) return;
            upsertCellValue(excelRow, colIdx, value);
          };

          tryWrite(colDossie, pr.dossie, "origem_dossie");
          tryWrite(colEquipe, pr.equipe, "origem_equipe");
          tryWrite(colReclamante, pr.reclamante, "origem_reclamante");
          tryWrite(colReclamada, pr.reclamada, "origem_reclamada");
          tryWrite(colRelator, pr.relator, "origem_relator");
        }

        const parserError = sheetDoc.getElementsByTagName("parsererror")[0];
        if (parserError) {
          toast.error("Erro ao montar a planilha final");
          return;
        }

        zip.file(worksheetPath, serializer.serializeToString(sheetDoc));

        // --- Adicionar estilo amarelo no styles.xml para células preenchidas ---
        const stylesPath = "xl/styles.xml";
        const stylesXml = await zip.file(stylesPath)?.async("string");
        let yellowStyleIndex: string | null = null;

        if (stylesXml) {
          const stylesDoc = parser.parseFromString(stylesXml, "application/xml");
          const stylesNs = stylesDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

          // 1. Adicionar fill amarelo
          const fills = stylesDoc.getElementsByTagNameNS(stylesNs, "fills")[0];
          const fillCount = fills ? Number(fills.getAttribute("count") || "0") : 0;
          const newFillIndex = fillCount;

          if (fills) {
            const fillEl = stylesDoc.createElementNS(stylesNs, "fill");
            const patternEl = stylesDoc.createElementNS(stylesNs, "patternFill");
            patternEl.setAttribute("patternType", "solid");
            const fgColor = stylesDoc.createElementNS(stylesNs, "fgColor");
            fgColor.setAttribute("rgb", "FFFFFF00");
            const bgColor = stylesDoc.createElementNS(stylesNs, "bgColor");
            bgColor.setAttribute("indexed", "64");
            patternEl.appendChild(fgColor);
            patternEl.appendChild(bgColor);
            fillEl.appendChild(patternEl);
            fills.appendChild(fillEl);
            fills.setAttribute("count", String(fillCount + 1));
          }

          // 2. Adicionar um novo xf em cellXfs que herda do primeiro xf mas com fill amarelo
          const cellXfs = stylesDoc.getElementsByTagNameNS(stylesNs, "cellXfs")[0];
          const xfCount = cellXfs ? Number(cellXfs.getAttribute("count") || "0") : 0;

          if (cellXfs) {
            // Pegar o primeiro xf como base para herdar fonte/borda/alinhamento
            const baseXf = cellXfs.getElementsByTagNameNS(stylesNs, "xf")[0];
            const newXf = stylesDoc.createElementNS(stylesNs, "xf");
            if (baseXf) {
              newXf.setAttribute("numFmtId", baseXf.getAttribute("numFmtId") || "0");
              newXf.setAttribute("fontId", baseXf.getAttribute("fontId") || "0");
              newXf.setAttribute("borderId", baseXf.getAttribute("borderId") || "0");
            } else {
              newXf.setAttribute("numFmtId", "0");
              newXf.setAttribute("fontId", "0");
              newXf.setAttribute("borderId", "0");
            }
            newXf.setAttribute("fillId", String(newFillIndex));
            newXf.setAttribute("applyFill", "1");
            cellXfs.appendChild(newXf);
            cellXfs.setAttribute("count", String(xfCount + 1));
            yellowStyleIndex = String(xfCount);
          }

          zip.file(stylesPath, serializer.serializeToString(stylesDoc));
        }

        // --- Aplicar o estilo amarelo nas células que foram preenchidas ---
        if (yellowStyleIndex) {
          const updatedSheetXml = await zip.file(worksheetPath)?.async("string");
          if (updatedSheetXml) {
            const updatedDoc = parser.parseFromString(updatedSheetXml, "application/xml");
            const updatedNs = updatedDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            const updatedSheetData = updatedDoc.getElementsByTagNameNS(updatedNs, "sheetData")[0];

            if (updatedSheetData) {
              const updatedRowMap = new Map<number, Element>();
              for (const rowEl of Array.from(updatedSheetData.getElementsByTagNameNS(updatedNs, "row"))) {
                const rn = Number(rowEl.getAttribute("r"));
                if (!Number.isNaN(rn)) updatedRowMap.set(rn, rowEl);
              }

              for (const pr of results) {
                const excelRow = dataStartRow + pr.originalIndex;
                const markYellow = (colIdx: number, value: string, origemKey: string) => {
                  if (colIdx < 0 || isEmpty(value) || !(pr as any)[origemKey]) return;
                  const rowEl = updatedRowMap.get(excelRow);
                  if (!rowEl) return;
                  const cellRef = XLSX.utils.encode_cell({ r: excelRow - 1, c: colIdx });
                  const cells = Array.from(rowEl.getElementsByTagNameNS(updatedNs, "c")).filter(c => c.parentNode === rowEl);
                  const cell = cells.find(c => c.getAttribute("r") === cellRef);
                  if (cell) cell.setAttribute("s", yellowStyleIndex!);
                };

                markYellow(colDossie, pr.dossie, "origem_dossie");
                markYellow(colEquipe, pr.equipe, "origem_equipe");
                markYellow(colReclamante, pr.reclamante, "origem_reclamante");
                markYellow(colReclamada, pr.reclamada, "origem_reclamada");
                markYellow(colRelator, pr.relator, "origem_relator");
              }

              zip.file(worksheetPath, serializer.serializeToString(updatedDoc));
            }
          }
        }

        // Generate and download
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${input1FileName || "Distribuicoes_TST"} complementada.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Erro ao exportar:", err);
        toast.error("Erro ao exportar planilha. Tentando método alternativo...");
        // Fallback
        exportFallback();
      }
    } else {
      exportFallback();
    }

    toast.success("Planilha baixada com sucesso!");
  };

  const exportFallback = () => {
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
    XLSX.writeFile(wb, `${input1FileName || "Distribuicoes_TST"} complementada.xlsx`);
  };

  const origemBadge = (origem?: string) => {
    if (!origem) return null;
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      input2: { label: "Prazos", variant: "default" },
      input3: { label: "Processos", variant: "secondary" },
      input4: { label: "Dossiês Ativos", variant: "outline" },
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

        {/* Options */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={forceOverwrite} onCheckedChange={(v) => setForceOverwrite(!!v)} />
              <span className="text-sm">Sobrescrever campos já preenchidos no Input 1</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={useAI} onCheckedChange={(v) => setUseAI(!!v)} />
              <span className="text-sm flex items-center gap-1"><Sparkles className="w-3 h-3" /> Usar IA para processos não encontrados</span>
            </label>
          </CardContent>
        </Card>

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

        {/* Diagnostics Card */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> Diagnóstico do Cruzamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="font-medium mb-1">Matches por Planilha</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Rel. Prazos: <span className="text-foreground font-medium">{stats.matchInput2}/{stats.total}</span></li>
                      <li>Processos: <span className="text-foreground font-medium">{stats.matchInput3}/{stats.total}</span></li>
                      <li>Dossiês Ativos: <span className="text-foreground font-medium">{stats.matchInput4}/{stats.total}</span></li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Processos Não Encontrados (amostras)</p>
                    {stats.unmatchedSamples.length > 0 ? (
                      <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                        {stats.unmatchedSamples.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Todos encontrados!</p>
                    )}
                  </div>
                </div>

                {/* Detailed field fills table */}
                <div>
                  <p className="font-medium mb-2">Campos Preenchidos — Detalhamento por Fonte</p>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Campo</TableHead>
                          <TableHead className="text-xs text-center">Total</TableHead>
                          <TableHead className="text-xs text-center">
                            <Badge variant="default" className="text-[10px]">Rel. Prazos</Badge>
                          </TableHead>
                          <TableHead className="text-xs text-center">
                            <Badge variant="secondary" className="text-[10px]">Processos</Badge>
                          </TableHead>
                          <TableHead className="text-xs text-center">
                            <Badge variant="outline" className="text-[10px]">Dossiês Ativos</Badge>
                          </TableHead>
                          <TableHead className="text-xs text-center">
                            <Badge variant="destructive" className="text-[10px]">IA</Badge>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(stats.fieldFills).map(([field, detail]) => {
                          const label = field.charAt(0).toUpperCase() + field.slice(1);
                          const pct = stats.total > 0 ? `${((detail.total / stats.total) * 100).toFixed(1)}%` : "0%";
                          return (
                            <TableRow key={field}>
                              <TableCell className="text-xs font-medium">{label}</TableCell>
                              <TableCell className="text-xs text-center font-bold">{detail.total} <span className="text-muted-foreground font-normal">({pct})</span></TableCell>
                              <TableCell className="text-xs text-center">{detail.input2 || "—"}</TableCell>
                              <TableCell className="text-xs text-center">{detail.input3 || "—"}</TableCell>
                              <TableCell className="text-xs text-center">{detail.input4 || "—"}</TableCell>
                              <TableCell className="text-xs text-center">{detail.ia || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download */}
        {results.length > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={baixarPlanilha} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Planilha Complementada
            </Button>
            <Button onClick={gerarRelatorioPDF} variant="outline" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Baixar Relatório PDF
            </Button>
          </div>
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
