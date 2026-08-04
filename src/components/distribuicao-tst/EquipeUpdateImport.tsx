import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote, ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

const PREFIX = "Jurídico Trabalhista - ";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}

function stripPrefix(equipe: string): string {
  const n = equipe.normalize("NFC").trim();
  if (n.toLowerCase().startsWith(PREFIX.toLowerCase())) {
    return n.slice(PREFIX.length).trim();
  }
  return n;
}

interface Props {
  onUpdated: () => void;
}

export function EquipeUpdateImport({ onUpdated }: Props) {
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
      tipo: "atualizar_equipe",
      arquivoNome: file.name,
    });
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });

      // Layout esperado: coluna A = Processo, coluna B = Dossiê, coluna C = Equipe.
      // A chave de atualização é o Dossiê (col B). Processo é apenas informativo.
      // Lê TODAS as abas. Cabeçalho geralmente está na linha 1.
      const equipePorDossie = new Map<string, string>();
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
        // detecta linha de cabeçalho procurando "Processo" na col A, "Dossi" na col B ou "Equipe" na col C
        let headerIdx = 0;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const r = json[i] || [];
          const a = norm(r[0]).toLowerCase();
          const b = norm(r[1]).toLowerCase();
          const c = norm(r[2]).toLowerCase();
          if (a.includes("processo") || b.includes("dossi") || c.includes("equipe")) { headerIdx = i; break; }
        }
        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r) continue;
          const dossie = norm(r[1]);
          const equipeRaw = norm(r[2]);
          if (!dossie || !equipeRaw) continue;
          const equipe = stripPrefix(equipeRaw);
          if (equipe) equipePorDossie.set(dossie, equipe);
        }
      }

      if (equipePorDossie.size === 0) {
        toast.warning("Nenhum dossiê/equipe encontrado na planilha (Col B = Dossiê / Col C = Equipe)");
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          resumo: "Nenhum dossiê/equipe encontrado na planilha.",
        });
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      let updated = 0;
      const itensAudit: ItemAuditoriaLote[] = [];
      const dossiePorId = new Map<string, string>();
      const dossies = [...equipePorDossie.keys()];
      const idsPorEquipe = new Map<string, string[]>();
      for (let i = 0; i < dossies.length; i += 500) {
        const batch = dossies.slice(i, i + 500);
        const { data, error } = await supabase
          .from("dados_benner" as any)
          .select("id, dossie")
          .in("dossie", batch);
        if (error) { console.error("Erro ao localizar registros por dossiê:", error); continue; }
        for (const row of (data as any[]) || []) {
          const equipe = equipePorDossie.get(row.dossie);
          if (!equipe) continue;
          dossiePorId.set(row.id, row.dossie);
          if (!idsPorEquipe.has(equipe)) idsPorEquipe.set(equipe, []);
          idsPorEquipe.get(equipe)!.push(row.id);
        }
      }

      const grupos = [...idsPorEquipe.entries()];
      for (let g = 0; g < grupos.length; g++) {
        const [equipe, ids] = grupos[g];
        setProgress(Math.round(((g + 1) / Math.max(grupos.length, 1)) * 100));
        setStatusText(`Equipe "${equipe}" (${g + 1}/${grupos.length}) · ${updated} atualizados`);
        for (let i = 0; i < ids.length; i += 500) {
          const batch = ids.slice(i, i + 500);
          const { data, error } = await supabase
            .from("dados_benner" as any)
            .update({ equipe } as any)
            .in("id", batch)
            .select("id");
          if (!error && data) {
            updated += (data as any[]).length;
            for (const row of data as any[]) {
              itensAudit.push({
                dossie: dossiePorId.get(row.id) ?? null,
                acao: "atualizado",
                detalhe: `Equipe: ${equipe}`,
              });
            }
          }
        }
      }

      setProgress(100);
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: equipePorDossie.size,
        atualizados: updated,
        ignorados: Math.max(equipePorDossie.size - updated, 0),
        resumo: `${updated} registros atualizados com a equipe da planilha (${equipePorDossie.size} dossiês lidos).`,
        itens: itensAudit,
      });
      if (updated > 0) {
        toast.success(`${updated} registros atualizados com a equipe da planilha.`);
        onUpdated();
      } else {
        toast.warning("Nenhum registro atualizado (nenhum dossiê correspondente encontrado)");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: err?.message || String(err) });
    } finally {
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
        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
        Atualizar Equipe
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