import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lerCsvPontoVirgula } from "@/lib/checklistProjuris";
import { montarVinculosMarcadores } from "@/lib/marcadoresProjuris";

const db = supabase as any;
const ARQS = ["marcador", "marcadorvinculomodulo"] as const;
const COORD_SANTANDER_CIVEL = "968631d0-6659-46f1-b45d-899892cb0121";
const NOME_MIGRACAO = "Marcadores do Projuris";

export function ImportarMarcadoresProjuris({ userId }: { userId: string }) {
  const [arquivos, setArquivos] = useState<Record<string, File>>({});
  const [prog, setProg] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const escolher = (fs: FileList | null) => {
    const m = { ...arquivos };
    for (const f of Array.from(fs || [])) {
      const n = f.name.toLowerCase().replace(/\.csv$/, "").replace(/[\s_-]*(\(\d+\)|-\d+|_\d+|\d+)?\s*$/, "").trim();
      if ((ARQS as readonly string[]).includes(n)) m[n] = f;
    }
    setArquivos(m);
  };

  const importar = async () => {
    setRodando(true); setResumo(null); setProg(0);
    try {
      const [mk, vk] = await Promise.all(ARQS.map(async (k) => lerCsvPontoVirgula(await arquivos[k].text())));
      const { nomes, vinculos, ignorados } = montarVinculosMarcadores(mk, vk);

      // Etiquetas: reaproveita pelo nome na coordenação; cria as que faltam.
      const { data: existentes, error: e1 } = await db.from("etiquetas").select("id,nome").eq("coordenacao_id", COORD_SANTANDER_CIVEL);
      if (e1) throw e1;
      const etiquetaId = new Map<string, string>((existentes || []).map((e: any) => [e.nome.trim().toUpperCase(), e.id]));
      const novas = nomes.filter((n) => !etiquetaId.has(n.toUpperCase()));
      if (novas.length) {
        const { data, error } = await db.from("etiquetas").insert(novas.map((nome, i) => ({
          coordenacao_id: COORD_SANTANDER_CIVEL, nome, cor: "#64748b", modulos: ["processos", "itens"], ativo: true, ordem: 100 + i, created_by: userId,
        }))).select("id,nome");
        if (error) throw error;
        for (const e of data || []) etiquetaId.set(e.nome.trim().toUpperCase(), e.id);
      }
      setProg(10);

      // Resolve processos e tarefas migrados pela chave do Projuris.
      const registro = new Map<string, string>();
      for (const tipo of ["processo", "tarefa"] as const) {
        const chaves = [...new Set(vinculos.filter((v) => v.entidade === tipo).map((v) => v.chave))];
        for (let k = 0; k < chaves.length; k += 150) {
          const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa,registro_id")
            .eq("tipo", tipo).in("chave_externa", chaves.slice(k, k + 150)).not("registro_id", "is", null);
          if (error) throw error;
          for (const r of data || []) registro.set(`${tipo}|${r.chave_externa}`, r.registro_id);
        }
        setProg(tipo === "processo" ? 30 : 50);
      }

      const rows = vinculos
        .filter((v) => registro.has(`${v.entidade}|${v.chave}`))
        .map((v) => ({ etiqueta_id: etiquetaId.get(v.marcador.toUpperCase()), entidade: v.entidade, entidade_id: registro.get(`${v.entidade}|${v.chave}`), created_by: userId }));

      const { data: mig, error: e2 } = await db.from("migracoes_projuris")
        .insert({ coordenacao_id: COORD_SANTANDER_CIVEL, nome: NOME_MIGRACAO, status: "em_andamento", criado_por: userId }).select("id").single();
      if (e2) throw e2;

      let inseridos = 0;
      for (let k = 0; k < rows.length; k += 500) {
        const { data, error } = await db.from("etiquetas_itens")
          .upsert(rows.slice(k, k + 500), { onConflict: "etiqueta_id,entidade,entidade_id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        if (data?.length) {
          inseridos += data.length;
          const { error: e3 } = await db.from("migracoes_projuris_itens").insert(
            data.map((d: any) => ({ migracao_id: mig.id, tipo: "marcador_vinculo", registro_id: d.id, status: "criado" })));
          if (e3) throw e3;
        }
        setProg(50 + Math.round((k / Math.max(rows.length, 1)) * 50));
      }
      const contadores = { etiquetas_novas: novas.length, vinculos: inseridos, sem_registro: vinculos.length - rows.length, ignorados };
      await db.from("migracoes_projuris").update({ status: "concluida", contadores }).eq("id", mig.id);
      setProg(100);
      setResumo(`${nomes.length} marcadores (${novas.length} etiquetas novas). ${inseridos} etiquetas aplicadas; já existentes foram puladas. ${vinculos.length - rows.length} vínculos sem processo/tarefa migrado e ${ignorados} de marcadores inativos ou CAPTURA ficaram de fora.`);
      toast.success("Marcadores importados");
    } catch (e: any) { toast.error(e.message || "Falha na importação"); }
    setRodando(false);
  };

  const desfazer = async () => {
    if (!confirm("Remover as etiquetas aplicadas pela importação de marcadores do Projuris?")) return;
    setRodando(true);
    try {
      const { data: migs, error } = await db.from("migracoes_projuris").select("id").eq("nome", NOME_MIGRACAO);
      if (error) throw error;
      for (const m of migs || []) {
        for (;;) {
          const { data: itens, error: e1 } = await db.from("migracoes_projuris_itens").select("id,registro_id")
            .eq("migracao_id", m.id).eq("tipo", "marcador_vinculo").limit(150);
          if (e1) throw e1;
          if (!itens?.length) break;
          const { error: e2 } = await db.from("etiquetas_itens").delete().in("id", itens.map((i: any) => i.registro_id));
          if (e2) throw e2;
          const { error: e3 } = await db.from("migracoes_projuris_itens").delete().in("id", itens.map((i: any) => i.id));
          if (e3) throw e3;
        }
        await db.from("migracoes_projuris").update({ status: "desfeita" }).eq("id", m.id);
      }
      setResumo("Importação de marcadores desfeita (as etiquetas continuam cadastradas, sem uso).");
      toast.success("Desfeito");
    } catch (e: any) { toast.error(e.message || "Falha ao desfazer"); }
    setRodando(false);
  };

  const pronto = ARQS.every((k) => arquivos[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marcadores do Projuris</CardTitle>
        <CardDescription>Envie marcador.csv e marcadorvinculomodulo.csv. Cada marcador ativo vira uma etiqueta da Coordenação Santander Cível e é aplicado aos processos e tarefas já migrados. CAPTURA não entra: ela segue o Acompanhamento Especial.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv" multiple onChange={(e) => escolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">{ARQS.map((k) => `${k}: ${arquivos[k] ? "ok" : "falta"}`).join(" · ")}</p>
        {rodando && <Progress value={prog} />}
        <div className="flex gap-2">
          <Button disabled={!pronto || rodando} onClick={importar}>{rodando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar marcadores</Button>
          <Button variant="outline" disabled={rodando} onClick={desfazer}><Undo2 className="h-4 w-4 mr-1" />Desfazer</Button>
        </div>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
