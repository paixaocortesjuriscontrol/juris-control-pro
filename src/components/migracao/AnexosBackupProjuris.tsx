import { useRef, useState } from "react";
import { toast } from "sonner";
import { BlobReader, BlobWriter, ZipReader, type Entry } from "@zip.js/zip.js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Pause, Play, Upload } from "lucide-react";
import { sanitizarNome } from "@/lib/migracaoProjuris";

/**
 * Etapa 4 do backup: anexos.
 * Usa o "Mapeamento de Arquivos" do Projuris (cdarquivo, cdmodulo, codigo_entidade, caminho, nome)
 * e os zips com os arquivos físicos. Módulo 3 = processo (identificador_projuris do processo),
 * módulo 4 = tarefa (identificador_projuris da tarefa). Relatórios (52) e importações (85) ficam fora.
 */
type Map_ = { cd: string; modulo: string; entidade: string; caminho: string; nome: string };
type Linha = Map_ & { motivo: string | null; processoId?: string | null; tarefaId?: string | null; entry?: Entry };

const parseCsv = (txt: string) => {
  const linhas: string[][] = []; let campo = "", linha: string[] = [], q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};
const baseArq = (p: string) => (p.split("/").pop() || p).toLowerCase();
const ceder = () => new Promise((r) => setTimeout(r, 0));

interface Props { coordId: string; nomeCoord: string; userId: string; onConcluido: () => void }

export function AnexosBackupProjuris({ coordId, nomeCoord, userId, onConcluido }: Props) {
  const [mapa, setMapa] = useState<Map_[]>([]);
  const [zips, setZips] = useState<{ nome: string; entries: Entry[] }[]>([]);
  const [conf, setConf] = useState<Linha[] | null>(null);
  const [lendo, setLendo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState({ feito: 0, total: 0 });
  const [feito, setFeito] = useState(false);
  const pausado = useRef(false); const cancelado = useRef(false);
  const [pausa, setPausa] = useState(false);

  const abrir = async (files: FileList | null) => {
    if (!files) return;
    setConf(null);
    for (const f of Array.from(files)) {
      try {
        if (/\.csv$/i.test(f.name)) {
          setLendo(f.name);
          const rows = parseCsv(await f.text());
          const h = rows[0].map((x) => x.trim().toLowerCase());
          const ix = (n: string) => h.indexOf(n);
          const iCd = ix("cdarquivo"), iMod = ix("cdmodulo"), iEnt = ix("codigo_entidade_onde_o_arquivo_foi_vinculado"), iCam = ix("caminho"), iNome = ix("nome");
          if (iCd < 0 || iMod < 0 || iEnt < 0 || iCam < 0) { toast.error(`${f.name}: não é o Mapeamento de Arquivos do Projuris`); continue; }
          const lista = rows.slice(1).filter((r) => r[iCd]).map((r) => ({ cd: r[iCd].trim(), modulo: r[iMod].trim(), entidade: r[iEnt].trim(), caminho: r[iCam].trim(), nome: (r[iNome] || "").trim() || baseArq(r[iCam]) }));
          setMapa(lista);
          toast.success(`${f.name}: ${lista.length.toLocaleString("pt-BR")} arquivos no mapeamento`);
        } else if (/\.zip$/i.test(f.name)) {
          setLendo(`${f.name} (listando...)`);
          const entries = (await new ZipReader(new BlobReader(f)).getEntries()).filter((e) => !e.directory);
          setZips((z) => [...z, { nome: f.name, entries }]);
        } else toast.warning(`${f.name}: envie o CSV de mapeamento e os zips dos anexos`);
      } catch (e: any) { toast.error(`Erro ao ler ${f.name}: ${e?.message || e}`); }
    }
    setLendo(null);
  };

  const analisar = async () => {
    setMsg("Cruzando arquivos...");
    try {
      const porNome = new Map<string, Entry>();
      zips.forEach((z) => z.entries.forEach((e) => porNome.set(baseArq(e.filename), e)));
      // já migrados
      const migrados = new Set<string>();
      const cds = mapa.map((m) => m.cd);
      for (let k = 0; k < cds.length; k += 200) {
        const { data, error } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa").eq("tipo", "anexo").eq("status", "criado").in("chave_externa", cds.slice(k, k + 200));
        if (error) throw error;
        ((data as any[]) || []).forEach((x) => migrados.add(x.chave_externa));
        if (k % 2000 === 0) { setMsg(`Verificando anexos já migrados: ${k} de ${cds.length}`); await ceder(); }
      }
      const busca = async (tabela: "processos" | "tarefas", ids: string[]) => {
        const out = new Map<string, { id: string; processo_id?: string | null }>();
        for (let k = 0; k < ids.length; k += 200) {
          const { data, error } = await supabase.from(tabela).select(tabela === "tarefas" ? "id, identificador_projuris, processo_id" : "id, identificador_projuris").in("identificador_projuris" as any, ids.slice(k, k + 200));
          if (error) throw error;
          ((data as any[]) || []).forEach((x) => out.set(String(x.identificador_projuris), x));
          setMsg(`Procurando ${tabela}: ${Math.min(k + 200, ids.length)} de ${ids.length}`); await ceder();
        }
        return out;
      };
      const procs = await busca("processos", Array.from(new Set(mapa.filter((m) => m.modulo === "3").map((m) => m.entidade))));
      const tars = await busca("tarefas", Array.from(new Set(mapa.filter((m) => m.modulo === "4").map((m) => m.entidade))));
      const vistos = new Set<string>();
      const ls: Linha[] = mapa.map((m) => {
        let motivo: string | null = null;
        let processoId: string | null = null, tarefaId: string | null = null;
        if (m.modulo === "52") motivo = "Relatório gerado pelo Projuris (não é anexo de caso)";
        else if (m.modulo === "85") motivo = "Planilha de importação do Projuris (não é anexo de caso)";
        else if (m.modulo === "3") { processoId = procs.get(m.entidade)?.id || null; if (!processoId) motivo = "Processo não importado (faça a etapa Processos)"; }
        else if (m.modulo === "4") { const t = tars.get(m.entidade); tarefaId = t?.id || null; processoId = t?.processo_id || null; if (!tarefaId) motivo = "Tarefa não importada (faça a etapa Tarefas)"; }
        else motivo = `Vinculado a outro módulo do Projuris (${m.modulo})`;
        const entry = porNome.get(baseArq(m.caminho));
        if (!motivo && migrados.has(m.cd)) motivo = "Já migrado antes";
        if (!motivo && vistos.has(m.cd)) motivo = "Repetido no mapeamento";
        if (!motivo && !entry) motivo = "Arquivo não encontrado nos zips";
        vistos.add(m.cd);
        return { ...m, motivo, processoId, tarefaId, entry };
      });
      setConf(ls);
    } catch (e: any) { toast.error(`Erro na análise: ${e?.message || e}`); }
    setMsg("");
  };

  const esperar = async () => { while (pausado.current && !cancelado.current) await new Promise((r) => setTimeout(r, 400)); };

  const importar = async () => {
    if (!conf) return;
    cancelado.current = false; pausado.current = false; setPausa(false); setRodando(true);
    const ok = conf.filter((l) => !l.motivo), pul = conf.filter((l) => l.motivo);
    const { data: mig, error } = await supabase.from("migracoes_projuris" as any).insert({
      coordenacao_id: coordId, nome: `Projuris Backup Anexos ${nomeCoord} ${new Date().toLocaleString("pt-BR")}`,
      mapeamento: { modulo: "backup", tabela: "Anexos" }, criado_por: userId,
    }).select("id").single();
    if (error || !mig) { toast.error(error?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = (mig as any).id;
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) await supabase.from("migracoes_projuris_itens" as any).insert(it.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x }))); };
    const cont = { criados: 0, pulados: pul.length, erros: 0, anexos_enviados: 0, anexos_sem_vinculo: pul.length };
    const base = (import.meta as any).env.VITE_SUPABASE_URL;
    try {
      await log(pul.map((l) => ({ tipo: "anexo", chave_externa: l.cd, status: "pulado", motivo: l.motivo, dados: { titulo: l.nome } })));
      setProg({ feito: 0, total: ok.length });
      const fila = [...ok]; let n = 0;
      const trab = async () => {
        while (fila.length && !cancelado.current) {
          await esperar(); if (cancelado.current) break;
          const a = fila.shift()!;
          try {
            const blob: Blob = await (a.entry as any).getData(new BlobWriter());
            const path = `${a.processoId || `tarefas/${a.tarefaId}`}/projuris_${a.cd}_${sanitizarNome(a.nome)}`;
            const { error: up } = await supabase.storage.from("documentos_processos").upload(path, blob, { upsert: true });
            if (up) throw up;
            const { data: doc, error: ins } = await supabase.from("documentos").insert({
              nome: a.nome, tipo: blob.type || null, tamanho_bytes: blob.size,
              url: `${base}/storage/v1/object/sign/documentos_processos/${path}`,
              processo_id: a.processoId, tarefa_id: a.tarefaId, uploaded_by: userId,
            } as any).select("id").single();
            if (ins) throw ins;
            cont.criados++; cont.anexos_enviados++;
            await log([{ tipo: "anexo", chave_externa: a.cd, registro_id: (doc as any).id, status: "criado", dados: { titulo: a.nome, path } }]);
          } catch (e: any) {
            cont.erros++;
            await log([{ tipo: "anexo", chave_externa: a.cd, status: "erro", motivo: e?.message || String(e), dados: { titulo: a.nome } }]);
          }
          setProg({ feito: ++n, total: ok.length });
        }
      };
      await Promise.all([trab(), trab(), trab(), trab()]);
      await supabase.from("migracoes_projuris" as any).update({ status: cancelado.current ? "cancelada" : "concluida", contadores: cont }).eq("id", mid);
      toast.success(`Anexos: ${cont.criados} enviados, ${cont.pulados} pulados, ${cont.erros} com erro`);
      setFeito(true); onConcluido();
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: cont }).eq("id", mid);
      toast.error(`Erro na importação: ${e?.message || e}`);
    } finally { setRodando(false); }
  };

  const resumo = conf ? Array.from(conf.reduce((m, l) => m.set(l.motivo || "Será importado", (m.get(l.motivo || "Será importado") || 0) + 1), new Map<string, number>())).sort((a, b) => b[1] - a[1]) : [];
  const okN = conf?.filter((l) => !l.motivo).length || 0;
  const totalZip = zips.reduce((s, z) => s + z.entries.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">4. Anexos {feito && <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />importado</Badge>}</CardTitle>
        <CardDescription>
          Envie o arquivo <strong>Mapeamento de Arquivos</strong> (.csv) do Projuris e os zips com os arquivos. Cada anexo vai para a ficha do processo
          (ou para a tarefa) já importado, com o nome original. Faça antes as etapas Processos e Tarefas. Pode repetir quando chegarem mais arquivos: os já enviados são pulados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/40"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void abrir(e.dataTransfer.files); }}>
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Arraste o mapeamento (.csv) e os zips dos anexos</span>
          <input type="file" multiple className="hidden" accept=".csv,.zip" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
        </label>
        {lendo && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={mapa.length ? "secondary" : "outline"}>Mapeamento: {mapa.length ? `${mapa.length.toLocaleString("pt-BR")} arquivos` : "não enviado"}</Badge>
          <Badge variant={zips.length ? "secondary" : "outline"}>Zips: {zips.length} ({totalZip.toLocaleString("pt-BR")} arquivos)</Badge>
          {(mapa.length > 0 || zips.length > 0) && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setMapa([]); setZips([]); setConf(null); }}>Limpar</Button>}
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={!mapa.length || !zips.length || rodando || !!msg} onClick={() => void analisar()}>
            {msg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Analisar anexos (nada é gravado)
          </Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
        {conf && (
          <div className="space-y-1 rounded-md border p-3">
            {resumo.map(([k, n]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n.toLocaleString("pt-BR")}</Badge></div>)}
            {rodando && prog.total > 0 && (<><Progress value={Math.round((prog.feito / prog.total) * 100)} /><p className="text-xs text-muted-foreground">{prog.feito.toLocaleString("pt-BR")} de {prog.total.toLocaleString("pt-BR")} — não feche esta página</p></>)}
            <div className="flex gap-2 pt-2">
              <Button size="sm" disabled={rodando || !okN} onClick={() => void importar()}>
                {rodando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Importar {okN.toLocaleString("pt-BR")} anexos
              </Button>
              {rodando && (<>
                <Button size="sm" variant="outline" onClick={() => { pausado.current = !pausado.current; setPausa(pausado.current); }}>{pausa ? <><Play className="mr-1 h-3 w-3" />Continuar</> : <><Pause className="mr-1 h-3 w-3" />Pausar</>}</Button>
                <Button size="sm" variant="destructive" onClick={() => { cancelado.current = true; pausado.current = false; }}>Cancelar</Button>
              </>)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
