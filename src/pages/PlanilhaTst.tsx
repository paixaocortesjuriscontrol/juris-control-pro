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
  Circle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Classificação de Relatores (Prompt item g) ---
const RELATOR_CLASSIFICACAO: Record<string, "POSITIVO" | "NEGATIVO"> = {
  "luiz philippe vieira de mello filho": "NEGATIVO",
  "guilherme augusto caputo bastos": "POSITIVO",
  "jose roberto freire pimenta": "NEGATIVO",
  "ives gandra da silva martins filho": "POSITIVO",
  "maria cristina irigoyen peduzzi": "POSITIVO",
  "lelio bentes correa": "NEGATIVO",
  "mauricio jose godinho delgado": "NEGATIVO",
  "katia magalhaes arruda": "NEGATIVO",
  "augusto cesar leite de carvalho": "NEGATIVO",
  "delaide alves miranda arantes": "NEGATIVO",
  "hugo carlos scheuermann": "NEGATIVO",
  "alexandre de souza agra belmonte": "POSITIVO",
  "claudio mascarenhas brandao": "NEGATIVO",
  "douglas alencar rodrigues": "POSITIVO",
  "maria helena mallmann": "NEGATIVO",
  "breno medeiros": "POSITIVO",
  "alexandre luiz ramos": "POSITIVO",
  "luiz jose dezena da silva": "POSITIVO",
  "evandro pereira valadao lopes": "POSITIVO",
  "amaury rodrigues pinto junior": "POSITIVO",
  "alberto bastos balazeiro": "NEGATIVO",
  "morgana de almeida richa": "POSITIVO",
  "sergio pinto martins": "POSITIVO",
  "liana chaib": "NEGATIVO",
  "antonio fabricio de matos goncalves": "NEGATIVO",
  "jose pedro de camargo rodrigues de souza": "POSITIVO",
  "joao pedro silvestrin": "POSITIVO",
};

// --- Relator → Turma mapping (Prompt item h) ---
const RELATOR_TURMA: Record<string, string> = {
  "luiz philippe vieira de mello filho": "Presidente",
  "guilherme augusto caputo bastos": "Vice-Presidente",
  "jose roberto freire pimenta": "Corregedor-Geral",
  "ives gandra da silva martins filho": "4ª Turma",
  "maria cristina irigoyen peduzzi": "Impedida",
  "lelio bentes correa": "1ª Turma",
  "mauricio jose godinho delgado": "3ª Turma",
  "katia magalhaes arruda": "6ª Turma",
  "augusto cesar leite de carvalho": "6ª Turma",
  "delaide alves miranda arantes": "2ª Turma",
  "hugo carlos scheuermann": "1ª Turma",
  "alexandre de souza agra belmonte": "3ª Turma",
  "claudio mascarenhas brandao": "7ª Turma",
  "douglas alencar rodrigues": "5ª Turma",
  "maria helena mallmann": "2ª Turma",
  "breno medeiros": "5ª Turma",
  "alexandre luiz ramos": "4ª Turma",
  "luiz jose dezena da silva": "8ª Turma",
  "evandro pereira valadao lopes": "8ª Turma",
  "amaury rodrigues pinto junior": "1ª Turma",
  "alberto bastos balazeiro": "7ª Turma",
  "morgana de almeida richa": "4ª Turma",
  "sergio pinto martins": "8ª Turma",
  "liana chaib": "3ª Turma",
  "antonio fabricio de matos goncalves": "7ª Turma",
  "jose pedro de camargo rodrigues de souza": "5ª Turma",
  "joao pedro silvestrin": "2ª Turma",
};

// --- Classificação de Turmas (Prompt item h) ---
const TURMA_CLASSIFICACAO: Record<string, "POSITIVA" | "NEGATIVA"> = {
  "1ª turma": "POSITIVA",
  "2ª turma": "NEGATIVA",
  "3ª turma": "NEGATIVA",
  "4ª turma": "POSITIVA",
  "5ª turma": "POSITIVA",
  "6ª turma": "NEGATIVA",
  "7ª turma": "NEGATIVA",
  "8ª turma": "POSITIVA",
  "sbdi-1": "NEGATIVA",
  "sbdi-2": "POSITIVA",
  "pleno": "NEGATIVA",
  "presidencia": "NEGATIVA",
  "vice-presidencia": "NEGATIVA",
  "corregedoria": "NEGATIVA",
};

// Classificar turma pelo nome da turma (coluna I)
function classificarTurma(nomeTurma: string): "POSITIVA" | "NEGATIVA" | "" {
  if (!nomeTurma || isEmpty(nomeTurma)) return "";
  const norm = nomeTurma.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (TURMA_CLASSIFICACAO[norm]) return TURMA_CLASSIFICACAO[norm];
  for (const [key, val] of Object.entries(TURMA_CLASSIFICACAO)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return "";
}

// Regra A: Remove "Gabinete do/da" e prefixos similares, deixando só o nome do ministro
function limparNomeMinistroColG(valor: string): string {
  if (!valor || isEmpty(valor)) return valor;
  // Remove "Gabinete do ", "Gabinete da ", "Gab. do ", "Gab. da ", case-insensitive
  let limpo = valor.replace(/^gabinete\s+d[aoe]\s+/i, "").replace(/^gab\.\s*d[aoe]\s+/i, "").trim();
  // Remove "Min. " or "Ministro " or "Ministra " prefix
  limpo = limpo.replace(/^min\.\s*/i, "").replace(/^ministr[oa]\s+/i, "").trim();
  return limpo;
}

// Regra B: Na coluna I, remover nome do ministro, deixando só turma/órgão
function limparTurmaColI(valor: string): string {
  if (!valor || isEmpty(valor)) return valor;
  const padroes = [
    /\d+[ªa]\s*turma/i,
    /sbdi[\s-]*[12]/i,
    /pleno/i,
    /presid[eê]ncia/i,
    /presidente/i,
    /vice[\s-]*presid[eê]ncia/i,
    /vice[\s-]*presidente/i,
    /corregedor(?:ia)?(?:[\s-]*geral)?/i,
    /cejusc/i,
    /sub[\s-]*se[çc][ãa]o/i,
    /subse[çc][ãa]o/i,
    /se[çc][ãa]o/i,
    /sess[ãa]o/i,
    /impedid[oa]/i,
  ];
  for (const padrao of padroes) {
    const match = valor.match(padrao);
    if (match) return match[0].trim();
  }
  return valor;
}

// Extrair nome do ministro de texto combinado como "7ª Turma - Gabinete do Ministro Evandro..."
function extrairMinistroDeTextoCombinadoI(valor: string): string {
  if (!valor || isEmpty(valor)) return "";
  // Pattern: "Xª Turma - Gabinete do/da Ministro/a Nome..." or "Xª Turma - Gabinete do Desembargador..."
  const match = valor.match(/(?:gabinete\s+d[aoe]\s+)(?:ministr[oa]\s+|desembargador(?:a)?\s+(?:convocad[oa]\s+)?)?(.+)/i);
  if (match && match[1]) return match[1].trim();
  // Pattern without "Gabinete": "Xª Turma - Ministro Nome"
  const match2 = valor.match(/(?:turma|sbdi|pleno|presid)\s*[-–]\s*(?:ministr[oa]\s+|desembargador(?:a)?\s+(?:convocad[oa]\s+)?)?(.+)/i);
  if (match2 && match2[1]) return match2[1].trim();
  return "";
}

function classificarRelator(nomeRelator: string): "POSITIVO" | "NEGATIVO" | "" {
  if (!nomeRelator || isEmpty(nomeRelator)) return "";
  const norm = nomeRelator.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  // Try exact match first, then partial match
  if (RELATOR_CLASSIFICACAO[norm]) return RELATOR_CLASSIFICACAO[norm];
  for (const [key, val] of Object.entries(RELATOR_CLASSIFICACAO)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  // Try matching by last name
  const parts = norm.split(/\s+/);
  for (const [key, val] of Object.entries(RELATOR_CLASSIFICACAO)) {
    const keyParts = key.split(/\s+/);
    // Match if last name matches
    if (parts.length > 0 && keyParts.length > 0 && parts[parts.length - 1] === keyParts[keyParts.length - 1]) {
      return val;
    }
  }
  return "";
}

function classificarTurmaDoRelator(nomeRelator: string): { turma: string; classificacao: "POSITIVA" | "NEGATIVA" | "" } {
  if (!nomeRelator || isEmpty(nomeRelator)) return { turma: "", classificacao: "" };
  const norm = nomeRelator.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  const findTurma = (key: string): string | undefined => RELATOR_TURMA[key];
  
  let turma = findTurma(norm);
  if (!turma) {
    for (const [key, val] of Object.entries(RELATOR_TURMA)) {
      if (norm.includes(key) || key.includes(norm)) { turma = val; break; }
    }
  }
  if (!turma) {
    const parts = norm.split(/\s+/);
    for (const [key, val] of Object.entries(RELATOR_TURMA)) {
      const keyParts = key.split(/\s+/);
      if (parts.length > 0 && keyParts.length > 0 && parts[parts.length - 1] === keyParts[keyParts.length - 1]) {
        turma = val; break;
      }
    }
  }
  
  if (!turma) return { turma: "", classificacao: "" };
  
  const turmaLower = turma.toLowerCase();
  const classificacao = TURMA_CLASSIFICACAO[turmaLower] || "";
  return { turma, classificacao };
}

interface ProcessRow {
  sheetIndex: number;
  originalIndex: number;
  originalData: Record<string, any>;
  numero_processo: string;
  dossie: string;
  equipe: string;
  reclamante: string;
  reclamada: string;
  relator: string;
  classificacao_relator: string;
  turma_relator: string;
  classificacao_turma: string;
  origem_dossie?: string;
  origem_equipe?: string;
  origem_reclamante?: string;
  origem_reclamada?: string;
  origem_relator?: string;
  origem_classificacao_relator?: string;
  origem_turma_relator?: string;
  origem_classificacao_turma?: string;
}

interface SheetData {
  headers: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
}

interface FieldFillDetail {
  total: number;
  uniqueTotal: number;
  input2: number;
  uniqueInput2: number;
  input3: number;
  uniqueInput3: number;
  input4: number;
  uniqueInput4: number;
  ia: number;
  uniqueIa: number;
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
  totalUnicosInput1: number;
  fieldFills: Record<string, FieldFillDetail>;
  unmatchedSamples: string[];
  dossiesNaoLocalizados: number;
  linhasPreenchidas: number;
  totalLinhas: number;
  preenchimentoPorColuna: Record<string, { preenchidas: number; total: number }>;
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

function readAllSheetsFromFile(file: File): Promise<{ sheets: (SheetData & { sheetName: string; sheetIndex: number })[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheets: (SheetData & { sheetName: string; sheetIndex: number })[] = [];
        for (let si = 0; si < wb.SheetNames.length; si++) {
          const sheetName = wb.SheetNames[si];
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, rawNumbers: false }) as any[][];
          let headerIdx = 0;
          for (let i = 0; i < Math.min(json.length, 10); i++) {
            const row = json[i];
            if (row && row.some(c => c && String(c).toLowerCase().includes("processo"))) {
              headerIdx = i; break;
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
          sheets.push({ headers, rows, headerRowIndex: headerIdx, sheetName, sheetIndex: si });
        }
        resolve({ sheets });
      } catch (err) { reject(err); }
    };
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
  const [stats, setStats] = useState<Stats>({ total: 0, passo1: 0, passo2: 0, ia: 0, naoEncontrados: 0, matchInput2: 0, matchInput3: 0, matchInput4: 0, totalUnicosInput1: 0, fieldFills: {}, unmatchedSamples: [], dossiesNaoLocalizados: 0, linhasPreenchidas: 0, totalLinhas: 0, preenchimentoPorColuna: {} });
  const [processing, setProcessing] = useState(false);
  type StepStatus = "pending" | "active" | "done";
  const [progressSteps, setProgressSteps] = useState<{ label: string; status: StepStatus }[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [originalFileBuffer, setOriginalFileBuffer] = useState<ArrayBuffer | null>(null);
  const [input1Meta, setInput1Meta] = useState<{ headers: string[]; headerRowIndex: number; sheetName: string }[]>([]);
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

    const stepLabels = [
      "Lendo planilhas",
      "Cruzando Prazos e Processos",
      "Cruzando Dossiês Ativos",
      "Classificando Relatores e Turmas",
      ...(useAI ? ["Análise por IA"] : []),
      "Finalizando",
    ];
    const steps: { label: string; status: StepStatus }[] = stepLabels.map(label => ({ label, status: "pending" as StepStatus }));
    let currentStep = 0;

    const tick = async (pct?: number) => {
      if (pct !== undefined) setProgressPct(pct);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16)));
    };
    const advanceStep = async (pct: number) => {
      steps[currentStep].status = "done";
      currentStep++;
      if (currentStep < steps.length) steps[currentStep].status = "active";
      setProgressSteps([...steps]);
      setProgressPct(pct);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    };

    setProcessing(true);
    setProgressPct(0);
    steps[0].status = "active";
    setProgressSteps([...steps]);
    cancelledRef.current = false;

    try {
      await tick(2);
      const allInput1Sheets = await readAllSheetsFromFile(files[0]);
      await tick(5);
      const buf = await readOriginalFileBuffer(files[0]);
      await tick(7);
      setOriginalFileBuffer(buf);
      setInput1Meta(allInput1Sheets.sheets.map(s => ({ headers: s.headers, headerRowIndex: s.headerRowIndex, sheetName: s.sheetName })));
      setInput1FileName(files[0].name.replace(/\.(xlsx|xls)$/i, ""));
      let input2: SheetData | null = null;
      if (files[1]) { input2 = await readSheetData(files[1]); await tick(9); }
      let input3: SheetData | null = null;
      if (files[2]) { input3 = await readSheetData(files[2]); await tick(11); }
      let input4: SheetData | null = null;
      if (files[3]) { input4 = await readSheetData(files[3]); await tick(13); }

      await tick(14);
      const lookup2 = input2 ? buildAllLookups(input2.rows, input2.headers) : new Map<string, Record<string, any>>();
      await tick(14);
      const lookup3 = input3 ? buildAllLookups(input3.rows, input3.headers) : new Map<string, Record<string, any>>();
      await tick(14);
      const lookup4 = input4 ? buildAllLookups(input4.rows, input4.headers) : new Map<string, Record<string, any>>();

      for (const sheet of allInput1Sheets.sheets) {
        console.log(`[PlanilhaTST] Input1 Aba "${sheet.sheetName}" (${sheet.sheetIndex}):`, sheet.rows.length, "rows | Headers:", sheet.headers.join(", "));
      }
      if (input2) console.log("[PlanilhaTST] Input2:", input2.rows.length, "rows | Lookup keys:", lookup2.size);
      if (input3) console.log("[PlanilhaTST] Input3:", input3.rows.length, "rows | Lookup keys:", lookup3.size);
      if (input4) console.log("[PlanilhaTST] Input4:", input4.rows.length, "rows | Lookup keys:", lookup4.size);

      const logSample = (label: string, rows: Record<string, any>[], headers: string[]) => {
        const samples = rows.slice(0, 3).map(r => `"${getProcessoFromRow(r, headers)}" → norm: "${normalizeProcesso(getProcessoFromRow(r, headers))}"`);
        console.log(`[PlanilhaTST] ${label} sample processes:`, samples);
      };
      for (const sheet of allInput1Sheets.sheets) {
        logSample(`Input1[${sheet.sheetName}]`, sheet.rows, sheet.headers);
      }
      if (input2) logSample("Input2", input2.rows, input2.headers);
      if (input3) logSample("Input3", input3.rows, input3.headers);
      if (input4) logSample("Input4", input4.rows, input4.headers);

      await advanceStep(15);

      const processRows: ProcessRow[] = [];
      let countPasso1 = 0;
      let countPasso2 = 0;
      const totalInput1Rows = allInput1Sheets.sheets.reduce((sum, s) => sum + s.rows.length, 0);
      let globalRowCounter = 0;

      for (const sheet of allInput1Sheets.sheets) {
        for (let i = 0; i < sheet.rows.length; i++) {
          if (globalRowCounter % 20 === 0) await tick(15 + Math.round((globalRowCounter / totalInput1Rows) * 20));
          globalRowCounter++;
          const row = sheet.rows[i];
          const proc = getProcessoFromRow(row, sheet.headers);
          const procNorm = normalizeProcesso(proc);

          const relatorVal = getFieldFromRow(row, sheet.headers, "relator") || NOT_FOUND;
          const classRelator = classificarRelator(relatorVal);
          const turmaInfo = classificarTurmaDoRelator(relatorVal);

          const pr: ProcessRow = {
            sheetIndex: sheet.sheetIndex,
            originalIndex: i,
            originalData: { ...row },
            numero_processo: proc,
            dossie: getFieldFromRow(row, sheet.headers, "dossi", "dossie", "dossiê") || NOT_FOUND,
            equipe: getFieldFromRow(row, sheet.headers, "equipe") || NOT_FOUND,
            reclamante: getFieldFromRow(row, sheet.headers, "reclamante") || NOT_FOUND,
            reclamada: getFieldFromRow(row, sheet.headers, "reclamada") || NOT_FOUND,
            relator: relatorVal,
            classificacao_relator: classRelator,
            turma_relator: turmaInfo.turma,
            classificacao_turma: turmaInfo.classificacao,
          };

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
              if (row2 && input2) {
                const val = getFieldFromRow(row2, input2.headers, ...f.terms);
                if (!isEmpty(val)) {
                  (pr as any)[f.key] = val;
                  (pr as any)[`origem_${f.key}`] = "input2";
                  complemented1 = true;
                }
              }
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
      }

      console.log(`[PlanilhaTST] Passo 1.1: ${countPasso1}/${processRows.length} processos complementados via Input 2/3`);
      console.log(`[PlanilhaTST] Total abas processadas: ${allInput1Sheets.sheets.length}`);

      if (input2) console.log(`[PlanilhaTST] Input2 headers:`, input2.headers.filter(h => h.trim()));
      if (input3) console.log(`[PlanilhaTST] Input3 headers:`, input3.headers.filter(h => h.trim()));
      if (input4) console.log(`[PlanilhaTST] Input4 headers:`, input4.headers.filter(h => h.trim()));

      const matchedSet2 = new Set<string>();
      const matchedSet3 = new Set<string>();
      const uniqueInput1Set = new Set<string>();
      const unmatchedSamples: string[] = [];
      for (let pi = 0; pi < processRows.length; pi++) {
        if (pi % 20 === 0) await tick();
        const pr = processRows[pi];
        const norm = normalizeProcesso(pr.numero_processo);
        if (norm) uniqueInput1Set.add(norm);
        if (lookupProcess(norm, lookup2)) matchedSet2.add(norm);
        if (lookupProcess(norm, lookup3)) matchedSet3.add(norm);
        if (!lookupProcess(norm, lookup2) && !lookupProcess(norm, lookup3) && unmatchedSamples.length < 5) {
          unmatchedSamples.push(`"${pr.numero_processo}" (norm: "${norm}")`);
        }
      }
      const matchCount2 = matchedSet2.size;
      const matchCount3 = matchedSet3.size;
      console.log(`[PlanilhaTST] Match rates: Input2: ${matchCount2}/${processRows.length}, Input3: ${matchCount3}/${processRows.length}`);
      if (unmatchedSamples.length > 0) {
        console.log(`[PlanilhaTST] Unmatched samples:`, unmatchedSamples);
      }
      const firstMatched = processRows.find(pr => !isEmpty(pr.dossie) || !isEmpty(pr.equipe) || !isEmpty(pr.reclamante));
      if (firstMatched) {
        console.log(`[PlanilhaTST] First filled row:`, { proc: firstMatched.numero_processo, dossie: firstMatched.dossie, equipe: firstMatched.equipe, reclamante: firstMatched.reclamante, reclamada: firstMatched.reclamada, relator: firstMatched.relator });
      }

      await advanceStep(40);

      // Passo 1.2: Input 4 for remaining empty fields (except RELATOR)
      for (let pi = 0; pi < processRows.length; pi++) {
        if (pi % 20 === 0) await tick(40 + Math.round((pi / processRows.length) * 15));
        const pr = processRows[pi];
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

      // Input 4 diagnostics — count UNIQUE processes, not rows
      const matchedSet4 = new Set<string>();
      for (const pr of processRows) {
        const norm = normalizeProcesso(pr.numero_processo);
        if (lookupProcess(norm, lookup4)) matchedSet4.add(norm);
      }
      const matchCount4 = matchedSet4.size;
      console.log(`[PlanilhaTST] Passo 1.2: ${countPasso2}/${processRows.length} processos complementados via Input 4`);
      console.log(`[PlanilhaTST] Match rate Input4: ${matchCount4} unique processes`);

      await advanceStep(55);

      // Re-classify relator/turma after all data sources updated relator field
      for (let pi = 0; pi < processRows.length; pi++) {
        if (pi % 20 === 0) await tick(55 + Math.round((pi / processRows.length) * 10));
        const pr = processRows[pi];
        if (!isEmpty(pr.relator)) {
          const cl = classificarRelator(pr.relator);
          const ti = classificarTurmaDoRelator(pr.relator);
          if (cl) {
            pr.classificacao_relator = cl;
            pr.origem_classificacao_relator = pr.origem_relator || "auto";
          }
          if (ti.turma) {
            pr.turma_relator = ti.turma;
            pr.classificacao_turma = ti.classificacao;
            pr.origem_turma_relator = pr.origem_relator || "auto";
            pr.origem_classificacao_turma = pr.origem_relator || "auto";
          }
        }
      }

      await advanceStep(65);

      // Compute field fill counts per source
      const emptyDetail = (): FieldFillDetail => ({
        total: 0,
        uniqueTotal: 0,
        input2: 0,
        uniqueInput2: 0,
        input3: 0,
        uniqueInput3: 0,
        input4: 0,
        uniqueInput4: 0,
        ia: 0,
        uniqueIa: 0,
      });
      const fieldFills: Record<string, FieldFillDetail> = {
        dossie: emptyDetail(), equipe: emptyDetail(), reclamante: emptyDetail(), reclamada: emptyDetail(), relator: emptyDetail(),
      };
      const fieldFillUniques: Record<string, Record<"total" | "input2" | "input3" | "input4" | "ia", Set<string>>> = {
        dossie: { total: new Set(), input2: new Set(), input3: new Set(), input4: new Set(), ia: new Set() },
        equipe: { total: new Set(), input2: new Set(), input3: new Set(), input4: new Set(), ia: new Set() },
        reclamante: { total: new Set(), input2: new Set(), input3: new Set(), input4: new Set(), ia: new Set() },
        reclamada: { total: new Set(), input2: new Set(), input3: new Set(), input4: new Set(), ia: new Set() },
        relator: { total: new Set(), input2: new Set(), input3: new Set(), input4: new Set(), ia: new Set() },
      };
      const fieldKeys = ["dossie", "equipe", "reclamante", "reclamada", "relator"] as const;
      for (const pr of processRows) {
        const procNorm = normalizeProcesso(pr.numero_processo);
        for (const fk of fieldKeys) {
          const origem = (pr as any)[`origem_${fk}`] as string | undefined;
          if (!isEmpty(pr[fk] as string) && origem) {
            fieldFills[fk].total++;
            if (procNorm) fieldFillUniques[fk].total.add(procNorm);
            if (origem === "input2") {
              fieldFills[fk].input2++;
              if (procNorm) fieldFillUniques[fk].input2.add(procNorm);
            }
            else if (origem === "input3") {
              fieldFills[fk].input3++;
              if (procNorm) fieldFillUniques[fk].input3.add(procNorm);
            }
            else if (origem === "input4") {
              fieldFills[fk].input4++;
              if (procNorm) fieldFillUniques[fk].input4.add(procNorm);
            }
            else if (origem === "ia") {
              fieldFills[fk].ia++;
              if (procNorm) fieldFillUniques[fk].ia.add(procNorm);
            }
          }
        }
      }

      for (const fk of fieldKeys) {
        fieldFills[fk].uniqueTotal = fieldFillUniques[fk].total.size;
        fieldFills[fk].uniqueInput2 = fieldFillUniques[fk].input2.size;
        fieldFills[fk].uniqueInput3 = fieldFillUniques[fk].input3.size;
        fieldFills[fk].uniqueInput4 = fieldFillUniques[fk].input4.size;
        fieldFills[fk].uniqueIa = fieldFillUniques[fk].ia.size;
      }

      // Passo 2: AI for remaining incomplete (only if enabled)
      const incomplete = processRows.filter(pr =>
        isEmpty(pr.dossie) || isEmpty(pr.equipe) || isEmpty(pr.reclamante) || isEmpty(pr.reclamada) || isEmpty(pr.relator)
      );

      let countIA = 0;

      if (useAI && incomplete.length > 0) {
        await advanceStep(70);
        const batchSize = 10;
        for (let b = 0; b < incomplete.length; b += batchSize) {
          if (cancelledRef.current) break;

          const batch = incomplete.slice(b, b + batchSize);
          await tick(70 + Math.round((b / incomplete.length) * 20));

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

      const dossiesNaoLocalizados = processRows.filter(pr => isEmpty(pr.dossie)).length;

      // Linhas preenchidas = linhas que têm ao menos 1 campo preenchido pelo sistema
      const linhasPreenchidas = processRows.filter(pr =>
        pr.origem_dossie || pr.origem_equipe || pr.origem_reclamante || pr.origem_reclamada || pr.origem_relator
      ).length;

      // Preenchimento por coluna
      const colunas = ["dossie", "equipe", "reclamante", "reclamada", "relator"] as const;
      const preenchimentoPorColuna: Record<string, { preenchidas: number; total: number }> = {};
      for (const col of colunas) {
        preenchimentoPorColuna[col] = {
          preenchidas: processRows.filter(pr => !isEmpty(pr[col])).length,
          total: processRows.length,
        };
      }

      setStats({
        total: processRows.length,
        passo1: countPasso1,
        passo2: countPasso2,
        ia: countIA,
        naoEncontrados,
        matchInput2: matchCount2,
        matchInput3: matchCount3,
        matchInput4: matchCount4,
        totalUnicosInput1: uniqueInput1Set.size,
        fieldFills,
        unmatchedSamples,
        dossiesNaoLocalizados,
        linhasPreenchidas,
        totalLinhas: processRows.length,
        preenchimentoPorColuna,
      });

      setResults(processRows);
      await advanceStep(95);
      await tick(100);
      steps.forEach(s => { s.status = "done"; });
      setProgressSteps([...steps]);
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
    const matchRate = (val: number) => stats.totalUnicosInput1 > 0 ? `${((val / stats.totalUnicosInput1) * 100).toFixed(1)}%` : "0%";
    doc.text(`• Base única (Distribuições): ${stats.totalUnicosInput1} processos`, 18, y); y += 6;
    doc.text(`• Rel. Prazos: ${stats.matchInput2}/${stats.totalUnicosInput1} (${matchRate(stats.matchInput2)})`, 18, y); y += 6;
    doc.text(`• Processos: ${stats.matchInput3}/${stats.totalUnicosInput1} (${matchRate(stats.matchInput3)})`, 18, y); y += 6;
    doc.text(`• Dossiês Ativos: ${stats.matchInput4}/${stats.totalUnicosInput1} (${matchRate(stats.matchInput4)})`, 18, y); y += 10;

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

    // Preenchimento por Coluna
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Preenchimento por Coluna", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const [col, info] of Object.entries(stats.preenchimentoPorColuna)) {
      if (y > 270) { doc.addPage(); y = 20; }
      const pct = info.total > 0 ? `${((info.preenchidas / info.total) * 100).toFixed(1)}%` : "0%";
      const label = col.charAt(0).toUpperCase() + col.slice(1);
      doc.text(`• ${label}: ${info.preenchidas}/${info.total} (${pct})`, 18, y);
      y += 6;
    }
    y += 4;

    // Resumo por Linha
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo por Linha", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const pctLinhas = stats.totalLinhas > 0 ? `${((stats.linhasPreenchidas / stats.totalLinhas) * 100).toFixed(1)}%` : "0%";
    doc.text(`• Linhas preenchidas (verde): ${stats.linhasPreenchidas} de ${stats.totalLinhas} (${pctLinhas})`, 18, y); y += 6;
    const pctDossie = stats.totalLinhas > 0 ? `${((stats.dossiesNaoLocalizados / stats.totalLinhas) * 100).toFixed(1)}%` : "0%";
    doc.text(`• Dossiês não localizados: ${stats.dossiesNaoLocalizados} de ${stats.totalLinhas} (${pctDossie})`, 18, y); y += 6;
    doc.text(`• Processos sem nenhum cruzamento: ${stats.naoEncontrados}`, 18, y); y += 10;

    // Processos não encontrados (amostras)
    if (stats.unmatchedSamples.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
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

    if (originalFileBuffer && input1Meta.length > 0) {
      try {
        const zip = await JSZip.loadAsync(originalFileBuffer);
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
        const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

        // Discover ALL sheet paths
        const sheetPaths: { index: number; path: string }[] = [];
        if (workbookXml && workbookRelsXml) {
          const wbDoc = parser.parseFromString(workbookXml, "application/xml");
          const relsDoc = parser.parseFromString(workbookRelsXml, "application/xml");
          const wbNs = wbDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
          const relsNs = relsDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/package/2006/relationships";
          const sheetEls = Array.from(wbDoc.getElementsByTagNameNS(wbNs, "sheet"));
          for (let si = 0; si < sheetEls.length; si++) {
            const rId = sheetEls[si].getAttribute("r:id") || sheetEls[si].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
            const rel = rId ? Array.from(relsDoc.getElementsByTagNameNS(relsNs, "Relationship")).find(n => n.getAttribute("Id") === rId) : null;
            const target = rel?.getAttribute("Target");
            if (target) {
              sheetPaths.push({ index: si, path: `xl/${target.replace(/^\/+/, "").replace(/^xl\//, "")}` });
            }
          }
        }
        if (sheetPaths.length === 0) sheetPaths.push({ index: 0, path: "xl/worksheets/sheet1.xml" });

        // Parse shared strings table (critical for reading cell values correctly)
        const sstXml = await zip.file("xl/sharedStrings.xml")?.async("string");
        const sharedStrings: string[] = [];
        if (sstXml) {
          const sstDoc = parser.parseFromString(sstXml, "application/xml");
          const sstNs = sstDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
          const siEls = sstDoc.getElementsByTagNameNS(sstNs, "si");
          for (const si of Array.from(siEls)) {
            const tEls = si.getElementsByTagNameNS(sstNs, "t");
            if (tEls.length > 0) {
              sharedStrings.push(Array.from(tEls).map(t => t.textContent || "").join(""));
            } else {
              sharedStrings.push("");
            }
          }
        }

        // --- Add styles (font Calibri 8 + yellow fill) ONCE ---
        const stylesPath = "xl/styles.xml";
        const stylesXml = await zip.file(stylesPath)?.async("string");
        let newFontIndex = 0;
        let newFillIndex = 0;

        if (stylesXml) {
          const stylesDoc = parser.parseFromString(stylesXml, "application/xml");
          const stylesNs = stylesDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
          const fonts = stylesDoc.getElementsByTagNameNS(stylesNs, "fonts")[0];
          const fontCount = fonts ? Number(fonts.getAttribute("count") || "0") : 0;
          newFontIndex = fontCount;
          if (fonts) {
            const fontEl = stylesDoc.createElementNS(stylesNs, "font");
            const szEl = stylesDoc.createElementNS(stylesNs, "sz"); szEl.setAttribute("val", "8");
            const nameEl = stylesDoc.createElementNS(stylesNs, "name"); nameEl.setAttribute("val", "Calibri");
            const familyEl = stylesDoc.createElementNS(stylesNs, "family"); familyEl.setAttribute("val", "2");
            const schemeEl = stylesDoc.createElementNS(stylesNs, "scheme"); schemeEl.setAttribute("val", "minor");
            fontEl.appendChild(szEl); fontEl.appendChild(nameEl); fontEl.appendChild(familyEl); fontEl.appendChild(schemeEl);
            fonts.appendChild(fontEl);
            fonts.setAttribute("count", String(fontCount + 1));
          }
          const fills = stylesDoc.getElementsByTagNameNS(stylesNs, "fills")[0];
          const fillCount = fills ? Number(fills.getAttribute("count") || "0") : 0;
          newFillIndex = fillCount;
          if (fills) {
            const fillEl = stylesDoc.createElementNS(stylesNs, "fill");
            const patternEl = stylesDoc.createElementNS(stylesNs, "patternFill"); patternEl.setAttribute("patternType", "solid");
            const fgColor = stylesDoc.createElementNS(stylesNs, "fgColor"); fgColor.setAttribute("rgb", "FFFFFF00");
            const bgColor = stylesDoc.createElementNS(stylesNs, "bgColor"); bgColor.setAttribute("indexed", "64");
            patternEl.appendChild(fgColor); patternEl.appendChild(bgColor);
            fillEl.appendChild(patternEl);
            fills.appendChild(fillEl);
            fills.setAttribute("count", String(fillCount + 1));
          }
          zip.file(stylesPath, serializer.serializeToString(stylesDoc));
        }

        // --- VALUE PASS: process each sheet ---
        for (const { index: sheetIdx, path: worksheetPath } of sheetPaths) {
          const sheetResults = results.filter(r => r.sheetIndex === sheetIdx);
          if (sheetResults.length === 0) continue;
          const meta = input1Meta[sheetIdx];
          if (!meta) continue;

          const sheetXml = await zip.file(worksheetPath)?.async("string");
          if (!sheetXml) continue;

          const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
          const sheetNs = sheetDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
          const sheetDataEl = sheetDoc.getElementsByTagNameNS(sheetNs, "sheetData")[0];
          if (!sheetDataEl) continue;

          const headers = meta.headers;
          const dataStartRow = meta.headerRowIndex + 2;

          const getColIdx = (terms: string[]): number => findColumnIndex(headers, ...terms);
          const colDossie = getColIdx(["dossi", "dossie", "dossiê"]);
          const colEquipe = getColIdx(["equipe"]);
          const colReclamante = getColIdx(["reclamante"]);
          const colReclamada = getColIdx(["reclamada"]);
          const colRelator = getColIdx(["relator"]);
          const colClassRelator = 7;
          const colTurma = 8;
          const colClassTurma = 9;

          const rowMap = new Map<number, Element>();
          for (const rowEl of Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row"))) {
            const rowNumber = Number(rowEl.getAttribute("r"));
            if (!Number.isNaN(rowNumber)) rowMap.set(rowNumber, rowEl);
          }

          const getRowCells = (rowEl: Element) =>
            Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter((cell) => cell.parentNode === rowEl);

          const getColumnLetters = (cellRef: string) => cellRef.replace(/\d+/g, "");

          const columnLettersToIndex = (letters: string) => {
            let value = 0;
            for (const char of letters) value = value * 26 + (char.charCodeAt(0) - 64);
            return value - 1;
          };

          const getCell = (rowEl: Element, cellRef: string) =>
            getRowCells(rowEl).find((cell) => cell.getAttribute("r") === cellRef) || null;

          const ensureRow = (rowNumber: number) => {
            const existing = rowMap.get(rowNumber);
            if (existing) return existing;
            const rowEl = sheetDoc.createElementNS(sheetNs, "row");
            rowEl.setAttribute("r", String(rowNumber));
            const allRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row")).filter((row) => row.parentNode === sheetDataEl);
            const nextRow = allRows.find((row) => Number(row.getAttribute("r")) > rowNumber);
            if (nextRow) sheetDataEl.insertBefore(rowEl, nextRow);
            else sheetDataEl.appendChild(rowEl);
            rowMap.set(rowNumber, rowEl);
            return rowEl;
          };

          const createInlineStringChildren = (cellEl: Element, value: string) => {
            while (cellEl.firstChild) cellEl.removeChild(cellEl.firstChild);
            cellEl.setAttribute("t", "inlineStr");
            const isEl = sheetDoc.createElementNS(sheetNs, "is");
            const tEl = sheetDoc.createElementNS(sheetNs, "t");
            if (/^\s|\s$| {2,}|\n/.test(value)) tEl.setAttribute("xml:space", "preserve");
            tEl.textContent = value;
            isEl.appendChild(tEl);
            cellEl.appendChild(isEl);
          };

          const findStyleForNewCell = (rowEl: Element, rowNumber: number, colIdx: number) => {
            const sameRowStyle = getRowCells(rowEl)
              .map((cell) => ({ style: cell.getAttribute("s"), distance: Math.abs(columnLettersToIndex(getColumnLetters(cell.getAttribute("r") || "A")) - colIdx) }))
              .filter((item): item is { style: string; distance: number } => Boolean(item.style))
              .sort((a, b) => a.distance - b.distance)[0]?.style;
            if (sameRowStyle) return sameRowStyle;
            const colLetters = XLSX.utils.encode_col(colIdx);
            for (let offset = 1; offset <= Math.min(sheetResults.length, 10); offset++) {
              for (const candidateRowNumber of [rowNumber - offset, rowNumber + offset]) {
                const candidateRow = rowMap.get(candidateRowNumber);
                if (!candidateRow) continue;
                const sameColumnCell = getCell(candidateRow, `${colLetters}${candidateRowNumber}`);
                const sameColumnStyle = sameColumnCell?.getAttribute("s");
                if (sameColumnStyle) return sameColumnStyle;
                const fallbackRowStyle = getRowCells(candidateRow).map((cell) => cell.getAttribute("s")).find((style): style is string => Boolean(style));
                if (fallbackRowStyle) return fallbackRowStyle;
              }
            }
            return null;
          };

          const readCellValue = (rowEl: Element, colIdx: number, rowNumber: number): string => {
            const cellRef = XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIdx });
            const cell = getCell(rowEl, cellRef);
            if (!cell) return "";
            const cellType = cell.getAttribute("t");
            if (cellType === "inlineStr") {
              const tEls = cell.getElementsByTagNameNS(sheetNs, "t");
              return tEls.length > 0 ? tEls[0].textContent || "" : "";
            }
            if (cellType === "s") {
              const vEl = cell.getElementsByTagNameNS(sheetNs, "v")[0];
              const idx = parseInt(vEl?.textContent || "0", 10);
              return sharedStrings[idx] || "";
            }
            const tEls = cell.getElementsByTagNameNS(sheetNs, "t");
            if (tEls.length > 0) return tEls[0].textContent || "" ;
            const vEl = cell.getElementsByTagNameNS(sheetNs, "v")[0];
            return vEl?.textContent || "";
          };

          const upsertCellValue = (rowNumber: number, colIdx: number, value: string, allowEmpty = false) => {
            if (colIdx < 0 || (!allowEmpty && isEmpty(value))) return;
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
            if (inheritedStyle) newCell.setAttribute("s", inheritedStyle);
            createInlineStringChildren(newCell, value);
            const rowCells = getRowCells(rowEl);
            const nextCell = rowCells.find((cell) => {
              const ref = cell.getAttribute("r") || "";
              return columnLettersToIndex(getColumnLetters(ref)) > colIdx;
            });
            if (nextCell) rowEl.insertBefore(newCell, nextCell);
            else rowEl.appendChild(newCell);
          };

          // Write cell values
          for (const pr of sheetResults) {
            const excelRow = dataStartRow + pr.originalIndex;
            const tryWrite = (colIdx: number, value: string, origemKey: string) => {
              if (colIdx < 0 || isEmpty(value)) return;
              if (!(pr as any)[origemKey]) return;
              upsertCellValue(excelRow, colIdx, value);
            };

            tryWrite(colDossie, pr.dossie, "origem_dossie");
            tryWrite(colEquipe, pr.equipe, "origem_equipe");
            tryWrite(colReclamante, pr.reclamante, "origem_reclamante");
            tryWrite(colReclamada, pr.reclamada, "origem_reclamada");
            tryWrite(colRelator, pr.relator, "origem_relator");

            const rowEl = rowMap.get(excelRow);
            if (rowEl) {
              // === PASSO 1: Analisar coluna I primeiro - extrair ministro para G se possível ===
              const rawI = readCellValue(rowEl, colTurma, excelRow).trim();
              if (rawI) {
                const ministroExtraido = extrairMinistroDeTextoCombinadoI(rawI);
                if (ministroExtraido && colRelator >= 0) {
                  const currentG = readCellValue(rowEl, colRelator, excelRow).trim();
                  if (!currentG || isEmpty(currentG)) {
                    upsertCellValue(excelRow, colRelator, ministroExtraido);
                  }
                }
                const limpoI = limparTurmaColI(rawI);
                if (limpoI !== rawI) {
                  upsertCellValue(excelRow, colTurma, limpoI);
                }
              }


              // === PASSO 2: Regra A - Limpar coluna G (remover "Gabinete do/da") ===
              if (colRelator >= 0) {
                const currentG = readCellValue(rowEl, colRelator, excelRow).trim();
                if (currentG) {
                  const limpoG = limparNomeMinistroColG(currentG);
                  if (limpoG !== currentG) {
                    upsertCellValue(excelRow, colRelator, limpoG);
                  }
                }
              }

              // === PASSO 3: Ler valores atualizados e classificar ===
              const currentH = readCellValue(rowEl, colClassRelator, excelRow).trim().toUpperCase();
              const currentI2 = readCellValue(rowEl, colTurma, excelRow).trim();
              const currentINorm = currentI2.toUpperCase();
              const currentJRaw = readCellValue(rowEl, colClassTurma, excelRow).trim();
              const currentJ = currentJRaw.toUpperCase();

              const hasValidH = currentH === "POSITIVO" || currentH === "NEGATIVO";
              const hasValidTurma = currentI2 && (
                currentINorm.includes("TURMA") || currentINorm.includes("SBDI") ||
                currentINorm.includes("PLENO") || currentINorm.includes("PRESIDENTE") ||
                currentINorm.includes("CORREGEDOR") || currentINorm.includes("IMPEDID") ||
                currentINorm.includes("CEJUSC") || currentINorm.includes("SESS") ||
                currentINorm.includes("SE")
              );
              const hasValidJ = currentJ === "POSITIVO" || currentJ === "NEGATIVO"
                || currentJ === "POSITIVA" || currentJ === "NEGATIVA"
                || currentJ.includes("AINDA NÃO DISTRIBU");

              // Move invalid J content to column I (only if I doesn't have valid turma)
              if (currentJRaw && !hasValidJ) {
                if (!hasValidTurma) {
                  const turmaFromJ = limparTurmaColI(currentJRaw);
                  upsertCellValue(excelRow, colTurma, turmaFromJ);
                  const minFromJ = extrairMinistroDeTextoCombinadoI(currentJRaw);
                  if (minFromJ && colRelator >= 0) {
                    const gNow = readCellValue(rowEl, colRelator, excelRow).trim();
                    if (!gNow || isEmpty(gNow)) {
                      upsertCellValue(excelRow, colRelator, limparNomeMinistroColG(minFromJ));
                    }
                  }
                }
                upsertCellValue(excelRow, colClassTurma, "", true);
              }

              // === PASSO 4: Classificar relator (H) e turma (J) ===
              const finalG = colRelator >= 0 ? readCellValue(rowEl, colRelator, excelRow).trim() : "";
              if (finalG && !hasValidH) {
                const classRel = classificarRelator(finalG);
                if (classRel) upsertCellValue(excelRow, colClassRelator, classRel);
              }
              if (pr.classificacao_relator && !hasValidH && !finalG) {
                upsertCellValue(excelRow, colClassRelator, pr.classificacao_relator);
              }

              const finalI = readCellValue(rowEl, colTurma, excelRow).trim();
              if (!hasValidTurma && pr.turma_relator) {
                upsertCellValue(excelRow, colTurma, limparTurmaColI(pr.turma_relator));
              }
              const finalIForClass = readCellValue(rowEl, colTurma, excelRow).trim();
              if (finalIForClass && !hasValidJ) {
                const classTurma = classificarTurma(finalIForClass);
                if (classTurma) upsertCellValue(excelRow, colClassTurma, classTurma);
              }
              if (pr.classificacao_turma && !hasValidJ && !finalIForClass) {
                upsertCellValue(excelRow, colClassTurma, pr.classificacao_turma);
              }

            }
          }

          const parserError = sheetDoc.getElementsByTagName("parsererror")[0];
          if (parserError) {
            console.error(`Erro ao montar aba ${sheetIdx}`);
            continue;
          }
          zip.file(worksheetPath, serializer.serializeToString(sheetDoc));
        }

        // --- STYLE PASS: apply yellow/Calibri styles across all sheets ---
        {
          const updatedStylesXml2 = await zip.file(stylesPath)?.async("string");
          if (updatedStylesXml2) {
            const stylesDoc2 = parser.parseFromString(updatedStylesXml2, "application/xml");
            const sNs = stylesDoc2.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            const cellXfs2 = stylesDoc2.getElementsByTagNameNS(sNs, "cellXfs")[0];
            let xfCount2 = cellXfs2 ? Number(cellXfs2.getAttribute("count") || "0") : 0;
            const styleCache: Record<string, string> = {};

            const makeYellowStyle = (origStyleId: string | null, centered: boolean): string => {
              let borderId = "0";
              if (origStyleId && cellXfs2) {
                const xfs = cellXfs2.getElementsByTagNameNS(sNs, "xf");
                const idx = Number(origStyleId);
                if (!isNaN(idx) && idx < xfs.length) borderId = xfs[idx].getAttribute("borderId") || "0";
              }
              const key = `${borderId}|${centered ? "1" : "0"}`;
              if (styleCache[key]) return styleCache[key];
              if (!cellXfs2) return "0";
              const newXf = stylesDoc2.createElementNS(sNs, "xf");
              newXf.setAttribute("numFmtId", "0");
              newXf.setAttribute("fontId", String(newFontIndex));
              newXf.setAttribute("fillId", String(newFillIndex));
              newXf.setAttribute("borderId", borderId);
              newXf.setAttribute("applyFont", "1");
              newXf.setAttribute("applyFill", "1");
              if (borderId !== "0") newXf.setAttribute("applyBorder", "1");
              if (centered) {
                newXf.setAttribute("applyAlignment", "1");
                const al = stylesDoc2.createElementNS(sNs, "alignment");
                al.setAttribute("horizontal", "center");
                al.setAttribute("vertical", "center");
                al.setAttribute("wrapText", "1");
                newXf.appendChild(al);
              }
              cellXfs2.appendChild(newXf);
              const styleIdx = String(xfCount2);
              xfCount2++;
              cellXfs2.setAttribute("count", String(xfCount2));
              styleCache[key] = styleIdx;
              return styleIdx;
            };

            for (const { index: sheetIdx, path: worksheetPath } of sheetPaths) {
              const sheetResults = results.filter(r => r.sheetIndex === sheetIdx);
              if (sheetResults.length === 0) continue;
              const meta = input1Meta[sheetIdx];
              if (!meta) continue;

              const updatedSheetXml = await zip.file(worksheetPath)?.async("string");
              if (!updatedSheetXml) continue;

              const updatedDoc = parser.parseFromString(updatedSheetXml, "application/xml");
              const updatedNs = updatedDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
              const updatedSheetData = updatedDoc.getElementsByTagNameNS(updatedNs, "sheetData")[0];
              if (!updatedSheetData) continue;

              const updatedRowMap = new Map<number, Element>();
              for (const rowEl of Array.from(updatedSheetData.getElementsByTagNameNS(updatedNs, "row"))) {
                const rn = Number(rowEl.getAttribute("r"));
                if (!Number.isNaN(rn)) updatedRowMap.set(rn, rowEl);
              }

              const sheetHeaders = meta.headers;
              const dataStartRow = meta.headerRowIndex + 2;
              const colDossie = findColumnIndex(sheetHeaders, "dossi", "dossie", "dossiê");
              const colEquipe = findColumnIndex(sheetHeaders, "equipe");
              const colReclamante = findColumnIndex(sheetHeaders, "reclamante");
              const colReclamada = findColumnIndex(sheetHeaders, "reclamada");
              const colRelator = findColumnIndex(sheetHeaders, "relator");
              const colClassRelator = 7;
              const colTurma = 8;
              const colClassTurma = 9;

              const applyStyle = (rowEl: Element, excelRow: number, colIdx: number, centered: boolean) => {
                if (colIdx < 0) return;
                const cellRef = XLSX.utils.encode_cell({ r: excelRow - 1, c: colIdx });
                const cells = Array.from(rowEl.getElementsByTagNameNS(updatedNs, "c")).filter(c => c.parentNode === rowEl);
                const cell = cells.find(c => c.getAttribute("r") === cellRef);
                if (cell) {
                  const origStyle = cell.getAttribute("s") || null;
                  cell.setAttribute("s", makeYellowStyle(origStyle, centered));
                }
              };

              for (const pr of sheetResults) {
                const excelRow = dataStartRow + pr.originalIndex;
                const rowEl = updatedRowMap.get(excelRow);
                if (!rowEl) continue;

                const markYellow = (colIdx: number, value: string, origemKey: string) => {
                  if (colIdx < 0 || isEmpty(value) || !(pr as any)[origemKey]) return;
                  applyStyle(rowEl, excelRow, colIdx, false);
                };

                markYellow(colDossie, pr.dossie, "origem_dossie");
                markYellow(colEquipe, pr.equipe, "origem_equipe");
                markYellow(colReclamante, pr.reclamante, "origem_reclamante");
                markYellow(colReclamada, pr.reclamada, "origem_reclamada");
                markYellow(colRelator, pr.relator, "origem_relator");

                if (pr.classificacao_relator) applyStyle(rowEl, excelRow, colClassRelator, true);
                if (pr.turma_relator) applyStyle(rowEl, excelRow, colTurma, true);
                if (pr.classificacao_turma) applyStyle(rowEl, excelRow, colClassTurma, true);
              }

              zip.file(worksheetPath, serializer.serializeToString(updatedDoc));
            }

            zip.file(stylesPath, serializer.serializeToString(stylesDoc2));
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
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Progresso</span>
                <span className="font-semibold">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                {progressSteps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-1.5 text-xs rounded-md px-2 py-1.5 border ${
                    step.status === "done" ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400" :
                    step.status === "active" ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400" :
                    "bg-muted/30 border-border text-muted-foreground"
                  }`}>
                    {step.status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : step.status === "active" ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
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
                <div className="text-2xl font-bold text-green-500">{stats.linhasPreenchidas}</div>
                <div className="text-xs text-muted-foreground">Linhas Preenchidas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-orange-500">{stats.dossiesNaoLocalizados}</div>
                <div className="text-xs text-muted-foreground">Dossiês Não Localizados</div>
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
                    <p className="font-medium mb-1">Processos únicos em comum por planilha</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Base única (Distribuições): <span className="text-foreground font-medium">{stats.totalUnicosInput1}</span></li>
                      <li>Rel. Prazos: <span className="text-foreground font-medium">{stats.matchInput2}/{stats.totalUnicosInput1 || 0}</span></li>
                      <li>Processos: <span className="text-foreground font-medium">{stats.matchInput3}/{stats.totalUnicosInput1 || 0}</span></li>
                      <li>Dossiês Ativos: <span className="text-foreground font-medium">{stats.matchInput4}/{stats.totalUnicosInput1 || 0}</span></li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">Na tabela abaixo, cada célula mostra primeiro os processos únicos e abaixo a quantidade de linhas preenchidas.</p>
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
                  <p className="font-medium mb-2">Campos Preenchidos — Processos únicos e linhas</p>
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
                          return (
                            <TableRow key={field}>
                              <TableCell className="text-xs font-medium">{label}</TableCell>
                              <TableCell className="text-xs text-center font-bold">
                                <div>{detail.uniqueTotal} proc.</div>
                                <div className="text-muted-foreground font-normal">{detail.total} linhas</div>
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {detail.input2 ? (
                                  <>
                                    <div>{detail.uniqueInput2} proc.</div>
                                    <div className="text-muted-foreground">{detail.input2} linhas</div>
                                  </>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {detail.input3 ? (
                                  <>
                                    <div>{detail.uniqueInput3} proc.</div>
                                    <div className="text-muted-foreground">{detail.input3} linhas</div>
                                  </>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {detail.input4 ? (
                                  <>
                                    <div>{detail.uniqueInput4} proc.</div>
                                    <div className="text-muted-foreground">{detail.input4} linhas</div>
                                  </>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {detail.ia ? (
                                  <>
                                    <div>{detail.uniqueIa} proc.</div>
                                    <div className="text-muted-foreground">{detail.ia} linhas</div>
                                  </>
                                ) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Preenchimento por Coluna */}
                <div>
                  <p className="font-medium mb-2">Preenchimento por Coluna</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(stats.preenchimentoPorColuna).map(([col, info]) => {
                      const pct = info.total > 0 ? Math.round((info.preenchidas / info.total) * 100) : 0;
                      const label = col.charAt(0).toUpperCase() + col.slice(1);
                      return (
                        <div key={col} className="border rounded-md p-3 text-center">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-lg font-bold text-foreground">{info.preenchidas}/{info.total}</div>
                          <Progress value={pct} className="h-1.5 mt-1" />
                          <div className="text-xs text-muted-foreground mt-1">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo por linha */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-1">Linhas Preenchidas (verde)</div>
                    <div className="text-2xl font-bold text-green-600">{stats.linhasPreenchidas}</div>
                    <div className="text-xs text-muted-foreground">de {stats.totalLinhas} linhas totais ({stats.totalLinhas > 0 ? Math.round((stats.linhasPreenchidas / stats.totalLinhas) * 100) : 0}%)</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-1">Dossiês Não Localizados</div>
                    <div className="text-2xl font-bold text-orange-500">{stats.dossiesNaoLocalizados}</div>
                    <div className="text-xs text-muted-foreground">de {stats.totalLinhas} processos ({stats.totalLinhas > 0 ? Math.round((stats.dossiesNaoLocalizados / stats.totalLinhas) * 100) : 0}%)</div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-1">Sem Nenhum Dado</div>
                    <div className="text-2xl font-bold text-red-500">{stats.naoEncontrados}</div>
                    <div className="text-xs text-muted-foreground">processos sem cruzamento</div>
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
                      <TableHead className="text-xs">Class. Relator</TableHead>
                      <TableHead className="text-xs">Class. Turma</TableHead>
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
                        <TableCell className="text-xs">
                          {pr.classificacao_relator ? (
                            <Badge variant={pr.classificacao_relator === "POSITIVO" ? "default" : "destructive"} className="text-[10px]">
                              {pr.classificacao_relator}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {pr.classificacao_turma ? (
                            <span className="flex flex-col gap-0.5">
                              <Badge variant={pr.classificacao_turma === "POSITIVA" ? "default" : "destructive"} className="text-[10px]">
                                {pr.classificacao_turma}
                              </Badge>
                              {pr.turma_relator && <span className="text-[10px] text-muted-foreground">{pr.turma_relator}</span>}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
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
