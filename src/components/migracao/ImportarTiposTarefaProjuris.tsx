import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lerCsvPontoVirgula } from "@/lib/checklistProjuris";
import { montarModelosTarefaProjuris } from "@/lib/tiposTarefaProjuris";

const db = supabase as any;
const COORD_SANTANDER_CIVEL = "968631d0-6659-46f1-b45d-899892cb0121";

export function ImportarTiposTarefaProjuris({ userId }: { userId: string }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const escolher = (fs: FileList | null) => {
    for (const f of Array.from(fs || [])) {
      const n = f.name.toLowerCase().replace(/\.csv$/, "").replace(/[\s_-]*(\(\d+\)|-\d+|_\d+|\d+)?\s*$/, "").trim();
      if (n === "tarefatipo") setArquivo(f);
    }
  };

  const importar = async () => {
    if (!arquivo) return;
    setRodando(true); setResumo(null);
    try {
      const modelos = montarModelosTarefaProjuris(lerCsvPontoVirgula(await arquivo.text()));
      const { data: existentes, error } = await db.from("modelos_titulo_coordenacao")
        .select("padroes").eq("coordenacao_id", COORD_SANTANDER_CIVEL).not("padroes->>projuris_cd", "is", null);
      if (error) throw error;
      const ja = new Set((existentes || []).map((e: any) => String(e.padroes?.projuris_cd)));
      const novos = modelos.filter((m) => !ja.has(m.projuris_cd)).map((m) => ({
        coordenacao_id: COORD_SANTANDER_CIVEL, nome: m.nome, titulo: m.nome, tipo: m.tipo,
        prioridade: "media", padroes: m.padroes, ativo: true, criado_por: userId,
      }));
      for (let k = 0; k < novos.length; k += 200) {
        const { data, error: e2 } = await db.from("modelos_titulo_coordenacao").insert(novos.slice(k, k + 200)).select("id");
        if (e2) throw e2;
        if ((data?.length ?? 0) < novos.slice(k, k + 200).length) throw new Error("Sem permissão para criar modelos na Santander Cível.");
      }
      setResumo(`${modelos.length} tipos ativos lidos: ${novos.length} modelos criados, ${modelos.length - novos.length} já existiam.`);
      toast.success("Tipos de tarefa importados");
    } catch (e: any) { toast.error(e.message || "Falha na importação"); }
    setRodando(false);
  };

  const desfazer = async () => {
    if (!confirm("Excluir os Modelos de tarefas importados do Projuris?")) return;
    setRodando(true);
    try {
      const { error } = await db.from("modelos_titulo_coordenacao").delete()
        .eq("coordenacao_id", COORD_SANTANDER_CIVEL).not("padroes->>projuris_cd", "is", null);
      if (error) throw error;
      setResumo("Modelos importados do Projuris removidos.");
      toast.success("Desfeito");
    } catch (e: any) { toast.error(e.message || "Falha ao desfazer"); }
    setRodando(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de tarefa do Projuris</CardTitle>
        <CardDescription>Envie tarefatipo.csv. Cada tipo ativo vira um Modelo de tarefa da Coordenação Santander Cível, com prazo, prazo fatal, hora e cor do Projuris. Compromissos viram modelos de Evento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv" multiple onChange={(e) => escolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">tarefatipo: {arquivo ? "ok" : "falta"}</p>
        <div className="flex gap-2">
          <Button disabled={!arquivo || rodando} onClick={importar}>{rodando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar tipos</Button>
          <Button variant="outline" disabled={rodando} onClick={desfazer}><Undo2 className="h-4 w-4 mr-1" />Desfazer</Button>
        </div>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
