import { useState, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet,
  ArrowRight, Info, Table2,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- Types ---
interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
  sheetName: string;
  sheetIndex: number;
}

interface Stats {
  totalInput1: number;
  totalInput2: number;
  matched: number;
  unmatched: number;
  outputRows: number;
}

// --- Normalização de número de processo CNJ (20 dígitos) ---
function normalizeCNJ(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 15) return digits.padStart(20, "0");
  return digits;
}

function normalizeText(val: unknown): string {
  return String(val ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// --- Header helpers ---
function findCol(headers: string[], ...keywords: string[]): string | null {
  for (const h of headers) {
    const n = normalizeText(h);
    for (const kw of keywords) {
      if (n.includes(kw)) return h;
    }
  }
  return null;
}

// Layout Carga - 34 colunas (A-AH) exatamente como o template original
const LAYOUT_COLS = [
  "Dossiê",                                                       // A
  "Tribunal (TST, STF ou STJ)",                                    // B
  "Tipo de Recurso",                                               // C
  "Data da distribuição no TST/STF",                                // D
  "Turma",                                                         // E
  "Relator",                                                       // F
  "Análise do quarteirizado",                                      // G
  "Há risco de mídia negativa? (S/N)",                              // H
  "Risco",                                                         // I
  "Há discussão sobre provas digitais? (S/N)",                      // J
  "Temos data de julgamento? (S/N)",                                // K
  "Data Julgamento",                                               // L
  "Horário",                                                       // M
  "Julgamento (Virtual, Telepresencial, Híbrido ou Presencial)",    // N
  "Matéria de Honra (S/N)",                                        // O
  "Entrega de Memoriais (S/N)",                                    // P
  "Sustentação Oral (S/N/ Não cabe)",                               // Q
  "Sem transcendência",                                            // R
  "Recurso não conhecido",                                         // S
  "Recurso conhecido e provido",                                    // T
  "Recurso conhecido e não provido",                                // U
  "Outra",                                                         // V
  "Observações",                                                   // W
  "Ganhamos",                                                      // X
  "Perdemos",                                                      // Y
  "Processo baixado do TST/STF (S/N)",                              // Z
  "Recorrente",                                                    // AA
  "Favorável (turma)",                                             // AB
  "Desfavorável (turma)",                                          // AC
  "Favorável (relator)",                                            // AD
  "Desfavorável (relator)",                                         // AE
  "Bem aparelhado",                                                // AF
  "Mal aparelhado",                                                // AG
  "Com chances de êxito",                                           // AH
];

// Formata data para DD/MM/YYYY
function formatDateDDMMYYYY(val: string): string {
  if (!val) return "";
  const s = String(val).trim();
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  // D/M/YYYY → pad
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) return `${brMatch[1].padStart(2, "0")}/${brMatch[2].padStart(2, "0")}/${brMatch[3]}`;
  // MM/DD/YYYY heuristic or other — try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  return s;
}

// Converte SIM/NÃO para S/N
function toSN(val: string): string {
  const n = normalizeText(val);
  if (n === "sim" || n === "s") return "S";
  if (n === "nao" || n === "não" || n === "n") return "N";
  return val;
}

function deriveFavoravel(classificacao: string): string {
  const n = normalizeText(classificacao);
  if (n.includes("positiv") || n === "positivo" || n === "positiva") return "Favorável";
  if (n.includes("negativ") || n === "negativo" || n === "negativa") return "Desfavorável";
  return "";
}

function deriveAparelhamento(val: string): string {
  const n = normalizeText(val);
  if (n.includes("bem") || n.includes("sim")) return "Bem aparelhado";
  if (n.includes("mal") || n.includes("nao") || n.includes("não")) return "Mal aparelhado";
  return String(val ?? "");
}

export default function CargaBenner() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [outputData, setOutputData] = useState<Record<string, any>[] | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const input1Ref = useRef<HTMLInputElement>(null);
  const input2Ref = useRef<HTMLInputElement>(null);

  // Parsed data
  const [sheets1, setSheets1] = useState<ParsedSheet[] | null>(null);
  const [sheets2, setSheets2] = useState<ParsedSheet[] | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, which: 1 | 2) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (which === 1) { setFile1(f); setSheets1(null); }
    else { setFile2(f); setSheets2(null); }
    setStats(null);
    setOutputData(null);
  };

  const parseFile = useCallback((file: File, allSheets: boolean, inputType: string): Promise<ParsedSheet[]> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("../workers/cargaBennerReader.worker.ts", import.meta.url),
        { type: "module" }
      );
      const reader = new FileReader();
      reader.onload = () => {
        worker.postMessage({
          type: "parse",
          buffer: reader.result,
          allSheets,
          id: inputType,
          inputType,
        }, [reader.result as ArrayBuffer]);
      };
      worker.onmessage = (ev) => {
        if (ev.data.type === "result") {
          worker.terminate();
          resolve(ev.data.sheets);
        } else if (ev.data.type === "error") {
          worker.terminate();
          reject(new Error(ev.data.error));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const processData = async () => {
    if (!file1 || !file2) {
      toast.error("Selecione ambas as planilhas");
      return;
    }
    setProcessing(true);
    setProgress(0);
    setStats(null);
    setOutputData(null);

    try {
      // Phase 1: Read files
      setPhase("Lendo planilhas...");
      setProgress(10);

      const [parsed1, parsed2] = await Promise.all([
        parseFile(file1, true, "input1"),
        parseFile(file2, false, "input2"),
      ]);

      setSheets1(parsed1);
      setSheets2(parsed2);
      setProgress(40);

      // Phase 2: Build lookup from Pautas (Input 2)
      setPhase("Cruzando dados...");
      const pautaSheet = parsed2[0];
      if (!pautaSheet) throw new Error("Planilha de Pautas vazia");

      const pH = pautaSheet.headers;
      const pColProcesso = findCol(pH, "processo", "cnj");
      const pColDossie = findCol(pH, "dossie", "dossiê");
      const pColDataJulg = findCol(pH, "julgamento", "data do julgamento", "data julgamento");
      const pColHorario = findCol(pH, "horario", "horário");
      const pColTipo = findCol(pH, "virtual", "telepresencial", "hibrido", "híbrido");
      const pColSustentacao = findCol(pH, "sustentacao", "sustentação");
      const pColMemoriais = findCol(pH, "memoria", "memoriais", "memórias");
      const pColResultado = findCol(pH, "resultado");

      // Build lookup maps
      const pautaByProcesso = new Map<string, Record<string, any>>();
      const pautaByDossie = new Map<string, Record<string, any>>();

      for (const row of pautaSheet.rows) {
        if (pColProcesso) {
          const key = normalizeCNJ(String(row[pColProcesso] ?? ""));
          if (key.length >= 10) pautaByProcesso.set(key, row);
        }
        if (pColDossie) {
          const key = String(row[pColDossie] ?? "").trim();
          if (key) pautaByDossie.set(key.toLowerCase(), row);
        }
      }

      setProgress(55);

      // Phase 3: Generate output
      setPhase("Gerando Layout Carga...");

      // Collect all rows from input1
      const allInput1Rows: Record<string, any>[] = [];
      for (const sheet of parsed1) {
        for (const row of sheet.rows) allInput1Rows.push(row);
      }

      const h1 = parsed1[0]?.headers || [];
      const colProcesso1 = findCol(h1, "processo", "cnj");
      const colDossie1 = findCol(h1, "dossie", "dossiê");
      const colDataDist = findCol(h1, "distribuicao", "distribuição", "data da distribuicao");
      const colEquipe = findCol(h1, "equipe");
      const colReclamante = findCol(h1, "reclamante");
      const colReclamada = findCol(h1, "reclamada");
      const colRelator = findCol(h1, "relator");
      const colRelatorClass = h1.find(h => { const n = normalizeText(h); return n.includes("relator") && (n.includes("+") || n.includes("-") || n.includes("classif")); }) || null;
      const colTurma = h1.find(h => { const n = normalizeText(h); return n.includes("turma") && !n.includes("+") && !n.includes("-") && !n.includes("classif"); }) || null;
      const colTurmaClass = h1.find(h => { const n = normalizeText(h); return n.includes("turma") && (n.includes("+") || n.includes("-") || n.includes("classif")); }) || null;
      const colParteRecorrente = findCol(h1, "parte recorrente", "recorrente");
      const colTipoRecursoBanco = findCol(h1, "tipo de recurso do banco", "recurso do banco");
      const colTipoRecursoReclamante = findCol(h1, "tipo de recurso do reclamante", "recurso do reclamante");
      const colAparelhamento = h1.filter(h => normalizeText(h).includes("aparelhamento"));
      const colChanceExito = h1.filter(h => normalizeText(h).includes("chance"));
      const colHonra = findCol(h1, "honra");
      const colDecisao = findCol(h1, "decisao", "decisão");
      const colMidia = findCol(h1, "midia", "mídia");

      const output: Record<string, any>[] = [];
      let matched = 0;

      for (let i = 0; i < allInput1Rows.length; i++) {
        const row = allInput1Rows[i];
        const numProcesso = colProcesso1 ? String(row[colProcesso1] ?? "") : "";
        const dossie = colDossie1 ? String(row[colDossie1] ?? "").trim() : "";
        const cnj = normalizeCNJ(numProcesso);

        // Skip rows where dossiê was not found
        const dossieNorm = normalizeText(dossie);
        if (!dossie || dossieNorm.includes("nao localizado") || dossieNorm.includes("não localizado") || dossieNorm.includes("n/localizado") || dossieNorm.includes("n/ localizado")) {
          continue;
        }

        // Find matching pauta
        let pauta: Record<string, any> | undefined;
        if (cnj.length >= 10) pauta = pautaByProcesso.get(cnj);
        if (!pauta && dossie) pauta = pautaByDossie.get(dossie.toLowerCase());

        const hasJulg = !!pauta;
        if (hasJulg) matched++;

        // Tipo de Recurso: usar colunas posicionais L (col 11) e P (col 15) da planilha de distribuição
        const colLVal = String(row["__col11"] ?? "").trim();
        const colPVal = String(row["__col15"] ?? "").trim();
        const tipoRecurso = colLVal || colPVal;
        // Use the last aparelhamento/chance (banco side) if multiple exist
        const aparelhamento = colAparelhamento.length > 0 ? String(row[colAparelhamento[colAparelhamento.length - 1]] ?? "") : "";
        const chanceExito = colChanceExito.length > 0 ? String(row[colChanceExito[colChanceExito.length - 1]] ?? "") : "";

        const relatorClassRaw = colRelatorClass ? String(row[colRelatorClass] ?? "") : "";
        const turmaClassRaw = colTurmaClass ? String(row[colTurmaClass] ?? "") : "";

        const outRow: Record<string, any> = {};
        outRow[LAYOUT_COLS[0]] = dossie; // Dossiê
        outRow[LAYOUT_COLS[1]] = "TST"; // Tribunal
        outRow[LAYOUT_COLS[2]] = tipoRecurso; // Tipo de Recurso
        outRow[LAYOUT_COLS[3]] = formatDateDDMMYYYY(colDataDist ? String(row[colDataDist] ?? "") : ""); // Data distribuição
        outRow[LAYOUT_COLS[4]] = colTurma ? String(row[colTurma] ?? "") : ""; // Turma
        outRow[LAYOUT_COLS[5]] = colRelator ? String(row[colRelator] ?? "") : ""; // Relator
        outRow[LAYOUT_COLS[6]] = colDecisao ? String(row[colDecisao] ?? "") : ""; // Análise quarteirizado
        outRow[LAYOUT_COLS[7]] = colMidia ? toSN(String(row[colMidia] ?? "")) : ""; // Mídia negativa S/N
        outRow[LAYOUT_COLS[8]] = ""; // Risco
        outRow[LAYOUT_COLS[9]] = "N"; // Provas digitais
        outRow[LAYOUT_COLS[10]] = hasJulg ? "S" : "N"; // Temos data julgamento
        const dataJulgVal = hasJulg && pColDataJulg ? formatDateDDMMYYYY(String(pauta![pColDataJulg] ?? "")) : "";
        outRow[LAYOUT_COLS[11]] = dataJulgVal; // Data julgamento
        outRow[LAYOUT_COLS[12]] = hasJulg && pColHorario ? String(pauta![pColHorario] ?? "") : ""; // Horário
        outRow[LAYOUT_COLS[13]] = hasJulg && pColTipo ? String(pauta![pColTipo] ?? "") : ""; // Tipo julgamento
        outRow[LAYOUT_COLS[14]] = colHonra ? toSN(String(row[colHonra] ?? "")) : ""; // Matéria de Honra S/N
        const colLHasValidDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dataJulgVal);
        outRow[LAYOUT_COLS[15]] = colLHasValidDate ? "S" : (hasJulg ? (pColMemoriais ? toSN(String(pauta![pColMemoriais] ?? "")) : "") : "N"); // Memoriais S/N
        outRow[LAYOUT_COLS[16]] = hasJulg ? (pColSustentacao ? toSN(String(pauta![pColSustentacao] ?? "")) : "") : "N"; // Sustentação S/N
        outRow[LAYOUT_COLS[17]] = ""; // Sem transcendência
        outRow[LAYOUT_COLS[18]] = ""; // Recurso não conhecido
        outRow[LAYOUT_COLS[19]] = ""; // Recurso conhecido e provido
        outRow[LAYOUT_COLS[20]] = ""; // Recurso conhecido e não provido
        outRow[LAYOUT_COLS[21]] = ""; // Outra
        outRow[LAYOUT_COLS[22]] = ""; // Observações
        outRow[LAYOUT_COLS[23]] = ""; // Ganhamos
        outRow[LAYOUT_COLS[24]] = ""; // Perdemos
        outRow[LAYOUT_COLS[25]] = "N"; // Processo baixado
        outRow[LAYOUT_COLS[26]] = colParteRecorrente ? String(row[colParteRecorrente] ?? "") : ""; // Recorrente
        // Turma favorável/desfavorável → split into two columns
        const turmaFav = deriveFavoravel(turmaClassRaw);
        outRow[LAYOUT_COLS[27]] = turmaFav === "Favorável" ? "X" : ""; // AB - Favorável (turma)
        outRow[LAYOUT_COLS[28]] = turmaFav === "Desfavorável" ? "X" : ""; // AC - Desfavorável (turma)
        const relatorFav = deriveFavoravel(relatorClassRaw);
        outRow[LAYOUT_COLS[29]] = relatorFav === "Favorável" ? "X" : ""; // AD - Favorável (relator)
        outRow[LAYOUT_COLS[30]] = relatorFav === "Desfavorável" ? "X" : ""; // AE - Desfavorável (relator)
        // Aparelhamento → split into two columns
        const aparelhamentoVal = deriveAparelhamento(aparelhamento);
        outRow[LAYOUT_COLS[31]] = aparelhamentoVal === "Bem aparelhado" ? "X" : ""; // AF
        outRow[LAYOUT_COLS[32]] = aparelhamentoVal === "Mal aparelhado" ? "X" : ""; // AG
        outRow[LAYOUT_COLS[33]] = chanceExito; // AH - Chance de êxito

        output.push(outRow);

        if (i % 200 === 0) {
          setProgress(55 + Math.floor((i / allInput1Rows.length) * 40));
          await new Promise(r => setTimeout(r, 0));
        }
      }

      setProgress(95);
      setOutputData(output);
      setStats({
        totalInput1: allInput1Rows.length,
        totalInput2: pautaSheet.rows.length,
        matched,
        unmatched: allInput1Rows.length - matched,
        outputRows: output.length,
      });

      setPhase("Concluído!");
      setProgress(100);
      toast.success(`Layout gerado com ${output.length} linhas!`);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      console.error("[CargaBenner] Error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const downloadXlsx = async () => {
    if (!outputData) return;
    try {
      // Fetch the original template
      const resp = await fetch("/templates/layout_carga_tst_template.xlsx");
      if (!resp.ok) throw new Error("Template não encontrado");
      const templateBuf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(templateBuf);

      // Read the existing shared strings
      const sstXml = await zip.file("xl/sharedStrings.xml")!.async("string");
      // Parse existing strings
      const existingStrings: string[] = [];
      const siRegex = /<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g;
      let m: RegExpExecArray | null;
      while ((m = siRegex.exec(sstXml)) !== null) {
        existingStrings.push(m[1]);
      }

      // Build string index for data values
      const stringMap = new Map<string, number>();
      existingStrings.forEach((s, i) => stringMap.set(s, i));
      const newStrings = [...existingStrings];

      function getStringIndex(val: string): number {
        if (stringMap.has(val)) return stringMap.get(val)!;
        const idx = newStrings.length;
        newStrings.push(val);
        stringMap.set(val, idx);
        return idx;
      }

      // Convert column index to Excel letter (0=A, 1=B, ..., 25=Z, 26=AA, ...)
      function colToLetter(c: number): string {
        let s = "";
        let n = c;
        while (n >= 0) {
          s = String.fromCharCode(65 + (n % 26)) + s;
          n = Math.floor(n / 26) - 1;
        }
        return s;
      }

      // Build data rows XML (starting at row 3)
      let dataRowsXml = "";
      for (let i = 0; i < outputData.length; i++) {
        const row = outputData[i];
        const rowNum = i + 3; // rows 1,2 are headers
        let cellsXml = "";
        for (let c = 0; c < LAYOUT_COLS.length; c++) {
          const val = String(row[LAYOUT_COLS[c]] ?? "");
          if (!val) continue;
          const ref = colToLetter(c) + rowNum;
          const idx = getStringIndex(val);
          cellsXml += `<c r="${ref}" t="s"><v>${idx}</v></c>`;
        }
        dataRowsXml += `<row r="${rowNum}" spans="1:34">${cellsXml}</row>`;
      }

      // Modify sheet1.xml: insert data rows before </sheetData>
      let sheetXml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
      // Update dimension
      const lastRow = outputData.length + 2;
      sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:AH${lastRow}"/>`);
      // Insert data rows before </sheetData>
      sheetXml = sheetXml.replace("</sheetData>", dataRowsXml + "</sheetData>");
      zip.file("xl/worksheets/sheet1.xml", sheetXml);

      // Update shared strings
      const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const newSstEntries = newStrings.map(s => `<si><t>${escapeXml(s)}</t></si>`).join("");
      const newSst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${newStrings.length}" uniqueCount="${newStrings.length}">${newSstEntries}</sst>`;
      zip.file("xl/sharedStrings.xml", newSst);

      // Generate and download
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Layout_Carga_modulo_TST.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha baixada!");
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
      console.error("[CargaBenner] Download error:", err);
    }
  };

  return (
    <MainLayout title="Carga Benner - Módulo TST">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Table2 className="w-7 h-7 text-primary" />
              Carga Benner - Módulo TST
            </h1>
            <p className="text-muted-foreground mt-1">
              Gera a planilha Layout Carga para envio ao Banco Santander
            </p>
          </div>
        </div>

        {/* Input Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input 1 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Input 1: Planilha Complementada TST
              </CardTitle>
              <CardDescription>Resultado da tela Planilha TST (todas as abas)</CardDescription>
            </CardHeader>
            <CardContent>
              <input ref={input1Ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e, 1)} />
              <Button variant="outline" className="w-full" onClick={() => input1Ref.current?.click()} disabled={processing}>
                <Upload className="w-4 h-4 mr-2" />
                {file1 ? file1.name : "Selecionar arquivo"}
              </Button>
              {file1 && <p className="text-xs text-muted-foreground mt-2">{(file1.size / 1024 / 1024).toFixed(2)} MB</p>}
            </CardContent>
          </Card>

          {/* Input 2 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Input 2: Pautas de Julgamento
              </CardTitle>
              <CardDescription>Planilha com datas de julgamento e detalhes</CardDescription>
            </CardHeader>
            <CardContent>
              <input ref={input2Ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e, 2)} />
              <Button variant="outline" className="w-full" onClick={() => input2Ref.current?.click()} disabled={processing}>
                <Upload className="w-4 h-4 mr-2" />
                {file2 ? file2.name : "Selecionar arquivo"}
              </Button>
              {file2 && <p className="text-xs text-muted-foreground mt-2">{(file2.size / 1024 / 1024).toFixed(2)} MB</p>}
            </CardContent>
          </Card>
        </div>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={processData} disabled={processing || !file1 || !file2} className="px-8">
            {processing ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processando...</>
            ) : (
              <><ArrowRight className="w-5 h-5 mr-2" />Processar e Gerar Layout</>
            )}
          </Button>
        </div>

        {/* Progress */}
        {processing && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{phase}</span>
                  <span className="font-mono text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalInput1.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Processos (Input 1)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalInput2.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Pautas (Input 2)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.matched.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Com Julgamento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.unmatched.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Sem Julgamento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.outputRows.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Linhas no Layout</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Download */}
        {outputData && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="font-semibold text-foreground">Layout Carga pronto!</p>
                    <p className="text-sm text-muted-foreground">{outputData.length} linhas geradas com {LAYOUT_COLS.length} colunas</p>
                  </div>
                </div>
                <Button onClick={downloadXlsx}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Layout Carga (.xlsx)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Table */}
        {outputData && outputData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4" />
                Prévia (primeiras 20 linhas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">#</TableHead>
                      {LAYOUT_COLS.slice(0, 15).map(h => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputData.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        {LAYOUT_COLS.slice(0, 15).map(h => (
                          <TableCell key={h} className="text-xs whitespace-nowrap max-w-[150px] truncate">
                            {String(row[h] ?? "")}
                          </TableCell>
                        ))}
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
