import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lerCsvPontoVirgula, montarItensChecklist } from "@/lib/checklistProjuris";

const db = supabase as any;
const ARQS = ["checklist", "checklistitem", "checklistvinculomodulo"] as const;

export function ImportarChecklistsProjuris({ userId }: { userId: string }) {
  const [arquivos, setArquivos] = useState<Record<string, File>>({});
  const [prog, setProg] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const escolher = (fs: FileList | null) => {
    const m = { ...arquivos };
    for (const f of Array.from(fs || [])) {
      const n = f.name.toLowerCase().replace(/(-\d+)?\.csv$/, "");
      if ((ARQS as readonly string[]).includes(n)) m[n] = f;
    }
    setArquivos(m);
  };

  const importar = async () => {
    setRodando(true); setResumo(null); setProg(0);
    try {
      const [c, i, v] = await Promise.all(ARQS.map(async (k) => lerCsvPontoVirgula(await arquivos[k].text())));
      const { itens, semTarefa } = montarItensChecklist(c, i, v);
      const { data: modelos } = await db.from("checklist_modelos").select("id,nome").like("chave_externa", "projuris:%");
      const modeloPorNome = new Map((modelos || []).map((m: any) => [m.nome, m.id]));
      const chaves = [...new Set(itens.map((x) => x.tarefaChave))];
      const tarefaId = new Map<string, string>();
      for (let k = 0; k < chaves.length; k += 150) {
        const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa,registro_id")
          .eq("tipo", "tarefa").in("chave_externa", chaves.slice(k, k + 150)).not("registro_id", "is", null);
        if (error) throw error;
        for (const r of data || []) tarefaId.set(r.chave_externa, r.registro_id);
        setProg(Math.round((k / chaves.length) * 30));
      }
      const rows = itens.filter((x) => tarefaId.has(x.tarefaChave)).map((x) => ({
        tipo_item: "tarefa", item_id: tarefaId.get(x.tarefaChave), titulo: x.titulo || "(sem texto)", ordem: x.ordem,
        marcado: x.marcado, chave_externa: `projuris:${x.chave}`, modelo_id: modeloPorNome.get(x.nomeChecklist) ?? null, criado_por: userId,
      }));
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await db.from("checklist_itens").upsert(rows.slice(k, k + 500), { onConflict: "chave_externa", ignoreDuplicates: true });
        if (error) throw error;
        setProg(30 + Math.round((k / rows.length) * 70));
      }
      setProg(100);
      const semMigrar = itens.length - rows.length;
      setResumo(`${rows.length} itens importados (já existentes foram pulados). ${semMigrar} itens sem tarefa migrada e ${semTarefa} ligados a outro módulo ficaram de fora.`);
      toast.success("Checklists importados");
    } catch (e: any) { toast.error(e.message || "Falha na importação"); }
    setRodando(false);
  };

  const desfazer = async () => {
    if (!confirm("Remover todos os itens de checklist vindos do Projuris?")) return;
    setRodando(true);
    const { error } = await db.from("checklist_itens").delete().like("chave_externa", "projuris:%");
    setRodando(false);
    if (error) toast.error(error.message); else { setResumo("Importação de checklists desfeita."); toast.success("Desfeito"); }
  };

  const pronto = ARQS.every((k) => arquivos[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklists do Projuris</CardTitle>
        <CardDescription>Envie checklist.csv, checklistitem.csv e checklistvinculomodulo.csv. Importe depois das tarefas: cada checklist entra na tarefa correspondente com os itens marcados e não marcados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv" multiple onChange={(e) => escolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">{ARQS.map((k) => `${k}: ${arquivos[k] ? "ok" : "falta"}`).join(" · ")}</p>
        {rodando && <Progress value={prog} />}
        <div className="flex gap-2">
          <Button disabled={!pronto || rodando} onClick={importar}>{rodando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar checklists</Button>
          <Button variant="outline" disabled={rodando} onClick={desfazer}><Undo2 className="h-4 w-4 mr-1" />Desfazer</Button>
        </div>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
