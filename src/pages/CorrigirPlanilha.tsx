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
}

export default function CorrigirPlanilha() {
  const [distFile, setDistFile] = useState<File | null>(null);
  const [cargaFile, setCargaFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [resultWb, setResultWb] = useState<XLSX.WorkBook | null>(null);

  const readFile = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });

  const normalize = (val: unknown): string =>
    String(val ?? "").trim().toUpperCase();

  const processar = useCallback(async () => {
    if (!distFile || !cargaFile) {
      toast.error("Selecione ambas as planilhas");
      return;
    }
    setProcessing(true);
    setStats(null);
    setResultWb(null);

    try {
      const [distBuf, cargaBuf] = await Promise.all([readFile(distFile), readFile(cargaFile)]);

      // Read distribution spreadsheet - collect contracts with Benner Atualizado = SIM (col AA = index 26)
      const distWb = XLSX.read(new Uint8Array(distBuf), { type: "array" });
      const bennerSimContracts = new Set<string>();

      for (const sheetName of distWb.SheetNames) {
        const ws = distWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const bennerAtualizado = normalize(row[26]); // col AA
          if (bennerAtualizado === "SIM") {
            // Use dossier (col A = index 0) as contract identifier
            const dossie = normalize(row[0]);
            if (dossie) bennerSimContracts.add(dossie);
            // Also try col B (processo) as fallback key
            const processo = normalize(row[1]);
            if (processo) bennerSimContracts.add(processo);
          }
        }
      }

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

        // Step 1: Remove CEJUSC in column F (index 5)
        const afterCejusc = dataRows.filter(row => {
          const colF = normalize(row[5]);
          if (colF.includes("CEJUSC")) {
            cejuscRemovidas++;
            return false;
          }
          return true;
        });

        // Step 2: Remove rows where contract/dossier is in bennerSimContracts
        const afterBenner = afterCejusc.filter(row => {
          // Check col A (dossier) and col B (processo) against bennerSim set
          const colA = normalize(row[0]);
          const colB = normalize(row[1]);
          if ((colA && bennerSimContracts.has(colA)) || (colB && bennerSimContracts.has(colB))) {
            bennerSimRemovidas++;
            return false;
          }
          return true;
        });

        // Step 3: Remove duplicates by dossier/contract (col A + col B)
        const seen = new Set<string>();
        const afterDedup = afterBenner.filter(row => {
          const key = `${normalize(row[0])}|${normalize(row[1])}`;
          if (seen.has(key)) {
            duplicatasRemovidas++;
            return false;
          }
          seen.add(key);
          return true;
        });

        // Rebuild sheet
        const newData = [headerRow, ...afterDedup];
        const newWs = XLSX.utils.aoa_to_sheet(newData);
        cargaWb.Sheets[sheetName] = newWs;
      }

      const totalFinal = totalCarga - duplicatasRemovidas - cejuscRemovidas - bennerSimRemovidas;

      setStats({
        totalCarga,
        duplicatasRemovidas,
        cejuscRemovidas,
        bennerSimRemovidas,
        totalFinal,
      });
      setResultWb(cargaWb);
      toast.success("Planilha corrigida com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao processar: " + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  }, [distFile, cargaFile]);

  const baixar = useCallback(() => {
    if (!resultWb) return;
    const buf = XLSX.write(resultWb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const now = new Date();
    const suffix = `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}_${now.getHours().toString().padStart(2, "0")}h${now.getMinutes().toString().padStart(2, "0")}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Carga_Benner_Corrigida_${suffix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resultWb]);

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
                Usada para identificar contratos com Benner Atualizado = SIM (coluna AA)
              </Label>
              <Input
                id="dist-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setDistFile(e.target.files?.[0] || null)}
              />
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
                Planilha que será corrigida (remoção de duplicatas, CEJUSC e Benner SIM)
              </Label>
              <Input
                id="carga-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setCargaFile(e.target.files?.[0] || null)}
              />
              {cargaFile && <p className="text-xs text-green-600 mt-1">✓ {cargaFile.name}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Action */}
        <div className="flex gap-3">
          <Button onClick={processar} disabled={processing || !distFile || !cargaFile} className="gap-2">
            <Upload className="w-4 h-4" />
            {processing ? "Processando..." : "Processar"}
          </Button>
          {resultWb && (
            <Button variant="outline" onClick={baixar} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Planilha Corrigida
            </Button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          </div>
        )}
      </div>
    </MainLayout>
  );
}
