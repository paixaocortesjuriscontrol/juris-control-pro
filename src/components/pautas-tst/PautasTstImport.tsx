import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });

      let totalInserted = 0;

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
        if (headerIdx === -1) continue;

        const records: any[] = [];
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
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
            toast.error(`Erro ao importar: ${error.message}`);
            break;
          }
          totalInserted += (data as any[])?.length ?? batch.length;
        }
      }

      if (totalInserted > 0) {
        toast.success(`${totalInserted} pautas importadas com sucesso!`);
        onImported();
      } else {
        toast.warning("Nenhum registro válido encontrado na planilha");
      }
    } catch (err: any) {
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
    </>
  );
}
