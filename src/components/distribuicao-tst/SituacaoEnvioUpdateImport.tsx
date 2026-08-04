import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote, ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

const ROMAN_TO_CODE: Record<string, string> = {
  I: "CARGA_I",
  II: "CARGA_II",
  III: "CARGA_III",
  IV: "CARGA_IV",
  V: "CARGA_V",
  VI: "CARGA_VI",
  VII: "CARGA_VII",
};

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

function situacaoToCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/\s+/g, " ").trim();
  const m = s.match(/CARGA\s+(I{1,3}|IV|V|VI|VII)\b/);
  if (!m) return null;
  return ROMAN_TO_CODE[m[1]] ?? null;
}

interface Props {
  onUpdated: () => void;
}

export function SituacaoEnvioUpdateImport({ onUpdated }: Props) {
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
    const auditId = await iniciarAuditoriaLote({
      tipo: "atualizar_situacao_envio",
      arquivoNome: file.name,
    });
    let auditFinalizada = false;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

      // Locate columns (Dossiê, Processo, Tipo Carga)
      let headerIdx = -1;
      let colProc = -1;
      let colSit = -1;
      let colDossie = -1;
      for (let i = 0; i < Math.min(json.length, 10); i++) {
        const row = json[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
          const h = norm(row[j]).toLowerCase();
          if (h === "processo" && colProc === -1) colProc = j;
          if ((h.includes("tipo") && h.includes("carga")) && colSit === -1) colSit = j;
          if ((h.includes("situa") && h.includes("envio")) && colSit === -1) colSit = j;
          if ((h === "dossie" || h === "dossiê" || h.startsWith("dossi")) && colDossie === -1) colDossie = j;
        }
        if (colProc >= 0 && colSit >= 0) { headerIdx = i; break; }
      }
      if (headerIdx === -1) {
        toast.error("Não encontrei as colunas 'Processo' e 'Tipo Carga'");
        await finalizarAuditoriaLote(auditId, {
          status: "erro",
          erro: "Colunas 'Processo' e 'Tipo Carga' não encontradas.",
        });
        auditFinalizada = true;
        return;
      }

      // Load situacoes
      const { data: sits, error: sitErr } = await supabase
        .from("situacoes_envio_carga" as any)
        .select("id, codigo");
      if (sitErr || !sits) {
        toast.error("Erro ao carregar situações: " + (sitErr?.message ?? ""));
        await finalizarAuditoriaLote(auditId, { status: "erro", erro: sitErr?.message ?? "Falha ao carregar situações" });
        auditFinalizada = true;
        return;
      }
      const codeToId = new Map<string, string>();
      const idToCode = new Map<string, string>();
      for (const s of sits as any[]) {
        codeToId.set(s.codigo, s.id);
        idToCode.set(s.id, s.codigo);
      }

      // Build rows: processo -> { situacao_id, dossie }
      const rows: { processo: string; dossie: string | null; sid: string }[] = [];
      let semCodigo = 0;
      for (let i = headerIdx + 1; i < json.length; i++) {
        const r = json[i];
        if (!r) continue;
        const processo = norm(r[colProc]);
        const sitRaw = norm(r[colSit]);
        const dossie = colDossie >= 0 ? norm(r[colDossie]) : "";
        if (!processo || !sitRaw) continue;
        const code = situacaoToCode(sitRaw);
        if (!code) { semCodigo++; continue; }
        const id = codeToId.get(code);
        if (!id) { semCodigo++; continue; }
        rows.push({ processo, dossie: dossie || null, sid: id });
      }

      if (rows.length === 0) {
        toast.warning("Nenhum registro válido encontrado");
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          ignorados: semCodigo,
          resumo: "Nenhum registro válido encontrado na planilha.",
        });
        auditFinalizada = true;
        return;
      }

      // Check which processes already exist
      setStatusText("Verificando processos existentes…");
      const uniqueProcs = Array.from(new Set(rows.map(r => r.processo)));
      const existing = new Set<string>();
      for (let i = 0; i < uniqueProcs.length; i += 500) {
        const batch = uniqueProcs.slice(i, i + 500);
        const { data } = await supabase
          .from("dados_benner" as any)
          .select("processo")
          .in("processo", batch);
        for (const r of (data as any[] ?? [])) existing.add(r.processo);
      }

      const toUpdate = rows.filter(r => existing.has(r.processo));
      const toInsert = rows.filter(r => !existing.has(r.processo));

      // Group updates by sid
      const bySit = new Map<string, string[]>();
      for (const { processo, sid } of toUpdate) {
        if (!bySit.has(sid)) bySit.set(sid, []);
        bySit.get(sid)!.push(processo);
      }

      let updated = 0;
      const itensAudit: ItemAuditoriaLote[] = [];
      const totalGroups = bySit.size;
      let gIdx = 0;
      for (const [sid, procs] of bySit) {
        gIdx++;
        const uniq = Array.from(new Set(procs));
        for (let i = 0; i < uniq.length; i += 300) {
          const batch = uniq.slice(i, i + 300);
          setProgress(Math.round(((gIdx - 1) / totalGroups + (i / uniq.length) / totalGroups) * 50));
          setStatusText(`Atualizando grupo ${gIdx}/${totalGroups} · ${updated} atualizados`);
          const { error, count } = await supabase
            .from("dados_benner" as any)
            .update({ situacao_envio_carga_id: sid } as any, { count: "exact" })
            .in("processo", batch);
          if (!error) updated += count ?? batch.length;
          if (!error) {
            const codigo = idToCode.get(sid) || sid;
            batch.forEach((p) =>
              itensAudit.push({ processo: p, acao: "atualizado", detalhe: `Situação de envio: ${codigo}` })
            );
          }
        }
      }

      // Insert new records as BENNER = SIM
      let inserted = 0;
      if (toInsert.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? null;
        // Dedupe by processo+dossie
        const seen = new Set<string>();
        const newRecords = toInsert
          .filter(r => {
            const k = `${r.processo}|${r.dossie ?? ""}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map(r => ({
            processo: r.processo,
            dossie: r.dossie,
            situacao_envio_carga_id: r.sid,
            benner_atualizado: true,
            user_id: userId,
            fontes_importacao: ["situacao_envio_carga"],
          }));
        for (let i = 0; i < newRecords.length; i += 200) {
          const batch = newRecords.slice(i, i + 200);
          setProgress(50 + Math.round((i / newRecords.length) * 50));
          setStatusText(`Cadastrando novos · ${inserted}/${newRecords.length}`);
          const { error, data } = await supabase
            .from("dados_benner" as any)
            .insert(batch as any)
            .select("id");
          if (!error) inserted += (data as any[])?.length ?? batch.length;
          else console.error("Insert error:", error);
          if (!error) {
            batch.forEach((b: any) =>
              itensAudit.push({
                processo: b.processo,
                dossie: b.dossie,
                acao: "criado",
                detalhe: `Cadastrado como BENNER=SIM · Situação: ${idToCode.get(b.situacao_envio_carga_id) || ""}`,
              })
            );
          }
        }
      }

      setProgress(100);
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: rows.length + semCodigo,
        atualizados: updated,
        criados: inserted,
        ignorados: semCodigo,
        resumo: `${updated} atualizados · ${inserted} cadastrados (BENNER=SIM)${semCodigo > 0 ? ` · ${semCodigo} ignorados (situação não mapeada)` : ""}`,
        itens: itensAudit,
      });
      auditFinalizada = true;
      toast.success(
        `${updated} atualizados · ${inserted} cadastrados (BENNER=SIM)` +
          (semCodigo > 0 ? ` · ${semCodigo} ignorados (situação não mapeada)` : "")
      );
      onUpdated();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: err?.message || String(err) });
      auditFinalizada = true;
    } finally {
      if (!auditFinalizada) {
        await finalizarAuditoriaLote(auditId, { status: "cancelada", resumo: "Execução encerrada sem conclusão." });
      }
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
        Atualizar Situação Envio
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