import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const IMPORT_BATCH_SIZE = 500;

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
  const [progressText, setProgressText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgressText("Lendo planilha...");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.id) {
        throw new Error("Faça login para importar a planilha");
      }
      const userId = userData.user.id;

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
        throw new Error("Cabeçalho não encontrado na planilha");
      }

      const records: any[] = [];
      for (let i = headerIdx + 1; i < json.length; i++) {
        const r = json[i];
        if (!r || r.every(c => !String(c ?? "").trim())) continue;

        const dossie = normalizeText(r[0]);
        if (!dossie) continue;

        const rawProcesso = normalizeText(r[1]);
        const processoMatch = rawProcesso.match(/[\d][\d.\-\/]+/);
        const processo = processoMatch ? processoMatch[0] : "";
        if (!processo) continue;

        records.push({
          user_id: userId,
          status: "rascunho",
          dossie,
          processo,
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
          processo_baixado: isBoolS(r[26])
            ? "S"
            : String(r[26] ?? "").trim().toUpperCase() === "N" || String(r[26] ?? "").trim().toUpperCase() === "NÃO"
              ? "N"
              : normalizeText(r[26]) || null,
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
        return;
      }

      console.log(`[DadosBennerImport] ${records.length} registros parseados. Primeiro:`, JSON.stringify(records[0]));

      let inserted = 0;
      let updated = 0;
      const totalBatches = Math.ceil(records.length / IMPORT_BATCH_SIZE);

      for (let i = 0; i < records.length; i += IMPORT_BATCH_SIZE) {
        const batch = records.slice(i, i + IMPORT_BATCH_SIZE);
        const batchNumber = Math.floor(i / IMPORT_BATCH_SIZE) + 1;
        setProgressText(`Importando lote ${batchNumber}/${totalBatches}...`);

        const { data, error } = await supabase.functions.invoke("importar-dados-benner", {
          body: {
            userId,
            rows: batch,
            preserveFields: ["situacao_processo", "status"],
          },
        });

        if (error) {
          throw new Error(error.message || `Erro no lote ${batchNumber}`);
        }

        if (!data?.ok) {
          throw new Error(data?.error || `Erro no lote ${batchNumber}`);
        }

        inserted += Number(data.inserted || 0);
        updated += Number(data.updated || 0);
      }

      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} inserido(s)`);
      if (updated > 0) parts.push(`${updated} atualizado(s)`);
      toast.success(parts.length ? `${parts.join(", ")} com sucesso!` : "Importação concluída");
      onImported();
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + (err?.message || String(err)));
    } finally {
      setImporting(false);
      setProgressText(null);
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
        {progressText || "Importar Planilha"}
      </Button>
    </>
  );
}
