/**
 * DJEN Termos Paralela Engine v1.0
 *
 * Motor independente derivado do DJEN Termos Pro.
 * Inverte o loop: ao invés de (dia → termo → tribunal), processa
 * (tribunal → dia × termo) em paralelo, com até MAX_CONCURRENCY
 * tribunais executando simultaneamente.
 *
 * Cada tribunal é uma "track" com sua própria barra de progresso.
 * Mantém validação por metadados estruturados, dedup e persistência
 * idênticas ao Pro (compartilha tabela publicacoes_djen).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  buscarPjeComunicaPaginado,
  awaitPjeComunicaGlobalCooldown,
  getPjeComunicaGlobalCooldownRemainingMs,
  type PjeSearchType,
  type PoolViaInfo,
} from "@/utils/pjeComunicaClient";
import { buildDjenLikeConteudo } from "@/utils/djenLikeConteudo";
import {
  resetDjenProxyPoolStats,
  getDjenProxyPoolStats,
  isDjenProxyPoolEnabled,
  loadDjenProxyPool,
  syncDjenProxyPoolFromSupabase,
  DIRECT_SLOT_ID,
  getDjenProxySlotsRuntime,
  clearDjenProxyOfflineMark,
  type PoolSessionStats,
} from "@/utils/djenProxyPool";

// ============================================================================
// TIPOS
// ============================================================================

export type TrackStatus = 'pendente' | 'executando' | 'concluido' | 'erro' | 'cancelado';

export interface TrackProgress {
  tribunal: string;
  status: TrackStatus;
  current: number; // termos processados (no tribunal × dias)
  total: number;   // total termos × dias para esse tribunal
  novas: number;
  duplicadas: number;
  descartadas: number;
  mensagem: string;
  termoAtual: string | null;
  diaAtual: string | null;
  rateLimitHits: number;
  ultimoErro: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** Última rota usada (Direto vs VPS-X) — para feedback de roteamento. */
  lastViaId: string | null;
  lastViaLabel: string | null;
  lastViaKind: 'direct' | 'proxy' | null;
  /** Contagem total por rota dentro deste tribunal. */
  callsDirect: number;
  callsByProxy: Record<string, number>;
}

export interface DjenTermosParalelaProgress {
  status: 'idle' | 'executando' | 'concluido' | 'cancelado' | 'erro';
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
  poolStats?: PoolSessionStats;
}

interface Monitoramento {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte' | 'nome';
  termo_busca: string;
  oab?: string;
  uf?: string;
  ativo: boolean;
  exclusoes?: string[];
  tribunais?: string[];
  termos_or?: string[];
  descricao?: string | null;
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
// CONFIGURAÇÃO
// ============================================================================

const MAX_CONCURRENCY = 5;
const CONFIG = {
  delay_between_terms: 1500,
  delay_between_pages: 1200,
  delay_between_termos_or: 1000,
  max_retries: 3,
  retry_base_delay: 12000,
};

// ============================================================================
// AGRUPAMENTO POR HOST (anti rate-limit 429)
// ============================================================================
// Todos os tribunais conhecidos hoje usam o mesmo backend (comunicaapi.pje.jus.br),
// então rodar 5 tribunais em paralelo gera HTTP 429 em massa. Esta tabela mapeia
// cada tribunal para um "bucket" (host lógico) e limitamos quantos workers podem
// rodar simultaneamente em cada bucket. Se no futuro algum tribunal migrar para
// um endpoint próprio, basta movê-lo de bucket para liberar paralelismo.

type HostBucket = 'pje-comunica' | 'outro';

function getHostBucket(_tribunal: string): HostBucket {
  // Hoje TODOS os tribunais (TST, STF, STJ, TRFs, TRTs, TJs) consultam o
  // mesmo host comunicaapi.pje.jus.br via buscarPjeComunicaPaginado.
  return 'pje-comunica';
}

// Limite por bucket: máx. simultâneos no MESMO host PJE Comunica.
// Manter 2 reduz drasticamente o 429 sem matar o paralelismo.
const HOST_BUCKET_LIMITS: Record<HostBucket, number> = {
  'pje-comunica': 2,
  'outro': 5,
};

const STORAGE_KEY = 'djen-termos-paralela-checkpoint-v1';
const RESET_MARK_KEY = 'djen-termos-paralela-reset-at-v1';
const BR_TZ = 'America/Sao_Paulo';
const EXECUTION_SYNC_INTERVAL_MS = 15000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function getResetMarkMs(): number {
  try {
    return Number(localStorage.getItem(RESET_MARK_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function setResetMarkNow() {
  try {
    localStorage.setItem(RESET_MARK_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Sleep abortável — usa o AbortSignal para interromper imediatamente. */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((r) => setTimeout(r, ms));
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// ============================================================================
// ORDEM DE PRIORIDADE DE TRIBUNAIS
// ============================================================================

const TRIBUNAL_PRIORITY_ORDER: string[] = [
  'TST', 'STF', 'STJ',
  'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
  'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8', 'TRT9',
  'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16', 'TRT17',
  'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
];

function ordenarTribunais(tribunais: string[]): string[] {
  const indexMap = new Map<string, number>();
  TRIBUNAL_PRIORITY_ORDER.forEach((t, i) => indexMap.set(t, i));
  return [...tribunais].sort((a, b) => {
    const ia = indexMap.has(a) ? indexMap.get(a)! : 9999;
    const ib = indexMap.has(b) ? indexMap.get(b)! : 9999;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

const TODOS_CIVEIS = ['TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO'];
const TODOS_TRT = ['TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'];

function expandirTribunaisDoMon(tribunais?: string[]): string[] {
  if (!tribunais?.length) return [];
  const set = new Set<string>();
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') TODOS_CIVEIS.forEach(x => set.add(x));
    else if (t === 'TODOS_TRT') TODOS_TRT.forEach(x => set.add(x));
    else set.add(t.toUpperCase());
  }
  return Array.from(set);
}

// ============================================================================
// SINGLETON STATE
// ============================================================================

let state: {
  isRunning: boolean;
  progress: DjenTermosParalelaProgress;
  checkpoint: Checkpoint | null;
  abortController: AbortController | null;
  listeners: Set<(p: DjenTermosParalelaProgress) => void>;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastUpdatedAt: number;
  executionId: string | null;
  resetExecutionIds: Set<string>;
  lastExecutionSyncAt: number;
} = {
  isRunning: false,
  progress: createDefaultProgress(),
  checkpoint: null,
  abortController: null,
  listeners: new Set(),
  timerInterval: null,
  lastUpdatedAt: 0,
  executionId: null,
  resetExecutionIds: new Set(),
  lastExecutionSyncAt: 0,
};

function createDefaultProgress(): DjenTermosParalelaProgress {
  return {
    status: 'idle',
    tracks: [],
    totalTribunais: 0,
    tribunaisConcluidos: 0,
    novas: 0,
    duplicadas: 0,
    descartadas: 0,
    percentage: 0,
    mensagem: '',
    tempoDecorrido: 0,
    iniciadoEm: null,
    dataInicioYmd: null,
    dataFimYmd: null,
    concorrencia: HOST_BUCKET_LIMITS['pje-comunica'],
  };
}

function notifyListeners() {
  for (const l of state.listeners) l(state.progress);
}

function updateProgress(partial: Partial<DjenTermosParalelaProgress>) {
  state.progress = { ...state.progress, ...partial };
  state.lastUpdatedAt = Date.now();
  notifyListeners();
}

function stopLocalExecution() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.isRunning = false;
}

function updateTrack(tribunal: string, partial: Partial<TrackProgress>) {
  const tracks = state.progress.tracks.map(t =>
    t.tribunal === tribunal ? { ...t, ...partial } : t
  );
  // Recalcular agregados
  let novas = 0, duplicadas = 0, descartadas = 0, concluidos = 0;
  let totalCurrent = 0, totalGlobal = 0;
  for (const t of tracks) {
    novas += t.novas;
    duplicadas += t.duplicadas;
    descartadas += t.descartadas;
    if (t.status === 'concluido' || t.status === 'erro' || t.status === 'cancelado') concluidos++;
    totalCurrent += t.current;
    totalGlobal += t.total;
  }
  const tempoDecorrido = state.progress.iniciadoEm && state.progress.status === 'executando'
    ? Math.floor(Math.max(0, Date.now() - new Date(state.progress.iniciadoEm).getTime()) / 1000)
    : state.progress.tempoDecorrido;
  const percentage = totalGlobal > 0
    ? Math.min(100, Math.max(0, Math.round((totalCurrent / totalGlobal) * 100)))
    : 0;
  state.progress = {
    ...state.progress,
    tracks,
    novas,
    duplicadas,
    descartadas,
    tribunaisConcluidos: concluidos,
    percentage,
    tempoDecorrido,
  };
  state.lastUpdatedAt = Date.now();
  notifyListeners();
}

/**
 * Registra a rota (Direto/VPS) usada pela última chamada feita pelo tribunal.
 * Atualiza tanto o "lastVia" (mostrado em destaque na UI) quanto os contadores
 * acumulados por rota para um painel de uso por tribunal.
 */
function registrarViaTrack(tribunal: string, via: PoolViaInfo) {
  const tracks = state.progress.tracks.map(t => {
    if (t.tribunal !== tribunal) return t;
    const callsByProxy = { ...t.callsByProxy };
    let callsDirect = t.callsDirect;
    if (via.kind === 'direct') {
      callsDirect = callsDirect + 1;
    } else {
      callsByProxy[via.id] = (callsByProxy[via.id] || 0) + 1;
    }
    return {
      ...t,
      lastViaId: via.id,
      lastViaLabel: via.label,
      lastViaKind: via.kind,
      callsDirect,
      callsByProxy,
    };
  });
  state.progress = { ...state.progress, tracks };
  state.lastUpdatedAt = Date.now();
  notifyListeners();
}

// ============================================================================
// CHECKPOINT
// ============================================================================

function saveCheckpoint(cp: Checkpoint | null) {
  if (cp) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cp, savedAt: Date.now() }));
  else localStorage.removeItem(STORAGE_KEY);
  state.checkpoint = cp;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

// ============================================================================
// HELPERS
// ============================================================================

function ymdBrasilia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

function gerarListaDatas(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  const end = new Date(`${fim}T12:00:00`);
  while (d <= end) {
    datas.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return datas;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ').replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

function contemFrase(textoNorm: string, fraseNorm: string): boolean {
  if (!fraseNorm) return true;
  const escaped = fraseNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(textoNorm);
}

function contemFraseComAnd(textoNorm: string, termoRaw: string): boolean {
  if (!termoRaw) return true;
  if (!termoRaw.includes('+')) return contemFrase(textoNorm, normalizar(termoRaw));
  const partes = termoRaw.split('+').map(p => p.trim()).filter(Boolean);
  return partes.every(p => {
    if (/^OAB\s/i.test(p)) return true;
    const pNorm = normalizar(p);
    return !pNorm || contemFrase(textoNorm, pNorm);
  });
}

function encurtarParaApi(termo: string): string {
  if (!termo?.trim()) return termo;
  const limpo = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const palavras = limpo.split(/\s+/).filter(p => p.length >= 2 && !/^[&\/\\.,]+$/.test(p));
  if (palavras.length <= 2) return limpo;
  return palavras.slice(0, 2).join(' ');
}

function getSiglaTribunal(item: any): string | null {
  const raw = item?.siglaTribunal || item?.tribunal || item?.nomeOrgao || null;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.toUpperCase().match(/\b(TJ\w+|TRT\d+|TRF\d+|TST|STJ|STF)\b/);
  return m?.[1] ?? raw.trim().toUpperCase();
}

function extrairDataDisponibilizacaoYmd(item: any): string | null {
  const raw = item?.dataDisponibilizacao
    ?? item?.data_disponibilizacao
    ?? item?.datadisponibilizacao
    ?? item?.data
    ?? null;
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const corpo = String(item?.texto ?? item?.conteudo ?? item?.teor ?? '');
  const isoNoCorpo = corpo.match(/data\s+de\s+disponibiliza[cç][aã]o\D{0,30}(\d{4})[-/](\d{2})[-/](\d{2})/i);
  if (isoNoCorpo) return `${isoNoCorpo[1]}-${isoNoCorpo[2]}-${isoNoCorpo[3]}`;
  const brNoCorpo = corpo.match(/data\s+de\s+disponibiliza[cç][aã]o\D{0,30}(\d{2})\/(\d{2})\/(\d{4})/i);
  if (brNoCorpo) return `${brNoCorpo[3]}-${brNoCorpo[2]}-${brNoCorpo[1]}`;
  return null;
}

function normalizarHeadDedup(conteudo: string): string {
  const semDestinatarios = conteudo.replace(/Destinat[aá]rio\(s\)\s*:[\s\S]*$/i, '');
  return semDestinatarios
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 300);
}

function montarChaveEncontrada(params: {
  coordenacaoId?: string | null;
  processoNumero?: string | null;
  dataRefYmd: string;
  conteudo?: string | null;
  dedupProcessoDigits?: string | null;
  dedupHeadNorm?: string | null;
}): string {
  const coord = params.coordenacaoId ?? 'sem_coord';
  const proc = params.dedupProcessoDigits ?? String(params.processoNumero ?? '').replace(/\D/g, '');
  const head = params.dedupHeadNorm ?? normalizarHeadDedup(String(params.conteudo ?? ''));
  return `${coord}|${proc}|${params.dataRefYmd}|${head}`;
}

function gerarHash(conteudo: string, data: string, processoNumero?: string): string {
  const proc = (processoNumero || '').replace(/[^0-9]/g, '');
  const key = `${data}|${proc}|${conteudo}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 800);
  let h1 = 0, h2 = 0x9e3779b9;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = ((h1 << 5) - h1) + c; h1 = h1 & h1;
    h2 = ((h2 << 7) ^ h2) + c; h2 = h2 & h2;
  }
  return Math.abs(h1).toString(16) + Math.abs(h2).toString(16);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function proximoDiaYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function calcularProximoDiaUtil(dataBase: Date): Date {
  const r = new Date(dataBase);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  const mes = r.getMonth(), dia = r.getDate();
  if ((mes === 11 && dia >= 20) || (mes === 0 && dia <= 6)) {
    if (mes === 11) r.setFullYear(r.getFullYear() + 1);
    r.setMonth(0); r.setDate(7);
    while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  }
  return r;
}

function calcularDataPublicacao(dataDispYmd: string): string {
  const base = new Date(`${dataDispYmd}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return calcularProximoDiaUtil(base).toISOString().slice(0, 10);
}

interface ParsedTermoOr { nome: string; oabDigits?: string; }

function parsearTermoOr(raw: string): ParsedTermoOr | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const oabNomeMatch = trimmed.match(/^(\d{3,6})\s*\/\s*(.+)$/);
  if (oabNomeMatch) return { oabDigits: oabNomeMatch[1], nome: oabNomeMatch[2].trim() };
  const nomeOabMatch = trimmed.match(/^(.+?)\s*\/\s*(\d{3,6})$/);
  if (nomeOabMatch) return { oabDigits: nomeOabMatch[2], nome: nomeOabMatch[1].trim() };
  let clean = trimmed;
  clean = clean.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, '');
  clean = clean.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, '');
  clean = clean.replace(/^Adv\.?\s*/i, '');
  clean = clean.trim();
  if (!clean) return null;
  return { nome: clean };
}

function validarAdvogadoMetadados(pub: any, oab?: string, nome?: string): boolean {
  const advs = pub?.destinatarioadvogados;
  if (!Array.isArray(advs) || advs.length === 0) return false;
  const oabDigits = oab ? String(oab).replace(/\D/g, '') : '';
  const nomeNorm = nome ? normalizar(nome) : '';
  for (const entry of advs) {
    const adv = entry?.advogado || entry;
    if (!adv) continue;
    if (oabDigits && adv.numero_oab) {
      if (String(adv.numero_oab).replace(/\D/g, '') === oabDigits) return true;
    }
    if (nomeNorm && adv.nome) {
      const advNorm = normalizar(adv.nome);
      if (advNorm === nomeNorm || advNorm.includes(nomeNorm) || nomeNorm.includes(advNorm)) return true;
    }
  }
  return false;
}

function validarParteMetadados(pub: any, nomeParte: string): boolean {
  const nomeNorm = normalizar(nomeParte);
  if (!nomeNorm) return false;
  // ESTRITO: só valida em campos ESTRUTURADOS de PARTE (lado esquerdo da publicação).
  // NUNCA valida no teor geral. Campos verificados:
  //  - destinatarios[].nome (partes intimadas, qualquer polo)
  //  - poloAtivo / poloPassivo (strings com nomes do polo, possivelmente com ', ')
  //  - partes[] / partes_json (lista estruturada — strings ou {nome})
  const matches = (raw: any): boolean => {
    if (!raw) return false;
    const s = typeof raw === 'string' ? raw : (raw?.nome || raw?.nomeParte || raw?.parte || '');
    if (!s) return false;
    // pode vir vários nomes separados por vírgula
    const candidatos = String(s).split(/\s*,\s*|\s*;\s*/).map(x => x.trim()).filter(Boolean);
    for (const c of candidatos) {
      const cn = normalizar(c);
      if (!cn) continue;
      if (cn.includes(nomeNorm) || nomeNorm.includes(cn)) return true;
    }
    return false;
  };
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) if (matches(d)) return true;
  }
  if (matches(pub?.poloAtivo) || matches(pub?.polo_ativo)) return true;
  if (matches(pub?.poloPassivo) || matches(pub?.polo_passivo)) return true;
  if (Array.isArray(pub?.partes)) {
    for (const p of pub.partes) if (matches(p)) return true;
  }
  const partesJson = typeof pub?.partes_json === 'string'
    ? (() => { try { return JSON.parse(pub.partes_json); } catch { return []; } })()
    : pub?.partes_json;
  if (Array.isArray(partesJson)) {
    for (const p of partesJson) if (matches(p)) return true;
  }
  return false;
}

/**
 * Valida se algum dos nomes em `partes_json` (formato "[Polo] NOME" ou apenas "NOME")
 * contém o termo. Usado para revalidar publicações resgatadas de outras
 * coordenações, evitando inserir publicações onde o termo só aparece no
 * corpo do texto (ex.: jurisprudência, endereço) e NÃO nas partes estruturadas.
 */
function validarParteEmPartesJson(partesJson: any, nomesParte: string[]): boolean {
  let arr: any[] = [];
  if (Array.isArray(partesJson)) arr = partesJson;
  else if (typeof partesJson === 'string') {
    try { arr = JSON.parse(partesJson); } catch { arr = []; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const termosNorm = nomesParte.map(n => normalizar(String(n || ''))).filter(Boolean);
  if (termosNorm.length === 0) return false;
  for (const p of arr) {
    const raw = typeof p === 'string' ? p : (p?.nome || '');
    // remove prefixo "[Reclamante] " / "[Reclamado] " etc.
    const semPolo = String(raw).replace(/^\s*\[[^\]]+\]\s*/, '').trim();
    const partNorm = normalizar(semPolo);
    if (!partNorm) continue;
    for (const t of termosNorm) {
      if (partNorm.includes(t) || t.includes(partNorm)) return true;
    }
  }
  return false;
}

function extrairPartesDeCamposEstruturados(pub: any): string[] {
  const result: string[] = [];
  const add = (raw: any, polo?: string) => {
    if (!raw) return;
    const s = typeof raw === 'string' ? raw : (raw?.nome || raw?.nomeParte || raw?.parte || '');
    if (!s) return;
    for (const nome of String(s).split(/\s*,\s*|\s*;\s*/).map(x => x.trim()).filter(Boolean)) {
      result.push(polo ? `[${polo}] ${nome}` : nome);
    }
  };
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) {
      const polo = d?.polo === 'A' ? 'Reclamante' : d?.polo === 'P' ? 'Reclamado' : d?.polo || '';
      add(d, polo);
    }
  }
  add(pub?.poloAtivo || pub?.polo_ativo, 'Polo Ativo');
  add(pub?.poloPassivo || pub?.polo_passivo, 'Polo Passivo');
  if (Array.isArray(pub?.partes)) for (const p of pub.partes) add(p);
  const partesJson = typeof pub?.partes_json === 'string'
    ? (() => { try { return JSON.parse(pub.partes_json); } catch { return []; } })()
    : pub?.partes_json;
  if (Array.isArray(partesJson)) for (const p of partesJson) add(p);
  return result;
}

function buildTextoCompleto(pub: any): string {
  const partes: string[] = [];
  const texto = pub?.texto || pub?.conteudo || pub?.teor || '';
  if (texto) partes.push(texto);
  if (Array.isArray(pub?.destinatarios)) for (const d of pub.destinatarios) if (d?.nome) partes.push(d.nome);
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const e of pub.destinatarioadvogados) {
      const adv = e?.advogado || e;
      if (adv?.nome) partes.push(adv.nome);
      if (adv?.numero_oab) partes.push(`OAB ${adv.uf_oab || ''} ${adv.numero_oab}`);
    }
  }
  return partes.join('\n');
}

function temExclusao(pub: any, exclusoes?: string[]): string | null {
  if (!exclusoes?.length) return null;
  const textoNorm = normalizar(buildTextoCompleto(pub));
  for (const exc of exclusoes) {
    const excNorm = normalizar(exc);
    if (excNorm && textoNorm.includes(excNorm)) return exc;
  }
  return null;
}

function condicaoConcomitanteAtendida(pub: any, condicao?: string | null): boolean {
  if (!condicao) return true;
  const grupos = String(condicao).split('|').map(g => g.trim()).filter(Boolean);
  if (grupos.length === 0) return true;
  const textoNorm = normalizar(buildTextoCompleto(pub));
  return grupos.some(g => {
    const ts = g.split(',').map(t => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every(t => contemFrase(textoNorm, normalizar(t)));
  });
}

function validarTermo(pub: any, mon: Monitoramento): boolean {
  const tipo = mon.tipo;
  if (tipo === 'parte') {
    // REGRA: tipo='parte' SÓ casa em metadados estruturados de Parte(s)/polos.
    // Não lê nem valida o teor/texto geral da publicação.
    if (validarParteMetadados(pub, mon.termo_busca)) return true;
    for (const t of (mon.termos_or || [])) {
      if (validarParteMetadados(pub, String(t))) return true;
    }
    return false;
  }

  const textoNorm = normalizar(buildTextoCompleto(pub));
  if (tipo === 'advogado') {
    if (validarAdvogadoMetadados(pub, mon.oab, mon.termo_busca)) return true;
    const nomeNorm = normalizar(mon.termo_busca);
    if (nomeNorm && contemFrase(textoNorm, nomeNorm)) return true;
    if (mon.oab) {
      const od = String(mon.oab).replace(/\D/g, '');
      if (od.length >= 3 && textoNorm.includes(od)) return true;
    }
    if (mon.termos_or?.length) {
      for (const t of mon.termos_or) {
        const p = parsearTermoOr(t);
        if (!p) continue;
        if (validarAdvogadoMetadados(pub, p.oabDigits, p.nome)) return true;
        const nn = normalizar(p.nome);
        if (nn && contemFrase(textoNorm, nn)) return true;
        if (p.oabDigits && p.oabDigits.length >= 3 && textoNorm.includes(p.oabDigits)) return true;
      }
    }
    return false;
  }
  if (tipo === 'processo') {
    const nd = mon.termo_busca.replace(/\D/g, '');
    const pn = String(pub?.numero_processo || pub?.numeroProcesso || pub?.processo_numero || pub?.processo || '').replace(/\D/g, '');
    return pn.includes(nd);
  }
  if (contemFraseComAnd(textoNorm, mon.termo_busca)) return true;
  if (mon.termos_or?.length) {
    for (const t of mon.termos_or) {
      const p = parsearTermoOr(t);
      if (!p) continue;
      if (contemFraseComAnd(textoNorm, p.nome)) return true;
    }
  }
  return false;
}

function extrairAdvogadosEstruturados(pub: any): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(pub?.destinatarioadvogados)) {
    for (const e of pub.destinatarioadvogados) {
      const adv = e?.advogado || e;
      if (!adv?.nome) continue;
      const key = `${adv.nome}|${adv.numero_oab || ''}`.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const oabStr = adv.numero_oab ? ` - OAB ${adv.uf_oab || ''}${adv.numero_oab}` : '';
      result.push(`${adv.nome}${oabStr}`);
    }
  }
  return result;
}

function extrairPartesEstruturadas(pub: any): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const parte of extrairPartesDeCamposEstruturados(pub)) {
    const key = normalizar(parte);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(parte);
  }
  return result;
}

// ============================================================================
// EXECUTION SYNC
// ============================================================================

function buildSnapshot(overrides: Record<string, any> = {}): any {
  const poolStats = getDjenProxyPoolStats();
  const iniciadoEm = state.progress.iniciadoEm;
  const tempoDecorrido = iniciadoEm && state.progress.status === 'executando'
    ? Math.floor(Math.max(0, Date.now() - new Date(iniciadoEm).getTime()) / 1000)
    : state.progress.tempoDecorrido;
  return {
    progressStatus: state.progress.status,
    runKey: state.progress.dataInicioYmd && state.progress.dataFimYmd
      ? `${state.progress.dataInicioYmd}..${state.progress.dataFimYmd}`
      : null,
    dataInicioYmd: state.progress.dataInicioYmd,
    dataFimYmd: state.progress.dataFimYmd,
    totalTribunais: state.progress.totalTribunais,
    tribunaisConcluidos: state.progress.tribunaisConcluidos,
    novas: state.progress.novas,
    duplicadas: state.progress.duplicadas,
    descartadas: state.progress.descartadas,
    percentage: state.progress.percentage,
    mensagem: state.progress.mensagem,
    tempoDecorrido,
    iniciadoEm,
    tracks: state.progress.tracks.map(t => ({
      tribunal: t.tribunal,
      status: t.status,
      current: t.current,
      total: t.total,
      novas: t.novas,
      duplicadas: t.duplicadas,
      descartadas: t.descartadas,
      mensagem: t.mensagem,
      termoAtual: t.termoAtual,
      diaAtual: t.diaAtual,
      rateLimitHits: t.rateLimitHits,
      ultimoErro: t.ultimoErro,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
      lastViaId: t.lastViaId,
      lastViaLabel: t.lastViaLabel,
      lastViaKind: t.lastViaKind,
      callsDirect: t.callsDirect,
      callsByProxy: t.callsByProxy,
    })),
    pool_stats: poolStats,
    heartbeat_at: new Date().toISOString(),
    concorrencia: state.progress.concorrencia,
    ...overrides,
  };
}

function syncExecutionProgress(overrides: Record<string, any> = {}, force = false) {
  if (!state.executionId) return;
  const now = Date.now();
  if (!force && now - state.lastExecutionSyncAt < EXECUTION_SYNC_INTERVAL_MS) return;
  state.lastExecutionSyncAt = now;
  const erros = state.progress.tracks.filter(t => t.status === 'erro').length;
  void supabase
    .from('execucoes_agendadas')
    .update({
      detalhes: buildSnapshot(overrides),
      lotes_processados: state.progress.tribunaisConcluidos,
      total_lotes: state.progress.totalTribunais,
      registros_processados: state.progress.novas + state.progress.duplicadas + state.progress.descartadas,
      registros_encontrados: state.progress.novas,
      erros,
    })
    .eq('id', state.executionId)
    .then(({ error }) => {
      if (error) console.warn('[DJEN Paralela] Sync error:', error.message);
    });
}

async function markActiveParalelaExecutions(payload: Record<string, any>): Promise<void> {
  const activeId = state.executionId;
  if (activeId) state.resetExecutionIds.add(activeId);
  const { data, error } = await supabase
    .from('execucoes_agendadas')
    .update(payload)
    .eq('tipo', 'djen_paralela')
    .eq('status', 'executando')
    .is('finalizado_em', null)
    .select('id');

  if (error) {
    console.warn('[DJEN Paralela] Falha ao cancelar execução no banco:', error.message);
    return;
  }
  for (const row of data || []) state.resetExecutionIds.add(String(row.id));
}

// ============================================================================
// PROCESSAMENTO POR TRIBUNAL (TRACK)
// ============================================================================

/**
 * Processa um tribunal: percorre todos os dias × termos para esse tribunal.
 * Chamada concorrentemente para múltiplos tribunais via semáforo.
 */
async function processarTribunalTrack(
  tribunal: string,
  monitoramentos: Monitoramento[],
  datas: string[],
  signal: AbortSignal,
  viaId?: string,
) {
  const track = state.progress.tracks.find(t => t.tribunal === tribunal);
  if (!track) return;

  // Filtrar monitoramentos que devem ser executados nesse tribunal
  const monsParaEsseTrib = monitoramentos.filter(mon => {
    const tribs = expandirTribunaisDoMon(mon.tribunais);
    // Se o monitoramento não tem tribunais (= todos), inclui esse tribunal.
    if (tribs.length === 0) return true;
    return tribs.includes(tribunal);
  });

  const total = monsParaEsseTrib.length * datas.length;
  updateTrack(tribunal, {
    status: 'executando',
    total,
    current: 0,
    startedAt: Date.now(),
    mensagem: `Iniciando ${monsParaEsseTrib.length} termos × ${datas.length} dias`,
  });

  if (total === 0) {
    updateTrack(tribunal, {
      status: 'concluido',
      finishedAt: Date.now(),
      mensagem: 'Sem termos aplicáveis a este tribunal',
    });
    return;
  }

  let acumNovas = 0, acumDup = 0, acumDesc = 0, rateLimitHits = 0;
  let ultimoErro: string | null = null;
  let processed = 0;

  try {
    for (const diaYmd of datas) {
      if (signal.aborted) break;

      for (const mon of monsParaEsseTrib) {
        if (signal.aborted) break;

        // Cooldown global PJE
        const cooldown = getPjeComunicaGlobalCooldownRemainingMs();
        if (cooldown > 250) {
          updateTrack(tribunal, { mensagem: `⏸ Cooldown PJE ${Math.round(cooldown / 1000)}s` });
          await awaitPjeComunicaGlobalCooldown();
          if (signal.aborted) break;
        }

        updateTrack(tribunal, {
          termoAtual: mon.descricao || mon.termo_busca,
          diaAtual: diaYmd,
          mensagem: `[${diaYmd}] ${mon.descricao || mon.termo_busca}`,
        });

        try {
          const r = await processarTermoEmTribunal(mon, diaYmd, tribunal, signal, viaId);
          acumNovas += r.novas;
          acumDup += r.duplicadas;
          acumDesc += r.descartadas;
          rateLimitHits += r.rateLimitHits;
          ultimoErro = r.ultimoErro ?? null;
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          ultimoErro = e?.message || String(e);
          console.warn(`[DJEN Paralela][${tribunal}] erro termo:`, e?.message);
        }

        processed++;
        updateTrack(tribunal, {
          current: processed,
          novas: acumNovas,
          duplicadas: acumDup,
          descartadas: acumDesc,
          rateLimitHits,
          ultimoErro,
        });

        syncExecutionProgress();
        await abortableDelay(CONFIG.delay_between_terms, signal);
      }
    }

    updateTrack(tribunal, {
      status: signal.aborted ? 'cancelado' : 'concluido',
      current: signal.aborted ? processed : total,
      finishedAt: Date.now(),
      mensagem: signal.aborted
        ? 'Cancelado'
        : `Concluído: ${acumNovas} novas, ${acumDup} duplicadas, ${acumDesc} descartadas`,
    });
  } catch (e: any) {
    updateTrack(tribunal, {
      status: 'erro',
      finishedAt: Date.now(),
      ultimoErro: e?.message || String(e),
      mensagem: `Erro: ${e?.message || 'desconhecido'}`,
    });
  }
}

/**
 * Processa um termo num tribunal específico (uma data).
 * Versão simplificada do processarTermoPro do engine Pro.
 */
async function processarTermoEmTribunal(
  mon: Monitoramento,
  diaYmd: string,
  tribunal: string,
  signal: AbortSignal,
  viaId?: string,
): Promise<{ novas: number; duplicadas: number; descartadas: number; rateLimitHits: number; ultimoErro: string | null }> {
  if (signal.aborted) return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits: 0, ultimoErro: null };

  // `nome` é um tipo válido no banco, mas a API do PJE Comunica não aceita
  // esse literal em `tipo`. Para manter a busca correta, usamos palavra-chave.
  const tipo: PjeSearchType = mon.tipo === 'parte'
    ? 'parte'
    : mon.tipo === 'nome'
      ? 'palavra-chave'
      : mon.tipo;
  const resultados: any[] = [];
  const seen = new Set<string>();
  const seenContent = new Set<string>();
  let rateLimitHits = 0;
  let ultimoErro: string | null = null;

  const addResults = (items: any[]) => {
    for (const item of items) {
      const id = String(item?.id ?? '');
      const k = id || JSON.stringify(item).slice(0, 400);
      if (seen.has(k)) continue;
      seen.add(k);
      const conteudo = String(item?.texto ?? item?.conteudo ?? item?.teor ?? '');
      const proc = String(item?.numeroProcesso ?? '').replace(/\D/g, '');
      const ck = `${proc}|${conteudo.slice(0, 300).toLowerCase().trim()}`;
      if (ck.length > 5 && seenContent.has(ck)) continue;
      if (ck.length > 5) seenContent.add(ck);
      resultados.push({ ...item, siglaTribunal: item?.siglaTribunal ?? tribunal });
    }
  };

  const baseParams: any = {
    tipo,
    dataInicio: diaYmd,
    dataFim: diaYmd,
    pageSize: 50,
    siglaTribunal: tribunal,
  };

  if (tipo === 'parte') {
    baseParams.nomeParte = mon.termo_busca;
  } else if (tipo === 'advogado') {
    baseParams.oab = mon.oab ? String(mon.oab).replace(/\D/g, '') : undefined;
    baseParams.nomeAdvogado = mon.termo_busca?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    baseParams.uf = mon.uf;
  } else if (tipo === 'processo') {
    baseParams.numeroProcesso = mon.termo_busca.replace(/\D/g, '');
  } else {
    if (mon.termo_busca.includes('+')) {
      const partes = mon.termo_busca.split('+').map(p => p.trim()).filter(Boolean).filter(p => !/^OAB\s/i.test(p));
      const maior = partes.sort((a, b) => b.length - a.length)[0] || mon.termo_busca;
      baseParams.palavraChave = encurtarParaApi(maior);
    } else {
      baseParams.palavraChave = encurtarParaApi(mon.termo_busca);
    }
  }

  try {
    const resp = await buscarPjeComunicaPaginado({ ...baseParams, page: 1 }, {
      signal,
      maxPages: null,
      continueUntilEmpty: true,
      delayMs: CONFIG.delay_between_pages,
      maxRetries: CONFIG.max_retries,
      retryBaseDelay: CONFIG.retry_base_delay,
      onRateLimit: (waitMs, attempt, page) => {
        rateLimitHits++;
        ultimoErro = `HTTP 429 pág. ${page} (tentativa ${attempt})`;
      },
      onPoolVia: (via) => registrarViaTrack(tribunal, via),
      forceVia: viaId,
      fallbackToDirect: viaId === DIRECT_SLOT_ID,
    });
    addResults(resp.items);
    ultimoErro = resp.lastError ?? null;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    ultimoErro = e?.message || 'Falha de busca';
  }

  // Busca complementar para "parte": varre tribunal/data sem termo textual e
  // a validação posterior continua estrita em Parte(s)/polos estruturados.
  // Não usa fallback por conteúdo/palavra-chave.
  if (tipo === 'parte' && !signal.aborted) {
    try {
      const resp = await buscarPjeComunicaPaginado({
        tipo: 'palavra-chave' as PjeSearchType,
        palavraChave: '*',
        siglaTribunal: tribunal,
        dataInicio: diaYmd,
        dataFim: diaYmd,
        pageSize: 50,
        page: 1,
      }, {
        signal,
        maxPages: null,
        continueUntilEmpty: true,
        delayMs: CONFIG.delay_between_pages,
        maxRetries: CONFIG.max_retries,
        retryBaseDelay: CONFIG.retry_base_delay,
        onRateLimit: () => { rateLimitHits++; },
        onPoolVia: (via) => registrarViaTrack(tribunal, via),
        forceVia: viaId,
        fallbackToDirect: viaId === DIRECT_SLOT_ID,
      });
      addResults(resp.items);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
    }
  }

  // Retry automático: a API do PJE Comunica ocasionalmente devolve listagem
  // vazia (sem 429/5xx) para um termo que tem publicações. Antes de desistir,
  // refazemos uma única tentativa após pequeno delay.
  if (!signal.aborted && resultados.length === 0) {
    try {
      await abortableDelay(1500, signal);
      if (!signal.aborted) {
        console.warn(`[DJEN Paralela][${tribunal}] ${mon.termo_busca}: 0 resultados na 1ª passada — refazendo busca.`);
        const respRetry = await buscarPjeComunicaPaginado({ ...baseParams, page: 1 }, {
          signal,
          maxPages: null,
          continueUntilEmpty: true,
          delayMs: CONFIG.delay_between_pages,
          maxRetries: CONFIG.max_retries,
          retryBaseDelay: CONFIG.retry_base_delay,
          onRateLimit: (waitMs, attempt, page) => {
            rateLimitHits++;
            ultimoErro = `HTTP 429 pág. ${page} (tentativa ${attempt})`;
          },
          onPoolVia: (via) => registrarViaTrack(tribunal, via),
          forceVia: viaId,
          fallbackToDirect: viaId === DIRECT_SLOT_ID,
        });
        addResults(respRetry.items);
        if (respRetry.items.length > 0) {
          console.log(`[DJEN Paralela][${tribunal}] ${mon.termo_busca}: retry recuperou ${respRetry.items.length} item(ns).`);
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
    }
  }

  if (signal.aborted) {
    return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
  }

  if (resultados.length === 0) {
    return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
  }

  // Filtros declarados pelo monitoramento
  const tribunaisMon = expandirTribunaisDoMon(mon.tribunais);
  let descartadas = 0;
  let foraDoPeriodo = 0;
  const pubsDescartadas: any[] = [];

  const pubsValidas = resultados.filter(pub => {
    const dataDispReal = extrairDataDisponibilizacaoYmd(pub);
    if (dataDispReal && dataDispReal !== diaYmd) {
      foraDoPeriodo++;
      return false;
    }
    if (tribunaisMon.length > 0) {
      const sig = getSiglaTribunal(pub);
      if (!sig || !tribunaisMon.includes(sig)) {
        descartadas++;
        pubsDescartadas.push({ ...pub, motivo_descarte: 'tribunal_nao_permitido' });
        return false;
      }
    }
    const exc = temExclusao(pub, mon.exclusoes);
    if (exc) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: `excluido: ${exc}` });
      return false;
    }
    if (!validarTermo(pub, mon)) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: 'termo_nao_encontrado' });
      return false;
    }
    if (!condicaoConcomitanteAtendida(pub, mon.condicao_concomitante)) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: 'condicao_concomitante' });
      return false;
    }
    return true;
  });

  const hashMap = new Map<string, any>();
  for (const pub of pubsValidas) {
    const conteudo = pub.texto || pub.conteudo || pub.teor || '';
    const dataDisp = extrairDataDisponibilizacaoYmd(pub) || diaYmd;
    const procNum = pub.numeroProcesso || pub.numero_processo || pub.processo_numero || pub.processo || '';
    const hash = gerarHash(conteudo, dataDisp, procNum);
    if (!hashMap.has(hash)) hashMap.set(hash, { ...pub, hash_conteudo: hash, data_disponibilizacao_ymd: dataDisp });
  }
  const pubsUnicas = Array.from(hashMap.values());
  const pubsParaDedup = pubsUnicas;

  if (foraDoPeriodo > 0) {
    ultimoErro = `API devolveu ${foraDoPeriodo} resultado(s) fora de ${diaYmd}; ignorados.`;
    console.warn(`[DJEN Paralela][${tribunal}] ${mon.termo_busca}: ${foraDoPeriodo} resultado(s) fora de ${diaYmd} ignorados.`);
  }

  const chavesCandidatas = pubsParaDedup.map((p) => {
    const conteudoOriginal = p.texto || p.conteudo || p.teor || '';
    const conteudoFormatado = buildDjenLikeConteudo({
      pub: p,
      diaYmd,
      monitoramento: { tipo: mon.tipo, termo: mon.termo_busca, oab: mon.oab, uf: mon.uf },
      conteudoOriginal,
    });
    return montarChaveEncontrada({
      coordenacaoId: mon.coordenacao_id,
      processoNumero: p.numeroProcesso || p.numero_processo || p.processo_numero || p.processo || null,
      dataRefYmd: p.data_disponibilizacao_ymd,
      conteudo: conteudoFormatado,
    });
  });

  const hashesCandidatos = pubsParaDedup.map((p) => String(p.hash_conteudo || '')).filter(Boolean);
  let hashesEncontrados = new Set<string>();
  if (hashesCandidatos.length > 0) {
    let hashQuery = supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('status', 'encontrada')
      .in('hash_conteudo', hashesCandidatos);
    hashQuery = mon.coordenacao_id
      ? hashQuery.eq('coordenacao_id', mon.coordenacao_id)
      : hashQuery.is('coordenacao_id', null);
    const { data: existentesPorHash } = await hashQuery;
    hashesEncontrados = new Set((existentesPorHash || []).map((r: any) => String(r.hash_conteudo || '')));
  }

  let chavesEncontradas = new Set<string>();
  if (chavesCandidatas.length > 0) {
      const processosDigits = Array.from(new Set(pubsParaDedup.map((p) => String(p.numeroProcesso || p.numero_processo || p.processo_numero || p.processo || '').replace(/\D/g, '')).filter(Boolean)));
      const datasRef = Array.from(new Set(pubsParaDedup.map((p) => p.data_disponibilizacao_ymd).filter(Boolean)));
    if (processosDigits.length > 0 && datasRef.length > 0) {
      let dedupQuery = supabase
        .from('publicacoes_djen')
        .select('coordenacao_id, processo_numero, conteudo, data_disponibilizacao, data_publicacao, dedup_processo_digits, dedup_data_ref, dedup_head_norm')
        .eq('status', 'encontrada')
        .in('dedup_processo_digits', processosDigits)
        .in('dedup_data_ref', datasRef);
      dedupQuery = mon.coordenacao_id
        ? dedupQuery.eq('coordenacao_id', mon.coordenacao_id)
        : dedupQuery.is('coordenacao_id', null);
      const { data: encontradas } = await dedupQuery;
      chavesEncontradas = new Set((encontradas || []).map((r: any) => montarChaveEncontrada({
        coordenacaoId: r.coordenacao_id,
        processoNumero: r.processo_numero,
        dataRefYmd: String(r.dedup_data_ref || r.data_disponibilizacao || r.data_publicacao || '').slice(0, 10),
        conteudo: r.conteudo,
        dedupProcessoDigits: r.dedup_processo_digits,
        dedupHeadNorm: r.dedup_head_norm,
      })));
    }
  }

  const novas = pubsParaDedup.filter((p, idx) => {
    const hash = String(p.hash_conteudo || '');
    return !hashesEncontrados.has(hash) && !chavesEncontradas.has(chavesCandidatas[idx]);
  });
  const duplicadasBanco = pubsParaDedup.length - novas.length;

  let novasInseridasEfetivas = 0;
  let duplicadasReclassificadas = 0;
  if (novas.length > 0) {
    const payload = novas.map(pub => {
      const conteudoOriginal = pub.texto || pub.conteudo || pub.teor || null;
      const conteudoFormatado = buildDjenLikeConteudo({
        pub, diaYmd,
        monitoramento: { tipo: mon.tipo, termo: mon.termo_busca, oab: mon.oab, uf: mon.uf },
        conteudoOriginal,
      });
      const dataDisp = pub.data_disponibilizacao_ymd;
      const dataPub = calcularDataPublicacao(dataDisp);
      const advogados = extrairAdvogadosEstruturados(pub);
      const partes = extrairPartesEstruturadas(pub);
      return {
        monitoramento_id: mon.id,
        hash_conteudo: pub.hash_conteudo,
        processo_numero: pub.numeroProcesso || pub.numero_processo || pub.processo_numero || pub.processo || null,
        conteudo: conteudoFormatado,
        data_disponibilizacao: `${dataDisp}T12:00:00.000Z`,
        data_publicacao: `${dataPub}T12:00:00.000Z`,
        tribunal: getSiglaTribunal(pub),
        fonte: pub.fonte || pub.siglaTribunal || pub.tribunal || 'DJEN-PARALELA',
        lida: false,
        status: 'encontrada' as const,
        orgao: pub.orgao || pub.nomeOrgao || pub.nome_orgao || null,
        tipo_comunicacao: pub.tipo_comunicacao || pub.tipoComunicacao || null,
        meio: pub.meio || pub.meiocompleto || null,
        advogados_json: advogados.length > 0 ? JSON.stringify(advogados) : null,
        partes_json: partes.length > 0 ? JSON.stringify(partes) : null,
        coordenacao_id: mon.coordenacao_id ?? null,
      };
    });

    if (payload.length > 0) {
      // A busca SEMPRE já foi feita. Aqui só persistimos o resultado da comparação
      // pela chave de encontradas; se houver uma duplicada antiga com mesmo hash,
      // reativamos como encontrada em vez de deixar ela bloquear a nova captura.
      const hashesPayload = payload.map((p: any) => p.hash_conteudo).filter(Boolean);
      let inseridosCount = 0;
      for (const lote of chunkArray(payload, 10)) {
        // Sem .select('id'): evita statement timeout com trigger pesado por linha.
        const { error: insertError } = await supabase
          .from('publicacoes_djen')
          .insert(lote);
        if (!insertError) {
          inseridosCount += lote.length;
          continue;
        }
        const msg = String(insertError.message || '');
        const isConflict = insertError.code === '23505' || msg.includes('duplicate key');
        if (!isConflict) {
          console.error(`[DJEN Paralela][${tribunal}] insert error (mon=${mon.id} termo="${mon.termo_busca}"):`, insertError);
          ultimoErro = insertError.message || 'Erro ao gravar publicações';
          continue;
        }
        for (const row of lote) {
          const { error: oneErr } = await supabase
            .from('publicacoes_djen')
            .insert(row);
          const oneMsg = String(oneErr?.message || '');
          const oneIsConflict = oneErr && (oneErr.code === '23505' || oneMsg.includes('duplicate key'));
          if (!oneErr) inseridosCount += 1;
          else if (!oneIsConflict) console.error(`[DJEN Paralela][${tribunal}] insert individual error:`, oneErr);
        }
      }
      // Releitura confirmatória: o trigger pode reclassificar uma linha como
      // 'duplicada' depois do INSERT. Contamos como "novas" apenas as que
      // realmente ficaram com status='encontrada'.
      let efetivamenteEncontradas = inseridosCount;
      if (hashesPayload.length > 0) {
        const { count: encCount } = await supabase
          .from('publicacoes_djen')
          .select('id', { count: 'exact', head: true })
          .eq('monitoramento_id', mon.id)
          .eq('status', 'encontrada')
          .in('hash_conteudo', hashesPayload);
        if (typeof encCount === 'number') efetivamenteEncontradas = encCount;
      }
      novasInseridasEfetivas = efetivamenteEncontradas;
      duplicadasReclassificadas = Math.max(0, hashesPayload.length - efetivamenteEncontradas);
    }
  }

  // Persistir descartadas (limit 200)
  let descartadasEfetivas = 0;
  if (pubsDescartadas.length > 0) {
    const descMap = new Map<string, any>();
    for (const pub of pubsDescartadas) {
      const conteudoOriginal = pub.texto || pub.conteudo || pub.teor || '';
      const conteudoFormatado = buildDjenLikeConteudo({
        pub, diaYmd,
        monitoramento: { tipo: mon.tipo, termo: mon.termo_busca, oab: mon.oab, uf: mon.uf },
        conteudoOriginal,
      });
      const dataDisp = extrairDataDisponibilizacaoYmd(pub) || diaYmd;
      const procNum = pub.numeroProcesso || pub.numero_processo || pub.processo_numero || pub.processo || '';
      const hash = gerarHash(conteudoFormatado + (pub.motivo_descarte || ''), dataDisp, procNum);
      if (descMap.has(hash)) continue;
      const advogados = extrairAdvogadosEstruturados(pub);
      const partes = extrairPartesEstruturadas(pub);
      descMap.set(hash, {
        monitoramento_id: mon.id,
        hash_conteudo: hash,
        processo_numero: pub.numeroProcesso || pub.numero_processo || pub.processo_numero || null,
        conteudo: conteudoFormatado.slice(0, 100000),
        data_publicacao: `${calcularDataPublicacao(dataDisp)}T12:00:00.000Z`,
        data_disponibilizacao: `${dataDisp}T12:00:00.000Z`,
        tribunal: getSiglaTribunal(pub),
        fonte: pub.siglaTribunal || 'DJEN-PARALELA',
        motivo_descarte: pub.motivo_descarte || 'desconhecido',
        orgao: pub.nomeOrgao || null,
        tipo_comunicacao: pub.tipoComunicacao || null,
        meio: pub.meio || null,
        advogados_json: advogados.length > 0 ? JSON.stringify(advogados) : null,
        partes_json: partes.length > 0 ? JSON.stringify(partes) : null,
      });
    }
    const payloadDesc = Array.from(descMap.values()).slice(0, 200);
    descartadasEfetivas = payloadDesc.length;
    await supabase.from('publicacoes_djen_descartadas')
      .upsert(payloadDesc, { onConflict: 'monitoramento_id,hash_conteudo', ignoreDuplicates: true });
  }

  return {
    novas: novasInseridasEfetivas,
    duplicadas: duplicadasBanco + (pubsValidas.length - pubsUnicas.length) + duplicadasReclassificadas,
    descartadas: descartadasEfetivas,
    rateLimitHits,
    ultimoErro,
  };
}

// ============================================================================
// SEMÁFORO + LOOP PRINCIPAL
// ============================================================================

async function executarLoop(
  dataInicioYmd: string,
  dataFimYmd: string,
  retomar: boolean,
  coordenacaoId?: string,
  monitoramentoIds?: string[],
) {
  if (state.isRunning) {
    console.warn('[DJEN Paralela] Já existe execução local em andamento');
    return;
  }

  // POC pool de proxies: zera estatísticas a cada nova execução para
  // permitir comparar antes/depois com clareza.
  resetDjenProxyPoolStats();

  // Verificar execução no banco
  try {
    const { data: running } = await supabase
      .from('execucoes_agendadas')
      .select('id, iniciado_em, detalhes')
      .eq('tipo', 'djen_paralela')
      .eq('status', 'executando')
      .is('finalizado_em', null);
    if (running && running.length > 0) {
      // Considera órfã somente execução sem heartbeat recente. Antes era por
      // iniciado_em > 5min, o que cancelava execuções longas ainda saudáveis.
      const now = Date.now();
      const stale = running.filter((r: any) => {
        const heartbeatMs = r?.detalhes?.heartbeat_at ? new Date(r.detalhes.heartbeat_at).getTime() : 0;
        const iniciadoMs = r?.iniciado_em ? new Date(r.iniciado_em).getTime() : 0;
        return heartbeatMs > 0
          ? now - heartbeatMs > 15 * 60 * 1000
          : iniciadoMs > 0 && now - iniciadoMs > 20 * 60 * 1000;
      });
      if (stale.length > 0) {
        for (const s of stale) {
          const detalhes = s.detalhes && typeof s.detalhes === 'object' && !Array.isArray(s.detalhes)
            ? s.detalhes
            : {};
          await supabase.from('execucoes_agendadas')
            .update({ status: 'erro', finalizado_em: new Date().toISOString(), detalhes: { ...detalhes, mensagem: 'Erro: execução órfã sem heartbeat recente' } })
            .eq('id', s.id);
        }
        if (stale.length !== running.length) {
          updateProgress({
            status: 'erro',
            mensagem: 'Já existe outra execução DJEN Paralela ativa (iniciada há menos de 5 min). Aguarde ou use "Forçar Parada".',
          });
          return;
        }
      } else {
        updateProgress({
          status: 'erro',
          mensagem: 'Já existe outra execução DJEN Paralela ativa (iniciada há menos de 5 min). Aguarde ou use "Forçar Parada".',
        });
        return;
      }
    }
  } catch (e) {
    console.warn('[DJEN Paralela] Erro ao checar execuções no banco:', e);
  }

  state.isRunning = true;
  state.abortController = new AbortController();
  const signal = state.abortController.signal;
  const tempoInicio = Date.now();
  let executionId: string | null = null;

  state.timerInterval = setInterval(() => {
    updateProgress({ tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000) });
    syncExecutionProgress();
  }, 1000);

  try {
    // Carregar monitoramentos
    let query = supabase.from('monitoramentos_djen').select('*').eq('ativo', true);
    if (coordenacaoId) query = query.eq('coordenacao_id', coordenacaoId);
    if (monitoramentoIds?.length) query = query.in('id', monitoramentoIds);
    const { data: termos, error } = await query;
    if (error) throw error;
    if (!termos?.length) {
      console.error('[DJEN Paralela] Nenhum monitoramento retornado', {
        coordenacaoId,
        monitoramentoIdsCount: monitoramentoIds?.length ?? 0,
        monitoramentoIdsSample: monitoramentoIds?.slice(0, 3),
        error,
      });
      const detalhe = coordenacaoId
        ? ` (coordenação ${coordenacaoId.slice(0, 8)}…${monitoramentoIds?.length ? `, ${monitoramentoIds.length} IDs filtrados` : ''})`
        : '';
      updateProgress({ status: 'erro', mensagem: `Nenhum monitoramento ativo encontrado${detalhe}.`, percentage: 0 });
      return;
    }

    const monitoramentos: Monitoramento[] = termos.map((t: any) => ({
      id: t.id, tipo: t.tipo, termo_busca: t.termo_busca,
      oab: t.oab, uf: t.uf, ativo: t.ativo,
      exclusoes: t.exclusoes, tribunais: t.tribunais,
      termos_or: t.termos_or, descricao: t.descricao,
      condicao_concomitante: t.condicao_concomitante,
      coordenacao_id: t.coordenacao_id,
    }));

    // Coletar conjunto único de tribunais a partir dos monitoramentos.
    // Se algum monitoramento não tem tribunais (= todos), incluir TODOS_TRT + TODOS_CIVEIS + STF/STJ.
    const tribSet = new Set<string>();
    let temTodos = false;
    for (const m of monitoramentos) {
      const tribs = expandirTribunaisDoMon(m.tribunais);
      if (tribs.length === 0) temTodos = true;
      else for (const t of tribs) tribSet.add(t);
    }
    if (temTodos) {
      TODOS_TRT.forEach(t => tribSet.add(t));
      TODOS_CIVEIS.forEach(t => tribSet.add(t));
      ['STF', 'STJ', 'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6'].forEach(t => tribSet.add(t));
    }

    const tribunais = ordenarTribunais(Array.from(tribSet));
    if (tribunais.length === 0) {
      updateProgress({ status: 'erro', mensagem: 'Nenhum tribunal a processar.', percentage: 0 });
      return;
    }

    const datas = gerarListaDatas(dataInicioYmd, dataFimYmd);
    if (datas.length === 0) {
      updateProgress({ status: 'erro', mensagem: 'Período inválido.', percentage: 0 });
      return;
    }

    // Checkpoint
    const cp = retomar ? loadCheckpoint() : null;
    const runKey = `${dataInicioYmd}..${dataFimYmd}`;
    const tribunaisJaConcluidos = new Set<string>(
      cp && cp.runKey === runKey ? cp.tribunaisConcluidos : []
    );

    // Inicializar tracks
    const tracks: TrackProgress[] = tribunais.map(trib => ({
      tribunal: trib,
      status: tribunaisJaConcluidos.has(trib) ? 'concluido' : 'pendente',
      current: 0,
      total: 0,
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      mensagem: tribunaisJaConcluidos.has(trib) ? 'Já processado (checkpoint)' : 'Aguardando slot...',
      termoAtual: null,
      diaAtual: null,
      rateLimitHits: 0,
      ultimoErro: null,
      startedAt: null,
      finishedAt: tribunaisJaConcluidos.has(trib) ? Date.now() : null,
      lastViaId: null,
      lastViaLabel: null,
      lastViaKind: null,
      callsDirect: 0,
      callsByProxy: {},
    }));

    updateProgress({
      status: 'executando',
      tracks,
      totalTribunais: tribunais.length,
      tribunaisConcluidos: tribunaisJaConcluidos.size,
      novas: cp?.novas || 0,
      duplicadas: cp?.duplicadas || 0,
      descartadas: cp?.descartadas || 0,
      dataInicioYmd,
      dataFimYmd,
      mensagem: `Preparando workers para ${tribunais.length} tribunais...`,
      concorrencia: 1,
    });

    // Registrar execução no banco
    try {
      const iniciadoEm = new Date().toISOString();
      const { data: inserted, error: insErr } = await supabase
        .from('execucoes_agendadas')
        .insert({
          tipo: 'djen_paralela',
          status: 'executando',
          job_name: 'DJEN Termos Paralela',
          iniciado_em: iniciadoEm,
          detalhes: { runKey, totalTribunais: tribunais.length, dataInicioYmd, dataFimYmd, concorrencia: HOST_BUCKET_LIMITS['pje-comunica'] },
        })
        .select('id');
      if (insErr) console.error('[DJEN Paralela] Falha registrar execução:', insErr.message);
      else if (inserted && inserted.length > 0) {
        executionId = inserted[0].id;
        state.executionId = executionId;
        updateProgress({ iniciadoEm });
      }
    } catch (e) {
      console.error('[DJEN Paralela] Erro inesperado registrar execução:', e);
    }
    state.lastExecutionSyncAt = 0;
    syncExecutionProgress({}, true);

    // ========================================================================
    // ESTRATÉGIA "1 WORKER POR VPS" (pool exclusivo quando habilitado)
    // ========================================================================
    // Se houver VPS habilitada no pool, a Paralela NÃO usa o browser como via.
    // Cada VPS representa um IP independente perante o PJE Comunica e recebe um
    // worker dedicado. O browser direto fica apenas como fallback quando o pool
    // está desligado ou sem VPS válida.

    const tribunaisPendentes = tribunais.filter(t => !tribunaisJaConcluidos.has(t));
    const queue = [...tribunaisPendentes];
    const tribunaisConcluidosLista: string[] = Array.from(tribunaisJaConcluidos);

    try {
      // Sempre sincroniza antes de definir workers. O agendamento automático pode
      // iniciar em navegador sem cache local; sem isto caía para 1 worker Direto.
      await syncDjenProxyPoolFromSupabase();
    } catch (e) {
      console.warn('[DJEN Paralela] Falha ao sincronizar pool de proxies antes da execução:', e);
    }

    type ViaSpec = { id: string; label: string };
    const viasProxy: ViaSpec[] = [];
    const poolAtivo = isDjenProxyPoolEnabled();
    if (poolAtivo) {
      for (const slot of loadDjenProxyPool()) {
        if (slot.enabled && slot.id && slot.baseUrl && slot.token) {
          viasProxy.push({ id: slot.id, label: slot.label || slot.baseUrl });
        }
      }
    }
    const vias: ViaSpec[] = viasProxy.length > 0
      ? [...viasProxy, { id: DIRECT_SLOT_ID, label: 'Direto (browser)' }]
      : [{ id: DIRECT_SLOT_ID, label: 'Direto (browser)' }];
    const usandoPoolVps = viasProxy.length > 0;

    // Concorrência efetiva = mín(nº vias, nº tribunais pendentes).
    const concorrenciaEfetiva = Math.max(1, Math.min(vias.length, tribunaisPendentes.length || 1));
    updateProgress({
      concorrencia: concorrenciaEfetiva,
      mensagem: `Executando: ${tribunais.length} tribunais, ${concorrenciaEfetiva} workers (${vias.map(v => v.label).join(' + ')})`,
    });
    syncExecutionProgress({ pool_enabled: usandoPoolVps, vias: vias.map(v => ({ id: v.id, label: v.label })) }, true);

    const worker = async (via: ViaSpec) => {
      while (queue.length > 0 && !signal.aborted) {
        const trib = queue.shift();
        if (!trib) break;
        try {
          await processarTribunalTrack(trib, monitoramentos, datas, signal, via.id);
        } catch (e) {
          console.error(`[DJEN Paralela][worker ${via.label}] erro tribunal ${trib}:`, e);
        }
        tribunaisConcluidosLista.push(trib);

        saveCheckpoint({
          runKey,
          dataInicioYmd,
          dataFimYmd,
          tribunaisConcluidos: tribunaisConcluidosLista,
          novas: state.progress.novas,
          duplicadas: state.progress.duplicadas,
          descartadas: state.progress.descartadas,
          tempoInicio,
        });
        syncExecutionProgress({}, true);
      }
    };

    const workersToRun = vias.slice(0, concorrenciaEfetiva).map(v => worker(v));
    await Promise.all(workersToRun);

    if (signal.aborted) {
      updateProgress({ status: 'cancelado', mensagem: 'Execução cancelada' });
    } else {
      const tracksAbertas = state.progress.tracks.filter(t => t.status === 'executando' || t.status === 'pendente');
      const tracksComErro = state.progress.tracks.filter(t => t.status === 'erro');
      if (tracksAbertas.length > 0 || tracksComErro.length > 0) {
        updateProgress({
          status: 'erro',
          mensagem: `Execução terminou inconsistente: ${[...tracksAbertas, ...tracksComErro].map(t => t.tribunal).join(', ')} não finalizou corretamente.`,
        });
      } else {
        saveCheckpoint(null);
        updateProgress({
          status: 'concluido',
          percentage: 100,
          mensagem: `Concluído! ${state.progress.novas} novas, ${state.progress.duplicadas} duplicadas, ${state.progress.descartadas} descartadas em ${tribunais.length} tribunais`,
        });
      }
    }
  } catch (err: any) {
    console.error('[DJEN Paralela] Erro:', err);
    updateProgress({ status: 'erro', mensagem: `Erro: ${err?.message || String(err)}` });
  } finally {
    state.isRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (executionId && !state.resetExecutionIds.has(executionId)) {
      try {
        const finalStatus = signal.aborted ? 'cancelado' : (state.progress.status === 'erro' ? 'erro' : 'concluido');
        await supabase.from('execucoes_agendadas')
          .update({
            status: finalStatus,
            finalizado_em: new Date().toISOString(),
            lotes_processados: state.progress.tribunaisConcluidos,
            total_lotes: state.progress.totalTribunais,
            registros_processados: state.progress.novas + state.progress.duplicadas + state.progress.descartadas,
            registros_encontrados: state.progress.novas,
            erros: state.progress.tracks.filter(t => t.status === 'erro').length,
            detalhes: buildSnapshot({ finalStatus }),
          })
          .eq('id', executionId);
      } catch (e) {
        console.warn('[DJEN Paralela] Erro finalizar execução:', e);
      }
      state.executionId = null;
    } else if (executionId && state.executionId === executionId) {
      state.executionId = null;
    }
    if (state.progress.status === 'executando') {
      state.progress = { ...state.progress, status: 'concluido' };
    }
    state.lastUpdatedAt = Date.now();
    notifyListeners();

    // POC pool: imprime resumo de roteamento desta execução.
    if (isDjenProxyPoolEnabled()) {
      const stats = getDjenProxyPoolStats();
      console.log('[DJEN Paralela] 📊 Pool de Proxies — resumo da execução:');
      console.table({
        'Total de chamadas': stats.total,
        'Chamada direta (browser)': stats.direct,
        'Via proxies (soma)': stats.total - stats.direct,
      });
      if (Object.keys(stats.byProxy).length > 0) {
        console.table(
          Object.fromEntries(
            Object.entries(stats.byProxy).map(([id, count]) => [
              id,
              {
                chamadas: count,
                rate_limits_429: stats.rateLimitsByProxy[id] || 0,
                erros_proxy: stats.errorsByProxy[id] || 0,
              },
            ]),
          ),
        );
      }
    }
  }
}

// ============================================================================
// API PÚBLICA (singleton)
// ============================================================================

export function executarDjenTermosParalela(
  dataInicioYmd?: string,
  dataFimYmd?: string,
  retomar = false,
  coordenacaoId?: string,
  monitoramentoIds?: string[],
) {
  const hoje = ymdBrasilia();
  const inicio = dataInicioYmd || hoje;
  const fim = dataFimYmd || hoje;
  void executarLoop(inicio, fim, retomar, coordenacaoId, monitoramentoIds);
}

export async function cancelarDjenTermosParalela() {
  stopLocalExecution();
  // Marcar todos os tracks ativos como cancelando para feedback visual imediato
  const tracks = state.progress.tracks.map(t =>
    t.status === 'executando' || t.status === 'pendente'
      ? { ...t, status: 'cancelado' as TrackStatus, mensagem: 'Cancelado pelo usuário', finishedAt: Date.now() }
      : t
  );
  state.progress = {
    ...state.progress,
    tracks,
    status: 'cancelado',
    mensagem: 'Cancelado pelo usuário',
  };
  state.lastUpdatedAt = Date.now();
  notifyListeners();
  await markActiveParalelaExecutions({
    status: 'cancelado',
    finalizado_em: new Date().toISOString(),
    lotes_processados: state.progress.tribunaisConcluidos,
    total_lotes: state.progress.totalTribunais,
    registros_processados: state.progress.novas + state.progress.duplicadas + state.progress.descartadas,
    registros_encontrados: state.progress.novas,
    erros: state.progress.tracks.filter(t => t.status === 'erro').length,
    detalhes: buildSnapshot({ mensagem: 'Cancelado pelo usuário' }),
  });
  state.executionId = null;
}

export function limparEstadoDjenTermosParalela() {
  state.progress = createDefaultProgress();
  notifyListeners();
}

export async function forceKillDjenTermosParalela(clearCheckpoint = false) {
  stopLocalExecution();
  if (clearCheckpoint) {
    saveCheckpoint(null);
    setResetMarkNow();
  }
  // Limpa qualquer execução órfã do tipo djen_paralela no banco para
  // garantir que o próximo "Executar" não fique bloqueado.
  state.progress = createDefaultProgress();
  state.lastUpdatedAt = Date.now();
  notifyListeners();
  await markActiveParalelaExecutions({
    status: 'cancelado',
    finalizado_em: new Date().toISOString(),
    detalhes: { mensagem: 'Cancelado: forceKill pelo usuário' },
  });
  state.executionId = null;
}

/**
 * Reset TOTAL — limpa absolutamente tudo: estado em memória, checkpoint local,
 * execuções órfãs no banco, stats do pool de proxies e marcações de offline
 * de slots. Use quando uma execução anterior travou em um estado inconsistente
 * (ex.: tribunais marcados como "concluído 100%" porque a VPS deu 404 antes
 * de processar de verdade).
 */
export async function resetTotalDjenTermosParalela() {
  // 1) Para qualquer execução em curso e zera flags
  stopLocalExecution();
  // 2) Apaga checkpoint local
  saveCheckpoint(null);
  setResetMarkNow();
  state.checkpoint = null;
  state.executionId = null;
  state.resetExecutionIds.clear();
  // 3) Zera stats do pool e libera slots offline (para reavaliar VPS na próxima)
  try {
    resetDjenProxyPoolStats();
    getDjenProxySlotsRuntime().forEach(s => clearDjenProxyOfflineMark(s.id));
  } catch { /* noop */ }
  // 4) Reseta progress e notifica UI imediatamente — sem esperar banco/rede.
  state.progress = createDefaultProgress();
  state.lastUpdatedAt = Date.now();
  notifyListeners();

  // 5) Cancela execuções ativas no banco depois do reset visual.
  await markActiveParalelaExecutions({
    status: 'cancelado',
    finalizado_em: new Date().toISOString(),
    lotes_processados: 0,
    total_lotes: 0,
    registros_processados: 0,
    registros_encontrados: 0,
    erros: 0,
    detalhes: { mensagem: 'Reset Total pelo usuário' },
  });
}

export function getDjenTermosParalelaProgress(): DjenTermosParalelaProgress {
  return state.progress;
}

export function isDjenTermosParalelaRunning(): boolean {
  return state.isRunning || state.progress.status === 'executando';
}

export function getCheckpointParalela(): Checkpoint | null {
  return state.checkpoint || loadCheckpoint();
}

export function subscribeDjenTermosParalela(
  listener: (p: DjenTermosParalelaProgress) => void,
): () => void {
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}

export { MAX_CONCURRENCY };

// ============================================================================
// HIDRATAÇÃO A PARTIR DO BANCO — última execução agendada (cron/scheduler)
// ============================================================================
// Quando a Paralela executa sozinha (scheduler diário), o localStorage do
// navegador do usuário não tem checkpoint. Mas o engine grava snapshots
// completos em execucoes_agendadas.detalhes a cada ~15s. Esta função busca
// o snapshot mais recente e reidrata o progress visual da UI.
//
// Não sobrescreve uma execução em curso (isRunning) nem um snapshot mais
// recente já carregado em memória (lastUpdatedAt).
export async function hydrateDjenTermosParalelaFromBackend(): Promise<boolean> {
  try {
    if (state.isRunning) return false;
    const { data, error } = await supabase
      .from('execucoes_agendadas')
      .select('id, status, detalhes, created_at, finalizado_em, iniciado_em, lotes_processados, total_lotes, registros_processados, registros_encontrados')
      .eq('tipo', 'djen_paralela')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    if (state.resetExecutionIds.has(String(data.id))) return false;
    const resetMarkMs = getResetMarkMs();
    const createdMs = data.created_at ? new Date(data.created_at).getTime() : 0;
    if (resetMarkMs > 0 && createdMs > 0 && createdMs <= resetMarkMs) return false;
    const det: any = data.detalhes || {};
    if (!det || typeof det !== 'object') return false;

    const execStatus = String(data.status || '').toLowerCase();

    // Watchdog visual/banco: execução marcada como executando sem heartbeat
    // recente não pode aparecer como concluída nem bloquear o agendamento.
    const heartbeatMs = det.heartbeat_at ? new Date(det.heartbeat_at).getTime() : 0;
    const iniciadoMs = data.iniciado_em ? new Date(data.iniciado_em).getTime() : 0;
    const isStaleRunning = execStatus === 'executando' && (
      heartbeatMs > 0
        ? Date.now() - heartbeatMs > 15 * 60 * 1000
        : iniciadoMs > 0 && Date.now() - iniciadoMs > 20 * 60 * 1000
    );
    if (isStaleRunning) {
      await supabase.from('execucoes_agendadas')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          detalhes: { ...det, mensagem: 'Erro: execução órfã sem heartbeat recente' },
        })
        .eq('id', data.id);
      data.status = 'erro';
      det.mensagem = 'Erro: execução órfã sem heartbeat recente';
    }

    // Não regredir se memória já é mais nova que o snapshot do banco
    const snapTs = det.heartbeat_at ? new Date(det.heartbeat_at).getTime() : 0;
    const dbStatusAfterWatchdog = String(data.status || '').toLowerCase();
    if (
      state.lastUpdatedAt > 0 &&
      snapTs > 0 &&
      snapTs <= state.lastUpdatedAt &&
      dbStatusAfterWatchdog !== 'executando' &&
      dbStatusAfterWatchdog !== 'erro' &&
      dbStatusAfterWatchdog !== 'cancelado'
    ) {
      return false;
    }

    const tracksRaw: any[] = Array.isArray(det.tracks) ? det.tracks : [];
    const tracks: TrackProgress[] = tracksRaw.map((t) => ({
      tribunal: String(t?.tribunal || ''),
      status: (t?.status || 'pendente') as TrackStatus,
      current: Number(t?.current || 0),
      total: Number(t?.total || 0),
      novas: Number(t?.novas || 0),
      duplicadas: Number(t?.duplicadas || 0),
      descartadas: Number(t?.descartadas || 0),
      mensagem: String(t?.mensagem || ''),
      termoAtual: t?.termoAtual ?? null,
      diaAtual: t?.diaAtual ?? null,
      rateLimitHits: Number(t?.rateLimitHits || 0),
      ultimoErro: t?.ultimoErro ?? null,
      startedAt: t?.startedAt ?? null,
      finishedAt: t?.finishedAt ?? null,
      lastViaId: t?.lastViaId ?? null,
      lastViaLabel: t?.lastViaLabel ?? null,
      lastViaKind: t?.lastViaKind ?? null,
      callsDirect: Number(t?.callsDirect || 0),
      callsByProxy: t?.callsByProxy && typeof t.callsByProxy === 'object' ? t.callsByProxy : {},
    }));

    const aggregateFromTracks = tracks.reduce(
      (acc, t) => {
        acc.novas += Number(t.novas || 0);
        acc.duplicadas += Number(t.duplicadas || 0);
        acc.descartadas += Number(t.descartadas || 0);
        acc.current += Number(t.current || 0);
        acc.total += Number(t.total || 0);
        if (t.status === 'concluido' || t.status === 'erro' || t.status === 'cancelado') acc.concluidos += 1;
        return acc;
      },
      { novas: 0, duplicadas: 0, descartadas: 0, current: 0, total: 0, concluidos: 0 },
    );
    const percentageFromTracks = aggregateFromTracks.total > 0
      ? Math.min(100, Math.max(0, Math.round((aggregateFromTracks.current / aggregateFromTracks.total) * 100)))
      : 0;

    // Status do progress: se a execução agendada terminou, refletir 'concluido';
    // se ainda está em andamento mas a UI não está rodando, mostrar como 'concluido'
    // (visualização histórica) — o usuário pode clicar Retomar se quiser.
    const finalStatus: DjenTermosParalelaProgress['status'] =
      String(data.status || '').toLowerCase() === 'executando' ? 'executando'
      : String(data.status || '').toLowerCase() === 'erro' ? 'erro'
      : execStatus === 'cancelado' ? 'cancelado'
      : 'concluido';

    const tempoDecorrido = finalStatus === 'executando' && data.iniciado_em
      ? Math.floor(Math.max(0, Date.now() - new Date(data.iniciado_em).getTime()) / 1000)
      : Number(det.tempoDecorrido || 0)
        || (data.iniciado_em && data.finalizado_em
            ? Math.floor(Math.max(0, new Date(data.finalizado_em).getTime() - new Date(data.iniciado_em).getTime()) / 1000)
            : 0);

    const registrosEncontrados = Number((data as any).registros_encontrados || 0);
    const registrosProcessados = Number((data as any).registros_processados || 0);
    const lotesProcessados = Number((data as any).lotes_processados || 0);
    const totalLotes = Number((data as any).total_lotes || 0);

    state.progress = {
      ...createDefaultProgress(),
      status: finalStatus,
      tracks,
      totalTribunais: Math.max(Number(det.totalTribunais || 0), totalLotes, tracks.length),
      tribunaisConcluidos: Math.max(Number(det.tribunaisConcluidos || 0), aggregateFromTracks.concluidos, lotesProcessados),
      novas: Math.max(Number(det.novas || 0), aggregateFromTracks.novas, registrosEncontrados),
      duplicadas: Math.max(Number(det.duplicadas || 0), aggregateFromTracks.duplicadas),
      descartadas: Math.max(Number(det.descartadas || 0), aggregateFromTracks.descartadas, registrosProcessados),
      percentage: Math.max(Math.min(100, Math.max(0, Number(det.percentage || 0))), percentageFromTracks),
      mensagem: String(det.mensagem || `Última execução agendada — ${finalStatus}`),
      tempoDecorrido,
      iniciadoEm: data.iniciado_em ?? det.iniciadoEm ?? null,
      dataInicioYmd: det.dataInicioYmd ?? null,
      dataFimYmd: det.dataFimYmd ?? null,
      concorrencia: Number(det.concorrencia || HOST_BUCKET_LIMITS['pje-comunica']),
      poolStats: det.pool_stats,
    };
    state.lastUpdatedAt = snapTs || Date.now();
    notifyListeners();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// HIDRATAÇÃO INICIAL — restaura progresso visual após F5/reload
// ============================================================================
// Quando o módulo carrega (ex.: após F5), se houver checkpoint salvo no
// localStorage, reconstruímos um snapshot do progress para que a UI mostre:
// - status "cancelado" (execução foi interrompida pelo reload)
// - contadores agregados (novas/duplicadas/descartadas)
// - tribunais já concluídos como tracks com status "concluido"
// Isso evita a sensação de que "perdeu tudo" quando na verdade o checkpoint
// está intacto e o botão Retomar funciona.
(function hydrateFromCheckpoint() {
  try {
    const cp = loadCheckpoint();
    if (!cp) return;
    state.checkpoint = cp;
    const concluidos = Array.isArray(cp.tribunaisConcluidos) ? cp.tribunaisConcluidos : [];
    const tracks: TrackProgress[] = ordenarTribunais(concluidos).map((trib) => ({
      tribunal: trib,
      status: 'concluido',
      current: 0,
      total: 0,
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      mensagem: 'Concluído (checkpoint)',
      termoAtual: null,
      diaAtual: null,
      rateLimitHits: 0,
      ultimoErro: null,
      startedAt: null,
      finishedAt: null,
      lastViaId: null,
      lastViaLabel: null,
      lastViaKind: null,
      callsDirect: 0,
      callsByProxy: {},
    }));
    state.progress = {
      ...createDefaultProgress(),
      status: 'cancelado',
      tracks,
      totalTribunais: concluidos.length,
      tribunaisConcluidos: concluidos.length,
      novas: cp.novas || 0,
      duplicadas: cp.duplicadas || 0,
      descartadas: cp.descartadas || 0,
      // Mostra "X de X concluídos" como 100% das tracks que conseguimos
      // recuperar do checkpoint. Quando o usuário clicar em Retomar, o engine
      // recalcula totalTribunais com a lista completa e o percentual cai para
      // refletir os tribunais que ainda faltam.
      percentage: concluidos.length > 0 ? 100 : 0,
      mensagem: `Execução interrompida — ${concluidos.length} tribunal(is) já concluído(s). Clique em Retomar para continuar.`,
      dataInicioYmd: cp.dataInicioYmd,
      dataFimYmd: cp.dataFimYmd,
    };
  } catch {
    // ignore — hidratação é best-effort
  }
})();