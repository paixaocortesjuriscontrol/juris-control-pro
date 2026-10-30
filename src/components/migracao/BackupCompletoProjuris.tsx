import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { norm, digitos, formatarCnj, paraData, classificarTipo, mapearSituacao } from "@/lib/migracaoProjuris";
import { COLUNAS_COMPLEMENTOS_PROJURIS, fontesComplementosUnicas } from "@/lib/projurisComplementos";
import { criarEnriquecedorProjuris, TABELAS_PROCESSOS_RELACIONADOS } from "@/lib/projurisProcessosRelacionados";

// Colunas mantidas de cada tabela do backup (o resto do CSV é ignorado).
// Tabela sem lista = mantém todas as colunas (arquivo pequeno).
const TABELAS: Record<string, string[] | null> = {
  processo: ["cdprocesso", "flativo", "flexclusaotipo", "dtinclusao", "dtdistribuicao", "descricao", "nmassunto", "nmpasta", "nmpastacliente", "flprocessoinstancia", "vlacao", "flsegredojustica", "desenhaprocesso", ...COLUNAS_COMPLEMENTOS_PROJURIS],
  processonumero: ["cdprocessonumero", "flativo", "denumeroprocesso", "flprocessoinstancia", "flprincipal", "flexclusaotipo", "cdprocesso"],
  tarefaevento: ["cdtarefaevento", "flativo", "flexclusaotipo", "dtinclusao", "dtbase", "dtconclusaoprevista", "dtlimite", "detarefa", "cdtarefa", "cdtarefatipo", "dtconclusao", "flconcluido", "detitulo", "deidentificador", "dtinicio", "cdusuariocriador", "cdusuarioconclusao", "flprivado"],
  tarefatipo: ["cdtarefatipo", "flativo", "detarefa"],
  andamento: ["cdandamento", "flativo", "dtandamento", "dthoraandamento", "deandamento", "cdandamentotipo", "flexclusaotipo"],
  andamentovinculomodulo: ["cdandamento", "cdmodulo", "cdregistrovinculo"],
  workflowcontrole: ["cdworkflowcontrole", "cdmodulo", "cdregistrovinculo"],
  workflowexecucao: ["cdworkflowcontrole", "cdmodulo", "cdregistrovinculo"],
  cacheintimacaotarefa: ["cdintimacao", "cdtarefa"],
  // Tabelas de vínculo enviadas pelo Projuris (22/10/2026)
  tarefavinculomodulo: ["cdtarefa", "cdmodulo", "cdregistrovinculo", "flprincipal"],
  retarefaeventousuario: ["cdtarefaevento", "cdusuario"],
  comentariovinculomodulo: ["cdcomentario", "cdmodulo", "cdregistrovinculo"],
  arquivovinculomodulo: ["cdarquivo", "cdmodulo", "cdregistrovinculo", "flprincipal"],
  reprocessousuario: ["cdprocesso", "cdusuario"],
  marcadorvinculomodulo: ["cdmarcador", "cdmodulo", "cdregistrovinculo"],
  intimacaonumeroprocesso: ["cdintimacao", "denumeroprocesso"],
  usuario: ["cdusuario", "flativo", "delogin", "cdpessoa"],
  pessoa: ["cdpessoa", "nmpessoa"],
  comentario: ["cdcomentario", "decomentario", "dtinclusao", "cdusuariocriador"],
  arquivo: ["cdarquivo", "dearquivo", "nmarquivoorigem", "deurlexterna", "decaminhoarquivo"],
  andamentotipo: null,
  ...TABELAS_PROCESSOS_RELACIONADOS,
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
  "    let pos = 0, inQ = false;",
  "    while (true) {",
  "      const { done, value } = await reader.read();",
  "      if (value) pending += dec.decode(value, { stream: true });",
  "      let start = 0;",
  "      for (; pos < pending.length; pos++) {",
  "        const c = pending.charCodeAt(pos);",
  "        if (c === 34) inQ = !inQ;",
  "        else if (c === 10 && !inQ) { handleLine(pending.slice(start, pos)); start = pos + 1; }",
  "      }",
  "      if (start > 0) { pending = pending.slice(start); pos -= start; }",
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

const excluido = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase(); return !!s && !["0", "n", "nao", "não", "false", "null", "f"].includes(s); };
const ceder = () => new Promise((r) => setTimeout(r, 0));
const CANCELADO = new Error("__cancelado__");
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
  // Relatório de Atividades do Projuris: Identificador (TAR.x) -> CNJ do processo vinculado
  const vincTarefaRef = useRef<Map<string, string>>(new Map());
  const [vincTarefas, setVincTarefas] = useState(0);
  const lerRelatorio = async (buf: ArrayBuffer, nome: string) => {
    const wb = XLSX.read(buf, { type: "array" });
    let n = 0;
    for (const aba of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[aba], { header: 1, defval: "", raw: false });
      const hi = rows.findIndex((x, i) => i < 15 && x.map(norm).includes("identificador") && x.map(norm).includes("processo vinculado"));
      if (hi < 0) continue;
      const h = rows[hi].map(norm); const ci = h.indexOf("identificador"), cp = h.indexOf("processo vinculado");
      for (const x of rows.slice(hi + 1)) {
        const id = String(x[ci] || "").trim().toUpperCase(); const d = digitos(x[cp]);
        if (id && d.length === 20) { vincTarefaRef.current.set(id, d); n++; }
      }
    }
    setVincTarefas(vincTarefaRef.current.size);
    return n;
  };
  const ehRelatorio = (n: string) => /\.xlsx?$/i.test(n);
  const [lendo, setLendo] = useState<string | null>(null);
  const [conf, setConf] = useState<Conf | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState<string | null>(null);
  const [prog, setProg] = useState({ feito: 0, total: 0 });
  const [feitos, setFeitos] = useState<Record<string, boolean>>({});
  type Resultado = { status: "ok" | "cancelado" | "erro"; criados: number; pulados: number; erros: number; vinculados: number; msg?: string; quando: string };
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [recuperacao, setRecuperacao] = useState("");
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
    cancelado.current = false;
    setConf(null); setAnalisando(false);
    for (const f of Array.from(files)) {
      if (cancelado.current) break;
      try {
        if (f.name.toLowerCase().endsWith(".zip")) {
          setLendo(`${f.name} (listando...)`);
          const reader = new ZipReader(new BlobReader(f));
          const entries = (await reader.getEntries()).filter((e) => !e.directory);
          let usados = 0;
          for (const e of entries) {
            if (cancelado.current) break;
            if (ehRelatorio(e.filename)) {
              setLendo(e.filename);
              const b: Blob = await (e as any).getData(new BlobWriter());
              if (await lerRelatorio(await b.arrayBuffer(), e.filename)) usados++; else setIgnorados((i) => i + 1);
              continue;
            }
            const base = baseNome(e.filename);
            if (!(base in TABELAS)) { setIgnorados((i) => i + 1); continue; }
            setLendo(`${e.filename}`);
            const blob: Blob = await (e as any).getData(new BlobWriter());
            await lerTabela(base, blob, e.filename);
            usados++;
            setInfo(Array.from(tabelasRef.current.entries()).map(([n, t]) => ({ nome: n, linhas: t.linhas.length, arquivos: t.arquivos })));
          }
          if (!usados) toast.warning(`${f.name}: nenhuma tabela do Projuris reconhecida dentro do zip`);
        } else if (ehRelatorio(f.name)) {
          setLendo(f.name);
          const n = await lerRelatorio(await f.arrayBuffer(), f.name);
          if (!n) toast.warning(`${f.name}: não encontrei as colunas "Identificador" e "Processo Vinculado"`);
          else toast.success(`${f.name}: ${n} tarefas com processo vinculado`);
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
    if (cancelado.current) {
      cancelado.current = false;
      toast.warning("Leitura cancelada. O que já foi lido continua disponível — use “Limpar tudo” para começar de novo.");
    }
    setLendo(null);
  };

  const zerar = () => {
    tabelasRef.current = new Map(); vincTarefaRef.current = new Map(); setVincTarefas(0);
    setInfo([]); setIgnorados(0); setConf(null);
  };

  // ---------- Análise (nada é gravado) ----------
  const gu = (base: string) => {
    const t = tabelasRef.current.get(base);
    if (!t || !t.linhas.length) return null;
    const idx = new Map<string, number>();
    t.colunas.forEach((c, i) => { if (!idx.has(c)) idx.set(c, i); });
    return { linhas: t.linhas, colunas: t.colunas, g: (r: string[], c: string) => { const i = idx.get(c); return i === undefined || i >= r.length ? "" : r[i]; } };
  };

  const casarNome = (n: string) => {
    const k = norm(n); if (!k) return null;
    const ex = usuarios.find((u) => norm(u.nome) === k); if (ex) return ex.id;
    const t = k.split(" ");
    const p = usuarios.filter((u) => { const ut = norm(u.nome).split(" "); return ut[0] === t[0] && ut.includes(t[t.length - 1]); });
    return p.length === 1 ? p[0].id : null;
  };

  const dadosRelacionados = () => Object.fromEntries(Array.from(tabelasRef.current.entries()).map(([nome, t]) => [nome, t.linhas.map(r => Object.fromEntries(t.colunas.map((c, i) => [c, r[i] ?? ""])))]));

  const recuperarComplementos = async () => {
    const proc = gu("processo"); const nums = gu("processonumero");
    if (!proc || !nums) { toast.error("Envie processo.csv e processonumero.csv do backup."); return; }
    const registros = (t: NonNullable<ReturnType<typeof gu>>) => t.linhas.map(r => Object.fromEntries(t.colunas.map(c => [c, t.g(r, c)])));
    const { fontes, ambiguos } = fontesComplementosUnicas(registros(proc), registros(nums), criarEnriquecedorProjuris(dadosRelacionados()));
    if (!fontes.length) { toast.error("Nenhuma origem única disponível para recuperação."); return; }
    setRodando("complementos"); setRecuperacao(""); setProg({ feito: 0, total: fontes.length });
    let mid: string | undefined; let recuperados = 0; let ausentes = 0; let duplicados = ambiguos;
    try {
      const { data: mig, error } = await supabase.from("migracoes_projuris").insert({
        coordenacao_id: coordId, criado_por: userId, nome: `Recuperação de complementos Projuris — ${nomeCoord}`,
        mapeamento: { modulo: "recuperacao_complementos", tabela: "Complementos", somente_vazios: true },
      }).select("id").single();
      if (error || !mig) throw error ?? new Error("Não foi possível abrir a recuperação.");
      mid = (mig as { id: string }).id;
      for (let k = 0; k < fontes.length; k += LOTE) {
        const { data, error: e } = await supabase.rpc("recuperar_complementos_projuris", { _migracao_id: mid, _fontes: fontes.slice(k, k + LOTE) });
        if (e) throw e;
        const r = data as { recuperados?: number; ausentes?: number; ambiguos?: number } | null;
        recuperados += r?.recuperados ?? 0; ausentes += r?.ausentes ?? 0; duplicados += r?.ambiguos ?? 0;
        setProg({ feito: Math.min(k + LOTE, fontes.length), total: fontes.length }); await ceder();
      }
      const { error: fim } = await supabase.from("migracoes_projuris" as any).update({ status: "concluida", contadores: { recuperados, ausentes, ambiguos: duplicados } }).eq("id", mid);
      if (fim) throw fim;
      setRecuperacao(`${recuperados.toLocaleString("pt-BR")} processos recuperados · ${ausentes.toLocaleString("pt-BR")} sem vínculo na migração desta coordenação · ${duplicados.toLocaleString("pt-BR")} ambíguos preservados`);
      onConcluido(); toast.success("Recuperação concluída; informações preenchidas foram preservadas.");
    } catch (e: unknown) {
      if (mid) await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: { recuperados, ausentes, ambiguos: duplicados } }).eq("id", mid);
      toast.error(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      onConcluido();
    } finally { setRodando(null); }
  };

  const analisar = async () => {
    if (!tabelasRef.current.size) return;
    setAnalisando(true); cancelado.current = false;
    try {
      // --------- 1. números de processo ---------
      setMsg("Cruzando processos...");
      await ceder();
      const procNum = new Map<string, { dig: string; sc: number }>();
      const enriquecer = criarEnriquecedorProjuris(dadosRelacionados());
      const guNum = gu("processonumero");
      if (guNum) for (const r of guNum.linhas) {
        if (excluido(guNum.g(r, "flexclusaotipo"))) continue;
        const dig = digitos(guNum.g(r, "denumeroprocesso"));
        if (dig.length !== 20) continue;
        const cd = String(guNum.g(r, "cdprocesso") || ""); if (!cd) continue;
        const sc = (norm(guNum.g(r, "flprincipal")) === "s" ? 2 : 0) + (norm(guNum.g(r, "flprocessoinstancia")).includes("primeira") ? 1 : 0);
        const cur = procNum.get(cd);
        if (!cur || sc > cur.sc) procNum.set(cd, { dig, sc });
        if (procNum.size % 8000 === 0) { await ceder(); if (cancelado.current) throw CANCELADO; }
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
        const nomeCol = guTipoA.colunas.includes("nmandamentotipo") ? "nmandamentotipo" : guTipoA.colunas.includes("deandamentotipo") ? "deandamentotipo" : (guTipoA.colunas.find((c) => c.startsWith("de") && c !== idCol) || guTipoA.colunas[1] || "");
        for (const r of guTipoA.linhas) andamentoTipoNome.set(String(guTipoA.g(r, idCol) || ""), String(guTipoA.g(r, nomeCol) || ""));
      }
      // --------- 4. vínculos de andamentos ---------
      const vincMap = new Map<string, string>();
      const guVinc = gu("andamentovinculomodulo");
      if (guVinc) for (const r of guVinc.linhas) if (norm(guVinc.g(r, "cdmodulo")) === "3") vincMap.set(String(guVinc.g(r, "cdandamento") || ""), String(guVinc.g(r, "cdregistrovinculo") || ""));
      // --------- 4b. tarefas criadas por fluxo: workflowexecucao (módulo 4) → workflowcontrole (módulo 3 = processo) ---------
      const controleProc = new Map<string, string>();
      const guWc = gu("workflowcontrole");
      if (guWc) for (const r of guWc.linhas) if (norm(guWc.g(r, "cdmodulo")) === "3") controleProc.set(String(guWc.g(r, "cdworkflowcontrole") || ""), String(guWc.g(r, "cdregistrovinculo") || ""));
      const tarefaProc = new Map<string, string>();
      // vínculo oficial: tarefavinculomodulo (cdtarefa → processo, módulo 3); cdtarefa = tarefaevento.cdtarefa
      const tarefaVincProc = new Map<string, string>();
      const guTv = gu("tarefavinculomodulo");
      if (guTv) for (const r of guTv.linhas) if (norm(guTv.g(r, "cdmodulo")) === "3") tarefaVincProc.set(String(guTv.g(r, "cdtarefa") || ""), String(guTv.g(r, "cdregistrovinculo") || ""));
      // responsáveis: retarefaeventousuario (cdtarefaevento → cdusuario)
      const respTarefa = new Map<string, string[]>();
      const guRu = gu("retarefaeventousuario");
      if (guRu) for (const r of guRu.linhas) {
        const k = String(guRu.g(r, "cdtarefaevento") || ""); const u = usuarioNome.get(String(guRu.g(r, "cdusuario") || ""))?.nome;
        if (k && u) respTarefa.set(k, [...(respTarefa.get(k) || []), u]);
      }
      const guWe = gu("workflowexecucao");
      if (guWe) for (const r of guWe.linhas) if (norm(guWe.g(r, "cdmodulo")) === "4") {
        const p = controleProc.get(String(guWe.g(r, "cdworkflowcontrole") || ""));
        if (p) tarefaProc.set(String(guWe.g(r, "cdregistrovinculo") || ""), p);
      }

      // --------- 5. processos (linhas do módulo) ---------
      const procRows: LinhaConf[] = [];
      const procByCd = new Map<string, { cdprocesso: string; dig: string | null }>();
      const guProc = gu("processo");
      const vistosDig = new Set<string>();
      if (guProc) for (const r of guProc.linhas) {
        const cd = String(guProc.g(r, "cdprocesso") || ""); if (!cd) continue;
        let motivo: string | null = null;
        if (excluido(guProc.g(r, "flexclusaotipo"))) motivo = "Excluído no Projuris";
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
          complementos: enriquecer(Object.fromEntries(guProc.colunas.map(c => [c, guProc.g(r, c)]))),
        };
        procRows.push(item);
        if (!motivo) procByCd.set(cd, { cdprocesso: cd, dig });
        if (procRows.length % 5000 === 0) { await ceder(); if (cancelado.current) throw CANCELADO; }
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
        await ceder(); if (cancelado.current) throw CANCELADO;
      }

      // --------- 6. tarefas ---------
      setMsg("Cruzando tarefas...");
      await ceder(); if (cancelado.current) throw CANCELADO;
      const migradas = new Set<string>();
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
          await ceder(); if (cancelado.current) throw CANCELADO;
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
        if (cancelado.current) throw CANCELADO;
      }
      const tarefasRows: LinhaConf[] = [];
      const respCache = new Map<string, string | null>();
      if (guTe) {
        const vistosTe = new Set<string>();
        for (const r of guTe.linhas) {
          const chave = String(guTe.g(r, "cdtarefaevento") || "");
          let motivo: string | null = null;
          if (!chave) motivo = "Sem identificador";
          else if (excluido(guTe.g(r, "flexclusaotipo"))) motivo = "Excluída no Projuris";
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
          const casar = (n: string) => { let id = respCache.get(n); if (id === undefined) { id = casarNome(n); respCache.set(n, id); } return id; };
          const respsProjuris = (respTarefa.get(chave) || []).map(casar).filter(Boolean) as string[];
          const respId = respsProjuris[0] || casar(criador);
          const ident = String(guTe.g(r, "deidentificador") || "").trim().toUpperCase();
          const cpVinc = tarefaVincProc.get(String(guTe.g(r, "cdtarefa") || ""));
          const procDig = (cpVinc ? procNum.get(cpVinc)?.dig || null : null) || vincTarefaRef.current.get(ident) || (() => { const cp = tarefaProc.get(chave); return cp ? procNum.get(cp)?.dig || null : null; })();
          tarefasRows.push({
            chave, motivo, ident, procDig, cdTipo: String(guTe.g(r, "cdtarefatipo") || "").trim(),
            titulo: det || "(sem título)", tipo: classificarTipo(det, tipoTarefaNome.get(String(guTe.g(r, "cdtarefatipo") || "")) || ""),
            data, fatal: limite && limite !== prevista ? limite : null, status,
            conclusao: paraData(guTe.g(r, "dtconclusao")) || data, responsavelId: respId, outrosResp: respsProjuris.filter((x) => x !== respId), criadorNome: criador,
          });
          if (tarefasRows.length % 5000 === 0) { await ceder(); if (cancelado.current) throw CANCELADO; }
        }
      }

      // --------- 7. andamentos ---------
      setMsg("Cruzando andamentos...");
      await ceder(); if (cancelado.current) throw CANCELADO;
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
        await ceder(); if (cancelado.current) throw CANCELADO;
      }
      const guAnd = gu("andamento");
      const andamentosRows: LinhaConf[] = [];
      if (guAnd) {
        const vistosAnd = new Set<string>();
        for (const r of guAnd.linhas) {
          const cd = String(guAnd.g(r, "cdandamento") || "");
          let motivo: string | null = null;
          if (!cd) motivo = "Sem identificador";
          else if (excluido(guAnd.g(r, "flexclusaotipo"))) motivo = "Excluído no Projuris";
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
          if (andamentosRows.length % 5000 === 0) { await ceder(); if (cancelado.current) throw CANCELADO; }
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
        if (arqTotal % 5000 === 0) { await ceder(); if (cancelado.current) throw CANCELADO; }
      }

      setConf({
        processos: procRows, tarefas: tarefasRows, andamentos: andamentosRows,
        comentarios: guCom ? guCom.linhas.length : 0, arquivos: { total: arqTotal, comCnj: arqCnj },
        ignorados, arquivosLidos: info,
      });
    } catch (e: any) {
      if (cancelado.current) { cancelado.current = false; toast.warning("Análise cancelada. Nada foi gravado."); }
      else toast.error(`Erro na análise: ${e?.message || e}`);
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
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) {
      const { error: logError } = await supabase.from("migracoes_projuris_itens" as any).insert(it.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x })));
      if (logError) throw logError;
    } };
    const linhas = conf[mod];
    const puladas = linhas.filter((l) => l.motivo);
    const ok = linhas.filter((l) => !l.motivo);
    const tipoItem = mod === "processos" ? "processo" : mod === "tarefas" ? "tarefa" : "andamento";
    const cont: Record<string, number> = { criados: 0, pulados: puladas.length, erros: 0 };
    const contadores: Record<string, number> = { ...cont };
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
          const { data, error: e } = await supabase.from("processos").select("id, numero").in("numero", parte.flatMap(l => [l.dig, formatarCnj(l.dig)]));
          if (e) throw e;
          ((data as any[]) || []).forEach((p) => procDb.set(digitos(p.numero), p.id));
          await ceder();
        }
        const existentesIds = Array.from(new Set(ok.flatMap(l => { const id = procDb.get(l.dig); return id ? [id] : []; })));
        for (let k = 0; k < existentesIds.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const { error: vinculoErro } = await supabase.from("processos_coordenacoes_responsaveis").upsert(
            existentesIds.slice(k, k + LOTE).map((pid) => ({ processo_id: pid, coordenacao_id: coordId })) as any,
            { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true },
          );
          if (vinculoErro) throw vinculoErro;
          setProg({ feito: Math.min(k + LOTE, existentesIds.length), total: existentesIds.length });
        }
        await log(existentesIds.map((pid) => {
          const l = ok.find((x) => x.dig && procDb.get(x.dig) === pid);
          return { tipo: tipoItem, chave_externa: l?.chave || null, registro_id: pid, status: "existente", motivo: "Já cadastrado; coordenação vinculada", dados: { titulo: l?.dig ? formatarCnj(l.dig) : "" } };
        }));
        cont.vinculados = existentesIds.length;
        const fontesExistentes = ok.filter(l => procDb.has(l.dig)).map(l => ({ cd: String(l.cdprocesso), cnj: l.dig, campos: l.complementos }));
        for (let k = 0; k < fontesExistentes.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const { data: res, error: recErro } = await supabase.rpc("recuperar_complementos_projuris", { _migracao_id: mid, _fontes: fontesExistentes.slice(k, k + LOTE) });
          if (recErro) throw recErro;
          const resultado = res as { recuperados?: number } | null;
          cont.recuperados = (cont.recuperados || 0) + (resultado?.recuperados || 0);
          await ceder();
        }
        const novos = ok.filter((l) => !procDb.has(l.dig));
        for (let k = 0; k < novos.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = novos.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("processos").insert(parte.map((l) => ({
            numero: formatarCnj(l.dig), area: "civil", status: "ativo", coordenacao_id: coordId,
            identificador_projuris: String(l.cdprocesso), ...l.complementos,
          }) as any)).select("id, numero");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo: tipoItem, chave_externa: l.chave, status: "erro", motivo: e.message, dados: { titulo: formatarCnj(l.dig) } }))); }
          await log(((data as any[]) || []).map((p) => ({ tipo: tipoItem, chave_externa: digitos(p.numero), registro_id: p.id, status: "criado", dados: { complementos: parte.find(l => l.dig === digitos(p.numero))?.complementos } })));
          cont.criados += ((data as any[]) || []).length;
          setProg({ feito: Math.min(k + LOTE, novos.length), total: novos.length });
        }
      } else if (mod === "tarefas") {
        // Tipo original do Projuris → Modelo de tarefa (padroes.projuris_cd) da coordenação
        const modeloPorCd = new Map<string, string>();
        {
          const { data: mods } = await (supabase as any).from("modelos_titulo_coordenacao").select("id,padroes").eq("coordenacao_id", coordId);
          for (const m of mods || []) { const cd = m.padroes?.projuris_cd; if (cd) modeloPorCd.set(String(cd), m.id); }
        }
        const modeloDe = (l: any) => (l.cdTipo && modeloPorCd.get(l.cdTipo)) || null;
        // Tarefas já migradas antes: grava o tipo original nelas também
        {
          const porModelo = new Map<string, string[]>();
          for (const l of tarefasRowsRef.current) { const m = modeloDe(l); if (m) { if (!porModelo.has(m)) porModelo.set(m, []); porModelo.get(m)!.push(String(l.chave)); } }
          for (const [mid, chaves] of porModelo) for (let k = 0; k < chaves.length; k += 100) {
            await (supabase as any).from("tarefas").update({ modelo_tarefa_id: mid }).eq("coordenacao_id", coordId).eq("origem", "projuris").is("modelo_tarefa_id", null).in("identificador_projuris", chaves.slice(k, k + 100));
          }
        }
        const procId = new Map<string, string>();
        const dgs = Array.from(new Set(ok.map((l) => l.procDig).filter(Boolean))) as string[];
        for (let k = 0; k < dgs.length; k += 100) {
          const parte = dgs.slice(k, k + 100);
          const { data, error: e } = await supabase.from("processos").select("id, numero").in("numero", [...parte, ...parte.map(formatarCnj)]);
          if (e) throw e;
          ((data as any[]) || []).forEach((p) => procId.set(digitos(p.numero), p.id));
        }
        for (let k = 0; k < ok.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = ok.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("tarefas").insert(parte.map((l) => ({
            titulo: String(l.titulo).slice(0, 500), tipo_tarefa: l.tipo,
            tipo_registro: l.tipo === "PRAZO" ? "prazo" : "tarefa",
            data_vencimento: l.data, data_prevista: l.data, data_fatal: l.fatal,
            status: l.status, data_cumprimento: l.status === "cumprido" ? `${l.conclusao || l.data}T12:00:00-03:00` : null,
            prioridade: "media", processo_id: (l.procDig && procId.get(l.procDig)) || null, coordenacao_id: coordId,
            responsavel_id: l.responsavelId || userId, criado_por: userId, origem: "projuris",
            identificador_projuris: String(l.chave), modelo_tarefa_id: modeloDe(l),
            observacoes: [l.procDig && procId.get(l.procDig) ? "" : l.procDig ? `Processo ${formatarCnj(l.procDig)} não cadastrado no Juris Control (importe os processos antes)` : `Sem processo vinculado no Relatório de Atividades`, l.ident ? `Identificador Projuris: ${l.ident}` : "", l.criadorNome ? `Criada por (Projuris): ${l.criadorNome}` : ""].filter(Boolean).join("\n") || null,
          }) as any)).select("id");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo: tipoItem, chave_externa: String(l.chave), status: "erro", motivo: e.message, dados: { titulo: String(l.titulo).slice(0, 200) } }))); }
          else {
            const rows = ((data as any[]) || []);
            const respRows = rows.flatMap((r, j) => Array.from(new Set([parte[j].responsavelId || userId, ...((parte[j].outrosResp as string[]) || [])])).map((u) => ({ tarefa_id: r.id, usuario_id: u })));
            for (let j = 0; j < respRows.length; j += 500) await supabase.from("tarefa_responsaveis").insert(respRows.slice(j, j + 500) as any);
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
      const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      setResultados((r) => ({ ...r, [mod]: { status: cancelado.current ? "cancelado" : "ok", criados: cont.criados, pulados: cont.pulados, erros: cont.erros, vinculados: cont.vinculados || 0, quando } }));
      if (!cancelado.current) setFeitos((f) => ({ ...f, [mod]: true }));
      onConcluido();
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores }).eq("id", mid);
      toast.error(`Erro na importação: ${e?.message || e}`);
      const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      setResultados((r) => ({ ...r, [mod]: { status: "erro", criados: cont.criados, pulados: cont.pulados, erros: cont.erros, vinculados: cont.vinculados || 0, msg: String(e?.message || e), quando } }));
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
        {rodando !== mod && resultados[mod] && (() => {
          const r = resultados[mod];
          const cor = r.status === "ok" && !r.erros ? "border-emerald-600 bg-emerald-50 text-emerald-900" : r.status === "erro" || r.erros ? "border-destructive bg-destructive/10 text-destructive" : "border-amber-500 bg-amber-50 text-amber-900";
          const tit = r.status === "ok" ? (r.erros ? "Importação concluída com erros" : "Importação concluída com sucesso") : r.status === "cancelado" ? "Importação cancelada" : "Importação interrompida por erro";
          return (
            <div className={`rounded-md border-2 p-3 text-sm ${cor}`}>
              <div className="flex items-center gap-2 font-semibold">{r.status === "ok" && !r.erros ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{tit} — {r.quando}</div>
              <p className="mt-1">
                {r.criados.toLocaleString("pt-BR")} {tipo} importados
                {r.vinculados ? ` · ${r.vinculados.toLocaleString("pt-BR")} já existentes vinculados à coordenação` : ""}
                {` · ${r.pulados.toLocaleString("pt-BR")} pulados`}
                {r.erros ? ` · ${r.erros.toLocaleString("pt-BR")} com erro` : ""}
              </p>
              {r.msg && <p className="mt-1 text-xs">{r.msg}</p>}
              <p className="mt-1 text-xs opacity-80">O detalhe de cada item está no Histórico de migrações, no rodapé da tela.</p>
            </div>
          );
        })()}
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
            <input type="file" multiple className="hidden" accept=".zip,.csv,.txt,.xlsx,.xls" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
          </label>
          {lendo && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...
              <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => { cancelado.current = true; }}>Cancelar leitura</Button>
            </p>
          )}
          {info.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Tabelas lidas ({info.length})</h4>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!!lendo || analisando || rodando !== null} onClick={zerar}>Limpar tudo</Button>
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
            <p className="text-xs text-muted-foreground">{ignorados} arquivo(s) não utilizados nesta etapa.</p>
          )}
          <div className="flex items-center gap-3">
            <Button disabled={analisando || rodando !== null || lendo !== null || !tabelasRef.current.size} onClick={() => void analisar()}>
              {analisando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Analisar (nada é gravado)
            </Button>
              {analisando && <Button size="sm" variant="destructive" onClick={() => { cancelado.current = true; }}>Cancelar análise</Button>}
              {(analisando || msg) && <span className="text-xs text-muted-foreground">{msg || "Analisando..."}</span>}
          </div>
          {info.some(t => t.nome === "processo") && info.some(t => t.nome === "processonumero") && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-sm font-semibold">Complementos disponíveis</h4>
              <div className="divide-y text-sm">
                {[
                  ["Justiça e órgão judicial", ["processojustica", "processoorgao"]],
                  ["Comarca e UF", ["cidade", "estado"]],
                  ["Número e tipo de vara", ["processovaranumero", "processovaratipo"]],
                  ["Classe, fase e área", ["classecnj", "processofase", "processoarea"]],
                  ["Partes e tipos de participação", ["processoparticipacaotipo", "pessoa", "participacaotipo"]],
                  ["Responsáveis de origem", ["reprocessousuario", "usuario", "pessoa"]],
                  ["Campos personalizados", ["campodinamico", "campodinamicodado"]],
                  ["Pedidos", ["processopedido"]],
                ].map(([label, tables]) => {
                  const missing = (tables as string[]).filter(n => !info.some(t => t.nome === n));
                  return <div key={String(label)} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <span>{String(label)}</span>
                    <span className="max-w-full break-words text-xs text-muted-foreground">{missing.length ? `Arquivos ausentes: ${missing.map(n => `${n}.csv`).join(", ")}` : "Arquivos carregados"}</span>
                  </div>;
                })}
              </div>
              <Button variant="outline" disabled={analisando || !!rodando || !!lendo} onClick={() => void recuperarComplementos()}>
                {rodando === "complementos" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Recuperar complementos
              </Button>
              {recuperacao && <p className="text-sm text-muted-foreground">{recuperacao}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {conf && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Conferência</CardTitle>
              <CardDescription>Nada foi gravado ainda. Importe na ordem: Processos → Tarefas → Andamentos.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Secao titulo="1. Processos" ls={conf.processos} mod="processos" tipo="processos"
                desc={`${conf.processos.filter(l => !l.motivo && Object.keys(l.complementos || {}).length > 0).length.toLocaleString("pt-BR")} processos com complementos disponíveis; campos preenchidos são preservados.`} />
              <Secao titulo="2. Tarefas" ls={conf.tarefas} mod="tarefas" tipo="tarefas"
                desc={`A ligação tarefa → processo vem da tabela tarefavinculomodulo do Projuris (prioritária); sem ela, do Relatório de Atividades, dos fluxos e das intimações. Responsáveis vêm de retarefaeventousuario. ${conf.tarefas.filter((l) => l.procDig).length.toLocaleString("pt-BR")} tarefas do backup foram ligadas a processo.`} />
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
                  <p><strong>{conf.comentarios.toLocaleString("pt-BR")} comentários:</strong> a ligação vem da tabela comentariovinculomodulo. Os comentários das tarefas já migradas foram importados em 22/10/2026; tarefas novas recebem os comentários pela equipe técnica.</p>
                )}
                {conf.arquivos.total > 0 && (
                  <p><strong>{conf.arquivos.total.toLocaleString("pt-BR")} anexos</strong> no cadastro do backup: são importados na etapa <strong>4. Anexos</strong> abaixo, usando o Mapeamento de Arquivos do Projuris e os zips. Anexos fora do mapeamento ficam sem vínculo.</p>
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
