import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lerCsvPontoVirgula } from "@/lib/checklistProjuris";

const db = supabase as any;
const ARQS = ["comentario", "comentariovinculomodulo", "usuario", "pessoa", "retarefaeventousuario"] as const;
const OBRIG = ["comentario", "comentariovinculomodulo"];
const COORD_SANTANDER_CIVEL = "968631d0-6659-46f1-b45d-899892cb0121";

/** Comentários do Projuris ficam até o fim do dia de corte (BRT). */
export function comentarioDentroDoCorte(dtinclusao: string, corte: string): boolean {
  if (!corte) return true;
  const dia = (dtinclusao || "").slice(0, 10);
  return !!dia && dia <= corte;
}

export function ImportarComentariosProjuris({ userId }: { userId: string }) {
  const [arquivos, setArquivos] = useState<Record<string, File>>({});
  const [corte, setCorte] = useState("2026-11-13");
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

  const ler = async (k: string) => (arquivos[k] ? lerCsvPontoVirgula(await arquivos[k].text()) : []);

  const nomesUsuarios = async () => {
    const [us, ps] = [await ler("usuario"), await ler("pessoa")];
    const pessoa = new Map(ps.map((p) => [p.cdpessoa, (p.nmpessoa || "").trim()]));
    return new Map(us.map((u) => [u.cdusuario, pessoa.get(u.cdpessoa) || ""]));
  };

  const importar = async () => {
    setRodando(true); setResumo(null); setProg(0);
    try {
      const vinc = await ler("comentariovinculomodulo");
      const tarefaDe = new Map(vinc.filter((v) => v.cdmodulo === "4").map((v) => [v.cdcomentario, v.cdregistrovinculo]));
      const nomes = await nomesUsuarios();
      const coms = (await ler("comentario")).filter((c) => tarefaDe.has(c.cdcomentario) && c.flativo === "S" && !c.dtexclusao && (c.decomentario || "").trim());
      const dentro = coms.filter((c) => comentarioDentroDoCorte(c.dtinclusao, corte));
      const foraCorte = coms.length - dentro.length;
      setProg(10);

      const { data: mig, error: e1 } = await db.from("migracoes_projuris").insert({
        coordenacao_id: COORD_SANTANDER_CIVEL, nome: `Comentários do Projuris ${new Date().toLocaleString("pt-BR")}`,
        status: "em_andamento", criado_por: userId, mapeamento: { modulo: "comentarios", data_corte: corte || null },
      }).select("id").single();
      if (e1) throw e1;

      const tot = { criados: 0, ja_importados: 0, sem_tarefa: 0, apos_corte: foraCorte };
      const LOTE = 300;
      for (let k = 0; k < dentro.length; k += LOTE) {
        const itens = dentro.slice(k, k + LOTE).map((c) => ({
          cd: c.cdcomentario, tarefa: tarefaDe.get(c.cdcomentario), conteudo: c.decomentario.replace(/\[\^id:\d+\]\s*/g, ""),
          criado_em: c.dtinclusao, autor: nomes.get(c.cdusuariocriador) || "",
        }));
        const { data, error } = await db.rpc("importar_comentarios_projuris", { _migracao: mig.id, _itens: itens, _corte: corte || null });
        if (error) throw error;
        tot.criados += data.criados; tot.ja_importados += data.ja_importados; tot.sem_tarefa += data.sem_tarefa; tot.apos_corte += data.apos_corte;
        setProg(10 + Math.round(((k + LOTE) / Math.max(dentro.length, 1)) * 90));
      }
      await db.from("migracoes_projuris").update({ status: "concluida", contadores: tot }).eq("id", mig.id);
      setProg(100);
      setResumo(`${tot.criados.toLocaleString("pt-BR")} comentários importados · ${tot.ja_importados.toLocaleString("pt-BR")} já existiam · ${tot.sem_tarefa.toLocaleString("pt-BR")} de tarefas que não estão no sistema · ${tot.apos_corte.toLocaleString("pt-BR")} depois da data de corte.`);
      toast.success("Comentários importados");
    } catch (e: any) { toast.error(e.message || "Falha na importação"); }
    setRodando(false);
  };

  const excelRecusadas = async () => {
    setRodando(true);
    try {
      const { data: migs, error } = await db.from("migracoes_projuris").select("id,nome,created_at")
        .ilike("nome", "Projuris Backup Tarefas%").order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      if (!migs?.length) throw new Error("Nenhuma importação de tarefas do backup encontrada");
      const linhas: any[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error: e2 } = await db.from("migracoes_projuris_itens").select("chave_externa,motivo,dados")
          .eq("migracao_id", migs[0].id).eq("status", "erro").range(de, de + 999);
        if (e2) throw e2;
        linhas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const pessoas = new Map<string, string[]>();
      if (arquivos.retarefaeventousuario) {
        const nomes = await nomesUsuarios();
        for (const r of await ler("retarefaeventousuario")) {
          const n = nomes.get(r.cdusuario) || `usuário ${r.cdusuario}`;
          pessoas.set(r.cdtarefaevento, [...(pessoas.get(r.cdtarefaevento) || []), n]);
        }
      }
      const dataBR = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : d || "");
      const ws = XLSX.utils.json_to_sheet(linhas.map((l) => ({
        "Código Projuris": l.chave_externa, Tipo: l.dados?.tipo || "", Título: l.dados?.titulo || "", Data: dataBR(l.dados?.data),
        "Pessoas no Projuris": (pessoas.get(l.chave_externa) || []).join("; ") || (arquivos.retarefaeventousuario ? "nenhuma pessoa no Projuris" : ""),
        Motivo: l.motivo || "",
      })));
      ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 50 }, { wch: 12 }, { wch: 45 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Recusadas");
      XLSX.writeFile(wb, `tarefas_recusadas_projuris_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${linhas.length.toLocaleString("pt-BR")} tarefas recusadas no Excel`);
    } catch (e: any) { toast.error(e.message || "Falha ao gerar o Excel"); }
    setRodando(false);
  };

  const pronto = OBRIG.every((k) => arquivos[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comentários do Projuris e tarefas recusadas</CardTitle>
        <CardDescription>
          Envie comentario.csv e comentariovinculomodulo.csv do backup (e, para mostrar autores e pessoas, usuario.csv, pessoa.csv e retarefaeventousuario.csv).
          Os comentários entram nas tarefas já migradas, sem avisos para a equipe, só até a data de corte; os já importados são pulados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv" multiple onChange={(e) => escolher(e.target.files)} />
        <p className="text-xs text-muted-foreground">{ARQS.map((k) => `${k}: ${arquivos[k] ? "ok" : OBRIG.includes(k) ? "falta" : "opcional"}`).join(" · ")}</p>
        <div className="flex items-center gap-2 text-sm">
          <span>Data de corte dos comentários:</span>
          <Input type="date" className="w-44" value={corte} onChange={(e) => setCorte(e.target.value)} />
        </div>
        {rodando && <Progress value={prog} />}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!pronto || rodando} onClick={importar}>{rodando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar comentários</Button>
          <Button variant="outline" disabled={rodando} onClick={excelRecusadas}><Download className="h-4 w-4 mr-1" />Excel das tarefas recusadas</Button>
        </div>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
