import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";

interface Stats {
  totalCarga: number;
  duplicatasRemovidas: number;
  cejuscRemovidas: number;
  bennerSimRemovidas: number;
  totalFinal: number;
  dossieIgualProcesso: number;
}

export default function CorrigirPlanilha() {
  const [distFile, setDistFile] = useState<File | null>(null);
  const [cargaFile, setCargaFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [distResultWb, setDistResultWb] = useState<XLSX.WorkBook | null>(null);

  const readFile = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });

  const normalize = (val: unknown): string =>
    String(val ?? "").trim().toUpperCase();

  const normalizeDigits = (val: unknown): string =>
    String(val ?? "").replace(/\D/g, "");

  const processar = useCallback(async () => {
    if (!distFile || !cargaFile) {
      toast.error("Selecione ambas as planilhas");
      return;
    }
    setProcessing(true);
    setStats(null);
    setResultBlob(null);
    setDistResultWb(null);

    try {
      const [distBuf, cargaBuf] = await Promise.all([readFile(distFile), readFile(cargaFile)]);

      // === DISTRIBUTION: read with XLSX to collect Benner SIM + detect dossie=processo ===
      const distWb = XLSX.read(new Uint8Array(distBuf), { type: "array" });
      const bennerSimContracts = new Set<string>();
      let dossieIgualProcesso = 0;

      for (const sheetName of distWb.SheetNames) {
        const ws = distWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const bennerAtualizado = normalize(row[26]);
          if (bennerAtualizado === "SIM") {
            const dossie = normalize(row[0]);
            if (dossie) bennerSimContracts.add(dossie);
            const processo = normalize(row[1]);
            if (processo) bennerSimContracts.add(processo);
          }
          const dossieDigits = normalizeDigits(row[0]);
          const processoDigits = normalizeDigits(row[1]);
          if (dossieDigits && processoDigits && dossieDigits === processoDigits) {
            dossieIgualProcesso++;
          }
        }
      }
      setDistResultWb(distWb);

      // === CARGA BENNER: use XLSX to determine which rows to remove, then JSZip to remove from XML ===
      const cargaWb = XLSX.read(new Uint8Array(cargaBuf), { type: "array", cellDates: true });

      // Build set of 1-based row indices to remove per sheet
      const rowsToRemovePerSheet: Map<number, Set<number>> = new Map();
      let duplicatasRemovidas = 0;
      let cejuscRemovidas = 0;
      let bennerSimRemovidas = 0;
      let totalCarga = 0;

      for (let si = 0; si < cargaWb.SheetNames.length; si++) {
        const ws = cargaWb.Sheets[cargaWb.SheetNames[si]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        if (rows.length < 2) continue;

        const dataRows = rows.slice(1);
        totalCarga += dataRows.length;
        const removeSet = new Set<number>();

        // Pass 1: CEJUSC (col F = index 5)
        for (let i = 0; i < dataRows.length; i++) {
          const colF = normalize(dataRows[i][5]);
          if (colF.includes("CEJUSC")) {
            cejuscRemovidas++;
            removeSet.add(i + 2); // 1-based Excel row (header=row1, data starts row2)
          }
        }

        // Pass 2: Benner SIM contracts
        for (let i = 0; i < dataRows.length; i++) {
          const excelRow = i + 2;
          if (removeSet.has(excelRow)) continue;
          const colA = normalize(dataRows[i][0]);
          const colB = normalize(dataRows[i][1]);
          if ((colA && bennerSimContracts.has(colA)) || (colB && bennerSimContracts.has(colB))) {
            bennerSimRemovidas++;
            removeSet.add(excelRow);
          }
        }

        // Pass 3: Duplicates by dossie+contract (col A + col B)
        const seen = new Set<string>();
        for (let i = 0; i < dataRows.length; i++) {
          const excelRow = i + 2;
          if (removeSet.has(excelRow)) continue;
          const key = `${normalize(dataRows[i][0])}|${normalize(dataRows[i][1])}`;
          if (seen.has(key)) {
            duplicatasRemovidas++;
            removeSet.add(excelRow);
          } else {
            seen.add(key);
          }
        }

        if (removeSet.size > 0) rowsToRemovePerSheet.set(si, removeSet);
      }

      const totalFinal = totalCarga - duplicatasRemovidas - cejuscRemovidas - bennerSimRemovidas;

      // === JSZip: manipulate XML to remove rows while preserving styles ===
      const zip = await JSZip.loadAsync(cargaBuf);
      const parser = new DOMParser();
      const serializer = new XMLSerializer();

      // Discover sheet paths
      const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
      const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
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

      for (const { index: sheetIdx, path: worksheetPath } of sheetPaths) {
        const removeSet = rowsToRemovePerSheet.get(sheetIdx);
        if (!removeSet || removeSet.size === 0) continue;

        const sheetXml = await zip.file(worksheetPath)?.async("string");
        if (!sheetXml) continue;

        const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
        const sheetNs = sheetDoc.documentElement.namespaceURI || "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const sheetDataEl = sheetDoc.getElementsByTagNameNS(sheetNs, "sheetData")[0];
        if (!sheetDataEl) continue;

        // Remove rows
        const allRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row")).filter(r => r.parentNode === sheetDataEl);
        for (const rowEl of allRows) {
          const rn = Number(rowEl.getAttribute("r"));
          if (removeSet.has(rn)) {
            sheetDataEl.removeChild(rowEl);
          }
        }

        // Renumber remaining rows sequentially
        const remainingRows = Array.from(sheetDataEl.getElementsByTagNameNS(sheetNs, "row"))
          .filter(r => r.parentNode === sheetDataEl)
          .sort((a, b) => Number(a.getAttribute("r")) - Number(b.getAttribute("r")));

        let newRowNum = 1;
        for (const rowEl of remainingRows) {
          const oldRowNum = Number(rowEl.getAttribute("r")!);
          if (oldRowNum !== newRowNum) {
            rowEl.setAttribute("r", String(newRowNum));
            const cells = Array.from(rowEl.getElementsByTagNameNS(sheetNs, "c")).filter(c => c.parentNode === rowEl);
            for (const cell of cells) {
              const ref = cell.getAttribute("r") || "";
              const colLetters = ref.replace(/\d+/g, "");
              cell.setAttribute("r", colLetters + newRowNum);
            }
          }
          newRowNum++;
        }

        // Update dimension
        const dimEl = sheetDoc.getElementsByTagNameNS(sheetNs, "dimension")[0];
        if (dimEl) {
          const dimRef = dimEl.getAttribute("ref") || "";
          const dimMatch = dimRef.match(/^([A-Z]+)\d+:([A-Z]+)\d+$/);
          if (dimMatch) {
            dimEl.setAttribute("ref", `${dimMatch[1]}1:${dimMatch[2]}${newRowNum - 1}`);
          }
        }

        // Update merge cells if present
        const mergeCellsEl = sheetDoc.getElementsByTagNameNS(sheetNs, "mergeCells")[0];
        if (mergeCellsEl) {
          const merges = Array.from(mergeCellsEl.getElementsByTagNameNS(sheetNs, "mergeCell"));
          for (const m of merges) {
            const ref = m.getAttribute("ref") || "";
            // Remove merges that reference removed rows - simplified approach
            const rowNums = ref.match(/\d+/g)?.map(Number) || [];
            if (rowNums.some(rn => removeSet.has(rn))) {
              mergeCellsEl.removeChild(m);
            }
          }
          const remaining = mergeCellsEl.getElementsByTagNameNS(sheetNs, "mergeCell").length;
          if (remaining === 0) {
            mergeCellsEl.parentNode?.removeChild(mergeCellsEl);
          } else {
            mergeCellsEl.setAttribute("count", String(remaining));
          }
        }

        zip.file(worksheetPath, serializer.serializeToString(sheetDoc));
      }

      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      setResultBlob(blob);
      setStats({ totalCarga, duplicatasRemovidas, cejuscRemovidas, bennerSimRemovidas, totalFinal, dossieIgualProcesso });
      toast.success("Planilhas processadas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao processar: " + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  }, [distFile, cargaFile]);

  const makeTimeSuffix = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}_${now.getHours().toString().padStart(2, "0")}h${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${makeTimeSuffix()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWb = (wb: XLSX.WorkBook, name: string) => {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, name);
  };

  return (
    <MainLayout title="Corrigir Planilha" subtitle="Remova duplicatas, linhas CEJUSC e registros já atualizados no Benner">
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                Planilha de Distribuição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="dist-file" className="text-xs text-muted-foreground mb-2 block">
                Identifica Benner SIM (col AA) e marca dossiê = processo em vermelho
              </Label>
              <Input id="dist-file" type="file" accept=".xlsx,.xls" onChange={(e) => setDistFile(e.target.files?.[0] || null)} />
              {distFile && <p className="text-xs text-green-600 mt-1">✓ {distFile.name}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                Planilha Carga Benner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="carga-file" className="text-xs text-muted-foreground mb-2 block">
                Será corrigida preservando layout original (cores, fontes, centralização)
              </Label>
              <Input id="carga-file" type="file" accept=".xlsx,.xls" onChange={(e) => setCargaFile(e.target.files?.[0] || null)} />
              {cargaFile && <p className="text-xs text-green-600 mt-1">✓ {cargaFile.name}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={processar} disabled={processing || !distFile || !cargaFile} className="gap-2">
            <Upload className="w-4 h-4" />
            {processing ? "Processando..." : "Processar"}
          </Button>
          {resultBlob && (
            <Button variant="outline" onClick={() => downloadBlob(resultBlob, "Carga_Benner_Corrigida")} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Carga Corrigida
            </Button>
          )}
          {distResultWb && stats && stats.dossieIgualProcesso > 0 && (
            <Button variant="outline" onClick={() => downloadWb(distResultWb, "Distribuicoes_Verificada")} className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
              <Download className="w-4 h-4" />
              Baixar Distribuição ({stats.dossieIgualProcesso} com dossiê = processo)
            </Button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats.totalCarga}</p>
                <p className="text-xs text-muted-foreground">Total Original</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-red-600">
                  <Trash2 className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.duplicatasRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">Duplicatas</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.cejuscRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">CEJUSC</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.bennerSimRemovidas}</p>
                </div>
                <p className="text-xs text-muted-foreground">Benner SIM</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.totalFinal}</p>
                </div>
                <p className="text-xs text-muted-foreground">Total Final</p>
              </CardContent>
            </Card>
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-2xl font-bold">{stats.dossieIgualProcesso}</p>
                </div>
                <p className="text-xs text-muted-foreground">Dossiê = Processo</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
