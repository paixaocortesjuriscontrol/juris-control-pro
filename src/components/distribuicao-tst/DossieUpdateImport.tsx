import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

      // Find header row
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

      // Build map: processo_numero -> dossie
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

      // Fetch distribuicoes that match and update dossie
      const numeros = [...dossieMap.keys()];
      let updated = 0;

      for (let i = 0; i < numeros.length; i += 500) {
        const batch = numeros.slice(i, i + 500);
        const { data } = await supabase
          .from("distribuicoes_tst" as any)
          .select("id, processo_numero")
          .in("processo_numero", batch);

        if (!data || (data as any[]).length === 0) continue;

        // Group updates by dossie value for efficiency
        for (const row of data as any[]) {
          const newDossie = dossieMap.get(row.processo_numero);
          if (!newDossie) continue;
          const { error } = await supabase
            .from("distribuicoes_tst" as any)
            .update({ dossie: newDossie } as any)
            .eq("processo_numero", row.processo_numero);
          if (!error) updated++;
        }
      }

      if (updated > 0) {
        toast.success(`${updated} dossiês atualizados!`);
        onUpdated();
      } else {
        toast.warning("Nenhum dossiê atualizado (nenhum processo correspondente encontrado)");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Atualizar Dossiês
      </Button>
    </>
  );
}
