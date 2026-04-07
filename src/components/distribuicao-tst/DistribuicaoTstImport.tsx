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
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // Excel serial date
  const n = Number(t);
  if (!isNaN(n) && n > 30000 && n < 100000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

function toBool(val: unknown): boolean {
  const t = String(val ?? "").trim().toUpperCase();
  return t === "S" || t === "SIM" || t === "X" || t === "TRUE";
}

interface Props {
  onImported: () => void;
}

export function DistribuicaoTstImport({ onImported }: Props) {
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

        // Find header row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i];
          if (row?.some(c => /n[uú]mero.*processo/i.test(String(c ?? "")) || /dossi[eê]/i.test(String(c ?? "")))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) continue;

        const records: any[] = [];
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !String(c ?? "").trim())) continue;

          const processoNumero = norm(r[1]);
          if (!processoNumero || processoNumero.length < 7) continue;

          // Ensure processo exists
          const { data: existingProc } = await supabase
            .from("processos")
            .select("id")
            .eq("numero", processoNumero)
            .maybeSingle();

          let processoId = existingProc?.id;
          if (!processoId) {
            const { data: newProc, error: procErr } = await supabase
              .from("processos")
              .insert({
                numero: processoNumero,
                status: "ativo",
                area: "trabalhista",
                polo_ativo: norm(r[4]) || null,
                polo_passivo: norm(r[5]) || null,
                dossie_tst: norm(r[2]) || null,
                relator_tst: norm(r[6]) || null,
                turma_tst: norm(r[8]) || null,
              })
              .select("id")
              .single();
            if (procErr) {
              console.error("Erro ao criar processo:", procErr);
              continue;
            }
            processoId = newProc.id;
          }

          records.push({
            processo_id: processoId,
            processo_numero: processoNumero,
            aba_origem: sheetName,
            data_distribuicao: parseDateBR(r[0]),
            dossie: norm(r[2]) || null,
            equipe: norm(r[3]) || null,
            reclamante: norm(r[4]) || null,
            reclamada: norm(r[5]) || null,
            relator: norm(r[6]) || null,
            relator_favorabilidade: norm(r[7]) || null,
            turma: norm(r[8]) || null,
            turma_favorabilidade: norm(r[9]) || null,
            parte_recorrente: norm(r[10]) || null,
            tipo_recurso_reclamante: norm(r[11]) || null,
            materias_recurso_reclamante: norm(r[12]) || null,
            aparelhamento_reclamante: norm(r[13]) || null,
            chance_exito_reclamante: norm(r[14]) || null,
            tipo_recurso_banco: norm(r[15]) || null,
            materias_recurso_banco: norm(r[16]) || null,
            aparelhamento_banco: norm(r[17]) || null,
            chance_exito_banco: norm(r[18]) || null,
            honra: norm(r[19]) || null,
            tema: norm(r[20]) || null,
            execucao: norm(r[21]) || null,
            midia_negativa: norm(r[22]) || null,
            decisao_quarteirizado: norm(r[23]) || null,
            recurso_terceiros: norm(r[24]) || null,
            transito_julgado: toBool(r[25]),
            benner_atualizado: toBool(r[26]),
          });
        }

        // Insert in batches, using delete-then-insert for dedup
        for (let i = 0; i < records.length; i += 50) {
          const batch = records.slice(i, i + 50);
          for (const rec of batch) {
            // Delete existing with same key
            await supabase
              .from("distribuicoes_tst" as any)
              .delete()
              .eq("processo_numero", rec.processo_numero)
              .eq("aba_origem", rec.aba_origem || "");
          }
          const { error, data } = await supabase.from("distribuicoes_tst" as any).insert(batch as any).select("id");
          if (error) {
            console.error(`Erro ao importar lote:`, error);
            toast.error(`Erro ao importar: ${error.message}`);
            break;
          }
          totalInserted += (data as any[])?.length ?? batch.length;
        }
      }

      if (totalInserted > 0) {
        toast.success(`${totalInserted} distribuições importadas com sucesso!`);
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
