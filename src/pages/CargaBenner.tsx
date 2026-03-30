import { useState, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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

// Layout Carga headers (35 columns)
const LAYOUT_HEADERS = [
  "Dossiê", "Tribunal", "Tipo de Recurso", "Data da distribuição", "Turma", "Relator",
  "Análise do quarteirizado", "Há risco de mídia negativa?", "Risco",
  "Há discussão sobre provas digitais?", "Temos data de julgamento?",
  "Data Julgamento", "Horário", "Tipo Julgamento", "Matéria de Honra",
  "Entrega de Memoriais", "Sustentação Oral",
  "Sem transcendência", "Transcendência não reconhecida", "Transcendência reconhecida e recurso desprovido",
  "Transcendência reconhecida e recurso provido", "Outra",
  "Observações", "Ganhamos / Perdemos", "Processo baixado",
  "Recorrente", "Turma Favorável/Desfavorável", "Relator Favorável/Desfavorável",
  "Recurso Bem/Mal aparelhado", "Chance de êxito",
  "Número do Processo", "Reclamante", "Reclamada", "Equipe", "Data Distribuição Original",
];

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

        // Find matching pauta
        let pauta: Record<string, any> | undefined;
        if (cnj.length >= 10) pauta = pautaByProcesso.get(cnj);
        if (!pauta && dossie) pauta = pautaByDossie.get(dossie.toLowerCase());

        const hasJulg = !!pauta;
        if (hasJulg) matched++;

        const tipoRecurso = colTipoRecursoBanco ? String(row[colTipoRecursoBanco] ?? "") : (colTipoRecursoReclamante ? String(row[colTipoRecursoReclamante] ?? "") : "");
        // Use the last aparelhamento/chance (banco side) if multiple exist
        const aparelhamento = colAparelhamento.length > 0 ? String(row[colAparelhamento[colAparelhamento.length - 1]] ?? "") : "";
        const chanceExito = colChanceExito.length > 0 ? String(row[colChanceExito[colChanceExito.length - 1]] ?? "") : "";

        const relatorClassRaw = colRelatorClass ? String(row[colRelatorClass] ?? "") : "";
        const turmaClassRaw = colTurmaClass ? String(row[colTurmaClass] ?? "") : "";

        const outRow: Record<string, any> = {
          "Dossiê": dossie,
          "Tribunal": "TST",
          "Tipo de Recurso": tipoRecurso,
          "Data da distribuição": colDataDist ? String(row[colDataDist] ?? "") : "",
          "Turma": colTurma ? String(row[colTurma] ?? "") : "",
          "Relator": colRelator ? String(row[colRelator] ?? "") : "",
          "Análise do quarteirizado": colDecisao ? String(row[colDecisao] ?? "") : "",
          "Há risco de mídia negativa?": colMidia ? String(row[colMidia] ?? "") : "",
          "Risco": "",
          "Há discussão sobre provas digitais?": "NÃO",
          "Temos data de julgamento?": hasJulg ? "SIM" : "NÃO",
          "Data Julgamento": hasJulg && pColDataJulg ? String(pauta![pColDataJulg] ?? "") : "",
          "Horário": hasJulg && pColHorario ? String(pauta![pColHorario] ?? "") : "",
          "Tipo Julgamento": hasJulg && pColTipo ? String(pauta![pColTipo] ?? "") : "",
          "Matéria de Honra": colHonra ? String(row[colHonra] ?? "") : "",
          "Entrega de Memoriais": hasJulg && pColMemoriais ? String(pauta![pColMemoriais] ?? "") : "",
          "Sustentação Oral": hasJulg && pColSustentacao ? String(pauta![pColSustentacao] ?? "") : "",
          "Sem transcendência": "",
          "Transcendência não reconhecida": "",
          "Transcendência reconhecida e recurso desprovido": "",
          "Transcendência reconhecida e recurso provido": "",
          "Outra": "",
          "Observações": "",
          "Ganhamos / Perdemos": "",
          "Processo baixado": "NÃO",
          "Recorrente": colParteRecorrente ? String(row[colParteRecorrente] ?? "") : "",
          "Turma Favorável/Desfavorável": deriveFavoravel(turmaClassRaw),
          "Relator Favorável/Desfavorável": deriveFavoravel(relatorClassRaw),
          "Recurso Bem/Mal aparelhado": deriveAparelhamento(aparelhamento),
          "Chance de êxito": chanceExito,
          "Número do Processo": numProcesso,
          "Reclamante": colReclamante ? String(row[colReclamante] ?? "") : "",
          "Reclamada": colReclamada ? String(row[colReclamada] ?? "") : "",
          "Equipe": colEquipe ? String(row[colEquipe] ?? "") : "",
          "Data Distribuição Original": colDataDist ? String(row[colDataDist] ?? "") : "",
        };

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

  const downloadXlsx = () => {
    if (!outputData) return;
    const ws = XLSX.utils.json_to_sheet(outputData, { header: LAYOUT_HEADERS });
    // Set column widths
    ws["!cols"] = LAYOUT_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Layout Carga TST");
    XLSX.writeFile(wb, "Layout_Carga_modulo_TST.xlsx");
    toast.success("Planilha baixada!");
  };

  return (
    <MainLayout>
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
                    <p className="text-sm text-muted-foreground">{outputData.length} linhas geradas com {LAYOUT_HEADERS.length} colunas</p>
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
                      {LAYOUT_HEADERS.slice(0, 15).map(h => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outputData.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        {LAYOUT_HEADERS.slice(0, 15).map(h => (
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
