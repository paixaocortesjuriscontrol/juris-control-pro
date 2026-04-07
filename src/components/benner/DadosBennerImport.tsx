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
  // DD/MM/YYYY -> YYYY-MM-DD
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Already YYYY-MM-DD
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

      // Find header row (look for "Dossiê" or "dossie" in first 10 rows)
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

        // Map positional columns (A=0 through AH=33)
        const dossie = normalizeText(r[0]);
        if (!dossie) continue; // skip rows without dossiê

        records.push({
          user_id: userId,
          status: "rascunho",
          dossie: dossie,
          contrato: "", // not in the source spreadsheet
          tribunal: normalizeText(r[1]),
          tipo_recurso: normalizeText(r[2]),
          data_distribuicao: parseDateBR(r[3]),
          turma: normalizeText(r[4]),
          relator: normalizeText(r[5]),
          analise_quarteirizado: normalizeText(r[6]),
          risco_midia: normalizeText(r[7]) || null,
          risco_descricao: normalizeText(r[8]) || null,
          provas_digitais: normalizeText(r[9]) || null,
          tem_data_julgamento: normalizeText(r[10]) || null,
          data_julgamento: parseDateBR(r[11]),
          horario_julgamento: normalizeText(r[12]) || null,
          tipo_julgamento: normalizeText(r[13]) || null,
          materia_honra: normalizeText(r[14]) || null,
          entrega_memoriais: normalizeText(r[15]) || null,
          sustentacao_oral: normalizeText(r[16]) || null,
          resultado_sem_transcendencia: isXCell(r[17]),
          resultado_nao_conhecido: isXCell(r[18]),
          resultado_conhecido_provido: isXCell(r[19]),
          resultado_conhecido_nao_provido: isXCell(r[20]),
          resultado_outra: normalizeText(r[21]) || null,
          observacoes: normalizeText(r[22]) || null,
          ganhamos: isXCell(r[23]),
          perdemos: isXCell(r[24]),
          processo_baixado: isBoolS(r[25]) ? "S" : (String(r[25] ?? "").trim().toUpperCase() === "N" || String(r[25] ?? "").trim().toUpperCase() === "NÃO" ? "N" : normalizeText(r[25]) || null),
          recorrente: normalizeText(r[26]) || null,
          posicao_turma_favoravel: isXCell(r[27]),
          posicao_turma_desfavoravel: isXCell(r[28]),
          posicao_relator_favoravel: isXCell(r[29]),
          posicao_relator_desfavoravel: isXCell(r[30]),
          recurso_bem_aparelhado: isXCell(r[31]),
          recurso_mal_aparelhado: isXCell(r[32]),
          chance_exito: normalizeText(r[33]) || null,
        });
      }

      if (!records.length) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        setImporting(false);
        return;
      }

      // Buscar contrato (número do processo) pelo dossiê
      const dossies = [...new Set(records.map(r => r.dossie).filter(Boolean))];
      const dossieToContrato: Record<string, string> = {};
      // Query in batches of 50 dossiês
      for (let i = 0; i < dossies.length; i += 50) {
        const batch = dossies.slice(i, i + 50);
        const { data } = await supabase
          .from("processos")
          .select("numero, dossie_tst")
          .in("dossie_tst", batch);
        if (data) {
          for (const p of data) {
            if (p.dossie_tst) dossieToContrato[p.dossie_tst] = p.numero;
          }
        }
      }
      // Preencher contrato nos registros
      let encontrados = 0;
      for (const rec of records) {
        if (rec.dossie && dossieToContrato[rec.dossie]) {
          rec.contrato = dossieToContrato[rec.dossie];
          encontrados++;
        }
      }
      if (encontrados > 0) {
        toast.info(`${encontrados} de ${records.length} registros tiveram o Nº Processo encontrado pelo dossiê`);
      }

      console.log(`[DadosBennerImport] ${records.length} registros parseados. Primeiro:`, JSON.stringify(records[0]));

      // Insert in batches of 100
      let inserted = 0;
      let lastError: string | null = null;
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error, data } = await supabase.from("dados_benner" as any).insert(batch as any).select("id");
        if (error) {
          console.error(`[DadosBennerImport] Erro lote ${Math.floor(i / 100) + 1}:`, error);
          lastError = error.message;
          toast.error(`Erro ao importar lote ${Math.floor(i / 100) + 1}: ${error.message}`);
          break;
        }
        inserted += (data as any[])?.length ?? batch.length;
      }

      if (inserted > 0) {
        toast.success(`${inserted} registros importados com sucesso!`);
        onImported();
      } else if (!lastError) {
        toast.warning("Nenhum registro foi inserido. Verifique se você está logado.");
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
