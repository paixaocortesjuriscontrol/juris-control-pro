import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lerCsvPontoVirgula } from "@/lib/checklistProjuris";
import { montarExecucoesWorkflow, type EtapaImportada } from "@/lib/execucoesWorkflowProjuris";

const db = supabase as any;
const ARQS = ["workflow", "etapaworkflow", "workflowcontrole", "workflowexecucao"] as const;
const COORD_SANTANDER_CIVEL = "968631d0-6659-46f1-b45d-899892cb0121";
const NOME_MIGRACAO = "Fluxos (workflows) em execução do Projuris";
const LOTE = 150;

async function mapaChaves(tipo: string, chaves: string[]) {
  const m = new Map<string, string>();
  for (let k = 0; k < chaves.length; k += LOTE) {
    const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa,registro_id")
      .eq("tipo", tipo).in("chave_externa", chaves.slice(k, k + LOTE)).not("registro_id", "is", null);
    if (error) throw error;
    for (const r of data || []) m.set(r.chave_externa, r.registro_id);
  }
  return m;
}

export function ImportarExecucoesWorkflowProjuris({ userId }: { userId: string }) {
  const [arquivos, setArquivos] = useState<Record<string, File>>({});
  const [ignorados, setIgnorados] = useState<string[]>([]);
  const [prog, setProg] = useState(0);
  const [fase, setFase] = useState("");
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const escolher = (fs: FileList | null) => {
    const m = { ...arquivos };
    const ign: string[] = [];
    const ALIAS: Record<string, string> = { etapaworflow: "etapaworkflow", etapasworkflow: "etapaworkflow", etapasworflow: "etapaworkflow" };
    for (const f of Array.from(fs || [])) {
      let n = f.name.toLowerCase().replace(/\.csv$/, "").replace(/\s*(\(\d+\)|-\d+|_\d+|\d+)\s*$/, "").replace(/[\s_-]/g, "").trim();
      n = ALIAS[n] || n;
      if ((ARQS as readonly string[]).includes(n)) m[n] = f; else ign.push(f.name);
    }
    setArquivos(m);
    setIgnorados(ign);
  };

  const importar = async () => {
    setRodando(true); setResumo(null); setProg(0);
    try {
      setFase("Lendo arquivos");
      const [wf, et, ct, ex] = await Promise.all(ARQS.map(async (k) => lerCsvPontoVirgula(await arquivos[k].text())));

      setFase("Lendo modelos importados");
      const { data: itensEt, error: e0 } = await db.from("migracoes_projuris_itens").select("chave_externa,registro_id,dados").eq("tipo", "workflow_etapa").not("registro_id", "is", null);
      if (e0) throw e0;
      const ids = (itensEt || []).map((i: any) => i.registro_id);
      const etapasDb = new Map<string, any>();
      for (let k = 0; k < ids.length; k += LOTE) {
        const { data, error } = await db.from("workflow_etapas").select("id,ordem,titulo,tipo_item,workflow_id").in("id", ids.slice(k, k + LOTE));
        if (error) throw error;
        for (const e of data || []) etapasDb.set(e.id, e);
      }
      const importadas: EtapaImportada[] = (itensEt || []).filter((i: any) => etapasDb.has(i.registro_id)).map((i: any) => {
        const e = etapasDb.get(i.registro_id);
        return { chave: i.chave_externa, workflowOrigem: String(i.dados?.workflow_origem || ""), etapaId: e.id, ordem: e.ordem, titulo: e.titulo, tipoItem: (e.tipo_item || "prazo").toLowerCase() };
      });
      const { data: itensWf, error: e1 } = await db.from("migracoes_projuris_itens").select("chave_externa,registro_id").eq("tipo", "workflow").not("registro_id", "is", null);
      if (e1) throw e1;
      const workflowId = new Map<string, string>((itensWf || []).map((i: any) => [i.chave_externa, i.registro_id]));

      const { planos, semModelo } = montarExecucoesWorkflow(wf, et, ct, ex, importadas);
      setProg(10);

      setFase("Conferindo fluxos já importados");
      const jaFeitos = await mapaChaves("workflow_execucao", planos.map((p) => p.cdcontrole));
      const novos = planos.filter((p) => !jaFeitos.has(p.cdcontrole) && workflowId.has(p.workflowOrigem));
      setProg(20);

      setFase("Localizando tarefas e processos migrados");
      const tarefaId = await mapaChaves("tarefa", [...new Set(novos.flatMap((p) => p.etapas.map((e) => e.cdtarefa).filter(Boolean) as string[]))]);
      setProg(45);
      const processoId = await mapaChaves("processo", [...new Set(novos.map((p) => p.cdprocesso).filter(Boolean) as string[])]);
      const procDaTarefa = new Map<string, string>();
      const tids = [...new Set(tarefaId.values())];
      for (let k = 0; k < tids.length; k += LOTE) {
        const { data, error } = await db.from("tarefas").select("id,processo_id").in("id", tids.slice(k, k + LOTE));
        if (error) throw error;
        for (const t of data || []) if (t.processo_id) procDaTarefa.set(t.id, t.processo_id);
        setProg(45 + Math.round((k / Math.max(tids.length, 1)) * 20));
      }

      const { data: mig, error: e2 } = await db.from("migracoes_projuris")
        .insert({ coordenacao_id: COORD_SANTANDER_CIVEL, nome: NOME_MIGRACAO, status: "em_andamento", criado_por: userId }).select("id").single();
      if (e2) throw e2;

      setFase("Gravando fluxos");
      let criados = 0, automaticos = 0, abertasSemTarefa = 0;
      for (let k = 0; k < novos.length; k += 100) {
        const lote = novos.slice(k, k + 100).map((p) => {
          const id = crypto.randomUUID();
          const etapas = p.etapas.map((e) => ({
            execucao_id: id, etapa_id: e.etapaId, ordem: e.ordem, item_tipo: e.tipoItem, status: e.status, sucesso: e.sucesso,
            item_id: e.cdtarefa ? tarefaId.get(e.cdtarefa) || null : null,
          }));
          const primeiraTarefa = etapas.find((e) => e.item_id)?.item_id;
          const processo = (p.cdprocesso && processoId.get(p.cdprocesso)) || (primeiraTarefa && procDaTarefa.get(primeiraTarefa)) || null;
          const aberta = etapas.find((e) => e.status === "materializada");
          if (aberta && aberta.item_id) automaticos++; else if (aberta) abertasSemTarefa++;
          return {
            exec: { id, workflow_id: workflowId.get(p.workflowOrigem), coordenacao_id: COORD_SANTANDER_CIVEL, processo_id: processo, iniciado_por: userId,
              data_inicio: p.dataInicio, status: p.status, observacoes: `Importado do Projuris (fluxo ${p.cdcontrole}).` },
            etapas, chave: p.cdcontrole,
          };
        });
        const { error: a } = await db.from("workflow_execucoes").insert(lote.map((l) => l.exec));
        if (a) throw a;
        const { error: b } = await db.from("workflow_execucao_etapas").insert(lote.flatMap((l) => l.etapas));
        if (b) throw b;
        const { error: c } = await db.from("migracoes_projuris_itens").insert(lote.map((l) => ({ migracao_id: mig.id, tipo: "workflow_execucao", chave_externa: l.chave, registro_id: l.exec.id, status: "criado" })));
        if (c) throw c;
        criados += lote.length;
        setProg(65 + Math.round((k / Math.max(novos.length, 1)) * 35));
      }
      const contadores = { fluxos: criados, em_andamento_automaticos: automaticos, abertas_sem_tarefa: abertasSemTarefa, ja_importados: jaFeitos.size, sem_modelo: semModelo };
      await db.from("migracoes_projuris").update({ status: "concluida", contadores }).eq("id", mig.id);
      setProg(100); setFase("");
      setResumo(`${criados} fluxos importados (${novos.filter((p) => p.status === "em_andamento").length} em andamento, o resto como histórico). ${automaticos} seguem automáticos: ao concluir a tarefa atual, a próxima etapa é criada. ${abertasSemTarefa} em andamento sem a tarefa migrada. ${jaFeitos.size} já tinham sido importados e ${semModelo} são de modelos não importados.`);
      toast.success("Fluxos importados");
    } catch (e: any) { toast.error(e.message || "Falha na importação"); }
    setRodando(false);
  };

  const desfazer = async () => {
    if (!confirm("Remover os fluxos importados do Projuris? As tarefas continuam.")) return;
    setRodando(true);
    try {
      const { data: migs, error } = await db.from("migracoes_projuris").select("id").eq("nome", NOME_MIGRACAO);
      if (error) throw error;
      for (const m of migs || []) {
        for (;;) {
          const { data: itens, error: e1 } = await db.from("migracoes_projuris_itens").select("id,registro_id").eq("migracao_id", m.id).eq("tipo", "workflow_execucao").limit(LOTE);
          if (e1) throw e1;
          if (!itens?.length) break;
          const { error: e2 } = await db.from("workflow_execucoes").delete().in("id", itens.map((i: any) => i.registro_id));
          if (e2) throw e2;
          const { error: e3 } = await db.from("migracoes_projuris_itens").delete().in("id", itens.map((i: any) => i.id));
          if (e3) throw e3;
        }
        await db.from("migracoes_projuris").update({ status: "desfeita" }).eq("id", m.id);
      }
      setResumo("Importação de fluxos desfeita. Tarefas e modelos continuam.");
      toast.success("Desfeito");
    } catch (e: any) { toast.error(e.message || "Falha ao desfazer"); }
    setRodando(false);
  };

  const pronto = ARQS.every((k) => arquivos[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxos (workflows) em execução do Projuris</CardTitle>
        <CardDescription>Envie workflow.csv, etapaworkflow.csv, workflowcontrole.csv e workflowexecucao.csv. Cada fluxo iniciado no Projuris vira uma execução do modelo já importado, na Coordenação Santander Cível, ligada às tarefas já migradas. Fluxos parados numa etapa continuam automáticos; os encerrados ficam como histórico. Os modelos continuam desligados até a revisão. Pode escolher os arquivos aos poucos; etapaworkflowtarefa.csv e workflowgatilhoautomatico.csv não são necessários.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv" multiple onChange={(e) => escolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">{ARQS.map((k) => `${k}: ${arquivos[k] ? "ok" : "falta"}`).join(" · ")}</p>
        {ignorados.length > 0 && <p className="text-xs text-muted-foreground">Não usados: {ignorados.join(", ")}</p>}
        {rodando && <><Progress value={prog} /><p className="text-xs text-muted-foreground">{fase}</p></>}
        <div className="flex gap-2">
          <Button disabled={!pronto || rodando} onClick={importar}>{rodando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar fluxos</Button>
          <Button variant="outline" disabled={rodando} onClick={desfazer}><Undo2 className="h-4 w-4 mr-1" />Desfazer</Button>
        </div>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
