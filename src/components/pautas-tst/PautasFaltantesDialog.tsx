import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportarPautasFaltantes } from "@/lib/pautasSemanaExport";

/** Relatório de dados faltantes por período + reimportação da planilha devolvida (preenche só campos vazios). */
export function PautasFaltantesDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [gerando, setGerando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ atualizadas: number; nao_encontrados: string[] } | null>(null);

  const gerar = async () => {
    setGerando(true);
    try {
      const todas: any[] = [];
      for (let a = 0; ; a += 1000) {
        let q = supabase.from("pautas_tst" as any).select("*").order("data_julgamento").range(a, a + 999);
        if (de) q = q.gte("data_julgamento", de);
        if (ate) q = q.lte("data_julgamento", ate);
        const { data, error } = await q;
        if (error) throw error;
        todas.push(...((data as any[]) || []));
        if (!data || data.length < 1000) break;
      }
      const ids = [...new Set(todas.map((p) => p.dados_benner_id).filter(Boolean))] as string[];
      const cent: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await supabase.from("dados_benner" as any).select("id, centralizador").in("id", ids.slice(i, i + 300));
        ((data as any[]) || []).forEach((b) => { if (b.centralizador) cent[b.id] = b.centralizador; });
      }
      const nome = `PAUTA_DE_JULGAMENTO_dados_faltantes_${de || "inicio"}_a_${ate || "fim"}.xlsx`;
      const n = await exportarPautasFaltantes(todas.map((p) => ({ ...p, centralizador: cent[p.dados_benner_id] ?? null })), nome);
      n ? toast.success(`${n} pauta(s) com dados faltantes`) : toast.success("Nenhuma pauta do período com dados faltando");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  };

  const importar = async (file: File) => {
    setImportando(true);
    setResultado(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const linhas: any[] = [];
      for (const nomeAba of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nomeAba], { header: 1, defval: "" });
        const h = rows.findIndex((r) => r.some((c) => String(c).toUpperCase().includes("NUMERO DO PROCESSO")));
        if (h < 0) continue;
        const cab = rows[h].map((c) => String(c).trim().toUpperCase());
        const col = (n: string) => cab.findIndex((c) => c === n);
        const [cp, cd, ce, ca] = [col("NUMERO DO PROCESSO"), col("DOSSIÊ"), col("EQUIPE"), col("ADVOGADO INTERNO")];
        const limpa = (v: any) => { const t = String(v ?? "").trim(); return !t || /^a preencher$/i.test(t) ? "" : t; };
        for (const r of rows.slice(h + 1)) {
          const processo = limpa(r[cp]);
          if (!processo) continue;
          linhas.push({ processo, dossie: cd >= 0 ? limpa(r[cd]) : "", equipe: ce >= 0 ? limpa(r[ce]) : "", advogado_interno: ca >= 0 ? limpa(r[ca]) : "" });
        }
      }
      if (!linhas.length) throw new Error("Não encontrei a coluna NUMERO DO PROCESSO na planilha");
      const { data, error } = await (supabase as any).rpc("pautas_importar_faltantes", { _linhas: linhas });
      if (error) throw error;
      setResultado(data);
      toast.success(`${data?.atualizadas ?? 0} pauta(s) completada(s)`);
      onImported?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Download className="w-4 h-4 mr-2" /> Dados faltantes</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>PAUTA DE JULGAMENTO - dados faltantes</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Julgamento de</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
              <div><Label>até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Sem datas, o relatório traz todo o período.</p>
            <Button onClick={gerar} disabled={gerando} className="w-full">
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Gerar planilha
            </Button>
            <div className="border-t pt-4 space-y-2">
              <Label>Importar planilha devolvida</Label>
              <p className="text-xs text-muted-foreground">Preenche dossiê, equipe e advogado interno pelo número do processo, só onde estiver vazio.</p>
              <Button variant="outline" className="w-full" disabled={importando} asChild>
                <label className="cursor-pointer">
                  {importando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Escolher planilha
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
                </label>
              </Button>
              {resultado && (
                <div className="text-sm">
                  <p>{resultado.atualizadas} pauta(s) completada(s).</p>
                  {resultado.nao_encontrados?.length > 0 && (
                    <p className="text-destructive">Não encontrados ({resultado.nao_encontrados.length}): {resultado.nao_encontrados.slice(0, 20).join(", ")}{resultado.nao_encontrados.length > 20 ? "…" : ""}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
