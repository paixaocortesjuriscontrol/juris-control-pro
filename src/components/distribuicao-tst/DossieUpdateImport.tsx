import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

interface Props {
  onUpdated: () => void;
}

export function DossieUpdateImport({ onUpdated }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setStatusText("Lendo planilha…");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

      let headerIdx = -1;
      let colDossie = -1;
      let colProcesso = -1;
      for (let i = 0; i < Math.min(json.length, 10); i++) {
        const row = json[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
          const h = norm(row[j]).toLowerCase();
          if (h.includes("dossi") && colDossie === -1) colDossie = j;
          if ((h === "número" || h === "numero") && colProcesso === -1) colProcesso = j;
        }
        if (colDossie >= 0 && colProcesso >= 0) { headerIdx = i; break; }
      }

      if (headerIdx === -1 || colDossie === -1 || colProcesso === -1) {
        toast.error("Não encontrei as colunas 'Nº Do Dossiê' e 'Número' na planilha");
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const dossieMap = new Map<string, string>();
      for (let i = headerIdx + 1; i < json.length; i++) {
        const r = json[i];
        if (!r) continue;
        const processo = norm(r[colProcesso]);
        const dossie = norm(r[colDossie]);
        if (processo && processo.length >= 7 && dossie) {
          dossieMap.set(processo, dossie);
        }
      }

      if (dossieMap.size === 0) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const numeros = [...dossieMap.keys()];
      let updated = 0;
      let notFound = 0;
      const LOOKUP_BATCH = 1000;
      const UPDATE_CONCURRENCY = 8;
      const LOOKUP_CONCURRENCY = 4;
      const totalBatches = Math.ceil(numeros.length / LOOKUP_BATCH);
      let doneBatches = 0;

      const lookupBatches: string[][] = [];
      for (let i = 0; i < numeros.length; i += LOOKUP_BATCH) {
        lookupBatches.push(numeros.slice(i, i + LOOKUP_BATCH));
      }

      const processBatch = async (batch: string[]) => {
        const { data } = await supabase
          .from("dados_benner" as any)
          .select("id, processo")
          .in("processo", batch);

        if (!data || (data as any[]).length === 0) {
          notFound += batch.length;
          return;
        }

        const found = new Set((data as any[]).map((r: any) => r.processo));
        notFound += batch.length - found.size;

        const byDossie = new Map<string, string[]>();
        for (const row of data as any[]) {
          const newDossie = dossieMap.get(row.processo);
          if (!newDossie) continue;
          if (!byDossie.has(newDossie)) byDossie.set(newDossie, []);
          byDossie.get(newDossie)!.push(row.id);
        }

        const entries = [...byDossie.entries()];
        for (let i = 0; i < entries.length; i += UPDATE_CONCURRENCY) {
          const slice = entries.slice(i, i + UPDATE_CONCURRENCY);
          await Promise.all(
            slice.map(async ([dossie, ids]) => {
              const { error } = await supabase
                .from("dados_benner" as any)
                .update({ dossie } as any)
                .in("id", ids);
              if (!error) updated += ids.length;
            })
          );
        }
      };

      for (let i = 0; i < lookupBatches.length; i += LOOKUP_CONCURRENCY) {
        const slice = lookupBatches.slice(i, i + LOOKUP_CONCURRENCY);
        await Promise.all(
          slice.map(async (batch) => {
            await processBatch(batch);
            doneBatches += 1;
            setProgress(Math.round((doneBatches / totalBatches) * 100));
            setStatusText(`Lote ${doneBatches}/${totalBatches} · ${updated} atualizados`);
          })
        );
      }

      setProgress(100);
      if (updated > 0) {
        toast.success(`${updated} dossiês atualizados! (${notFound} não encontrados)`);
        onUpdated();
      } else {
        toast.warning("Nenhum dossiê atualizado (nenhum processo correspondente encontrado)");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setImporting(false);
      setProgress(0);
      setStatusText("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Atualizar Dossiês
      </Button>
      {importing && (
        <div className="space-y-1 min-w-[200px]">
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground truncate">{statusText}</p>
        </div>
      )}
    </div>
  );
}
