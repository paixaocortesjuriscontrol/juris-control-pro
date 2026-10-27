import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { fontesPlanilhaProcessos } from "@/lib/projurisPlanilhaProcessos";

interface Props { coordId: string; nomeCoord: string; userId: string; onConcluido: () => void }
type Fonte = ReturnType<typeof fontesPlanilhaProcessos>["fontes"][number];
const LOTE = 50;

export function ComplementarPlanilhaProjuris({ coordId, nomeCoord, userId, onConcluido }: Props) {
  const [lendo, setLendo] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [resumo, setResumo] = useState<{ linhas: number; ambiguos: number; semCnj: number; campos: number } | null>(null);
  const [prog, setProg] = useState({ feito: 0, total: 0 });
  const [resultado, setResultado] = useState("");
  const [migId, setMigId] = useState<string | null>(null);

  const ler = async (file: File) => {
    setLendo(true); setResultado(""); setFontes([]); setResumo(null); setMigId(null);
    try {
      const buf = await file.arrayBuffer();
      const linhas = await new Promise<Record<string, unknown>[]>((ok, falha) => {
        const w = new Worker(new URL("../../workers/projurisPlanilhaProcessos.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (e) => { w.terminate(); e.data.ok ? ok(e.data.linhas) : falha(new Error(e.data.erro)); };
        w.onerror = (e) => { w.terminate(); falha(new Error(e.message)); };
        w.postMessage(buf, [buf]);
      });
      const r = fontesPlanilhaProcessos(linhas);
      setFontes(r.fontes);
      setResumo({ linhas: linhas.length, ambiguos: r.ambiguos, semCnj: r.semCnj, campos: r.fontes.reduce((s, f) => s + Object.keys(f.campos).length, 0) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler a planilha.");
    } finally { setLendo(false); }
  };

  const aplicar = async () => {
    if (!fontes.length) return;
    setRodando(true); setProg({ feito: 0, total: fontes.length });
    let mid: string | undefined; let recuperados = 0, ausentes = 0, ambiguos = resumo?.ambiguos ?? 0;
    try {
      const { data: mig, error } = await supabase.from("migracoes_projuris").insert({
        coordenacao_id: coordId, criado_por: userId, nome: `Complementação pela planilha de processos — ${nomeCoord}`,
        mapeamento: { modulo: "recuperacao_complementos", tabela: "Planilha de processos", somente_vazios: true },
      } as any).select("id").single();
      if (error || !mig) throw error ?? new Error("Não foi possível abrir a complementação.");
      mid = (mig as { id: string }).id; setMigId(mid);
      for (let k = 0; k < fontes.length; k += LOTE) {
        const { data, error: e } = await supabase.rpc("recuperar_complementos_projuris" as any, { _migracao_id: mid, _fontes: fontes.slice(k, k + LOTE) as any });
        if (e) throw e;
        const r = data as { recuperados?: number; ausentes?: number; ambiguos?: number } | null;
        recuperados += r?.recuperados ?? 0; ausentes += r?.ausentes ?? 0; ambiguos += r?.ambiguos ?? 0;
        setProg({ feito: Math.min(k + LOTE, fontes.length), total: fontes.length });
      }
      await supabase.from("migracoes_projuris" as any).update({ status: "concluida", contadores: { recuperados, ausentes, ambiguos } }).eq("id", mid);
      setResultado(`${recuperados.toLocaleString("pt-BR")} processos complementados · ${ausentes.toLocaleString("pt-BR")} sem vínculo na migração desta coordenação · ${ambiguos.toLocaleString("pt-BR")} ambíguos preservados`);
      toast.success("Complementação concluída; campos já preenchidos foram preservados.");
    } catch (e: unknown) {
      if (mid) await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: { recuperados, ausentes, ambiguos } }).eq("id", mid);
      toast.error(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally { setRodando(false); onConcluido(); }
  };

  const baixarConflitos = async () => {
    if (!migId) return;
    const { data } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa, dados").eq("migracao_id", migId).limit(20000);
    const linhas: Record<string, unknown>[] = [];
    for (const it of (data as any[]) ?? []) {
      for (const [campo, c] of Object.entries((it.dados?.conflitos ?? {}) as Record<string, any>)) {
        linhas.push({ Identificador: it.chave_externa, CNJ: it.dados?.cnj, Campo: campo, "Valor atual": String(c?.atual ?? ""), "Valor da planilha": String(c?.origem ?? "") });
      }
    }
    if (!linhas.length) { toast.info("Nenhum conflito registrado."); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Conflitos");
    XLSX.writeFile(wb, "conflitos_complementacao_projuris.xlsx");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Complementar pela planilha de processos</CardTitle>
        <CardDescription>
          Envie a planilha "Processos em planilha" exportada do Projuris. Só os processos já migrados nesta coordenação são complementados, e só os campos vazios são preenchidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="inline-flex">
          <input type="file" accept=".xlsx" className="hidden" disabled={lendo || rodando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(f); e.target.value = ""; }} />
          <Button asChild variant="outline" disabled={lendo || rodando}>
            <span>{lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Selecionar planilha</span>
          </Button>
        </label>
        {resumo && (
          <p className="text-sm text-muted-foreground">
            {resumo.linhas.toLocaleString("pt-BR")} linhas · {fontes.length.toLocaleString("pt-BR")} processos prontos ({resumo.campos.toLocaleString("pt-BR")} informações) · {resumo.ambiguos} números repetidos com dados diferentes (ignorados) · {resumo.semCnj} sem número CNJ
          </p>
        )}
        {fontes.length > 0 && (
          <Button disabled={rodando} onClick={() => void aplicar()}>
            {rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar complementação
          </Button>
        )}
        {rodando && <Progress value={prog.total ? (prog.feito / prog.total) * 100 : 0} />}
        {resultado && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{resultado}</p>
            <Button variant="outline" size="sm" onClick={() => void baixarConflitos()}>Baixar conflitos</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
