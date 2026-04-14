import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  const [resultWb, setResultWb] = useState<XLSX.WorkBook | null>(null);
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
    setResultWb(null);
    setDistResultWb(null);

    try {
      const [distBuf, cargaBuf] = await Promise.all([readFile(distFile), readFile(cargaFile)]);

      // Read distribution spreadsheet
      const distWb = XLSX.read(new Uint8Array(distBuf), { type: "array" });
      const bennerSimContracts = new Set<string>();
      let dossieIgualProcesso = 0;

      // Build distribution result with red rows where dossier == processo
      for (const sheetName of distWb.SheetNames) {
        const ws = distWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          const bennerAtualizado = normalize(row[26]); // col AA
          if (bennerAtualizado === "SIM") {
            const dossie = normalize(row[0]);
            if (dossie) bennerSimContracts.add(dossie);
            const processo = normalize(row[1]);
            if (processo) bennerSimContracts.add(processo);
          }

          // Check if dossier (col A) digits == processo (col B) digits
          const dossieDigits = normalizeDigits(row[0]);
          const processoDigits = normalizeDigits(row[1]);
          if (dossieDigits && processoDigits && dossieDigits === processoDigits) {
            dossieIgualProcesso++;
            // Paint row red
            const ref = XLSX.utils.decode_range(ws["!ref"] || "A1");
            for (let c = ref.s.c; c <= ref.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r: i, c });
              if (!ws[addr]) ws[addr] = { v: "", t: "s" };
              if (!ws[addr].s) ws[addr].s = {};
              ws[addr].s = {
                fill: { fgColor: { rgb: "FF0000" } },
                font: { color: { rgb: "FFFFFF" }, bold: true },
              };
            }
          }
        }
      }

      // Save dist workbook with styles
      setDistResultWb(distWb);

      // Read carga benner spreadsheet
      const cargaWb = XLSX.read(new Uint8Array(cargaBuf), { type: "array", cellDates: true });

      let duplicatasRemovidas = 0;
      let cejuscRemovidas = 0;
      let bennerSimRemovidas = 0;
      let totalCarga = 0;

      for (const sheetName of cargaWb.SheetNames) {
        const ws = cargaWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        if (rows.length < 2) continue;

        const headerRow = rows[0];
        const dataRows = rows.slice(1);
        totalCarga += dataRows.length;

        const afterCejusc = dataRows.filter(row => {
          const colF = normalize(row[5]);
          if (colF.includes("CEJUSC")) { cejuscRemovidas++; return false; }
          return true;
        });

        const afterBenner = afterCejusc.filter(row => {
          const colA = normalize(row[0]);
          const colB = normalize(row[1]);
          if ((colA && bennerSimContracts.has(colA)) || (colB && bennerSimContracts.has(colB))) {
            bennerSimRemovidas++;
            return false;
          }
          return true;
        });

        const seen = new Set<string>();
        const afterDedup = afterBenner.filter(row => {
          const key = `${normalize(row[0])}|${normalize(row[1])}`;
          if (seen.has(key)) { duplicatasRemovidas++; return false; }
          seen.add(key);
          return true;
        });

        const newData = [headerRow, ...afterDedup];
        const newWs = XLSX.utils.aoa_to_sheet(newData);
        cargaWb.Sheets[sheetName] = newWs;
      }

      const totalFinal = totalCarga - duplicatasRemovidas - cejuscRemovidas - bennerSimRemovidas;

      setStats({ totalCarga, duplicatasRemovidas, cejuscRemovidas, bennerSimRemovidas, totalFinal, dossieIgualProcesso });
      setResultWb(cargaWb);
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

  const downloadWb = (wb: XLSX.WorkBook, name: string) => {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${makeTimeSuffix()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Corrigir Planilha" subtitle="Remova duplicatas, linhas CEJUSC e registros já atualizados no Benner">
      <div className="space-y-6 max-w-4xl">
        {/* Inputs */}
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
                Será corrigida (remoção de duplicatas, CEJUSC e Benner SIM)
              </Label>
              <Input id="carga-file" type="file" accept=".xlsx,.xls" onChange={(e) => setCargaFile(e.target.files?.[0] || null)} />
              {cargaFile && <p className="text-xs text-green-600 mt-1">✓ {cargaFile.name}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={processar} disabled={processing || !distFile || !cargaFile} className="gap-2">
            <Upload className="w-4 h-4" />
            {processing ? "Processando..." : "Processar"}
          </Button>
          {resultWb && (
            <Button variant="outline" onClick={() => downloadWb(resultWb, "Carga_Benner_Corrigida")} className="gap-2">
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

        {/* Stats */}
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
