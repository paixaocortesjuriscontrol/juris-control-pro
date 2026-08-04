import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote, ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

interface Props {
  onUpdated: () => void;
}

type LogEntry = { processo: string; dossie: string; status: "ok" | "notfound" | "error"; msg?: string };

export function DossieUpdateImport({ onUpdated }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState({ ok: 0, notfound: 0, error: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const appendLog = (entries: LogEntry[]) => {
    setLog((prev) => {
      const next = [...entries, ...prev];
      return next.slice(0, 300);
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelRef.current = false;
    setImporting(true);
    setProgress(0);
    setStatusText("Lendo planilha…");
    setLog([]);
    setCounts({ ok: 0, notfound: 0, error: 0, total: 0 });
    const auditId = await iniciarAuditoriaLote({
      tipo: "atualizar_dossies",
      arquivoNome: file.name,
    });
    const itensAudit: ItemAuditoriaLote[] = [];
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
        await finalizarAuditoriaLote(auditId, {
          status: "erro",
          erro: "Colunas 'Nº Do Dossiê' e 'Número' não encontradas na planilha.",
        });
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
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          resumo: "Nenhum registro válido encontrado na planilha.",
        });
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const numeros = [...dossieMap.keys()];
      const total = numeros.length;
      setCounts({ ok: 0, notfound: 0, error: 0, total });

      const LOOKUP_BATCH = 200;
      const UPDATE_CONCURRENCY = 5;
      let ok = 0, notfound = 0, error = 0, processed = 0;

      for (let bi = 0; bi < numeros.length; bi += LOOKUP_BATCH) {
        if (cancelRef.current) break;
        const batch = numeros.slice(bi, bi + LOOKUP_BATCH);
        setStatusText(`Buscando lote ${Math.floor(bi / LOOKUP_BATCH) + 1}/${Math.ceil(total / LOOKUP_BATCH)}…`);

        const { data, error: selErr } = await supabase
          .from("dados_benner" as any)
          .select("id, processo, dossie")
          .in("processo", batch);

        const foundRows = (selErr ? [] : (data as any[])) || [];
        const foundSet = new Set(foundRows.map((r: any) => r.processo));

        const notFoundEntries: LogEntry[] = batch
          .filter((p) => !foundSet.has(p))
          .map((p) => ({ processo: p, dossie: dossieMap.get(p) || "", status: "notfound" as const }));
        notfound += notFoundEntries.length;
        processed += notFoundEntries.length;
        notFoundEntries.forEach((e) =>
          itensAudit.push({ processo: e.processo, dossie: e.dossie, acao: "ignorado", detalhe: "Processo não encontrado na base" })
        );

        const updates: { row: any; newDossie: string }[] = [];
        for (const row of foundRows) {
          const newDossie = dossieMap.get(row.processo);
          if (newDossie) updates.push({ row, newDossie });
        }

        const batchLog: LogEntry[] = [...notFoundEntries];

        for (let i = 0; i < updates.length; i += UPDATE_CONCURRENCY) {
          if (cancelRef.current) break;
          const slice = updates.slice(i, i + UPDATE_CONCURRENCY);
          const results = await Promise.all(
            slice.map(async ({ row, newDossie }) => {
              const { error: upErr } = await supabase
                .from("dados_benner" as any)
                .update({ dossie: newDossie } as any)
                .eq("id", row.id);
              return { row, newDossie, upErr };
            })
          );
          for (const { row, newDossie, upErr } of results) {
            if (upErr) {
              error += 1;
              batchLog.unshift({ processo: row.processo, dossie: newDossie, status: "error", msg: upErr.message });
              itensAudit.push({ processo: row.processo, dossie: newDossie, acao: "erro", detalhe: upErr.message });
            } else {
              ok += 1;
              batchLog.unshift({ processo: row.processo, dossie: newDossie, status: "ok" });
              itensAudit.push({
                processo: row.processo,
                dossie: newDossie,
                acao: "atualizado",
                detalhe: `Dossiê: ${row.dossie || "—"} → ${newDossie}`,
              });
            }
            processed += 1;
          }
          setCounts({ ok, notfound, error, total });
          setProgress(Math.round((processed / total) * 100));
          setStatusText(`${processed}/${total} · ${ok} atualizados · ${notfound} não encontrados · ${error} erros`);
        }

        appendLog(batchLog);
      }

      setProgress(cancelRef.current ? progress : 100);
      await finalizarAuditoriaLote(auditId, {
        status: cancelRef.current ? "cancelada" : "concluida",
        totalLinhas: total,
        atualizados: ok,
        ignorados: notfound,
        erros: error,
        resumo: `${ok} dossiês atualizados · ${notfound} não encontrados · ${error} erros`,
        itens: itensAudit,
      });
      if (cancelRef.current) {
        toast.warning(`Cancelado. ${ok} atualizados, ${notfound} não encontrados, ${error} erros.`);
      } else if (ok > 0) {
        toast.success(`${ok} dossiês atualizados! (${notfound} não encontrados, ${error} erros)`);
        onUpdated();
      } else {
        toast.warning("Nenhum dossiê atualizado");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, {
        status: "erro",
        erro: err?.message || String(err),
        itens: itensAudit,
      });
    } finally {
      setImporting(false);
      cancelRef.current = false;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Atualizar Dossiês
        </Button>
        {importing && (
          <Button variant="destructive" size="sm" onClick={() => { cancelRef.current = true; }}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        )}
      </div>
      {(importing || log.length > 0) && (
        <div className="space-y-2 min-w-[280px] w-full max-w-2xl">
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{statusText}</span>
            <span className="text-emerald-600">✓ {counts.ok}</span>
            <span className="text-amber-600">? {counts.notfound}</span>
            <span className="text-red-600">✕ {counts.error}</span>
            <span>Total: {counts.total}</span>
          </div>
          {log.length > 0 && (
            <div className="border rounded-md max-h-64 overflow-auto text-xs">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 w-8"></th>
                    <th className="text-left px-2 py-1">Processo</th>
                    <th className="text-left px-2 py-1">Dossiê</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        {e.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {e.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        {e.status === "notfound" && <span className="text-amber-600">?</span>}
                      </td>
                      <td className="px-2 py-1 font-mono">{e.processo}</td>
                      <td className="px-2 py-1">{e.dossie}</td>
                      <td className="px-2 py-1">
                        {e.status === "ok" && "Atualizado"}
                        {e.status === "notfound" && "Não encontrado"}
                        {e.status === "error" && (e.msg || "Erro")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
