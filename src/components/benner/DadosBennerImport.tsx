import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function normalizeText(val: unknown): string {
  return String(val ?? "").trim();
}

function parseDateBR(val: unknown): string | null {
  const t = String(val ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return t;
}

function isXCell(val: unknown): boolean {
  const t = String(val ?? "").trim().toUpperCase();
  return t === "X" || t === "S";
}

function isBoolS(val: unknown): boolean {
  const t = String(val ?? "").trim().toUpperCase();
  return t === "S" || t === "SIM" || t === "X";
}

interface Props {
  onImported: () => void;
}

export function DadosBennerImport({ onImported }: Props) {
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

      let headerIdx = -1;
      for (let i = 0; i < Math.min(json.length, 10); i++) {
        const row = json[i];
        if (row?.some(c => /dossi[eê]/i.test(String(c ?? "")))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        toast.error("Cabeçalho não encontrado na planilha");
        setImporting(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      const records: any[] = [];
      for (let i = headerIdx + 1; i < json.length; i++) {
        const r = json[i];
        if (!r || r.every(c => !String(c ?? "").trim())) continue;

        const dossie = normalizeText(r[0]);
        if (!dossie) continue;

        const rawProcesso = normalizeText(r[1]);
        const processoMatch = rawProcesso.match(/[\d][\d.\-\/]+/);
        const processo = processoMatch ? processoMatch[0] : "";

        records.push({
          user_id: userId,
          status: "rascunho",
          dossie: dossie,
          processo: processo,
          tribunal: normalizeText(r[2]),
          tipo_recurso: normalizeText(r[3]),
          data_distribuicao: parseDateBR(r[4]),
          turma: normalizeText(r[5]),
          relator: normalizeText(r[6]),
          analise_quarteirizado: normalizeText(r[7]),
          risco_midia: normalizeText(r[8]) || null,
          risco_descricao: normalizeText(r[9]) || null,
          provas_digitais: normalizeText(r[10]) || null,
          tem_data_julgamento: normalizeText(r[11]) || null,
          data_julgamento: parseDateBR(r[12]),
          horario_julgamento: normalizeText(r[13]) || null,
          tipo_julgamento: normalizeText(r[14]) || null,
          materia_honra: normalizeText(r[15]) || null,
          entrega_memoriais: normalizeText(r[16]) || null,
          sustentacao_oral: normalizeText(r[17]) || null,
          resultado_sem_transcendencia: isXCell(r[18]),
          resultado_nao_conhecido: isXCell(r[19]),
          resultado_conhecido_provido: isXCell(r[20]),
          resultado_conhecido_nao_provido: isXCell(r[21]),
          resultado_outra: normalizeText(r[22]) || null,
          observacoes: normalizeText(r[23]) || null,
          ganhamos: isXCell(r[24]),
          perdemos: isXCell(r[25]),
          processo_baixado: isBoolS(r[26]) ? "S" : (String(r[26] ?? "").trim().toUpperCase() === "N" || String(r[26] ?? "").trim().toUpperCase() === "NÃO" ? "N" : normalizeText(r[26]) || null),
          recorrente: normalizeText(r[27]) || null,
          posicao_turma_favoravel: isXCell(r[28]),
          posicao_turma_desfavoravel: isXCell(r[29]),
          posicao_relator_favoravel: isXCell(r[30]),
          posicao_relator_desfavoravel: isXCell(r[31]),
          recurso_bem_aparelhado: isXCell(r[32]),
          recurso_mal_aparelhado: isXCell(r[33]),
          chance_exito: normalizeText(r[34]) || null,
        });
      }

      if (!records.length) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        setImporting(false);
        return;
      }

      console.log(`[DadosBennerImport] ${records.length} registros parseados. Primeiro:`, JSON.stringify(records[0]));

      // Collect all process numbers to check for existing records
      const processos = records.map(r => r.processo).filter(Boolean);
      const existingMap = new Map<string, string>(); // processo -> id

      // Fetch existing records in batches of 200
      for (let i = 0; i < processos.length; i += 200) {
        const batch = processos.slice(i, i + 200);
        const { data } = await supabase
          .from("dados_benner" as any)
          .select("id, processo")
          .in("processo", batch);
        if (data) {
          for (const row of data as any[]) {
            if (row.processo) existingMap.set(row.processo, row.id);
          }
        }
      }

      let inserted = 0;
      let updated = 0;
      let lastError: string | null = null;

      // Separate into new records and existing records to update
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      for (const rec of records) {
        if (rec.processo && existingMap.has(rec.processo)) {
          const existingId = existingMap.get(rec.processo)!;
          // Update all fields except situacao_processo and status
          const { status, user_id, ...updateFields } = rec;
          toUpdate.push({ id: existingId, data: updateFields });
        } else {
          toInsert.push(rec);
        }
      }

      // Insert new records in batches
      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100);
        const { error, data } = await supabase.from("dados_benner" as any).insert(batch as any).select("id");
        if (error) {
          console.error(`[DadosBennerImport] Erro lote insert ${Math.floor(i / 100) + 1}:`, error);
          lastError = error.message;
          toast.error(`Erro ao importar lote ${Math.floor(i / 100) + 1}: ${error.message}`);
          break;
        }
        inserted += (data as any[])?.length ?? batch.length;
      }

      // Update existing records one by one (to preserve situacao_processo)
      for (const item of toUpdate) {
        const { error } = await supabase
          .from("dados_benner" as any)
          .update(item.data as any)
          .eq("id", item.id);
        if (error) {
          console.error(`[DadosBennerImport] Erro update ${item.id}:`, error);
          lastError = error.message;
        } else {
          updated++;
        }
      }

      if (inserted > 0 || updated > 0) {
        const parts: string[] = [];
        if (inserted > 0) parts.push(`${inserted} inserido(s)`);
        if (updated > 0) parts.push(`${updated} atualizado(s)`);
        toast.success(`${parts.join(", ")} com sucesso!`);
        onImported();
      } else if (!lastError) {
        toast.warning("Nenhum registro foi inserido ou atualizado. Verifique se você está logado.");
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
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Importar Planilha
      </Button>
    </>
  );
}
