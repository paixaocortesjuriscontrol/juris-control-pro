import { useRef, useState } from "react";
import { toast } from "sonner";
import { BlobReader, BlobWriter, ZipReader, type Entry } from "@zip.js/zip.js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProjurisAnexosProgress } from "./ProjurisAnexosProgress";
import { useProjurisUploadProgress } from "@/hooks/useProjurisUploadProgress";
import { uploadAnexoProjuris } from "@/lib/uploadAnexoProjuris";
import { criarGravadorLotes, executarFila } from "@/lib/projurisImportQueue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Pause, Play, Upload } from "lucide-react";
import { sanitizarNome } from "@/lib/migracaoProjuris";
import { montarMapaBackup, indexarAnexosZip, nomeBaseAnexo, motivoModuloAnexo } from "@/lib/mapaAnexosProjuris";

/**
 * Etapa 4 do backup: anexos.
 * Usa o "Mapeamento de Arquivos" do Projuris (cdarquivo, cdmodulo, codigo_entidade, caminho, nome)
 * e os zips com os arquivos físicos. Módulo 3 = processo (identificador_projuris do processo),
 * módulo 4 = tarefa (identificador_projuris da tarefa). Relatórios (52) e importações (85) ficam fora.
 */
type Map_ = { cd: string; modulo: string; entidade: string; caminho: string; nome: string; nomeFinal?: string };
type Linha = Map_ & { motivo: string | null; processoId?: string | null; tarefaId?: string | null; entry?: Entry; docExistente?: string };
const CANCELADO = new Error("__cancelado__");

const parseCsv = (txt: string) => {
  const primeira = txt.slice(0, txt.indexOf("\n") > 0 ? txt.indexOf("\n") : 500);
  const sep = (primeira.split(";").length > primeira.split(",").length) ? ";" : ",";
  const linhas: string[][] = []; let campo = "", linha: string[] = [], q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};


const baseArq = nomeBaseAnexo;
const ceder = () => new Promise((r) => setTimeout(r, 0));

interface Props { coordId: string; nomeCoord: string; userId: string; onConcluido: () => void }

export function AnexosBackupProjuris({ coordId, nomeCoord, userId, onConcluido }: Props) {
  const infoRef = useRef(new Map<string, { caminho: string; nome: string; nomeFinal?: string }>());
  const vincRef = useRef<{ cd: string; modulo: string; entidade: string }[]>([]);
  const [mapa, setMapa] = useState<Map_[]>([]);
  const [zips, setZips] = useState<{ nome: string; entries: Entry[] }[]>([]);
  const [conf, setConf] = useState<Linha[] | null>(null);
  const [lendo, setLendo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const uploadProgress = useProjurisUploadProgress();
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
  const [feito, setFeito] = useState(false);
  const pausado = useRef(false); const cancelado = useRef(false);
  const [pausa, setPausa] = useState(false);

  const abrir = async (files: FileList | null) => {
    if (!files || lendo || analisando || rodando) return;
    setFeito(false);
    cancelado.current = false;
    setConf(null);
    for (const f of Array.from(files)) {
      if (cancelado.current) break;
      try {
        if (/\.csv$/i.test(f.name)) {
          setLendo(f.name);
          const rows = parseCsv(await f.text());
          const h = rows[0].map((x) => x.trim().toLowerCase().replace(/^\ufeff/, ""));
          const ix = (n: string) => h.indexOf(n);
          const iCd = ix("cdarquivo");
          if (iCd >= 0 && ix("decaminhoarquivo") >= 0) {
            // arquivo.csv do backup
            const iCam = ix("decaminhoarquivo"), iNome = ix("nmarquivoorigem"), iFinal = ix("nmarquivofinal");
            rows.slice(1).forEach((r) => { if (r[iCd]) infoRef.current.set(r[iCd].trim(), { caminho: (r[iCam] || "").trim(), nome: (r[iNome] || "").trim() || baseArq(r[iCam] || ""), nomeFinal: (r[iFinal] || "").trim() }); });
            toast.success(`${f.name}: ${infoRef.current.size.toLocaleString("pt-BR")} arquivos cadastrados`);
          } else if (iCd >= 0 && ix("cdregistrovinculo") >= 0 && ix("cdmodulo") >= 0) {
            // arquivovinculomodulo.csv do backup
            const iMod = ix("cdmodulo"), iReg = ix("cdregistrovinculo");
            vincRef.current = rows.slice(1).filter((r) => r[iCd]).map((r) => ({ cd: r[iCd].trim(), modulo: (r[iMod] || "").trim(), entidade: (r[iReg] || "").trim() }));
            toast.success(`${f.name}: ${vincRef.current.length.toLocaleString("pt-BR")} ligações de anexos`);
          } else {
            const iMod = ix("cdmodulo"), iEnt = ix("codigo_entidade_onde_o_arquivo_foi_vinculado"), iCam = ix("caminho"), iNome = ix("nome");
            if (iCd < 0 || iMod < 0 || iEnt < 0 || iCam < 0) { toast.error(`${f.name}: envie arquivo.csv + arquivovinculomodulo.csv ou o Mapeamento de Arquivos do Projuris`); continue; }
            const lista = rows.slice(1).filter((r) => r[iCd]).map((r) => ({ cd: r[iCd].trim(), modulo: r[iMod].trim(), entidade: r[iEnt].trim(), caminho: r[iCam].trim(), nome: (r[iNome] || "").trim() || baseArq(r[iCam]) }));
            setMapa(lista);
            toast.success(`${f.name}: ${lista.length.toLocaleString("pt-BR")} arquivos no mapeamento`);
          }
          if (infoRef.current.size && vincRef.current.length) {
            const m = montarMapaBackup(infoRef.current, vincRef.current);
            setMapa(m);
            toast.success(`${m.length.toLocaleString("pt-BR")} anexos prontos para cruzar com os zips`);
          }
        } else if (/\.zip$/i.test(f.name)) {
          setLendo(`${f.name} (listando...)`);
          const entries = (await new ZipReader(new BlobReader(f)).getEntries()).filter((e) => !e.directory);
          setZips((z) => [...z, { nome: f.name, entries }]);
        } else toast.warning(`${f.name}: envie o CSV de mapeamento e os zips dos anexos`);
      } catch (e: any) { toast.error(`Erro ao ler ${f.name}: ${e?.message || e}`); }
    }
    if (cancelado.current) {
      cancelado.current = false;
      toast.warning("Leitura cancelada. O que já foi lido continua disponível — use “Limpar” para começar de novo.");
    }
    setLendo(null);
  };

  const analisar = async () => {
    setAnalisando(true); cancelado.current = false;
    setMsg("Cruzando arquivos...");
    setAnalysisProgress({ done: 0, total: 0 });
    try {
      const localizar = indexarAnexosZip(zips.flatMap(z => z.entries));
      const correspondencias = new Map(mapa.map(m => [m, localizar(m)]));
      // já migrados
      const migrados = new Set<string>();
      // Search only files present in this upload, rather than every attachment in the backup.
      const presentes = mapa.filter(m => !motivoModuloAnexo(m.modulo) && correspondencias.get(m)?.entry);
      const cds = Array.from(new Set(presentes.map(m => m.cd)));
      const procIds = Array.from(new Set(presentes.filter(m => m.modulo === "3").map(m => m.entidade)));
      const tarIds = Array.from(new Set(presentes.filter(m => m.modulo === "4").map(m => m.entidade)));
      const total = cds.length + procIds.length + tarIds.length;
      let done = 0;
      setAnalysisProgress({ done, total });
      const batches = <T,>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size));
      const advance = async (count: number, label: string) => {
        done += count; setAnalysisProgress({ done, total }); setMsg(label);
        await ceder(); if (cancelado.current) throw CANCELADO;
      };
      await executarFila(batches(cds, 200), async parte => {
        if (cancelado.current) throw CANCELADO;
        // Paginate because a key may occur in several past attempts.
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa").eq("tipo", "anexo").eq("status", "criado").in("chave_externa", parte).range(from, from + 999);
          if (error) throw error;
          ((data as any[]) || []).forEach(x => migrados.add(x.chave_externa));
          if (!data || data.length < 1000) break;
        }
        await advance(parte.length, "Verificando anexos já migrados");
      });
      const busca = async (tabela: "processos" | "tarefas", ids: string[]) => {
        const out = new Map<string, { id: string; processo_id?: string | null }>();
        await executarFila(batches(ids, 200), async parte => {
          if (cancelado.current) throw CANCELADO;
          const { data, error } = await (supabase.from(tabela as any) as any).select(tabela === "tarefas" ? "id, identificador_projuris, processo_id" : "id, identificador_projuris").in("identificador_projuris", parte);
          if (error) throw error;
          ((data as any[]) || []).forEach(x => out.set(String(x.identificador_projuris), x));
          await advance(parte.length, `Procurando ${tabela}`);
        });
        return out;
      };
      const procs = await busca("processos", procIds);
      const tars = await busca("tarefas", tarIds);
      const vistos = new Set<string>();
      const ls: Linha[] = mapa.map((m) => {
        let motivo: string | null = null;
        let processoId: string | null = null, tarefaId: string | null = null;
        const match = correspondencias.get(m);
        motivo = motivoModuloAnexo(m.modulo);
        if (!motivo && match?.ambiguous) motivo = "Nome repetido em pastas diferentes dos zips (vínculo não confirmado)";
        if (!motivo && !match?.entry) motivo = "Arquivo não encontrado nos zips";
        if (!motivo && m.modulo === "3") { processoId = procs.get(m.entidade)?.id || null; if (!processoId) motivo = "Processo não importado (faça a etapa Processos)"; }
        else if (!motivo && m.modulo === "4") { const t = tars.get(m.entidade); tarefaId = t?.id || null; processoId = t?.processo_id || null; if (!tarefaId) motivo = "Tarefa não importada (faça a etapa Tarefas)"; }
        const entry = match?.entry;
        if (!motivo && migrados.has(m.cd)) motivo = "Já migrado antes";
        if (!motivo && vistos.has(m.cd)) motivo = "Repetido no mapeamento";
        if (!motivo && !entry) motivo = "Arquivo não encontrado nos zips";
        vistos.add(m.cd);
        return { ...m, motivo, processoId, tarefaId, entry };
      });
      // Anexos que já estão no sistema (inclusive de importações antigas, registradas pelo nome do arquivo):
      // mesmo nome no mesmo processo ou na mesma tarefa → não envia de novo.
      const cand = ls.filter((l) => !l.motivo);
      const nomes = Array.from(new Set(cand.map((l) => l.nome)));
      const existentes = new Map<string, { id: string; processo_id: string | null; tarefa_id: string | null }[]>();
      let checked = 0;
      setAnalysisProgress({ done: 0, total: nomes.length });
      await executarFila(batches(nomes, 150), async parte => {
        if (cancelado.current) throw CANCELADO;
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("documentos").select("id, nome, processo_id, tarefa_id").in("nome", parte).range(from, from + 999);
          if (error) throw error;
          ((data as any[]) || []).forEach(d => { const key = String(d.nome).toLowerCase(); existentes.set(key, [...(existentes.get(key) || []), d]); });
          if (!data || data.length < 1000) break;
        }
        checked += parte.length;
        setAnalysisProgress({ done: checked, total: nomes.length });
        setMsg("Conferindo anexos já existentes"); await ceder();
      });
      for (const l of cand) {
        const docs = existentes.get(l.nome.toLowerCase()) || [];
        if (l.tarefaId && docs.some((d) => d.tarefa_id === l.tarefaId)) { l.motivo = "Já existe na tarefa"; continue; }
        const noProc = docs.find((d) => l.processoId && d.processo_id === l.processoId);
        if (!noProc) continue;
        if (l.tarefaId && !noProc.tarefa_id) l.docExistente = noProc.id; // só liga o anexo já existente à tarefa
        else l.motivo = "Já existe no processo";
      }
      setConf(ls);
    } catch (e: any) {
      if (cancelado.current) { cancelado.current = false; toast.warning("Análise cancelada. Nada foi gravado."); }
      else toast.error(`Erro na análise: ${e?.message || e}`);
    }
    setMsg(""); setAnalisando(false);
  };

  const esperar = async () => { while (pausado.current && !cancelado.current) await new Promise((r) => setTimeout(r, 400)); };

  const importar = async () => {
    if (!conf || rodando) return;
    setFeito(false);
    cancelado.current = false; pausado.current = false; setPausa(false); setRodando(true);
    const ok = conf.filter((l) => !l.motivo), pul = conf.filter((l) => l.motivo);
    uploadProgress.start(ok.length);
    uploadProgress.phase("Abrindo lote de anexos");
    const { data: mig, error } = await supabase.from("migracoes_projuris" as any).insert({
      coordenacao_id: coordId, nome: `Projuris Backup Anexos ${nomeCoord} ${new Date().toLocaleString("pt-BR")}`,
      mapeamento: { modulo: "backup", tabela: "Anexos" }, criado_por: userId,
    }).select("id").single();
    if (error || !mig) { toast.error(error?.message || "Falha ao abrir migração"); setRodando(false); uploadProgress.finish("Não foi possível iniciar"); return; }
    const mid = (mig as any).id;
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) {
      const { error } = await supabase.from("migracoes_projuris_itens" as any).insert(it.slice(k, k + 500).map(x => ({ migracao_id: mid, ...x })));
      if (error) throw error;
    } };
    const audit = criarGravadorLotes<any>(log);
    const cont = { criados: 0, pulados: pul.length, erros: 0, anexos_enviados: 0, anexos_sem_vinculo: pul.length };
    const base = (import.meta as any).env.VITE_SUPABASE_URL;
    try {
      await log(pul.map((l) => ({ tipo: "anexo", chave_externa: l.cd, status: "pulado", motivo: l.motivo, dados: { titulo: l.nome } })));
      uploadProgress.phase("Enviando e vinculando anexos");
      const reserved = new Set<string>();
      await executarFila(ok, async (a, index) => {
        await esperar(); if (cancelado.current) return;
        const key = String(index);
        const target = `${a.tarefaId || a.processoId}|${a.nome.toLowerCase()}`;
        if (reserved.has(target)) {
          cont.pulados++;
          await audit.add({ tipo: "anexo", chave_externa: a.cd, status: "pulado", motivo: "Repetido no mesmo destino", dados: { titulo: a.nome } });
          uploadProgress.complete(key, "skipped");
          return;
        }
        reserved.add(target);
        let result: "uploaded" | "linked" | "errors" = "errors";
        let auditItem: any;
        try {
          if (a.docExistente) {
            uploadProgress.file(key, a.nome, "Vinculando", 0.2);
            const { data: updated, error: upd } = await supabase.from("documentos").update({ tarefa_id: a.tarefaId } as any).eq("id", a.docExistente).is("tarefa_id", null).select("id").single();
            if (upd || !updated) throw upd || new Error("O vínculo não foi confirmado");
            cont.criados++; result = "linked";
            auditItem = { tipo: "vinculo_anexo_tarefa", chave_externa: a.cd, registro_id: a.docExistente, status: "criado", dados: { tarefa_id: a.tarefaId, titulo: a.nome } };
          } else {
            if (!a.entry || !("getData" in a.entry)) throw new Error("Arquivo não disponível no zip");
            uploadProgress.file(key, a.nome, "Extraindo do zip");
            const blob: Blob = await (a.entry as any).getData(new BlobWriter(), { onprogress: (current: number, total: number) => uploadProgress.file(key, a.nome, "Extraindo do zip", total ? current / total * 0.1 : 0) });
            const path = `${a.processoId || `tarefas/${a.tarefaId}`}/projuris_${a.cd}_${sanitizarNome(a.nome)}`;
            await uploadAnexoProjuris(path, blob, (sent, total) => uploadProgress.file(key, a.nome, "Enviando", 0.1 + (total ? sent / total : 0) * 0.8, sent), true);
            uploadProgress.file(key, a.nome, "Gravando vínculo", 0.9, blob.size);
            const { data: doc, error: ins } = await supabase.from("documentos").insert({
              nome: a.nome, tipo: blob.type || null, tamanho_bytes: blob.size,
              url: `${base}/storage/v1/object/sign/documentos_processos/${path}`,
              processo_id: a.processoId, tarefa_id: a.tarefaId, uploaded_by: userId,
            } as any).select("id").single();
            if (ins || !doc) throw ins || new Error("Cadastro do anexo não confirmado");
            cont.criados++; cont.anexos_enviados++; result = "uploaded";
            auditItem = { tipo: "anexo", chave_externa: a.cd, registro_id: (doc as any).id, status: "criado", dados: { titulo: a.nome, path } };
          }
        } catch (e: any) {
          cont.erros++;
          auditItem = { tipo: "anexo", chave_externa: a.cd, status: "erro", motivo: e?.message || String(e), dados: { titulo: a.nome } };
        }
        // Audit failures must stop the queue, never disguise a created document as an upload failure.
        await audit.add(auditItem);
        uploadProgress.complete(key, result);
      });
      uploadProgress.phase("Salvando resultado do lote");
      await audit.flush();
      const { error: finalError } = await supabase.from("migracoes_projuris" as any).update({ status: cancelado.current ? "cancelada" : "concluida", contadores: cont }).eq("id", mid);
      if (finalError) throw finalError;
      uploadProgress.finish(cancelado.current ? "Envio cancelado" : cont.erros ? "Finalizado com erros" : "Anexos concluídos");
      const resultMessage = `${cont.anexos_enviados} enviados, ${cont.criados - cont.anexos_enviados} vinculados, ${cont.pulados} pulados, ${cont.erros} com erro`;
      if (cancelado.current || cont.erros) toast.warning(resultMessage); else toast.success(resultMessage);
      setFeito(!cancelado.current && !cont.erros); onConcluido();
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: cont }).eq("id", mid);
      uploadProgress.finish("Importação interrompida por erro");
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
          Envie <strong>arquivo.csv</strong> + <strong>arquivovinculomodulo.csv</strong> do backup (ou o Mapeamento de Arquivos) e os zips com os arquivos — os zips são lidos aqui no navegador, sem limite de tamanho. Cada anexo vai para a tarefa (e o processo dela) ou para a ficha do processo
          (ou para a tarefa) já importado, com o nome original. Faça antes as etapas Processos e Tarefas. Pode repetir quando chegarem mais arquivos: os já enviados são pulados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/40"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void abrir(e.dataTransfer.files); }}>
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Arraste arquivo.csv, arquivovinculomodulo.csv e os zips dos anexos</span>
          <input type="file" multiple className="hidden" disabled={!!lendo || analisando || rodando} accept=".csv,.zip" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
        </label>
        {lendo && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...
            <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => { cancelado.current = true; }}>Cancelar leitura</Button>
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant={mapa.length ? "secondary" : "outline"}>Mapeamento: {mapa.length ? `${mapa.length.toLocaleString("pt-BR")} arquivos` : "não enviado"}</Badge>
          <Badge variant={zips.length ? "secondary" : "outline"}>Zips: {zips.length} ({totalZip.toLocaleString("pt-BR")} arquivos)</Badge>
          {(mapa.length > 0 || zips.length > 0) && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!!lendo || analisando || rodando} onClick={() => { setMapa([]); setZips([]); setConf(null); infoRef.current = new Map(); vincRef.current = []; }}>Limpar</Button>}
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={!mapa.length || !zips.length || rodando || analisando || !!lendo} onClick={() => void analisar()}>
            {analisando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Analisar anexos (nada é gravado)
          </Button>
          {analisando && <Button size="sm" variant="destructive" onClick={() => { cancelado.current = true; }}>Cancelar análise</Button>}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
        {analisando && <div className="space-y-2"><Progress value={analysisProgress.total ? analysisProgress.done / analysisProgress.total * 100 : 0} aria-label="Conferência dos anexos" /><p className="text-xs text-muted-foreground">{analysisProgress.done.toLocaleString("pt-BR")} / {analysisProgress.total.toLocaleString("pt-BR")} conferidos</p></div>}
        {uploadProgress.state.total > 0 && <ProjurisAnexosProgress state={uploadProgress.state} paused={pausa && rodando} running={rodando} />}
        {conf && (
          <div className="space-y-1 rounded-md border p-3">
            {resumo.map(([k, n]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n.toLocaleString("pt-BR")}</Badge></div>)}
            {conf.some(l => l.motivo === "Arquivo não encontrado nos zips") && <details className="pt-2 text-xs"><summary className="cursor-pointer font-medium">Conferir exemplos de arquivos não encontrados</summary><div className="mt-2 space-y-2">{conf.filter(l => l.motivo === "Arquivo não encontrado nos zips").slice(0, 10).map((l, i) => <div key={i} className="break-all"><p>{l.nome}</p><p className="text-muted-foreground">Caminho no cadastro: {l.caminho}</p></div>)}</div></details>}
            <div className="flex gap-2 pt-2">
              <Button size="sm" disabled={rodando || feito || !okN} onClick={() => void importar()}>
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
