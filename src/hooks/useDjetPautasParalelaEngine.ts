/**
 * DJET Pautas Paralela Engine v1.0
 *
 * Motor independente da DJEN Termos Paralela para captura de PAUTAS DE
 * JULGAMENTO da Justiça do Trabalho (DEJT). Para cada (tribunal, dia)
 * chama a edge function `buscar-dejt-pautas`, que baixa o PDF do caderno
 * Judiciário, extrai texto e devolve os blocos de pauta que casam com
 * os termos dos monitoramentos.
 *
 * Os matches são gravados em `publicacoes_djen` com `tipo_publicacao='pauta'`
 * e `fonte='dejt-pdf'`, reutilizando o pipeline de análise/notificações.
 *
 * Arquitetura:
 *  - Singleton em memória + persistência leve em localStorage (checkpoint)
 *  - Loop tribunal→dia, até MAX_CONCURRENCY tribunais em paralelo
 *  - Tracks com barra de progresso individual
 *  - Sem dependência do PJe Comunica, sem proxies — DEJT é público
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TIPOS
// ============================================================================

export type TrackStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";

export interface TrackProgress {
  tribunal: string;
  status: TrackStatus;
  current: number;
  total: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  diasSemPdf: number;
  mensagem: string;
  diaAtual: string | null;
  ultimoErro: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface DjetPautasParalelaProgress {
  status: "idle" | "executando" | "concluido" | "cancelado" | "erro";
  tracks: TrackProgress[];
  totalTribunais: number;
  tribunaisConcluidos: number;
  novas: number;
  duplicadas: number;
  descartadas: number;
  percentage: number;
  mensagem: string;
  tempoDecorrido: number;
  iniciadoEm: string | null;
  dataInicioYmd: string | null;
  dataFimYmd: string | null;
  concorrencia: number;
}

interface Monitoramento {
  id: string;
  tipo: "palavra-chave" | "advogado" | "processo" | "parte";
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  exclusoes?: string[];
  tribunais?: string[];
  termos_or?: string[];
  condicao_concomitante?: string | null;
  coordenacao_id?: string | null;
}

interface Checkpoint {
  runKey: string;
  dataInicioYmd: string;
  dataFimYmd: string;
  tribunaisConcluidos: string[];
  novas: number;
  duplicadas: number;
  descartadas: number;
  tempoInicio: number;
}

// ============================================================================
// CONFIG
// ============================================================================

export const MAX_CONCURRENCY = 1;
const CHECKPOINT_KEY = "djet-pautas-paralela-checkpoint-v1";
const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000;
const DELAY_BETWEEN_DAYS_MS = 800;

const TRIBUNAIS_DEJT = [
  "TST",
  "TRT1", "TRT2", "TRT3", "TRT4", "TRT5", "TRT6", "TRT7", "TRT8",
  "TRT9", "TRT10", "TRT11", "TRT12", "TRT13", "TRT14", "TRT15",
  "TRT16", "TRT17", "TRT18", "TRT19", "TRT20", "TRT21", "TRT22",
  "TRT23", "TRT24",
];

// ============================================================================
// ESTADO SINGLETON
// ============================================================================

const initialProgress = (): DjetPautasParalelaProgress => ({
  status: "idle",
  tracks: [],
  totalTribunais: 0,
  tribunaisConcluidos: 0,
  novas: 0,
  duplicadas: 0,
  descartadas: 0,
  percentage: 0,
  mensagem: "",
  tempoDecorrido: 0,
  iniciadoEm: null,
  dataInicioYmd: null,
  dataFimYmd: null,
  concorrencia: MAX_CONCURRENCY,
});

let progress: DjetPautasParalelaProgress = initialProgress();
let running = false;
let abortRequested = false;
const subscribers = new Set<(p: DjetPautasParalelaProgress) => void>();

function notify() {
  const snapshot = { ...progress, tracks: progress.tracks.map((t) => ({ ...t })) };
  subscribers.forEach((cb) => {
    try { cb(snapshot); } catch (e) { console.error(e); }
  });
}

function setProgress(patch: Partial<DjetPautasParalelaProgress>) {
  progress = { ...progress, ...patch };
  notify();
}

function updateTrack(tribunal: string, patch: Partial<TrackProgress>) {
  const idx = progress.tracks.findIndex((t) => t.tribunal === tribunal);
  if (idx < 0) return;
  progress.tracks[idx] = { ...progress.tracks[idx], ...patch };
  recomputeAggregate();
  notify();
}

function recomputeAggregate() {
  const total = progress.tracks.reduce((acc, t) => acc + t.total, 0);
  const current = progress.tracks.reduce((acc, t) => acc + t.current, 0);
  const novas = progress.tracks.reduce((acc, t) => acc + t.novas, 0);
  const duplicadas = progress.tracks.reduce((acc, t) => acc + t.duplicadas, 0);
  const descartadas = progress.tracks.reduce((acc, t) => acc + t.descartadas, 0);
  const tribConcluidos = progress.tracks.filter(
    (t) => t.status === "concluido" || t.status === "erro" || t.status === "cancelado",
  ).length;
  progress.percentage = total > 0 ? Math.floor((current / total) * 100) : 0;
  progress.tribunaisConcluidos = tribConcluidos;
  progress.novas = novas;
  progress.duplicadas = duplicadas;
  progress.descartadas = descartadas;
}

// ============================================================================
// CHECKPOINT (localStorage)
// ============================================================================

function saveCheckpoint(cp: Checkpoint) {
  try {
    localStorage.setItem(
      CHECKPOINT_KEY,
      JSON.stringify({ ...cp, savedAt: Date.now() }),
    );
  } catch (e) { console.warn("[DJET-Paralela] checkpoint save error", e); }
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.savedAt || Date.now() - obj.savedAt > CHECKPOINT_TTL_MS) {
      localStorage.removeItem(CHECKPOINT_KEY);
      return null;
    }
    delete obj.savedAt;
    return obj as Checkpoint;
  } catch { return null; }
}

function clearCheckpoint() {
  try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* ignore */ }
}

// ============================================================================
// HELPERS
// ============================================================================

function ymdToDdmmyyyy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function buildDateRange(inicioYmd: string, fimYmd: string): string[] {
  const out: string[] = [];
  const start = new Date(`${inicioYmd}T12:00:00Z`);
  const end = new Date(`${fimYmd}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${da}`);
  }
  return out;
}

function getTodayYmdBrt(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function fetchActiveMonitoramentos(
  coordenacaoId?: string,
  ids?: string[],
): Promise<Monitoramento[]> {
  let q = supabase
    .from("monitoramentos_djen")
    .select("id, tipo, termo_busca, oab, uf, ativo, exclusoes, tribunais, termos_or, condicao_concomitante, coordenacao_id")
    .eq("ativo", true);
  if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
  if (ids && ids.length > 0) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as Monitoramento[];
}

/**
 * Filtra monitoramentos relevantes para um tribunal trabalhista específico.
 * Se o monitoramento define `tribunais`, só entra se a sigla bater. Se não
 * define, é considerado global e entra em todos os tribunais.
 */
function monitoramentosParaTribunal(monits: Monitoramento[], tribunal: string): Monitoramento[] {
  return monits.filter((m) => {
    if (!m.tribunais || m.tribunais.length === 0) return true;
    return m.tribunais.some((t) => (t || "").toUpperCase() === tribunal);
  });
}

function monitoramentoToInput(m: Monitoramento): {
  id: string;
  termos: string[];
  condicaoConcomitante?: string | null;
  exclusoes?: string[];
  oab?: string;
  coordenacao_id?: string | null;
} {
  const termos: string[] = [];
  if (m.termo_busca) termos.push(m.termo_busca);
  // Pautas usam o MESMO formato do DJEN Termos para concomitância:
  // `condicao_concomitante` é uma string "GRUPO1 | GRUPO2", onde
  // `|` é OR entre grupos e `,` é AND dentro do grupo.
  // Ex.: "OSMAR MENDES | LEANDRO ARTIAGA" exige um desses no bloco da pauta.
  return {
    id: m.id,
    termos,
    condicaoConcomitante: m.condicao_concomitante || undefined,
    exclusoes: m.exclusoes || [],
    oab: m.oab || undefined,
    coordenacao_id: m.coordenacao_id ?? null,
  };
}

function normalizeDjetText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CNJ_REGEX = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
const CNJ_REGEX_GLOBAL = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
const MAX_BLOCO_CHARS = 400_000;
const MAX_BUF_FLUSH_CHARS = 800_000;
const PAUTA_MARKERS = [
  "PAUTA DE JULGAMENTO",
  "PAUTAS DE JULGAMENTO",
  "SESSÃO ORDINÁRIA",
  "SESSÃO EXTRAORDINÁRIA",
  "SESSÃO TELEPRESENCIAL",
  "SESSÃO DE JULGAMENTO",
  "PAUTA DA SESSÃO",
];

function makePautaStreamSegmenter() {
  const escaped = PAUTA_MARKERS.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const markerRe = new RegExp(`(${escaped})`, "gi");
  let buf = "";
  let inBlock = false;

  function* flushSegments(text: string, final: boolean): Generator<string> {
    buf += text;
    while (true) {
      markerRe.lastIndex = 0;
      const first = markerRe.exec(buf);
      if (!first) {
        if (!inBlock && buf.length > 4000) buf = buf.slice(-2000);
        return;
      }
      if (!inBlock) {
        buf = buf.slice(first.index);
        inBlock = true;
      }
      markerRe.lastIndex = 1;
      const next = markerRe.exec(buf);
      if (!next) {
        if (final) {
          const bloco = buf.length > MAX_BLOCO_CHARS ? buf.slice(0, MAX_BLOCO_CHARS) : buf;
          buf = "";
          inBlock = false;
          yield bloco;
        } else if (buf.length > MAX_BUF_FLUSH_CHARS) {
          yield buf.slice(0, MAX_BLOCO_CHARS);
          buf = buf.slice(-4000);
          inBlock = false;
        }
        return;
      }
      const bloco = buf.slice(0, next.index);
      yield bloco.length > MAX_BLOCO_CHARS ? bloco.slice(0, MAX_BLOCO_CHARS) : bloco;
      buf = buf.slice(next.index);
    }
  }

  return {
    push(text: string): string[] { return Array.from(flushSegments(text, false)); },
    end(): string[] { return Array.from(flushSegments("", true)); },
  };
}

function extractCnj(text: string): string | null {
  const m = text.match(CNJ_REGEX);
  return m ? m[0] : null;
}

/**
 * Subdivide um bloco de Sessão em sub-blocos por processo (CNJ).
 * Para cada CNJ encontrado, recorta o trecho do CNJ até o próximo CNJ
 * (ou ~3 KB de contexto para o último), prefixado com o cabeçalho da
 * Sessão (até o primeiro CNJ) — preserva Turma, data/hora, órgão.
 * Se nenhum CNJ for encontrado, devolve o bloco inteiro com processo=null.
 */
function splitBlocoByProcessos(bloco: string): Array<{ processo: string | null; texto: string }> {
  const cnjs: Array<{ value: string; index: number }> = [];
  CNJ_REGEX_GLOBAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CNJ_REGEX_GLOBAL.exec(bloco)) !== null) {
    cnjs.push({ value: m[0], index: m.index });
  }
  if (cnjs.length === 0) {
    return [{ processo: null, texto: bloco }];
  }
  const headerEnd = cnjs[0].index;
  const header = bloco.slice(0, Math.min(headerEnd, 1500));
  const out: Array<{ processo: string | null; texto: string }> = [];
  // Dedup por CNJ (mesmo CNJ aparece várias vezes no bloco -> uma única sub-pauta)
  const seen = new Set<string>();
  for (let i = 0; i < cnjs.length; i++) {
    const cur = cnjs[i];
    if (seen.has(cur.value)) continue;
    seen.add(cur.value);
    const next = cnjs[i + 1];
    const end = next ? next.index : Math.min(bloco.length, cur.index + 3000);
    const slice = bloco.slice(cur.index, end);
    const texto = (header && cur.index > 0 ? `${header}\n` : "") + slice;
    out.push({ processo: cur.value, texto: texto.length > 8000 ? texto.slice(0, 8000) : texto });
  }
  return out;
}

function condicaoConcomitanteAtendidaBloco(blocoNorm: string, condicao?: string | null): boolean {
  if (!condicao) return true;
  const grupos = String(condicao).split("|").map((g) => g.trim()).filter(Boolean);
  if (grupos.length === 0) return true;
  return grupos.some((g) => {
    const ts = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every((t) => {
      const tn = normalizeDjetText(t);
      return tn ? blocoNorm.includes(tn) : false;
    });
  });
}

function matchBlocoMonitoramento(blocoNorm: string, mon: ReturnType<typeof monitoramentoToInput>): string | null {
  for (const ex of mon.exclusoes || []) {
    const exN = normalizeDjetText(ex);
    if (exN && blocoNorm.includes(exN)) return null;
  }
  if (!condicaoConcomitanteAtendidaBloco(blocoNorm, mon.condicaoConcomitante)) return null;
  for (const t of mon.termos || []) {
    const tn = normalizeDjetText(t);
    if (tn && blocoNorm.includes(tn)) return t;
  }
  if (mon.oab) {
    const digits = mon.oab.replace(/\D/g, "");
    if (digits && new RegExp(`\\boab\\b[^a-z0-9]{0,8}${digits}\\b`).test(blocoNorm)) return `OAB ${mon.oab}`;
    if (digits && new RegExp(`\\b${digits}\\b[^a-z0-9]{0,8}oab\\b`).test(blocoNorm)) return `OAB ${mon.oab}`;
  }
  return null;
}

async function fetchPdfArrayBufferViaProxy(tribunal: string, dataDDMMYYYY: string): Promise<ArrayBuffer | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buscar-dejt-pautas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ tribunal, dataDDMMYYYY, caderno: "judiciario", downloadOnly: true, monitoramentos: [] }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) throw new Error(`PDF proxy HTTP ${response.status}`);
  if (!contentType.includes("application/pdf")) return null;
  return await response.arrayBuffer();
}

async function buscarPautasNoNavegador(
  tribunal: string,
  dataDDMMYYYY: string,
  dataIso: string,
  monitoramentos: ReturnType<typeof monitoramentoToInput>[],
): Promise<{ sem_dados: boolean; motivo?: string; totalBlocos: number; matches: MatchOut[] }> {
  const arrayBuffer = await fetchPdfArrayBufferViaProxy(tribunal, dataDDMMYYYY);
  if (!arrayBuffer) return { sem_dados: true, motivo: "no-pdf", totalBlocos: 0, matches: [] };

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;

  const matches: MatchOut[] = [];
  let totalBlocos = 0;
  const seg = makePautaStreamSegmenter();

  const processBloco = async (bloco: string) => {
    totalBlocos++;
    const subBlocos = splitBlocoByProcessos(bloco);
    for (const sub of subBlocos) {
      const subNorm = normalizeDjetText(sub.texto);
      for (const mon of monitoramentos) {
        const hit = matchBlocoMonitoramento(subNorm, mon);
        if (!hit) continue;
        const conteudo = sub.texto.trim();
        const hash = await sha256Hex(
          `${mon.id}|${tribunal}|${dataIso}|${sub.processo || ""}|${conteudo.slice(0, 1024)}`,
        );
        matches.push({
          monitoramentoId: mon.id,
          coordenacaoId: mon.coordenacao_id ?? null,
          termoMatch: hit,
          processo: sub.processo,
          conteudo,
          hash,
          dataPublicacao: dataIso,
          fonte: "dejt-pdf",
          tribunal,
        });
      }
    }
  };

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      if (abortRequested) break;
      const page = await pdf.getPage(i);
      try {
        const content = await page.getTextContent();
        const pageText = (content.items as Array<{ str?: string; hasEOL?: boolean }>)
          .map((item) => `${item?.str || ""}${item?.hasEOL ? "\n" : " "}`)
          .join("");
        for (const bloco of seg.push(pageText)) await processBloco(bloco);
      } finally {
        try { page.cleanup(); } catch { /* ignore */ }
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    for (const bloco of seg.end()) await processBloco(bloco);
  } finally {
    try { await pdf.destroy(); } catch { /* ignore */ }
  }

  return { sem_dados: false, totalBlocos, matches };
}

// ============================================================================
// PERSISTÊNCIA DOS MATCHES
// ============================================================================

interface MatchOut {
  monitoramentoId: string;
  coordenacaoId: string | null;
  termoMatch: string;
  processo: string | null;
  conteudo: string;
  hash: string;
  dataPublicacao: string;
  fonte: string;
  tribunal: string;
}

async function persistMatches(matches: MatchOut[]): Promise<{ novas: number; duplicadas: number }> {
  if (matches.length === 0) return { novas: 0, duplicadas: 0 };

  // Dedup local pelo hash
  const seen = new Set<string>();
  const rows = matches.filter((m) => {
    if (seen.has(m.hash)) return false;
    seen.add(m.hash);
    return true;
  }).map((m) => ({
    monitoramento_id: m.monitoramentoId,
    coordenacao_id: m.coordenacaoId,
    hash_conteudo: m.hash,
    data_publicacao: m.dataPublicacao,
    processo_numero: m.processo,
    conteudo: m.conteudo,
    fonte: m.fonte,
    tipo_publicacao: "pauta",
    lida: false,
  }));

  // Insere em lotes de 100, ignorando duplicatas via constraint hash_conteudo
  let novas = 0;
  let duplicadas = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("publicacoes_djen")
      .upsert(slice as never, { onConflict: "hash_conteudo", ignoreDuplicates: true })
      .select("id");
    if (error) {
      // Fallback: insere uma a uma
      for (const r of slice) {
        const { error: e2 } = await supabase
          .from("publicacoes_djen")
          .insert(r as never);
        if (!e2) novas++; else duplicadas++;
      }
    } else {
      const inseridas = (data?.length ?? 0);
      novas += inseridas;
      duplicadas += slice.length - inseridas;
    }
  }
  return { novas, duplicadas };
}

// ============================================================================
// TRACK RUNNER
// ============================================================================

async function processarTribunal(
  tribunal: string,
  dias: string[],
  monitoramentos: Monitoramento[],
) {
  const monitsTrib = monitoramentosParaTribunal(monitoramentos, tribunal);
  const monsInput = monitsTrib.map(monitoramentoToInput).filter((m) => m.termos.length > 0 || m.oab);

  updateTrack(tribunal, {
    status: "executando",
    startedAt: Date.now(),
    total: dias.length,
    current: 0,
    mensagem: monsInput.length === 0 ? "Sem monitoramentos para este tribunal" : "Iniciando...",
  });

  if (monsInput.length === 0) {
    updateTrack(tribunal, {
      status: "concluido",
      finishedAt: Date.now(),
      mensagem: "Sem monitoramentos aplicáveis",
      current: dias.length,
    });
    return;
  }

  for (const diaYmd of dias) {
    if (abortRequested) {
      updateTrack(tribunal, { status: "cancelado", finishedAt: Date.now(), mensagem: "Cancelado" });
      return;
    }
    const dataDDMMYYYY = ymdToDdmmyyyy(diaYmd);
    updateTrack(tribunal, { diaAtual: diaYmd, mensagem: `Processando ${dataDDMMYYYY}` });

    try {
      const data = await buscarPautasNoNavegador(tribunal, dataDDMMYYYY, diaYmd, monsInput);

      if (data?.sem_dados) {
        updateTrack(tribunal, {
          current: progress.tracks.find((t) => t.tribunal === tribunal)!.current + 1,
          diasSemPdf: progress.tracks.find((t) => t.tribunal === tribunal)!.diasSemPdf + 1,
        });
      } else {
        const matches = (data?.matches || []) as MatchOut[];
        if (matches.length > 0) {
          const { novas, duplicadas } = await persistMatches(matches);
          updateTrack(tribunal, {
            current: progress.tracks.find((t) => t.tribunal === tribunal)!.current + 1,
            novas: progress.tracks.find((t) => t.tribunal === tribunal)!.novas + novas,
            duplicadas: progress.tracks.find((t) => t.tribunal === tribunal)!.duplicadas + duplicadas,
          });
        } else {
          updateTrack(tribunal, {
            current: progress.tracks.find((t) => t.tribunal === tribunal)!.current + 1,
          });
        }
      }
    } catch (e) {
      console.error(`[DJET-Paralela] ${tribunal} ${dataDDMMYYYY} erro:`, e);
      updateTrack(tribunal, {
        current: progress.tracks.find((t) => t.tribunal === tribunal)!.current + 1,
        ultimoErro: String((e as Error)?.message || e).slice(0, 200),
      });
    }

    if (DELAY_BETWEEN_DAYS_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_DAYS_MS));
    }
  }

  updateTrack(tribunal, {
    status: abortRequested ? "cancelado" : "concluido",
    finishedAt: Date.now(),
    mensagem: abortRequested ? "Cancelado" : "Concluído",
  });
}

// ============================================================================
// API PÚBLICA
// ============================================================================

export async function executarDjetPautasParalela(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  resume = false,
  coordenacaoId?: string,
  monitoramentoIds?: string[],
) {
  if (running) {
    console.warn("[DJET-Paralela] já está executando, ignorando.");
    return;
  }

  const today = getTodayYmdBrt();
  const inicio = dataInicioYmd || today;
  const fim = dataFimYmd || today;
  const dias = buildDateRange(inicio, fim);

  // Carrega monitoramentos uma vez
  let monitoramentos: Monitoramento[];
  try {
    monitoramentos = await fetchActiveMonitoramentos(coordenacaoId, monitoramentoIds);
  } catch (e) {
    setProgress({
      ...initialProgress(),
      status: "erro",
      mensagem: `Erro ao carregar monitoramentos: ${(e as Error).message}`,
    });
    return;
  }

  // Inicializa tracks (carrega checkpoint se for resume)
  const cp = resume ? loadCheckpoint() : null;
  const concluidos = new Set(cp?.tribunaisConcluidos || []);
  const tracks: TrackProgress[] = TRIBUNAIS_DEJT.map((trib) => ({
    tribunal: trib,
    status: concluidos.has(trib) ? "concluido" : "pendente",
    current: concluidos.has(trib) ? dias.length : 0,
    total: dias.length,
    novas: 0, duplicadas: 0, descartadas: 0, diasSemPdf: 0,
    mensagem: concluidos.has(trib) ? "Já concluído (checkpoint)" : "Aguardando",
    diaAtual: null, ultimoErro: null,
    startedAt: null, finishedAt: null,
  }));

  progress = {
    status: "executando",
    tracks,
    totalTribunais: TRIBUNAIS_DEJT.length,
    tribunaisConcluidos: concluidos.size,
    novas: cp?.novas || 0,
    duplicadas: cp?.duplicadas || 0,
    descartadas: cp?.descartadas || 0,
    percentage: 0,
    mensagem: `Buscando pautas DEJT (${inicio} → ${fim})`,
    tempoDecorrido: 0,
    iniciadoEm: new Date().toISOString(),
    dataInicioYmd: inicio,
    dataFimYmd: fim,
    concorrencia: MAX_CONCURRENCY,
  };
  recomputeAggregate();
  notify();

  running = true;
  abortRequested = false;
  const t0 = cp?.tempoInicio || Date.now();

  // Pool com MAX_CONCURRENCY
  const pendentes = TRIBUNAIS_DEJT.filter((t) => !concluidos.has(t));
  const queue = [...pendentes];
  const workers: Promise<void>[] = [];

  const runOne = async () => {
    while (queue.length > 0 && !abortRequested) {
      const trib = queue.shift()!;
      try {
        await processarTribunal(trib, dias, monitoramentos);
      } catch (e) {
        console.error(`[DJET-Paralela] tribunal ${trib} fatal:`, e);
        updateTrack(trib, {
          status: "erro",
          finishedAt: Date.now(),
          ultimoErro: String((e as Error)?.message || e).slice(0, 200),
        });
      }
      // Atualiza checkpoint
      const concl = progress.tracks
        .filter((t) => t.status === "concluido")
        .map((t) => t.tribunal);
      saveCheckpoint({
        runKey: `${inicio}_${fim}`,
        dataInicioYmd: inicio,
        dataFimYmd: fim,
        tribunaisConcluidos: concl,
        novas: progress.novas,
        duplicadas: progress.duplicadas,
        descartadas: progress.descartadas,
        tempoInicio: t0,
      });
    }
  };

  for (let i = 0; i < Math.min(MAX_CONCURRENCY, pendentes.length); i++) {
    workers.push(runOne());
  }
  await Promise.all(workers);

  running = false;
  const finalStatus: DjetPautasParalelaProgress["status"] = abortRequested ? "cancelado" : "concluido";
  setProgress({
    status: finalStatus,
    mensagem: finalStatus === "cancelado"
      ? "Cancelado pelo usuário"
      : `Concluído. ${progress.novas} novas pautas, ${progress.duplicadas} duplicadas.`,
    tempoDecorrido: Math.floor((Date.now() - t0) / 1000),
  });
  if (finalStatus === "concluido") clearCheckpoint();
}

export async function cancelarDjetPautasParalela() {
  if (!running) return;
  abortRequested = true;
  setProgress({ mensagem: "Cancelando..." });
}

export function limparEstadoDjetPautasParalela() {
  if (running) return;
  progress = initialProgress();
  notify();
}

export async function forceKillDjetPautasParalela(clearCp = false) {
  abortRequested = true;
  running = false;
  if (clearCp) clearCheckpoint();
  progress = { ...initialProgress(), status: "cancelado", mensagem: "Force kill" };
  notify();
}

export async function resetTotalDjetPautasParalela() {
  abortRequested = true;
  running = false;
  clearCheckpoint();
  progress = initialProgress();
  notify();
}

export function getDjetPautasParalelaProgress(): DjetPautasParalelaProgress {
  return { ...progress, tracks: progress.tracks.map((t) => ({ ...t })) };
}

export function isDjetPautasParalelaRunning(): boolean {
  return running;
}

export function getCheckpointDjetPautas(): Checkpoint | null {
  return loadCheckpoint();
}

export function subscribeDjetPautasParalela(
  cb: (p: DjetPautasParalelaProgress) => void,
): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

export { TRIBUNAIS_DEJT };