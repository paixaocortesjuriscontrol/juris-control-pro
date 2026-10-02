import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, Upload } from "lucide-react";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { norm, digitos, formatarCnj, paraData, classificarTipo, mapearSituacao } from "@/lib/migracaoProjuris";

// Colunas mantidas de cada tabela do backup (o resto do CSV é ignorado).
// Tabela sem lista = mantém todas as colunas (arquivo pequeno).
const TABELAS: Record<string, string[] | null> = {
  processo: ["cdprocesso", "flativo", "flexclusaotipo", "dtinclusao", "dtdistribuicao", "descricao", "nmassunto", "nmpasta", "nmpastacliente", "flprocessoinstancia", "vlacao", "flsegredojustica", "desenhaprocesso"],
  processonumero: ["cdprocessonumero", "flativo", "denumeroprocesso", "flprocessoinstancia", "flprincipal", "flexclusaotipo", "cdprocesso"],
  tarefaevento: ["cdtarefaevento", "flativo", "flexclusaotipo", "dtinclusao", "dtbase", "dtconclusaoprevista", "dtlimite", "detarefa", "cdtarefa", "cdtarefatipo", "dtconclusao", "flconcluido", "detitulo", "dtinicio", "cdusuariocriador", "cdusuarioconclusao", "flprivado"],
  tarefatipo: ["cdtarefatipo", "flativo", "detarefa"],
  andamento: ["cdandamento", "flativo", "dtandamento", "dthoraandamento", "deandamento", "cdandamentotipo", "flexclusaotipo"],
  andamentovinculomodulo: ["cdandamento", "cdmodulo", "cdregistrovinculo"],
  usuario: ["cdusuario", "flativo", "delogin", "cdpessoa"],
  pessoa: ["cdpessoa", "nmpessoa"],
  comentario: ["cdcomentario", "decomentario", "dtinclusao", "cdusuariocriador"],
  arquivo: ["cdarquivo", "dearquivo", "nmarquivoorigem", "deurlexterna", "decaminhoarquivo"],
  andamentotipo: null,
};

// Leitor de CSV com quebra de linha e aspas, feito em Web Worker para não travar a tela.
const WORKER_SRC = [
  "let delim = ';';",
  "const parseLine = (line) => {",
  "  if (line.indexOf('\"') === -1) return line.split(delim);",
  "  const out = []; let f = '', inQ = false;",
  "  for (let i = 0; i < line.length; i++) { const c = line[i];",
  "    if (inQ) { if (c === '\"') { if (line[i + 1] === '\"') { f += '\"'; i++; } else inQ = false; } else f += c; }",
  "    else if (c === '\"') inQ = true;",
  "    else if (c === delim) { out.push(f); f = ''; }",
  "    else if (c !== '\\r') f += c;",
  "  }",
  "  out.push(f); return out;",
  "};",
  "self.onmessage = async (e) => {",
  "  const { id, file, keep } = e.data;",
  "  try {",
  "    const reader = file.stream().getReader();",
  "    const dec = new TextDecoder('utf-8');",
  "    let headers = false, headerNames = null, keepIdx = null;",
  "    let batch = [], total = 0, pending = '', delimVisto = false;",
  "    const emit = () => { if (batch.length) { self.postMessage({ type: 'rows', id, arr: batch }); batch = []; } };",
  "    const handleLine = (line) => {",
  "      if (line.length && line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);",
  "      if (!line) return;",
  "      if (!headers) {",
  "        if (!delimVisto) {",
  "          const semi = line.split(';').length, comma = line.split(',').length;",
  "          delim = comma > semi ? ',' : ';'; delimVisto = true;",
  "        }",
  "        const raw = parseLine(line);",
  "        headerNames = raw.map((h, i) => (h || 'col' + i).trim());",
  "        keepIdx = (keep || headerNames).map((k) => headerNames.indexOf(k));",
  "        headers = true; return;",
  "      }",
  "      const cells = parseLine(line);",
  "      batch.push(keepIdx.map((j) => (j >= 0 && j < cells.length ? cells[j] : '')));",
  "      total++;",
  "      if (batch.length >= 2000) emit();",
  "    };",
  "    while (true) {",
  "      const { done, value } = await reader.read();",
  "      if (value) pending += dec.decode(value, { stream: true });",
  "      let idx;",
  "      while ((idx = pending.indexOf('\\n')) !== -1) {",
  "        const seg = pending.slice(0, idx + 1);",
  "        let q = 0; for (let i = 0; i < seg.length; i++) if (seg.charCodeAt(i) === 34) q++;",
  "        if (q % 2 === 1) break;",
  "        handleLine(pending.slice(0, idx));",
  "        pending = pending.slice(idx + 1);",
  "      }",
  "      if (batch.length >= 2000) emit();",
  "      if (done) break;",
  "    }",
  "    pending += dec.decode();",
  "    if (pending.trim()) handleLine(pending);",
  "    emit();",
  "    self.postMessage({ type: 'done', id, total, colunas: headerNames });",
  "  } catch (err) { self.postMessage({ type: 'erro', id, msg: String((err && err.message) || err) }); }",
  "};",
].join("\n");

const ceder = () => new Promise((r) => setTimeout(r, 0));
const valorNum = (v: string) => { const s = String(v ?? "").trim(); if (!s) return null; const n = Number(s.replace(/[^0-9.]/g, "")); return isFinite(n) && s ? n : null; };
const baseNome = (n: string) => (n.split("/").pop() || n).replace(/\.(csv|txt)$/i, "").toLowerCase().replace(/[-_]\d+$/, "");
const REGEX_CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

type TabelaLida = { colunas: string[]; linhas: string[][]; arquivos: string[] };
type LinhaConf = { chave: string; motivo: string | null; [k: string]: any };
type Conf = {
  processos: LinhaConf[]; tarefas: LinhaConf[]; andamentos: LinhaConf[];
  comentarios: number; arquivos: { total: number; comCnj: number };
  ignorados: number; arquivosLidos: { nome: string; linhas: number }[];
};

const LOTE = 200;

interface Props {
  coordId: string; nomeCoord: string; userId: string;
  usuarios: { id: string; nome: string }[]; onConcluido: () => void;
}

export function BackupCompletoProjuris({ coordId, nomeCoord, userId, usuarios, onConcluido }: Props) {
  const tabelasRef = useRef<Map<string, TabelaLida>>(new Map());
  const [info, setInfo] = useState<{ nome: string; linhas: number; arquivos: string[] }[]>([]);
  const [ignorados, setIgnorados] = useState(0);
  const [lendo, setLendo] = useState<string | null>(null);
  const [conf, setConf] = useState<Conf | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState<string | null>(null);
  const [prog, setProg] = useState({ feito: 0, total: 0 });
  const [feitos, setFeitos] = useState<Record<string, boolean>>({});
  const pausado = useRef(false);
  const cancelado = useRef(false);
  const [pausa, setPausa] = useState(false);
  const reqId = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  const getWorker = () => {
    if (!workerRef.current) {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
      workerRef.current = new Worker(url);
    }
    return workerRef.current;
  };

  // ---------- Leitura ----------
  const lerTabela = (base: string, blob: Blob, arquivo: string) =>
    new Promise<void>((resolve) => {
      const id = ++reqId.current;
      if (!tabelasRef.current.has(base)) tabelasRef.current.set(base, { colunas: [], linhas: [], arquivos: [] });
      const w = getWorker();
      const onMsg = (e: MessageEvent) => {
        const d = e.data;
        if (d.id !== id) return;
        if (d.type === "rows") {
          const t = tabelasRef.current.get(base)!;
          for (const r of d.arr) t.linhas.push(r);
        } else if (d.type === "done") {
          const t = tabelasRef.current.get(base)!;
          if (keepDe(base) === null && d.colunas) t.colunas = d.colunas;
          else t.colunas = keepDe(base) || (d.colunas || []);
          t.arquivos.push(arquivo);
          w.removeEventListener("message", onMsg);
          resolve();
        } else if (d.type === "erro") {
          toast.error(`${arquivo}: ${d.msg}`);
          w.removeEventListener("message", onMsg);
          resolve();
        }
      };
      w.addEventListener("message", onMsg);
      w.postMessage({ id, file: blob, keep: TABELAS[base] });
    });

  const keepDe = (base: string) => (TABELAS[base] === undefined ? null : (TABELAS[base] ?? null));

  const abrir = async (files: FileList | null) => {
    if (!files) return;
    setConf(null); setAnalisando(false);
    for (const f of Array.from(files)) {
      try {
        if (f.name.toLowerCase().endsWith(".zip")) {
          setLendo(`${f.name} (listando...)`);
          const reader = new ZipReader(new BlobReader(f));
          const entries = (await reader.getEntries()).filter((e) => !e.directory);
          let usados = 0;
          for (const e of entries) {
            const base = baseNome(e.filename);
            if (!(base in TABELAS)) { setIgnorados((i) => i + 1); continue; }
            setLendo(`${e.filename}`);
            const blob: Blob = await (e as any).getData(new BlobWriter());
            await lerTabela(base, blob, e.filename);
            usados++;
            setInfo(Array.from(tabelasRef.current.entries()).map(([n, t]) => ({ nome: n, linhas: t.linhas.length, arquivos: t.arquivos })));
          }
          if (!usados) toast.warning(`${f.name}: nenhuma tabela do Projuris reconhecida dentro do zip`);
        } else {
          const base = baseNome(f.name);
          if (!(base in TABELAS)) { setIgnorados((i) => i + 1); continue; }
          setLendo(`${f.name} (${(f.size / 1048576).toFixed(0)} MB)`);
          await lerTabela(base, f, f.name);
          setInfo(Array.from(tabelasRef.current.entries()).map(([n, t]) => ({ nome: n, linhas: t.linhas.length, arquivos: t.arquivos })));
        }
      } catch (e: any) {
        toast.error(`Erro ao ler ${f.name}: ${e?.message || e}`);
      }
    }
    setLendo(null);
  };

  const zerar = () => {
    tabelasRef.current = new Map();
    setInfo([]); setIgnorados(0); setConf(null);
  };

  // ---------- Análise (nada é gravado) ----------
  const gu = (base: string) => {
    const t = tabelasRef.current.get(base);
    if (!t || !t.linhas.length) return null;
    const idx = new Map<string, number>();
    t.colunas.forEach((c, i) => { if (!idx.has(c)) idx.set(c, i); });
    return { linhas: t.linhas, g: (r: string[], c: string) => { const i = idx.get(c); return i === undefined || i >= r.length ? "" : r[i]; } };
  };

  const casarNome = (n: string) => {
    const k = norm(n); if (!k) return null;
    const ex = usuarios.find((u) => norm(u.nome) === k); if (ex) return ex.id;
    const t = k.split(" ");
    const p = usuarios.filter((u) => { const ut = norm(u.nome).split(" "); return ut[0] === t[0] && ut.includes(t[t.length - 1]); });
    return p.length === 1 ? p[0].id : null;
  };

  const analisar = async () => {
    if (!tabelasRef.current.size) return;
    setAnalisando(true); cancelado.current = false;
    try {
      // --------- 1. números de processo ---------
      setMsg("Cruzando processos...");
      await ceder();
      const procNum = new Map<string, { dig: string; sc: number }>();
      const guNum = gu("processonumero");
      if (guNum) for (const r of guNum.linhas) {
        if (norm(guNum.g(r, "flexclusaotipo"))) continue;
        const dig = digitos(guNum.g(r, "denumeroprocesso"));
        if (dig.length !== 20) continue;
        const cd = String(guNum.g(r, "cdprocesso") || ""); if (!cd) continue;
        const sc = (norm(guNum.g(r, "flprincipal")) === "s" ? 2 : 0) + (norm(guNum.g(r, "flprocessoinstancia")).includes("primeira") ? 1 : 0);
        const cur = procNum.get(cd);
        if (!cur || sc > cur.sc) procNum.set(cd, { dig, sc });
        if (procNum.size % 8000 === 0) await ceder();
      }
      // --------- 2. usuários → nome da pessoa ---------
      const nomePessoa = new Map<string, string>();
      const guPessoa = gu("pessoa");
      if (guPessoa) for (const r of guPessoa.linhas) nomePessoa.set(String(guPessoa.g(r, "cdpessoa") || ""), String(guPessoa.g(r, "nmpessoa") || ""));
      const usuarioNome = new Map<string, { nome: string }>();
      const guUsu = gu("usuario");
      if (guUsu) for (const r of guUsu.linhas) {
        const login = String(guUsu.g(r, "delogin") || "");
        const pes = String(guUsu.g(r, "cdpessoa") || "");
        usuarioNome.set(String(guUsu.g(r, "cdusuario") || ""), { nome: nomePessoa.get(pes) || login });
      }
      // --------- 3. nomes de tipos ---------
      const tipoTarefaNome = new Map<string, string>();
      const guTipoT = gu("tarefatipo");
      if (guTipoT) for (const r of guTipoT.linhas) tipoTarefaNome.set(String(guTipoT.g(r, "cdtarefatipo") || ""), String(guTipoT.g(r, "detarefa") || ""));
      const andamentoTipoNome = new Map<string, string>();
      const guTipoA = gu("andamentotipo");
      if (guTipoA && guTipoA.linhas.length) {
        const idCol = guTipoA.linhas.length ? (guTipoA.colunas.includes("cdandamentotipo") ? "cdandamentotipo" : guTipoA.colunas[0]) : "";
        const nomeCol = guTipoA.colunas.includes("deandamentotipo") ? "deandamentotipo" : (guTipoA.colunas.find((c) => c.startsWith("de") && c !== idCol) || guTipoA.colunas[1] || "");
        for (const r of guTipoA.linhas) andamentoTipoNome.set(String(guTipoA.g(r, idCol) || ""), String(guTipoA.g(r, nomeCol) || ""));
      }
      // --------- 4. vínculos de andamentos ---------
      const vincMap = new Map<string, string>();
      const guVinc = gu("andamentovinculomodulo");
      if (guVinc) for (const r of guVinc.linhas) if (norm(guVinc.g(r, "cdmodulo")) === "3") vincMap.set(String(guVinc.g(r, "cdandamento") || ""), String(guVinc.g(r, "cdregistrovinculo") || ""));

      // --------- 5. processos (linhas do módulo) ---------
      const procRows: LinhaConf[] = [];
      const procByCd = new Map<string, { cdprocesso: string; dig: string | null }>();
      const guProc = gu("processo");
      const vistosDig = new Set<string>();
      if (guProc) for (const r of guProc.linhas) {
        const cd = String(guProc.g(r, "cdprocesso") || ""); if (!cd) continue;
        let motivo: string | null = null;
        if (norm(guProc.g(r, "flexclusaotipo"))) motivo = "Excluído no Projuris";
        else if (norm(guProc.g(r, "flativo")) === "n") motivo = "Inativo no Projuris";
        const num = procNum.get(cd);
        const dig = num?.dig || "";
        if (!motivo && !dig) motivo = "Sem número de processo no backup";
        if (!motivo && dig.length !== 20) motivo = "Número CNJ inválido";
        if (!motivo && vistosDig.has(dig)) motivo = "Repetido no backup";
        vistosDig.add(dig);
        const item: LinhaConf = {
          chave: cd, motivo,
          cdprocesso: cd, dig, pasta: String(guProc.g(r, "nmpastacliente") || guProc.g(r, "nmpasta") || ""),
          assunto: String(guProc.g(r, "nmassunto") || ""), descricao: String(guProc.g(r, "descricao") || ""),
          distIso: paraData(guProc.g(r, "dtdistribuicao")), valor: valorNum(guProc.g(r, "vlacao")),
        };
        procRows.push(item);
        if (!motivo) procByCd.set(cd, { cdprocesso: cd, dig });
        if (procRows.length % 5000 === 0) await ceder();
      }
      // já cadastrados no Juris Control (qualquer coordenação)
      const procDb = new Map<string, string>();
      const digs = Array.from(new Set(procRows.filter((l) => !l.motivo && l.dig).map((l) => l.dig)));
      for (let k = 0; k < digs.length; k += 100) {
        const parte = digs.slice(k, k + 100);
        const { data, error } = await supabase.from("processos").select("id, numero").in("numero", [...parte, ...parte.map(formatarCnj)]);
        if (error) throw error;
        ((data as any[]) || []).forEach((p) => procDb.set(digitos(p.numero), p.id));
        setMsg(`Procurando processos cadastrados: ${Math.min(k + 100, digs.length)} de ${digs.length}`);
        await ceder();
      }

      // --------- 6. tarefas ---------
      setMsg("Cruzando tarefas...");
      await ceder();
      const migradas = new Set<string>();
      const chavesTe = Array.from(new Set((tabelasRef.current.get("tarefaevento")?.linhas || []).map((_, i) => "")));
      const guTe = gu("tarefaevento");
      const idsTe: string[] = [];
      if (guTe) for (const r of guTe.linhas) { const k = String(guTe.g(r, "cdtarefaevento") || ""); if (k) idsTe.push(k); }
      {
        const unicos = Array.from(new Set(idsTe));
        const partes: string[][] = [];
        for (let k = 0; k < unicos.length; k += 200) partes.push(unicos.slice(k, k + 200));
        let feitosL = 0;
        for (let k = 0; k < partes.length; k += 4) {
          await Promise.all(partes.slice(k, k + 4).map(async (parte) => {
            const { data, error } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa").eq("tipo", "tarefa").eq("status", "criado").in("chave_externa", parte);
            if (error) throw error;
            ((data as any[]) || []).forEach((x) => migradas.add(x.chave_externa));
          }));
          feitosL += Math.min(4, partes.length - k);
          setMsg(`Verificando tarefas já migradas: ${feitosL} de ${partes.length} lotes`);
        }
        await ceder();
      }
      // tarefas de importações Projuris anteriores nesta coordenação (mesmo título + data)
      const existentes = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("tarefas").select("titulo, data_vencimento").eq("coordenacao_id", coordId).eq("origem", "projuris").range(from, from + 999);
        if (error) throw error;
        ((data as any[]) || []).forEach((t: any) => existentes.add(`${norm(t.titulo)}|${t.data_vencimento ? String(t.data_vencimento).slice(0, 10) : ""}`));
        if (!data || data.length < 1000) break;
        setMsg(`Conferindo tarefas já cadastradas: ${from + ((data as any[]) || []).length}`);
      }
      const tarefasRows: LinhaConf[] = [];
      const respCache = new Map<string, string | null>();
      if (guTe) {
        const vistosTe = new Set<string>();
        for (const r of guTe.linhas) {
          const chave = String(guTe.g(r, "cdtarefaevento") || "");
          let motivo: string | null = null;
          if (!chave) motivo = "Sem identificador";
          else if (norm(guTe.g(r, "flexclusaotipo"))) motivo = "Excluída no Projuris";
          else if (norm(guTe.g(r, "flativo")) === "n") motivo = "Inativa no Projuris";
          const det = String(guTe.g(r, "detarefa") || guTe.g(r, "detitulo") || "").replace(/\s+/g, " ").trim();
          if (!motivo && !det) motivo = "Sem título";
          const prevista = paraData(guTe.g(r, "dtconclusaoprevista"));
          const limite = paraData(guTe.g(r, "dtlimite"));
          const base = paraData(guTe.g(r, "dtbase"));
          const data = prevista || limite || base;
          if (!motivo && !data) motivo = "Sem data de vencimento";
          if (!motivo && migradas.has(chave)) motivo = "Já migrada antes";
          if (!motivo && existentes.has(`${norm(det)}|${data}`)) motivo = "Já cadastrada nesta coordenação (mesmo título e data)";
          if (!motivo && vistosTe.has(chave)) motivo = "Repetida no backup";
          vistosTe.add(chave);
          const concluido = norm(guTe.g(r, "flconcluido")) === "s" || !!paraData(guTe.g(r, "dtconclusao"));
          const status = concluido ? "cumprido" : mapearSituacao("", data);
          const criador = usuarioNome.get(String(guTe.g(r, "cdusuariocriador") || ""))?.nome || "";
          let respId = respCache.get(criador);
          if (respId === undefined) { respId = casarNome(criador); respCache.set(criador, respId); }
          tarefasRows.push({
            chave, motivo,
            titulo: det || "(sem título)", tipo: classificarTipo(det, tipoTarefaNome.get(String(guTe.g(r, "cdtarefatipo") || "")) || ""),
            data, fatal: limite && limite !== prevista ? limite : null, status,
            conclusao: paraData(guTe.g(r, "dtconclusao")) || data, responsavelId: respId, criadorNome: criador,
          });
          if (tarefasRows.length % 5000 === 0) await ceder();
        }
      }

      // --------- 7. andamentos ---------
      setMsg("Cruzando andamentos...");
      await ceder();
      const movExistentes = new Set<string>();
      const idsProcDb = Array.from(new Set(Array.from(procDb.values())));
      for (let k = 0; k < idsProcDb.length; k += 50) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("movimentacoes").select("processo_id, data_movimentacao, descricao").in("processo_id", idsProcDb.slice(k, k + 50)).range(from, from + 999);
          if (error) throw error;
          ((data as any[]) || []).forEach((m: any) => movExistentes.add(`${m.processo_id}|${String(m.data_movimentacao).slice(0, 10)}|${norm(m.descricao)}`));
          if (!data || data.length < 1000) break;
        }
        setMsg(`Verificando andamentos existentes: ${Math.min(k + 50, idsProcDb.length)} de ${idsProcDb.length} processos`);
        await ceder();
      }
      const guAnd = gu("andamento");
      const andamentosRows: LinhaConf[] = [];
      if (guAnd) {
        const vistosAnd = new Set<string>();
        for (const r of guAnd.linhas) {
          const cd = String(guAnd.g(r, "cdandamento") || "");
          let motivo: string | null = null;
          if (!cd) motivo = "Sem identificador";
          else if (norm(guAnd.g(r, "flexclusaotipo"))) motivo = "Excluído no Projuris";
          else if (norm(guAnd.g(r, "flativo")) === "n") motivo = "Inativo no Projuris";
          const procCd = vincMap.get(cd) || "";
          const proc = procByCd.get(procCd);
          const dig = proc?.dig || "";
          if (!motivo && !procCd) motivo = "Sem vínculo no backup";
          else if (!motivo && !proc) motivo = "Processo não listado no backup";
          else if (!motivo && !dig) motivo = "Sem número CNJ";
          const processoId = dig ? (procDb.get(dig) || null) : null;
          if (!motivo && !processoId) motivo = "Processo não cadastrado (importe na aba Processos)";
          const data = paraData(guAnd.g(r, "dtandamento"));
          if (!motivo && !data) motivo = "Data inválida";
          const texto = String(guAnd.g(r, "deandamento") || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (!motivo && !texto) motivo = "Sem descrição";
          const chaveMov = `${processoId}|${data}|${norm(texto)}`;
          if (!motivo && movExistentes.has(chaveMov)) motivo = "Andamento já existe";
          if (!motivo && vistosAnd.has(chaveMov)) motivo = "Repetido no backup";
          movExistentes.add(chaveMov); vistosAnd.add(chaveMov);
          andamentosRows.push({ chave: cd, motivo, processoId, data, texto, tipoNome: andamentoTipoNome.get(String(guAnd.g(r, "cdandamentotipo") || "")) || "" });
          if (andamentosRows.length % 5000 === 0) await ceder();
        }
      }

      // --------- 8. comentários e anexos (contagem, sem vínculo no backup) ---------
      const guCom = gu("comentario");
      const guArq = gu("arquivo");
      let arqTotal = 0, arqCnj = 0;
      if (guArq) for (const r of guArq.linhas) {
        arqTotal++;
        const txt = `${guArq.g(r, "dearquivo")} ${guArq.g(r, "nmarquivoorigem")} ${guArq.g(r, "deurlexterna")} ${guArq.g(r, "decaminhoarquivo")}`;
        if (REGEX_CNJ.test(txt)) arqCnj++;
        if (arqTotal % 5000 === 0) await ceder();
      }

      setConf({
        processos: procRows, tarefas: tarefasRows, andamentos: andamentosRows,
        comentarios: guCom ? guCom.linhas.length : 0, arquivos: { total: arqTotal, comCnj: arqCnj },
        ignorados, arquivosLidos: info,
      });
    } catch (e: any) {
      toast.error(`Erro na análise: ${e?.message || e}`);
    } finally {
      setAnalisando(false); setMsg("");
    }
  };

  // ---------- Importação ----------
  const esperar = async () => { while (pausado.current && !cancelado.current) await new Promise((r) => setTimeout(r, 400)); };

  const importar = async (mod: "processos" | "tarefas" | "andamentos") => {
    if (!conf) return;
    const tituloMod = mod === "processos" ? "Processos" : mod === "tarefas" ? "Tarefas" : "Andamentos";
    cancelado.current = false; pausado.current = false;
    setRodando(mod); setProg({ feito: 0, total: 0 });
    const { data: mig, error } = await supabase.from("migracoes_projuris" as any).insert({
      coordenacao_id: coordId, nome: `Projuris Backup ${tituloMod} ${nomeCoord} ${new Date().toLocaleString("pt-BR")}`,
      mapeamento: { modulo: "backup", tabela: tituloMod }, criado_por: userId,
    }).select("id").single();
    if (error || !mig) { toast.error(error?.message || "Falha ao abrir migração"); setRodando(null); return; }
    const mid = (mig as any).id;
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) await supabase.from("migracoes_projuris_itens" as any).insert(it.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x }))); };
    const linhas = conf[mod];
    const puladas = linhas.filter((l) => l.motivo);
    const ok = linhas.filter((l) => !l.motivo);
    const tipoItem = mod === "processos" ? "processo" : mod === "tarefas" ? "tarefa" : "andamento";
    const cont: Record<string, number> = { criados: 0, pulados: puladas.length, erros: 0 };
    try {
      await log(puladas.map((l) => ({
        tipo: tipoItem, chave_externa: l.chave || null, status: "pulado", motivo: l.motivo,
        dados: { titulo: (l.titulo || l.texto || "").slice(0, 200), data: l.data || null },
      })));
      setProg({ feito: 0, total: ok.length });
      if (mod === "processos") {
        const existentes = ok.filter((l) => l.dig && conf.processos.find((x) => x.chave === l.chave));
        const procDb = new Map<string, string>();
        for (let k = 0; k < ok.length; k += 100) {
          const parte = ok.slice(k, k + 100);
          const { data, error: e } = await supabase.from("processos").select("id, numero").in("numero", parte.map((l) => formatarCnj(l.dig)));
          if (e) throw e;
          ((data as any[]) || []).forEach((p) => procDb.set(digitos(p.numero), p.id));
          await ceder();
        }
        const existentesIds = Array.from(new Set(ok.filter((l) => procDb.has(l.dig)).map((l) => procDb.get(l.dig)!)));
        for (let k = 0; k < existentesIds.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          await supabase.from("processos_coordenacoes_responsaveis").upsert(
            existentesIds.slice(k, k + LOTE).map((pid) => ({ processo_id: pid, coordenacao_id: coordId })) as any,
            { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true },
          );
          setProg({ feito: Math.min(k + LOTE, existentesIds.length), total: existentesIds.length });
        }
        await log(existentesIds.map((pid) => {
          const l = ok.find((x) => x.dig && procDb.get(x.dig) === pid);
          return { tipo: tipoItem, chave_externa: l?.chave || null, registro_id: pid, status: "existente", motivo: "Já cadastrado; coordenação vinculada", dados: { titulo: l?.dig ? formatarCnj(l.dig) : "" } };
        }));
        cont.vinculados = existentesIds.length;
        const novos = ok.filter((l) => !procDb.has(l.dig));
        for (let k = 0; k < novos.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = novos.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("processos").insert(parte.map((l) => ({
            numero: formatarCnj(l.dig), area: "civil", status: "ativo", coordenacao_id: coordId,
            identificador_projuris: String(l.cdprocesso), pasta_cliente: l.pasta || null,
            assunto: l.assunto || null, valor_causa: l.valor, data_distribuicao: l.distIso,
            observacoes_processo: l.descricao ? l.descricao.slice(0, 4000) : null,
          }) as any)).select("id, numero");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo: tipoItem, chave_externa: l.chave, status: "erro", motivo: e.message, dados: { titulo: formatarCnj(l.dig) } }))); }
          await log(((data as any[]) || []).map((p) => ({ tipo: tipoItem, chave_externa: digitos(p.numero), registro_id: p.id, status: "criado" })));
          cont.criados += ((data as any[]) || []).length;
          setProg({ feito: Math.min(k + LOTE, novos.length), total: novos.length });
        }
      } else if (mod === "tarefas") {
        for (let k = 0; k < ok.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = ok.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("tarefas").insert(parte.map((l) => ({
            titulo: String(l.titulo).slice(0, 500), tipo_tarefa: l.tipo,
            tipo_registro: l.tipo === "PRAZO" ? "prazo" : "tarefa",
            data_vencimento: l.data, data_prevista: l.data, data_fatal: l.fatal,
            status: l.status, data_cumprimento: l.status === "cumprido" ? `${l.conclusao || l.data}T12:00:00-03:00` : null,
            prioridade: "media", processo_id: null, coordenacao_id: coordId,
            responsavel_id: l.responsavelId || userId, criado_por: userId, origem: "projuris",
            identificador_projuris: String(l.chave),
            observacoes: [`Sem processo vinculado (tarefa solta do backup do Projuris)`, l.criadorNome ? `Criada por (Projuris): ${l.criadorNome}` : ""].filter(Boolean).join("\n") || null,
          }) as any)).select("id");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo: tipoItem, chave_externa: String(l.chave), status: "erro", motivo: e.message, dados: { titulo: String(l.titulo).slice(0, 200) } }))); }
          else {
            const rows = ((data as any[]) || []);
            const respList = parte.map((l) => l.responsavelId || userId);
            for (let j = 0; j < rows.length; j += 500) await supabase.from("tarefa_responsaveis").insert(rows.slice(j, j + 500).map((r, jj) => ({ tarefa_id: r.id, usuario_id: respList[j + jj] })) as any);
            await log(rows.map((r, j) => ({ tipo: tipoItem, chave_externa: String(parte[j].chave), registro_id: r.id, status: "criado", dados: { titulo: String(parte[j].titulo).slice(0, 200), tipo: parte[j].tipo, data: parte[j].data } })));
            cont.criados += rows.length;
          }
          setProg({ feito: Math.min(k + LOTE, ok.length), total: ok.length });
        }
      } else {
        for (let k = 0; k < ok.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = ok.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("movimentacoes").insert(parte.map((l) => ({
            processo_id: l.processoId, data_movimentacao: l.data, descricao: String(l.texto).slice(0, 2000),
            tipo: l.tipoNome || null, fonte: "projuris",
          }) as any)).select("id");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo: tipoItem, chave_externa: String(l.chave), status: "erro", motivo: e.message, dados: { titulo: String(l.texto).slice(0, 200) } }))); }
          else {
            const rows = ((data as any[]) || []);
            await log(rows.map((r, j) => ({ tipo: tipoItem, chave_externa: String(parte[j].chave), registro_id: r.id, status: "criado", dados: { data: parte[j].data, titulo: String(parte[j].texto).slice(0, 200) } })));
            cont.criados += rows.length;
          }
          setProg({ feito: Math.min(k + LOTE, ok.length), total: ok.length });
        }
      }
      const contadores: Record<string, number> = { ...cont };
      if (mod === "processos") contadores.processos_criados = cont.criados;
      if (mod === "tarefas") contadores.tarefas_criadas = cont.criados;
      await supabase.from("migracoes_projuris" as any).update({ status: cancelado.current ? "cancelada" : "concluida", contadores }).eq("id", mid);
      if (cancelado.current) toast.warning(`${tituloMod}: importação cancelada (${cont.criados} criados)`);
      else toast.success(`${tituloMod}: ${cont.criados} importados, ${cont.pulados} pulados${cont.vinculados ? `, ${cont.vinculados} já existentes vinculados` : ""}`);
      setFeitos((f) => ({ ...f, [mod]: true }));
      onConcluido();
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores }).eq("id", mid);
      toast.error(`Erro na importação: ${e?.message || e}`);
    } finally {
      setRodando(null);
    }
  };

  // ---------- Render ----------
  const resumo = (ls: LinhaConf[]) => {
    const m = new Map<string, number>();
    ls.forEach((l) => { const k = l.motivo || "Será importado"; m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const Secao = ({ titulo, desc, ls, mod, tipo }: { titulo: string; desc: string; ls: LinhaConf[]; mod: "processos" | "tarefas" | "andamentos"; tipo: string }) => {
    const ok = ls.filter((l) => !l.motivo).length;
    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">{titulo}</h4>
          {feitos[mod] && <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />importado</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{desc}</p>
        {resumo(ls).map(([k, n]) => (
          <div key={k} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n.toLocaleString("pt-BR")}</Badge></div>
        ))}
        {rodando === mod && prog.total > 0 && (
          <div className="space-y-1">
            <Progress value={Math.round((prog.feito / prog.total) * 100)} />
            <p className="text-xs text-muted-foreground">{prog.feito.toLocaleString("pt-BR")} de {prog.total.toLocaleString("pt-BR")}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!!rodando || !ok || !conf} onClick={() => void importar(mod)}>
            {rodando === mod ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importar {ok.toLocaleString("pt-BR")} {tipo}
          </Button>
          {rodando === mod && (
            <>
              <Button size="sm" variant="outline" onClick={() => { pausado.current = !pausado.current; setPausa(pausado.current); }}>
                {pausa ? <><Play className="mr-1 h-3 w-3" />Continuar</> : <><Pause className="mr-1 h-3 w-3" />Pausar</>}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { cancelado.current = true; pausado.current = false; }}>Cancelar</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const pct = prog.total ? Math.round((prog.feito / prog.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backup completo do Projuris</CardTitle>
          <CardDescription>
            Envie o zip com os arquivos do backup (ou os CSVs avulsos). A tela cruza tudo pelo código interno do Projuris
            e importa em três etapas independentes — cada uma pode ser desfeita pelo Histórico de migrações no rodapé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void abrir(e.dataTransfer.files); }}>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="font-medium">Arraste o backup aqui ou clique para escolher</span>
            <span className="text-xs text-muted-foreground">.zip com os CSVs do Projuris (também aceita .csv avulsos)</span>
            <input type="file" multiple className="hidden" accept=".zip,.csv,.txt" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
          </label>
          {lendo && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...</p>}
          {info.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Tabelas lidas ({info.length})</h4>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={zerar}>Limpar tudo</Button>
              </div>
              <div className="max-h-64 overflow-auto">
                {info.map((t) => (
                  <div key={t.nome} className="flex items-center gap-2 border-b py-1 text-sm">
                    <span className="font-mono text-xs">{t.nome}</span>
                    <Badge variant="secondary" className="ml-auto">{t.linhas.toLocaleString("pt-BR")} linhas</Badge>
                    <span className="hidden max-w-[280px] truncate text-xs text-muted-foreground md:inline">{t.arquivos.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ignorados > 0 && (
            <p className="text-xs text-muted-foreground">{ignorados} arquivo(s) ignorado(s): tabelas de configuração do Projuris (cidades, feriados, bancos, auditoria etc.), que não entram na migração.</p>
          )}
          <div className="flex items-center gap-3">
            <Button disabled={analisando || rodando !== null || lendo !== null || !tabelasRef.current.size} onClick={() => void analisar()}>
              {analisando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Analisar (nada é gravado)
            </Button>
            {(analisando || msg) && <span className="text-xs text-muted-foreground">{msg || "Analisando..."}</span>}
          </div>
        </CardContent>
      </Card>

      {conf && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Conferência</CardTitle>
              <CardDescription>Nada foi gravado ainda. Importe na ordem: Processos → Tarefas → Andamentos.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Secao titulo="1. Processos" ls={conf.processos} mod="processos" tipo="processos"
                desc="Cadastra os processos pelo número CNJ. Não duplica; processos já cadastrados recebem a coordenação de destino como responsável." />
              <Secao titulo="2. Tarefas" ls={conf.tarefas} mod="tarefas" tipo="tarefas"
                desc="O backup não traz a ligação tarefa → processo (o Projuris guarda isso em outra tabela que não veio). As tarefas entram soltas, com aviso, e o criador original vai nas observações." />
              <Secao titulo="3. Andamentos" ls={conf.andamentos} mod="andamentos" tipo="andamentos"
                desc="Vinculados ao processo pelo arquivo andamentovinculomodulo. Sem repetir processo + data + descrição." />
            </CardContent>
          </Card>

          {(conf.comentarios > 0 || conf.arquivos.total > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Fora desta importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {conf.comentarios > 0 && (
                  <p><strong>{conf.comentarios.toLocaleString("pt-BR")} comentários:</strong> o backup não traz a tabela que liga comentário à tarefa ou ao processo. Se conseguirmos essa tabela depois, eles podem ser importados pela aba Comentários.</p>
                )}
                {conf.arquivos.total > 0 && (
                  <p><strong>{conf.arquivos.total.toLocaleString("pt-BR")} anexos</strong> ({conf.arquivos.comCnj.toLocaleString("pt-BR")} com número de processo no nome): o backup traz só o cadastro, sem os arquivos físicos e sem a tabela de vínculos. Quando você enviar o zip com os arquivos reais, a aba Anexos liga pelo CNJ no nome.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {rodando && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm"><span>Importando...</span><span>{prog.feito.toLocaleString("pt-BR")} / {prog.total.toLocaleString("pt-BR")}</span></div>
            <Progress value={pct} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
