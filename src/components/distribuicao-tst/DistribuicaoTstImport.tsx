import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, XCircle } from "lucide-react";
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
  const n = Number(t);
  if (!isNaN(n) && n > 30000 && n < 100000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function toBool(val: unknown): boolean {
  const t = String(val ?? "").trim().toUpperCase();
  return t === "S" || t === "SIM" || t === "X" || t === "TRUE";
}

interface ParsedRecord {
  sheetName: string;
  processoNumero: string;
  row: string[];
}

interface Props {
  onImported: () => void;
}

const BATCH_SIZE = 50;

export function DistribuicaoTstImport({ onImported }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const resetState = () => {
    setImporting(false);
    setProgress(0);
    setProgressLabel("");
    cancelRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setProgressLabel("Cancelando...");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelRef.current = false;
    setImporting(true);
    setProgress(0);
    setProgressLabel("Lendo planilha...");

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });

      // Parse all records from all sheets
      const allRecords: ParsedRecord[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i];
          if (row?.some(c => /n[uú]mero.*processo/i.test(String(c ?? "")) || /dossi[eê]/i.test(String(c ?? "")))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) continue;

        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !String(c ?? "").trim())) continue;
          const processoNumero = norm(r[1]);
          if (!processoNumero || processoNumero.length < 7) continue;
          allRecords.push({ sheetName, processoNumero, row: r });
        }
      }

      if (allRecords.length === 0) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        resetState();
        return;
      }

      const total = allRecords.length;
      setProgressLabel(`Etapa 1/3: Verificando processos... (${total} registros)`);
      setProgress(5);

      // Step 1: Collect unique processo numbers and resolve IDs in bulk
      const uniqueNumeros = [...new Set(allRecords.map(r => r.processoNumero))];
      const processoIdMap = new Map<string, string>();

      // Fetch existing processos in batches of 200
      for (let i = 0; i < uniqueNumeros.length; i += 200) {
        if (cancelRef.current) { toast.info("Importação cancelada."); resetState(); return; }
        const batch = uniqueNumeros.slice(i, i + 200);
        const { data } = await supabase
          .from("processos")
          .select("id, numero")
          .in("numero", batch);
        (data || []).forEach((p: any) => processoIdMap.set(p.numero, p.id));
        setProgress(5 + Math.round((i / uniqueNumeros.length) * 15));
      }

      // Create missing processos in batches
      const missing = uniqueNumeros.filter(n => !processoIdMap.has(n));
      if (missing.length > 0) {
        setProgressLabel(`Etapa 1/3: Criando ${missing.length} processos novos...`);
        // Build insert payloads using first occurrence data
        const firstOccurrence = new Map<string, string[]>();
        for (const rec of allRecords) {
          if (missing.includes(rec.processoNumero) && !firstOccurrence.has(rec.processoNumero)) {
            firstOccurrence.set(rec.processoNumero, rec.row);
          }
        }

        const toCreate = missing.map(num => {
          const r = firstOccurrence.get(num)!;
          return {
            numero: num,
            status: "ativo" as const,
            area: "trabalhista",
            polo_ativo: norm(r[4]) || null,
            polo_passivo: norm(r[5]) || null,
            dossie_tst: norm(r[2]) || null,
            relator_tst: norm(r[6]) || null,
            turma_tst: norm(r[8]) || null,
          };
        });

        for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
          if (cancelRef.current) { toast.info("Importação cancelada."); resetState(); return; }
          const batch = toCreate.slice(i, i + BATCH_SIZE);
          const { data, error } = await supabase
            .from("processos")
            .insert(batch)
            .select("id, numero");
          if (!error && data) {
            data.forEach((p: any) => processoIdMap.set(p.numero, p.id));
          } else if (error) {
            // Fallback: insert one by one for this batch
            for (const item of batch) {
              const { data: single, error: sErr } = await supabase
                .from("processos")
                .insert(item)
                .select("id, numero")
                .single();
              if (!sErr && single) processoIdMap.set(single.numero, single.id);
            }
          }
          setProgress(20 + Math.round((i / toCreate.length) * 10));
        }
      }

      setProgress(30);
      setProgressLabel(`Etapa 2/3: Removendo registros antigos...`);

      // Step 2: Delete existing distribuicoes for all processo_numero+aba_origem combos in bulk
      // Group by aba_origem for efficient deletion
      const abaGroups = new Map<string, string[]>();
      for (const rec of allRecords) {
        const key = rec.sheetName;
        if (!abaGroups.has(key)) abaGroups.set(key, []);
        const arr = abaGroups.get(key)!;
        if (!arr.includes(rec.processoNumero)) arr.push(rec.processoNumero);
      }

      for (const [aba, numeros] of abaGroups) {
        if (cancelRef.current) { toast.info("Importação cancelada."); resetState(); return; }
        // Delete in batches of 200 numeros per aba
        for (let i = 0; i < numeros.length; i += 200) {
          const batch = numeros.slice(i, i + 200);
          await supabase
            .from("distribuicoes_tst" as any)
            .delete()
            .in("processo_numero", batch)
            .eq("aba_origem", aba);
        }
      }

      setProgress(40);
      setProgressLabel(`Etapa 3/3: Inserindo ${total} distribuições...`);

      // Step 3: Build and insert all records in batches
      let totalUpserted = 0;
      const insertRecords = allRecords
        .filter(rec => processoIdMap.has(rec.processoNumero))
        .map(({ sheetName, processoNumero, row: r }) => ({
          processo_id: processoIdMap.get(processoNumero)!,
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
        }));

      for (let i = 0; i < insertRecords.length; i += BATCH_SIZE) {
        if (cancelRef.current) {
          toast.info(`Importação cancelada. ${totalUpserted} registros já inseridos.`);
          onImported();
          resetState();
          return;
        }

        const batch = insertRecords.slice(i, i + BATCH_SIZE);
        const { error, data } = await supabase
          .from("distribuicoes_tst" as any)
          .insert(batch as any)
          .select("id");

        if (error) {
          console.error(`Erro lote ${i / BATCH_SIZE + 1}:`, error);
          // Fallback individual
          for (const rec of batch) {
            const { error: sErr } = await supabase.from("distribuicoes_tst" as any).insert(rec as any);
            if (!sErr) totalUpserted++;
          }
        } else {
          totalUpserted += (data as any[])?.length ?? batch.length;
        }

        setProgress(40 + Math.round(((i + batch.length) / insertRecords.length) * 60));
        setProgressLabel(`Etapa 3/3: ${totalUpserted} de ${insertRecords.length} inseridos...`);
      }

      setProgress(100);
      setProgressLabel("Concluído!");

      if (totalUpserted > 0) {
        toast.success(`${totalUpserted} distribuições importadas/atualizadas!`);
        onImported();
      } else {
        toast.warning("Nenhum registro importado");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setTimeout(resetState, 1500);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Importar Planilha
      </Button>
      {importing && (
        <>
          <div className="flex items-center gap-2 min-w-[300px]">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{progressLabel}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="text-destructive hover:text-destructive">
            <XCircle className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        </>
      )}
    </div>
  );
}
