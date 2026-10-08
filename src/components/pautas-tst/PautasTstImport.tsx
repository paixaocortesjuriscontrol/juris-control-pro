import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

function parseDateBR(val: unknown): string | null {
  const t = String(val ?? "").trim();
  if (!t || t === "-----" || t === "--") return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const n = Number(t);
  if (!isNaN(n) && n > 30000 && n < 100000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function cleanVal(val: unknown): string | null {
  const v = norm(val);
  if (!v || v === "-----" || v === "--") return null;
  return v;
}

interface Props {
  onImported: () => void;
}

export function PautasTstImport({ onImported }: Props) {
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fase, setFase] = useState("");
  const [feito, setFeito] = useState(0);
  const [total, setTotal] = useState(1);
  const [resultado, setResultado] = useState<null | {
    abas: { nome: string; linhas: number; importadas: number; vinculadas: number; erro?: string }[];
    ignoradas: string[];
    erroGeral?: string;
  }>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setOpen(true);
    setResultado(null);
    setFeito(0);
    setTotal(1);
    setFase("Lendo a planilha...");
    const abas: { nome: string; linhas: number; importadas: number; vinculadas: number; erro?: string }[] = [];
    const ignoradas: string[] = [];
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });

      let totalInserted = 0;
      // Conta linhas para a barra de progresso (leitura + gravação)
      let totalLinhas = 0;
      for (const sn of wb.SheetNames) {
        const ref = wb.Sheets[sn]["!ref"];
        if (ref) totalLinhas += XLSX.utils.decode_range(ref).e.r + 1;
      }
      setTotal(Math.max(1, totalLinhas * 2));
      let progresso = 0;

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i];
          if (row?.some(c => /equipe/i.test(String(c ?? "")) || /dossi[eê]/i.test(String(c ?? "")))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          ignoradas.push(sheetName);
          progresso += json.length * 2;
          setFeito(progresso);
          continue;
        }
        setFase(`Lendo aba "${sheetName}"...`);
        const aba = { nome: sheetName, linhas: 0, importadas: 0, vinculadas: 0 } as (typeof abas)[number];
        abas.push(aba);
        progresso += (headerIdx + 1) * 2;

        const records: any[] = [];
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          progresso++;
          if (i % 20 === 0) setFeito(progresso);
          if (!r || r.every(c => !String(c ?? "").trim())) continue;

          const processoNumero = norm(r[3]);
          const dossie = norm(r[2]);
          if (!processoNumero && !dossie) continue;

          let processoId: string | null = null;
          if (processoNumero && processoNumero.length >= 7) {
            const { data: existingProc } = await supabase
              .from("processos")
              .select("id")
              .eq("numero", processoNumero)
              .maybeSingle();
            processoId = existingProc?.id || null;
            if (processoId) aba.vinculadas++;
          }

          records.push({
            processo_id: processoId,
            processo_numero: processoNumero || null,
            aba_origem: sheetName,
            equipe: cleanVal(r[0]),
            advogado_interno: cleanVal(r[1]),
            dossie: cleanVal(r[2]),
            reclamante: cleanVal(r[4]),
            reclamada: cleanVal(r[5]),
            parte_recorrente: cleanVal(r[6]),
            tipo_recurso: cleanVal(r[7]),
            data_julgamento: parseDateBR(r[8]),
            horario: cleanVal(r[9]),
            modalidade: cleanVal(r[10]),
            link_acesso: cleanVal(r[11]),
            orgao: cleanVal(r[12]),
            relator: cleanVal(r[13]),
            materia_recurso_reclamante: cleanVal(r[14]),
            aparelhamento_reclamante: cleanVal(r[15]),
            chance_exito_reclamante: cleanVal(r[16]),
            materia_recurso_banco: cleanVal(r[17]),
            aparelhamento_banco: cleanVal(r[18]),
            chance_exito_banco: cleanVal(r[19]),
            honra: cleanVal(r[20]),
            decisao: cleanVal(r[21]),
            sustentacao_oral: cleanVal(r[22]),
            desistencia_recurso: cleanVal(r[23]),
            midia_negativa: cleanVal(r[24]),
            entrega_memoriais: cleanVal(r[25]),
            solicitacao_providencias_banco: cleanVal(r[26]),
            solicitacao_rosa_oliveira: cleanVal(r[27]),
            comentarios_advogado: cleanVal(r[28]),
            retorno_esclarecimentos: cleanVal(r[29]),
            resultado_proxima_sessao: cleanVal(r[30]),
          });
        }

        aba.linhas = records.length;
        progresso += (json.length - headerIdx - 1) - records.length; // linhas vazias contam como gravadas
        setFeito(progresso);
        setFase(`Gravando aba "${sheetName}"...`);
        // Delete existing records from this sheet, then insert
        if (records.length > 0) {
          await supabase
            .from("pautas_tst" as any)
            .delete()
            .eq("aba_origem", sheetName);
        }

        for (let i = 0; i < records.length; i += 50) {
          const batch = records.slice(i, i + 50);
          const { error, data } = await supabase.from("pautas_tst" as any).insert(batch as any).select("id");
          if (error) {
            console.error(`Erro ao importar lote:`, error);
            aba.erro = error.message;
            break;
          }
          const n = (data as any[])?.length ?? batch.length;
          totalInserted += n;
          aba.importadas += n;
          progresso += batch.length;
          setFeito(progresso);
        }
      }

      setFeito(Math.max(1, totalLinhas * 2));
      setFase("Concluído");
      setResultado({ abas, ignoradas });
      if (totalInserted > 0) onImported();
    } catch (err: any) {
      setResultado({ abas, ignoradas, erroGeral: err?.message || String(err) });
      toast.error("Erro ao processar planilha: " + (err?.message || String(err)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Importar Planilha
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!importing) setOpen(o); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => importing && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{importing ? "Importando planilha de pautas" : "Resultado da importação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{fase}</span>
              <span>{Math.min(100, Math.round((feito / total) * 100))}%</span>
            </div>
            <Progress value={Math.min(100, (feito / total) * 100)} />
          </div>
          {resultado && (() => {
            const tot = resultado.abas.reduce((a, b) => ({ l: a.l + b.linhas, i: a.i + b.importadas, v: a.v + b.vinculadas }), { l: 0, i: 0, v: 0 });
            const comErro = resultado.abas.filter(a => a.erro);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Abas importadas</div><div className="text-lg font-semibold">{resultado.abas.length}</div></div>
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Pautas lidas</div><div className="text-lg font-semibold">{tot.l}</div></div>
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Gravadas</div><div className="text-lg font-semibold text-primary">{tot.i}</div></div>
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-xs">Ligadas a processo</div><div className="text-lg font-semibold">{tot.v}</div></div>
                </div>
                {resultado.erroGeral || comErro.length > 0 ? (
                  <div className="flex items-start gap-2 text-destructive"><AlertTriangle className="w-4 h-4 mt-0.5" /><span>{resultado.erroGeral ?? `${comErro.length} aba(s) com erro na gravação.`}</span></div>
                ) : (
                  <div className="flex items-center gap-2 text-primary"><CheckCircle2 className="w-4 h-4" />Importação concluída sem erros.</div>
                )}
                {resultado.abas.length > 0 && (
                  <div className="max-h-64 overflow-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0"><tr><th className="text-left p-2">Aba</th><th className="text-right p-2">Lidas</th><th className="text-right p-2">Gravadas</th><th className="text-right p-2">Com processo</th><th className="text-left p-2">Erro</th></tr></thead>
                      <tbody>
                        {resultado.abas.map(a => (
                          <tr key={a.nome} className="border-t"><td className="p-2">{a.nome}</td><td className="p-2 text-right">{a.linhas}</td><td className="p-2 text-right">{a.importadas}</td><td className="p-2 text-right">{a.vinculadas}</td><td className="p-2 text-destructive">{a.erro ?? ""}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resultado.ignoradas.length > 0 && (
                  <p className="text-xs text-muted-foreground">Abas sem cabeçalho de pauta (ignoradas): {resultado.ignoradas.join(", ")}</p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setOpen(false)} disabled={importing}>{importing ? "Aguarde..." : "Fechar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
