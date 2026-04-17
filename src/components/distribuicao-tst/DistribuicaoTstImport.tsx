import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, XCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m${s > 0 ? ` ${s}s` : ""}`;
}

interface Props {
  onImported: () => void;
}

const BATCH_SIZE = 500;

export function DistribuicaoTstImport({ onImported }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [detailText, setDetailText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const startTimeRef = useRef(0);

  const resetState = () => {
    setImporting(false);
    setProgress(0);
    setStatusText("");
    setDetailText("");
    cancelRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelRef.current = false;
    setImporting(true);
    setProgress(0);
    startTimeRef.current = Date.now();
    setStatusText("Lendo planilha...");

    try {
      // === STEP 0: Auth ===
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para importar.");
        resetState();
        return;
      }

      // === STEP 1: Parse Excel ===
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });

      const allRows: { sheetName: string; processoNumero: string; row: string[] }[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
        let headerIdx = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          if (json[i]?.some(c => /n[uú]mero.*processo/i.test(String(c ?? "")) || /dossi[eê]/i.test(String(c ?? "")))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) continue;
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !String(c ?? "").trim())) continue;
          const num = norm(r[1]);
          if (!num || num.length < 7) continue;
          allRows.push({ sheetName, processoNumero: num, row: r });
        }
      }

      if (allRows.length === 0) {
        toast.warning("Nenhum registro válido encontrado na planilha");
        resetState();
        return;
      }

      // === STEP 2: Upsert processos (bulk, no lookup needed) ===
      const uniqueNumeros = [...new Set(allRows.map(r => r.processoNumero))];
      const firstOcc = new Map<string, string[]>();
      for (const rec of allRows) {
        if (!firstOcc.has(rec.processoNumero)) firstOcc.set(rec.processoNumero, rec.row);
      }

      // Step 1: Lookup existing processos to know which are new vs updated
      setStatusText("Etapa 1/3: Verificando processos existentes");
      startTimeRef.current = Date.now();

      const processoIdMap = new Map<string, string>();
      const existingNumeros = new Set<string>();

      for (let i = 0; i < uniqueNumeros.length; i += BATCH_SIZE) {
        if (cancelRef.current) { toast.info("Cancelado."); resetState(); return; }
        const batch = uniqueNumeros.slice(i, i + BATCH_SIZE);
        const { data } = await supabase.from("processos").select("id, numero").in("numero", batch);
        (data || []).forEach((p: any) => {
          processoIdMap.set(p.numero, p.id);
          existingNumeros.add(p.numero);
        });
        const done = Math.min(i + BATCH_SIZE, uniqueNumeros.length);
        setProgress(Math.round((done / uniqueNumeros.length) * 10));
        setDetailText(`${done}/${uniqueNumeros.length} verificados`);
      }

      // Step 2: Upsert all processos (creates new, updates existing)
      const processosToUpsert = uniqueNumeros.map(num => {
        const r = firstOcc.get(num)!;
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

      let newProcessos = 0;
      let updatedProcessos = 0;

      setStatusText(`Etapa 2/3: Salvando ${uniqueNumeros.length} processos`);
      startTimeRef.current = Date.now();

      for (let i = 0; i < processosToUpsert.length; i += BATCH_SIZE) {
        if (cancelRef.current) { toast.info("Cancelado."); resetState(); return; }
        const batch = processosToUpsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await (supabase.from("processos") as any)
          .upsert(batch, { onConflict: "numero", ignoreDuplicates: false })
          .select("id, numero");

        if (error) {
          console.error("Erro upsert processos:", error);
        } else if (data) {
          for (const p of data as any[]) {
            processoIdMap.set(p.numero, p.id);
            if (existingNumeros.has(p.numero)) {
              updatedProcessos++;
            } else {
              newProcessos++;
            }
          }
        }

        const done = Math.min(i + BATCH_SIZE, processosToUpsert.length);
        setProgress(10 + Math.round((done / processosToUpsert.length) * 20));
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const eta = done > 0 ? ((processosToUpsert.length - done) * elapsed / done) : 0;
        setDetailText(`${done}/${processosToUpsert.length} processos · ${newProcessos} novos · ${updatedProcessos} atualizados${eta > 2 ? ` · ~${formatDuration(eta)} restante` : ""}`);
      }

      // === STEP 3: Upsert distribuições direto em dados_benner (tabela única) ===
      setStatusText("Etapa 3/3: Salvando distribuições em Dados Benner");
      startTimeRef.current = Date.now();

      const upsertRecords = allRows
        .filter(rec => processoIdMap.has(rec.processoNumero) && rec.processoNumero)
        .map(({ sheetName, processoNumero, row: r }) => {
          const relatorFav = norm(r[7]).toLowerCase();
          const turmaFav = norm(r[9]).toLowerCase();
          const dossieVal = norm(r[2]);
          return {
            processo: processoNumero,
            tribunal: "TST",
            aba_origem: sheetName,
            data_distribuicao: parseDateBR(r[0]),
            dossie: dossieVal || null,
            equipe: norm(r[3]) || null,
            reclamante: norm(r[4]) || null,
            reclamada: norm(r[5]) || null,
            relator: norm(r[6]) || null,
            posicao_relator_favoravel: relatorFav.includes("positiv") ? true : null,
            posicao_relator_desfavoravel: relatorFav.includes("negativ") ? true : null,
            turma: norm(r[8]) || null,
            posicao_turma_favoravel: turmaFav.includes("positiv") ? true : null,
            posicao_turma_desfavoravel: turmaFav.includes("negativ") ? true : null,
            recorrente: norm(r[10]) || null,
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
            status: "rascunho",
            user_id: user.id,
          };
        });

      const recordsComDossie = upsertRecords.filter(r => r.dossie);
      const dedupedRecordsComDossie = Array.from(
        new Map(recordsComDossie.map(record => [`${record.processo}||${record.dossie}`, record])).values()
      );
      const recordsSemDossie = upsertRecords.filter(r => !r.dossie);

      let totalUpserted = 0;
      let totalErrors = 0;
      let firstError: string | null = null;

      const processBatch = async (records: typeof upsertRecords, useUpsert: boolean) => {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          if (cancelRef.current) return false;
          const batch = records.slice(i, i + BATCH_SIZE);

          let error: any;
          if (useUpsert) {
            const res = await (supabase.from("dados_benner" as any) as any)
              .upsert(batch, { onConflict: "processo,dossie", ignoreDuplicates: false });
            error = res.error;
          } else {
            const res = await supabase.from("dados_benner" as any).insert(batch as any);
            error = res.error;
          }

          if (error) {
            console.error("Erro upsert dados_benner:", error, "Sample record:", batch[0]);
            if (!firstError) firstError = `${error.message}${error.details ? ` | ${error.details}` : ""}${error.hint ? ` | ${error.hint}` : ""}`;
            totalErrors += batch.length;
          } else {
            totalUpserted += batch.length;
          }

          const done = totalUpserted + totalErrors;
          const total = dedupedRecordsComDossie.length + recordsSemDossie.length;
          const pct = 30 + Math.round((done / total) * 70);
          setProgress(pct);
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const eta = done > 0 ? ((total - done) * elapsed / done) : 0;
          setDetailText(`${done}/${total} distribuições · ${totalErrors > 0 ? `${totalErrors} erros · ` : ""}${formatDuration(elapsed)}${eta > 2 ? ` · ~${formatDuration(eta)} restante` : ""}`);
        }
        return true;
      };

      const okComDossie = await processBatch(recordsComDossie, true);
      if (!okComDossie) {
        toast.info(`Cancelado. ${totalUpserted} registros processados.`);
        onImported();
        resetState();
        return;
      }
      const okSemDossie = await processBatch(recordsSemDossie, false);
      if (!okSemDossie) {
        toast.info(`Cancelado. ${totalUpserted} registros processados.`);
        onImported();
        resetState();
        return;
      }

      setProgress(100);
      setStatusText("Concluído!");

      if (totalUpserted > 0) {
        const parts: string[] = [`${totalUpserted} distribuições salvas`];
        if (newProcessos > 0) parts.push(`${newProcessos} processos novos`);
        if (updatedProcessos > 0) parts.push(`${updatedProcessos} processos atualizados`);
        if (totalErrors > 0) parts.push(`${totalErrors} erros`);
        toast.success(parts.join(", ") + "!");
        onImported();
      } else {
        toast.error(
          `Nenhum registro importado. ${totalErrors} com erro. ${firstError ? `Causa: ${firstError}` : "Verifique o console (F12)."}`,
          { duration: 20000 }
        );
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
    } finally {
      setTimeout(resetState, 2000);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Importar Planilha
        </Button>
        {importing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelRef.current = true;
              setStatusText("Cancelando... aguarde o lote atual finalizar");
              toast.info("Cancelamento solicitado. Aguardando lote atual...");
            }}
            disabled={cancelRef.current}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        )}
      </div>

      {importing && statusText && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3 max-w-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{statusText}</span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          {detailText && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{detailText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
