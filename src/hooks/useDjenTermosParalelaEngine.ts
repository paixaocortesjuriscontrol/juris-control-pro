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
import { buildDjenLikeConteudo, sanitizeDjenPublicationText } from "@/utils/djenLikeConteudo";
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

/** Tipos de busca dedicados às VPS (mapeamos 'nome' → 'palavra-chave'). */
export type WorkerTipo = 'parte' | 'advogado' | 'palavra-chave' | 'processo';
// Ordem de prioridade global das filas. `palavra-chave` (termo) e `processo`
// SEMPRE rodam por último — todos os workers só começam essas filas depois que
// `parte` e `advogado` esgotam, independentemente do tipo primário de cada VPS.
const WORKER_TIPOS_ORDER: WorkerTipo[] = ['parte', 'advogado', 'palavra-chave', 'processo'];
const TIPOS_PRIORITARIOS: WorkerTipo[] = ['parte', 'advogado'];
const TIPOS_FINAIS: WorkerTipo[] = ['palavra-chave', 'processo'];

function mapMonTipoToWorkerTipo(tipo: Monitoramento['tipo']): WorkerTipo {
  if (tipo === 'nome') return 'palavra-chave';
  if (tipo === 'geral') return 'palavra-chave';
  return tipo as WorkerTipo;
}

function isShardTrackId(monId?: string | null): boolean {
  return typeof monId === 'string' && monId.startsWith('shard');
}

function trackKey(tipo: WorkerTipo, tribunal: string, monId?: string | null, shardIdx?: number | null): string {
  if (typeof shardIdx === 'number' && Number.isFinite(shardIdx)) return `${tipo}|${tribunal}|shard${shardIdx}`;
  return monId ? `${tipo}|${tribunal}|${monId}` : `${tipo}|${tribunal}`;
}

function tribunalPriorityRank(tribunal: string): number {
  const t = String(tribunal || '').toUpperCase();
  if (t === 'TST') return 0;
  if (t === 'STF') return 1;
  if (t === 'STJ') return 2;
  const trt = t.match(/^TRT(\d{1,2})$/);
  if (trt) return 10 + Number(trt[1]);
  const idx = TRIBUNAL_PRIORITY_ORDER.indexOf(t);
  return idx >= 0 ? 100 + idx : 999;
}

function tipoPriorityRank(tipo: WorkerTipo): number {
  const idx = WORKER_TIPOS_ORDER.indexOf(tipo);
  return idx >= 0 ? idx : 99;
}

function isTribunalPrioritario(tribunal: string): boolean {
  const t = String(tribunal || '').toUpperCase();
  return t === 'TST' || t === 'STF' || t === 'STJ' || /^TRT\d{1,2}$/.test(t);
}

function isRecoverableVpsFailure(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '');
  return /HTTP\s*5\d\d|Falha após|Falha ao buscar|Failed to fetch|Pool DJEN|proxy_slot_timeout|upstream_status|timeout/i.test(msg);
}

function getAlternativeProxyViaIds(currentViaId?: string | null, max = 2): string[] {
  const slots = loadDjenProxyPool()
    .filter((s) => s.enabled && s.id && s.baseUrl && s.token && s.id !== currentViaId)
    .map((s) => s.id);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots.slice(0, max);
}

export interface TrackProgress {
  tribunal: string;
  /** Tipo de busca dedicado a essa track (parte/advogado/palavra-chave/processo). */
  tipo: 'parte' | 'advogado' | 'palavra-chave' | 'processo';
  /**
   * ID do monitoramento dedicado a essa track. Definido apenas para
   * `tipo='parte'`, em que cada monitoramento vira uma unidade de fila
   * independente para permitir paralelismo entre VPSs.
   */
  monId?: string | null;
  /** Rótulo amigável do termo de busca quando monId está presente. */
  monLabel?: string | null;
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
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte' | 'nome' | 'geral';
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
  // Paridade direta com monitor-servidor/engines/paralela.js.
  delay_between_terms: 1000,
  delay_between_pages: 400,
  delay_between_parte_or: 800,
  delay_between_advogado_or: 1800,
  max_retries: 4,
  // Paridade com servidor: 429 → ~8s base (8000*(attempt+1)). 20s travava
  // o worker em retries longos a cada rate-limit isolado.
  retry_base_delay: 8000,
};

// Paridade com DJEN Servidor: grupos grandes são fatiados para que múltiplas
// VPS processem o mesmo (tipo, tribunal) sem serializar tudo em uma única via.
const SHARD_SIZE = 4;
const SHARD_MIN = 2;
const MAIN_TIPOS: WorkerTipo[] = ['parte', 'advogado', 'palavra-chave'];

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
  'pje-comunica': 1,
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
  unitTotal: number;
  unitDone: number;
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
  unitTotal: 0,
  unitDone: 0,
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
  const prev = state.progress;
  const next = { ...prev, ...partial };
  if (prev.status === 'executando' && next.status === 'executando') {
    if (typeof partial.tempoDecorrido === 'number') {
      next.tempoDecorrido = Math.max(prev.tempoDecorrido || 0, partial.tempoDecorrido);
    }
    // percentage e tribunaisConcluidos devem refletir o estado atual; não
    // usar Math.max — isso travava a barra em 100% quando um snapshot antigo
    // contaminava o estado.
  }
  state.progress = next;
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

function updateTrack(tribunal: string, tipo: WorkerTipo, partial: Partial<TrackProgress>, monId?: string | null) {
  const tracks = state.progress.tracks.map(t =>
    (t.tribunal === tribunal && t.tipo === tipo && (t.monId ?? null) === (monId ?? null))
      ? { ...t, ...partial }
      : t
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
  const tempoComputado = state.progress.iniciadoEm && state.progress.status === 'executando'
    ? Math.floor(Math.max(0, Date.now() - new Date(state.progress.iniciadoEm).getTime()) / 1000)
    : state.progress.tempoDecorrido;
  const tempoDecorrido = state.progress.status === 'executando'
    ? Math.max(state.progress.tempoDecorrido || 0, tempoComputado)
    : tempoComputado;
  // Progresso baseado em tracks (tribunais×tipo) concluídos, que é a mesma
  // métrica exibida no header "X/Y tribunais". Sempre reflete o estado real
  // — NÃO usar Math.max com o valor anterior, senão um snapshot remoto
  // contaminado por execução anterior trava a barra em 100% enquanto o
  // header continua mostrando 250/354.
  const percentage = tracks.length > 0
    ? Math.min(100, Math.max(0, Math.round((concluidos / tracks.length) * 100)))
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
function registrarViaTrack(tribunal: string, tipo: WorkerTipo, via: PoolViaInfo, monId?: string | null) {
  const tracks = state.progress.tracks.map(t => {
    if (t.tribunal !== tribunal || t.tipo !== tipo || (t.monId ?? null) !== (monId ?? null)) return t;
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
  // NUNCA fatiar o termo. A busca DJEN por palavra-chave precisa enviar
  // a expressão INTEIRA configurada (ex.: "UNIÃO QUÍMICA" / "SEU ZÉ"),
  // apenas normalizada sem acentos para casar com o índice da API.
  // A validação local depois confirma a frase exata na ordem.
  return termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function termoParteParaBusca(raw: string): string {
  const parsed = parsearTermoOr(raw);
  return String(parsed?.nome || raw || '').trim();
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

function extrairIdDjen(item: any): string | null {
  const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const raw = item?.id_djen
    ?? item?.id
    ?? item?.codigoComunicacao
    ?? item?.codigo_comunicacao
    ?? item?.idComunicacao
    ?? item?.id_comunicacao
    ?? item?.comunicacaoId
    ?? item?.comunicacao_id
    ?? item?.codigo
    ?? null;
  const id = raw != null ? String(raw).trim() : '';
  return id && !isUuid(id) ? id : null;
}

function gerarHashPublicacao(conteudo: string, data: string, processoNumero?: string, idDjen?: string | null): string {
  return gerarHash(idDjen ? `id_djen:${idDjen}` : conteudo, data, processoNumero);
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

function parseArrayLike(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getTextoPublicacao(pub: any): string {
  const obj = pub?.comunicacao && typeof pub.comunicacao === 'object' ? pub.comunicacao : pub;
  return String(obj?.texto || obj?.conteudo || obj?.teor || pub?.texto || pub?.conteudo || pub?.teor || '');
}

function extrairSecaoAdvogadosTexto(pub: any): string {
  const texto = getTextoPublicacao(pub);
  if (!texto) return '';
  const headerRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?\s*/ig;
  const stopRe = /\b(?:Parte\s*\(\s*s\s*\)|Destinat[áa]rio(?:\(a\))?|Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(texto)) !== null) {
    const start = m.index + m[0].length;
    const after = texto.slice(start, start + 1800);
    const stop = after.search(stopRe);
    const section = (stop >= 0 ? after.slice(0, stop) : after).trim();
    if (section) out.push(section);
  }
  return out.join('\n');
}

function extrairSecoesPartesTexto(pub: any): string[] {
  const texto = getTextoPublicacao(pub);
  if (!texto) return [];
  const headers = [
    /\bParte\s*\(\s*s\s*\)\s*:?\s*/ig,
    /\bPolo\s+ativo\s*:?\s*/ig,
    /\bPolo\s+passivo\s*:?\s*/ig,
    /\bDestinat[áa]rio(?:\(a\))?\s*:?\s*/ig,
  ];
  const stopRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?|(?:^|\n)\s*(?:Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out: string[] = [];
  for (const re of headers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const start = m.index + m[0].length;
      const after = texto.slice(start, start + 1800);
      const stop = after.search(stopRe);
      const section = (stop >= 0 ? after.slice(0, stop) : after).trim();
      if (section) out.push(section);
    }
  }
  return out;
}

function parseOabFromString(raw: string): { numero_oab?: string; uf_oab?: string } {
  const text = normalizar(raw);
  let m = text.match(/OAB\s+([A-Z]{2})\s*(\d{3,7})/i);
  if (m) return { uf_oab: m[1].toUpperCase(), numero_oab: m[2] };
  m = text.match(/OAB\s+(\d{3,7})\s*([A-Z]{2})/i);
  if (m) return { uf_oab: m[2].toUpperCase(), numero_oab: m[1] };
  m = text.match(/\b([A-Z]{2})\s*(\d{3,7})\b/i);
  if (m) return { uf_oab: m[1].toUpperCase(), numero_oab: m[2] };
  return {};
}

function normalizarAdvogadoEntry(entry: any): { nome: string; numero_oab?: string; uf_oab?: string } | null {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = sanitizeDjenPublicationText(entry).replace(/\s+/g, ' ').trim();
    if (!text || text.length > 180 || /[<>]|&[A-Za-z]+;?/i.test(text)) return null;
    const parsed = parseOabFromString(text);
    const nome = text
      .replace(/^ADVOGADO\s*\(\s*A\s*\)\s*:?[\s-]*/i, '')
      .replace(/\s*-?\s*OAB\b.*$/i, '')
      .trim();
    return nome ? { nome, ...parsed } : null;
  }
  const adv = entry?.advogado || entry;
  if (!adv || typeof adv !== 'object') return null;
  const nome = sanitizeDjenPublicationText(adv.nome || adv.nomeAdvogado || adv.nomeRepresentante || adv.nome_representante || adv.nomeProcurador || '').replace(/\s+/g, ' ').trim();
  if (!nome || nome.length > 180 || /[<>]|&[A-Za-z]+;?/i.test(nome)) return null;
  const numero_oab = String(adv.numero_oab || adv.numeroOab || adv.oab || adv.inscricaoOab || '').replace(/\D/g, '');
  const uf_oab = String(adv.uf_oab || adv.ufOab || adv.uf || adv.siglaUf || '').trim().toUpperCase();
  return nome ? { nome, ...(numero_oab ? { numero_oab } : {}), ...(uf_oab ? { uf_oab } : {}) } : null;
}

function coletarAdvogadosEstruturados(pub: any): Array<{ nome: string; numero_oab?: string; uf_oab?: string }> {
  const roots = pub?.comunicacao && typeof pub.comunicacao === 'object' ? [pub, pub.comunicacao] : [pub];
  const result: Array<{ nome: string; numero_oab?: string; uf_oab?: string }> = [];
  const seen = new Set<string>();
  const add = (entry: any) => {
    const adv = normalizarAdvogadoEntry(entry);
    if (!adv?.nome) return;
    const key = normalizar(`${adv.nome}|${adv.uf_oab || ''}|${adv.numero_oab || ''}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(adv);
  };
  for (const root of roots) {
    for (const field of ['destinatarioadvogados', 'advogados', 'representantes', 'procuradores', 'advogados_json']) {
      for (const entry of parseArrayLike(root?.[field])) add(entry);
    }
    for (const dest of parseArrayLike(root?.destinatarios)) {
      for (const field of ['advogados', 'representantes', 'procuradores']) {
        for (const entry of parseArrayLike(dest?.[field])) add(entry);
      }
      if (dest?.nomeAdvogado) add({ nome: dest.nomeAdvogado, numeroOab: dest.numeroOab, ufOab: dest.ufOab });
    }
  }
  return result;
}

function validarAdvogadoSecaoAdvogados(pub: any, oab?: string, nome?: string): boolean {
  const secaoNorm = normalizar(extrairSecaoAdvogadosTexto(pub));
  if (!secaoNorm) return false;
  const nomeNorm = nome ? normalizar(nome) : '';
  if (nomeNorm && contemFrase(secaoNorm, nomeNorm)) return true;
  if (pub?.__advogadoOabFallback && oab) {
    const oabDigits = String(oab).replace(/\D/g, '');
    if (oabDigits.length >= 3 && secaoNorm.includes(oabDigits)) return true;
  }
  return false;
}

function validarAdvogadoMetadados(pub: any, oab?: string, nome?: string): boolean {
  const advs = coletarAdvogadosEstruturados(pub);
  if (advs.length === 0) return false;
  const oabDigits = oab ? String(oab).replace(/\D/g, '') : '';
  const nomeNorm = nome ? normalizar(nome) : '';
  // Regra única: o nome buscado precisa aparecer como FRASE CONTÍGUA (na ordem,
  // com fronteira de palavra) dentro do nome encontrado nos metadados. Sem
  // limite de tokens — se o nome configurado for curto, a advogada descarta
  // hom\u00f4nimos manualmente. Já a OAB só vale como prova quando a publicação
  // veio do fallback OAB (pub.__advogadoOabFallback), evitando matches por
  // OAB de outro advogado em consultas feitas por nome.
  const oabFallbackAtivo = pub?.__advogadoOabFallback === true;
  for (const adv of advs) {
    if (oabFallbackAtivo && oabDigits && adv.numero_oab) {
      if (String(adv.numero_oab).replace(/\D/g, '') === oabDigits) return true;
    }
    if (nomeNorm && adv.nome) {
      const advNorm = normalizar(adv.nome);
      if (contemFrase(advNorm, nomeNorm)) return true;
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
    const s = typeof raw === 'string'
      ? raw
      : (raw?.nome || raw?.nomeParte || raw?.parte || raw?.nomeDestinatario || raw?.destinatarioNome || '');
    if (!s) return false;
    // pode vir vários nomes separados por vírgula
    const candidatos = String(s).split(/\s*,\s*|\s*;\s*/).map(x => x.trim()).filter(Boolean);
    for (const c of candidatos) {
      const cn = normalizar(c);
      if (!cn) continue;
      // ESTRITO: a parte estruturada precisa CONTER o termo buscado como FRASE
      // (com fronteira de palavra). Nunca aceitar o inverso, senão iniciais
      // como "A.", "J.P." casam com qualquer termo que contenha essas letras.
      if (contemFrase(cn, nomeNorm)) return true;
    }
    return false;
  };
  if (Array.isArray(pub?.destinatarios)) {
    for (const d of pub.destinatarios) if (matches(d)) return true;
  }
  if (matches(pub?.poloAtivo) || matches(pub?.polo_ativo)) return true;
  if (matches(pub?.poloPassivo) || matches(pub?.polo_passivo)) return true;
  if (matches(pub?.destinatarioNome) || matches(pub?.destinatario_nome) || matches(pub?.nomeDestinatario)) return true;
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

function validarParteSecaoPartes(pub: any, nomeParte: string): boolean {
  const nomeNorm = normalizar(nomeParte);
  if (!nomeNorm) return false;
  return extrairSecoesPartesTexto(pub).some((secao) => {
    const secaoNorm = normalizar(secao);
    return secaoNorm.length >= 3 && contemFrase(secaoNorm, nomeNorm);
  });
}

function extrairPartesDeCamposEstruturados(pub: any): string[] {
  const result: string[] = [];
  const add = (raw: any, polo?: string) => {
    if (!raw) return;
    const s = typeof raw === 'string'
      ? raw
      : (raw?.nome || raw?.nomeParte || raw?.parte || raw?.nomeDestinatario || raw?.destinatarioNome || '');
    if (!s) return;
    for (const nome of sanitizeDjenPublicationText(s).split(/\s*,\s*|\s*;\s*/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      if (nome.length > 180 || /[<>]|&[A-Za-z]+;?/i.test(nome)) continue;
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
  add(pub?.destinatarioNome || pub?.destinatario_nome || pub?.nomeDestinatario, 'Destinatário');
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

function textoPartesEstruturadas(pub: any): string {
  return [...extrairPartesDeCamposEstruturados(pub), ...extrairSecoesPartesTexto(pub)].join('\n');
}

function temExclusaoEmPartes(pub: any, exclusoes?: string[]): string | null {
  if (!exclusoes?.length) return null;
  const textoNorm = normalizar(textoPartesEstruturadas(pub));
  if (!textoNorm) return null;
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

function condicaoConcomitanteAtendidaEmPartes(pub: any, condicao?: string | null): boolean {
  if (!condicao) return true;
  const grupos = String(condicao).split('|').map(g => g.trim()).filter(Boolean);
  if (grupos.length === 0) return true;
  const textoNorm = normalizar(textoPartesEstruturadas(pub));
  if (!textoNorm) return false;
  return grupos.some(g => {
    const ts = g.split(',').map(t => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every(t => contemFrase(textoNorm, normalizar(t)));
  });
}

function termosDeParte(mon: Monitoramento): string[] {
  const seen = new Set<string>();
  return [mon.termo_busca, ...(mon.termos_or || [])]
    .map((termo) => String(termo || '').trim())
    .filter((termo) => {
      if (!termo) return false;
      const key = normalizar(termo);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validarTermo(pub: any, mon: Monitoramento): boolean {
  const tipo = mon.tipo;
  // Busca Geral: aceita match em QUALQUER campo (partes, advogados, conteúdo, nº processo).
  if (tipo === 'geral') {
    const termos = [mon.termo_busca, ...(mon.termos_or || [])]
      .map((t) => String(t || '').trim())
      .filter(Boolean);
    const textoNorm = normalizar(buildTextoCompleto(pub));
    const pn = String(
      pub?.numero_processo || pub?.numeroProcesso || pub?.processo_numero || pub?.processo || '',
    ).replace(/\D/g, '');
    for (const t of termos) {
      const tn = normalizar(t);
      if (!tn) continue;
      if (contemFrase(textoNorm, tn)) return true;
      if (validarParteMetadados(pub, t)) return true;
      if (validarParteSecaoPartes(pub, t)) return true;
      if (validarAdvogadoMetadados(pub, undefined, t)) return true;
      if (validarAdvogadoSecaoAdvogados(pub, undefined, t)) return true;
      const td = t.replace(/\D/g, '');
      if (td && pn && pn.includes(td)) return true;
    }
    return false;
  }
  if (tipo === 'parte') {
    // REGRA: tipo='parte' SÓ casa em metadados estruturados ou na seção Parte(s).
    // Nunca valida no corpo/teor geral.
    if (validarParteMetadados(pub, mon.termo_busca)) return true;
    if (validarParteSecaoPartes(pub, mon.termo_busca)) return true;
    for (const t of (mon.termos_or || [])) {
      if (validarParteMetadados(pub, String(t))) return true;
      if (validarParteSecaoPartes(pub, String(t))) return true;
    }
    // Nunca confiar apenas no filtro `nomeParte` da API: parte valida só parte.
    return false;
  }

  const textoNorm = normalizar(buildTextoCompleto(pub));
  if (tipo === 'advogado') {
    if (validarAdvogadoMetadados(pub, mon.oab, mon.termo_busca)) return true;
    if (validarAdvogadoSecaoAdvogados(pub, mon.oab, mon.termo_busca)) return true;
    if (mon.termos_or?.length) {
      for (const t of mon.termos_or) {
        const p = parsearTermoOr(t);
        if (!p) continue;
        if (validarAdvogadoMetadados(pub, p.oabDigits, p.nome)) return true;
        if (validarAdvogadoSecaoAdvogados(pub, p.oabDigits, p.nome)) return true;
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

async function buscarPublicacoesJaEncontradasEmOutraCoordenacaoBrowser(
  mon: Monitoramento,
  diaYmd: string,
  tribunal: string,
): Promise<any[]> {
  if (!mon?.coordenacao_id) return [];
  const tipo = mapMonTipoToWorkerTipo(mon.tipo);
  if (!MAIN_TIPOS.includes(tipo)) return [];

  const resgatadas = new Map<string, any>();
  const BATCH = 1000;
  let from = 0;

  while (from <= 10000) {
    const { data, error } = await supabase
      .from('publicacoes_djen')
      .select('id,id_djen,hash_conteudo,processo_numero,conteudo,data_disponibilizacao,data_publicacao,tribunal,fonte,orgao,tipo_comunicacao,meio,advogados_json,partes_json,coordenacao_id')
      .eq('status', 'encontrada')
      .eq('tribunal', tribunal)
      .gte('data_disponibilizacao', `${diaYmd}T00:00:00.000Z`)
      .lte('data_disponibilizacao', `${diaYmd}T23:59:59.999Z`)
      .neq('coordenacao_id', mon.coordenacao_id)
      .range(from, from + BATCH - 1);

    if (error) {
      console.warn('[DJEN Paralela] resgate cross-coord browser falhou:', error.message);
      break;
    }

    const rows = data || [];
    for (const row of rows as any[]) {
      const candidato = {
        ...row,
        id: row.id_djen || row.id,
        texto: row.conteudo,
        teor: row.conteudo,
        dataDisponibilizacao: row.data_disponibilizacao,
        dataPublicacao: row.data_publicacao,
        siglaTribunal: row.tribunal,
        numeroProcesso: row.processo_numero,
        numero_processo: row.processo_numero,
        destinatarioadvogados: row.advogados_json,
        advogados: row.advogados_json,
        destinatarios: row.partes_json,
        partes: row.partes_json,
        __resgatadaDeOutraCoordenacao: row.coordenacao_id,
        __resgatadaDeFonte: 'publicacoes_djen',
      };

      const dataDispReal = extrairDataDisponibilizacaoYmd(candidato);
      if (dataDispReal && dataDispReal !== diaYmd) continue;
      const exc = mon.tipo === 'parte'
        ? temExclusaoEmPartes(candidato, mon.exclusoes)
        : temExclusao(candidato, mon.exclusoes);
      if (exc) continue;
      if (!validarTermo(candidato, mon)) continue;
      const concomitanteOk = mon.tipo === 'parte'
        ? condicaoConcomitanteAtendidaEmPartes(candidato, mon.condicao_concomitante)
        : condicaoConcomitanteAtendida(candidato, mon.condicao_concomitante);
      if (!concomitanteOk) continue;

      const idDjen = extrairIdDjen(candidato);
      const key = idDjen ? `id_djen:${idDjen}` : `row:${row.id}`;
      if (!resgatadas.has(key)) resgatadas.set(key, candidato);
    }

    if (rows.length < BATCH) break;
    from += BATCH;
  }

  return Array.from(resgatadas.values());
}

function extrairAdvogadosEstruturados(pub: any): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const add = (nome: string, numeroOab?: string, ufOab?: string) => {
    const nomeTrim = String(nome || '').trim();
    if (!nomeTrim) return;
    const oabDigits = String(numeroOab || '').replace(/\D/g, '');
    const uf = String(ufOab || '').trim().toUpperCase();
    const key = normalizar(`${nomeTrim}|${uf}|${oabDigits}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const oabStr = oabDigits ? ` - OAB ${uf}${oabDigits}` : '';
    result.push(`${nomeTrim}${oabStr}`);
  };

  for (const adv of coletarAdvogadosEstruturados(pub)) {
    add(adv.nome, adv.numero_oab, adv.uf_oab);
  }

  const secaoAdvogados = extrairSecaoAdvogadosTexto(pub);
  if (secaoAdvogados) {
    for (const linha of secaoAdvogados.split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean)) {
      const cleaned = linha.replace(/^[-•\s]+/, '').trim();
      if (cleaned.length >= 3) add(cleaned);
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
  for (const secao of extrairSecoesPartesTexto(pub)) {
    for (const linha of secao.split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean)) {
      const cleaned = linha.replace(/^[-•\s]+/, '').trim();
      const key = normalizar(cleaned);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
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
      tipo: t.tipo,
      monId: t.monId ?? null,
      monLabel: t.monLabel ?? null,
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
  tipo: WorkerTipo,
  monitoramentos: Monitoramento[],
  datas: string[],
  signal: AbortSignal,
  viaId?: string,
  monId?: string | null,
  monIdsFilter?: string[],
) {
  const track = state.progress.tracks.find(
    t => t.tribunal === tribunal && t.tipo === tipo && (t.monId ?? null) === (monId ?? null),
  );
  if (!track) return;

  // Filtrar monitoramentos que devem ser executados nesse (tribunal, tipo)
  const monsParaEsseTrib = monitoramentos.filter(mon => {
    if (mapMonTipoToWorkerTipo(mon.tipo) !== tipo) return false;
    if (monIdsFilter?.length && !monIdsFilter.includes(mon.id)) return false;
    if (monId && !isShardTrackId(monId) && mon.id !== monId) return false;
    const tribs = expandirTribunaisDoMon(mon.tribunais);
    // Se o monitoramento não tem tribunais (= todos), inclui esse tribunal.
    if (tribs.length === 0) return true;
    return tribs.includes(tribunal);
  });

  const total = monsParaEsseTrib.length * datas.length;
  updateTrack(tribunal, tipo, {
    status: 'executando',
    total,
    current: 0,
    startedAt: Date.now(),
    mensagem: `${tipo}: iniciando ${monsParaEsseTrib.length} termos × ${datas.length} dias`,
  }, monId);

  if (total === 0) {
    updateTrack(tribunal, tipo, {
      status: 'concluido',
      finishedAt: Date.now(),
      mensagem: `${tipo}: sem termos aplicáveis a este tribunal`,
    }, monId);
    return;
  }

  let acumNovas = 0, acumDup = 0, acumDesc = 0, rateLimitHits = 0;
  let ultimoErro: string | null = null;
  let processed = 0;
  let failedGroups = 0;

  try {
    for (const diaYmd of datas) {
      if (signal.aborted) break;

      // Sem OR: cada termo é consultado individualmente. Quando há vários
      // termos no mesmo tribunal, eles rodam em série dentro desta track.
      const grupos: Monitoramento[][] = monsParaEsseTrib.map((m) => [m]);

      for (const grupo of grupos) {
        if (signal.aborted) break;

        // Cooldown PJE por VPS — só aguarda se a VPS desse worker (viaId)
        // estiver realmente em cooldown. Antes era global e travava todas
        // as 6 VPSs quando uma só recebia 429.
        const cooldown = getPjeComunicaGlobalCooldownRemainingMs(viaId);
        if (cooldown > 250) {
          updateTrack(tribunal, tipo, { mensagem: `⏸ Cooldown PJE ${Math.round(cooldown / 1000)}s` }, monId);
          await awaitPjeComunicaGlobalCooldown(viaId);
          if (signal.aborted) break;
        }

        const mensagemTermo = grupo[0].descricao || grupo[0].termo_busca;
        updateTrack(tribunal, tipo, {
          termoAtual: mensagemTermo,
          diaAtual: diaYmd,
          mensagem: `[${diaYmd}] ${mensagemTermo}`,
        }, monId);

        try {
          let r: Awaited<ReturnType<typeof processarTermoEmTribunal>> | null = null;
          try {
            r = await processarTermoEmTribunal(grupo[0], diaYmd, tribunal, signal, viaId, tipo, monId);
          } catch (firstErr: any) {
            if (firstErr?.name === 'AbortError') throw firstErr;
            if (!isRecoverableVpsFailure(firstErr)) throw firstErr;
            const alternatives = getAlternativeProxyViaIds(viaId, 2);
            let lastErr = firstErr;
            for (const altViaId of alternatives) {
              if (signal.aborted) break;
              try {
                updateTrack(tribunal, tipo, { mensagem: `↻ retry em outra VPS (${alternatives.indexOf(altViaId) + 1}/${alternatives.length})` }, monId);
                r = await processarTermoEmTribunal(grupo[0], diaYmd, tribunal, signal, altViaId, tipo, monId);
                break;
              } catch (altErr: any) {
                if (altErr?.name === 'AbortError') throw altErr;
                lastErr = altErr;
                if (!isRecoverableVpsFailure(altErr)) throw altErr;
              }
            }
            if (!r) throw lastErr;
          }
          acumNovas += r.novas;
          acumDup += r.duplicadas;
          acumDesc += r.descartadas;
          rateLimitHits += r.rateLimitHits;
          ultimoErro = r.ultimoErro ?? null;
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          failedGroups += 1;
          ultimoErro = e?.message || String(e);
          console.warn(`[DJEN Paralela][${tribunal}] erro grupo:`, e?.message);
        }

        processed += grupo.length;
        updateTrack(tribunal, tipo, {
          current: processed,
          novas: acumNovas,
          duplicadas: acumDup,
          descartadas: acumDesc,
          rateLimitHits,
          ultimoErro,
        }, monId);

        syncExecutionProgress();
      }
    }

    updateTrack(tribunal, tipo, {
      status: signal.aborted ? 'cancelado' : failedGroups > 0 ? 'erro' : 'concluido',
      current: signal.aborted ? processed : total,
      finishedAt: Date.now(),
      ultimoErro,
      mensagem: signal.aborted
        ? 'Cancelado'
        : failedGroups > 0
          ? `Erro em ${failedGroups} termo(s): ${ultimoErro || 'falha de busca'}`
        : `Concluído: ${acumNovas} novas, ${acumDup} duplicadas, ${acumDesc} descartadas`,
    }, monId);
  } catch (e: any) {
    updateTrack(tribunal, tipo, {
      status: 'erro',
      finishedAt: Date.now(),
      ultimoErro: e?.message || String(e),
      mensagem: `Erro: ${e?.message || 'desconhecido'}`,
    }, monId);
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
  tipoTrack?: WorkerTipo,
  monIdTrack?: string | null,
  preloaded?: { items: any[]; rateLimitHits: number; ultimoErro: string | null } | null,
): Promise<{ novas: number; duplicadas: number; descartadas: number; rateLimitHits: number; ultimoErro: string | null }> {
  if (signal.aborted) return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits: 0, ultimoErro: null };

  // `nome` é um tipo válido no banco, mas a API do PJE Comunica não aceita
  // esse literal em `tipo`. Para manter a busca correta, usamos palavra-chave.
  const tipo: PjeSearchType = mon.tipo === 'parte'
    ? 'parte'
    : mon.tipo === 'nome' || mon.tipo === 'geral'
      ? 'palavra-chave'
      : mon.tipo;
  const resultados: any[] = [];
  const seen = new Set<string>();
  let rateLimitHits = preloaded?.rateLimitHits ?? 0;
  let ultimoErro: string | null = preloaded?.ultimoErro ?? null;

  const addResults = (items: any[], matchMeta: Record<string, any> = {}) => {
    for (const item of items) {
      const idDjen = extrairIdDjen(item);
      const k = idDjen ? `id_djen:${idDjen}` : JSON.stringify(item).slice(0, 400);
      if (seen.has(k)) continue;
      seen.add(k);
      resultados.push({ ...item, ...matchMeta, id_djen: idDjen, id: idDjen ?? item?.id, siglaTribunal: item?.siglaTribunal ?? tribunal });
    }
  };

  const incluirResgatesOutraCoordenacao = async () => {
    if (signal.aborted) return;
    try {
      const resgatadas = await buscarPublicacoesJaEncontradasEmOutraCoordenacaoBrowser(mon, diaYmd, tribunal);
      if (resgatadas.length > 0) {
        addResults(resgatadas, { __resgatadaCrossCoordBrowser: true });
        console.log(`[DJEN Paralela][${tribunal}] Resgate cross-coord browser: ${resgatadas.length} candidata(s) para ${mon.termo_busca}`);
      }
    } catch (e: any) {
      console.warn(`[DJEN Paralela][${tribunal}] resgate cross-coord browser erro:`, e?.message || e);
    }
  };

  // Caminho rápido: items vindos de uma busca agrupada (OR no palavraChave),
  // já pré-filtrados para casarem com este `mon`. Pula a chamada de rede.
  if (preloaded) {
    addResults(preloaded.items);
    await incluirResgatesOutraCoordenacao();
    if (signal.aborted) {
      return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
    }
    if (resultados.length === 0) {
      return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
    }
    return await consolidarResultadosTermo(mon, diaYmd, tribunal, resultados, rateLimitHits, ultimoErro);
  }

  const baseParams: any = {
    tipo,
    dataInicio: diaYmd,
    dataFim: diaYmd,
    pageSize: 50,
    siglaTribunal: tribunal,
  };

  if (tipo === 'advogado') {
    // Regra nova: busca primária SOMENTE por nomeAdvogado (sem OAB/UF).
    // A OAB fica como fallback (uma única chamada extra) caso a busca por
    // nome volte vazia. Validação posterior usa frase contígua nos metadados.
    baseParams.nomeAdvogado = mon.termo_busca?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  } else if (tipo === 'processo') {
    baseParams.numeroProcesso = mon.termo_busca.replace(/\D/g, '');
  } else if (tipo !== 'parte') {
    if (mon.termo_busca.includes('+')) {
      const partes = mon.termo_busca.split('+').map(p => p.trim()).filter(Boolean).filter(p => !/^OAB\s/i.test(p));
      const maior = partes.sort((a, b) => b.length - a.length)[0] || mon.termo_busca;
      baseParams.palavraChave = encurtarParaApi(maior);
    } else {
      baseParams.palavraChave = encurtarParaApi(mon.termo_busca);
    }
  }

  const executarBusca = async (
    params: any,
    matchMeta: Record<string, any> = {},
    forceViaOverride: string | undefined | null = viaId,
  ) => {
    const requestParams = { ...params, page: 1 };
    if (requestParams.tipo === 'parte') {
      if (requestParams.palavraChave) {
        console.error('[DJEN Paralela] Proteção: termo do tipo parte nunca pode enviar palavraChave. Removendo parâmetro.', {
          tribunal,
          termo: mon.termo_busca,
          palavraChave: requestParams.palavraChave,
        });
        delete requestParams.palavraChave;
      }
      if (!requestParams.nomeParte) {
        console.error('[DJEN Paralela] Proteção: termo do tipo parte sem nomeParte. Busca bloqueada.', {
          tribunal,
          termo: mon.termo_busca,
        });
        return { items: [], pagesFetched: 0, lastError: 'tipo parte sem nomeParte' } as any;
      }
    }

    const resp = await buscarPjeComunicaPaginado(requestParams, {
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
      onPoolVia: (via) => registrarViaTrack(tribunal, tipoTrack ?? mapMonTipoToWorkerTipo(mon.tipo), via, monIdTrack),
      forceVia: forceViaOverride ?? undefined,
      fallbackToDirect: forceViaOverride === DIRECT_SLOT_ID,
      // Igual ao DJEN Servidor: se a VPS da unit falha com 5xx/timeout, tenta
      // outra VPS do pool antes de desistir daquele par (mon, dia, tribunal).
      fallbackToPool: true,
      disableEdgeFallback: true,
      disableClientAdvogadoFallbacks: true,
      serverParity404AsError: true,
      throwOnConsecutiveFailedPages: true,
    });
    addResults(resp.items, matchMeta);
    ultimoErro = resp.lastError ?? null;
    return resp;
  };

  try {
    if (tipo === 'parte') {
      for (const termoParte of termosDeParte(mon)) {
        if (signal.aborted) break;
        const termoBusca = termoParteParaBusca(termoParte);
        const paramsParte = { ...baseParams, nomeParte: termoBusca };
        const resp = await executarBusca(
          paramsParte,
          { __matchedByNomeParte: true, __nomeParteBusca: termoBusca },
        );
        // Sem 2ª passada em resultado vazio: o cliente paginado já tolera
        // instabilidade internamente (retries por página, streak de vazias).
        // Se chegou aqui com 0 itens, é ausência real na API.
        console.log(`[DJEN Paralela][${tribunal}] Busca por parte termo="${termoBusca}": ${resp.items.length} resultados, pages=${resp.pagesFetched}`);
        await abortableDelay(CONFIG.delay_between_parte_or, signal);
      }
    } else {
      // Helper: busca por advogado com regra nova (nome primário, OAB fallback).
      const buscarAdvogado = async (
        nomeRaw: string | undefined,
        oabRaw: string | undefined,
        ufRaw: string | undefined,
        matchMeta: Record<string, any> = {},
      ) => {
        const nome = nomeRaw?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
        const oab = oabRaw ? String(oabRaw).replace(/\D/g, '') : '';
        const uf = String(ufRaw || '').trim().toUpperCase();
        let respPrincipal: any = null;
        if (nome) {
          const paramsNome = {
            tipo: 'advogado',
            dataInicio: diaYmd,
            dataFim: diaYmd,
            pageSize: 50,
            siglaTribunal: tribunal,
            nomeAdvogado: nome,
          } as any;
          respPrincipal = await executarBusca(paramsNome, matchMeta);
          // Sem 2ª passada em resultado vazio (cliente paginado já tolera
          // instabilidade via retries por página). Se vier 0, cai no fallback
          // por OAB abaixo (se aplicável).
        }
        // Fallback OAB: somente se a busca por nome veio vazia E temos OAB+UF
        // específica (UF=TODAS não é aceita pela API com numeroOab sozinho).
        const veioVazio = !respPrincipal || (respPrincipal.items?.length || 0) === 0;
        if (
          !signal.aborted &&
          veioVazio &&
          oab && oab.length >= 3 &&
          uf && uf !== 'TODAS' && /^[A-Z]{2}$/.test(uf)
        ) {
          await abortableDelay(800, signal);
          if (!signal.aborted) {
            const paramsOab = {
              tipo: 'advogado',
              dataInicio: diaYmd,
              dataFim: diaYmd,
              pageSize: 50,
              siglaTribunal: tribunal,
              oab,
              uf,
            } as any;
            try {
              await executarBusca(paramsOab, { ...matchMeta, __advogadoOabFallback: true });
            } catch (e: any) {
              if (e?.name === 'AbortError') throw e;
              console.warn(`[DJEN Paralela][${tribunal}] Fallback OAB advogado falhou:`, e?.message || e);
            }
          }
        }
      };

      if (tipo === 'advogado') {
        await buscarAdvogado(mon.termo_busca, mon.oab, mon.uf);
        if (!signal.aborted && mon.termos_or?.length) {
          for (const termoOr of mon.termos_or) {
            if (signal.aborted) break;
            const parsed = parsearTermoOr(String(termoOr));
            if (!parsed?.nome) continue;
            const mesmoNome = normalizar(parsed.nome) === normalizar(mon.termo_busca || '');
            if (mesmoNome) continue;
            await abortableDelay(CONFIG.delay_between_advogado_or, signal);
            if (signal.aborted) break;
            try {
              await buscarAdvogado(parsed.nome, parsed.oabDigits, mon.uf, { __termoOrAdvogado: String(termoOr) });
            } catch (e: any) {
              if (e?.name === 'AbortError') throw e;
              console.warn(`[DJEN Paralela][${tribunal}] Termo OR advogado "${termoOr}" falhou:`, e?.message || e);
            }
          }
        }
      } else {
        await executarBusca(baseParams);
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    ultimoErro = e?.message || 'Falha de busca';
    if (isRecoverableVpsFailure(e)) throw e;
  }

  if (signal.aborted) {
    return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
  }

  await incluirResgatesOutraCoordenacao();

  if (signal.aborted) {
    return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
  }

  if (resultados.length === 0) {
    return { novas: 0, duplicadas: 0, descartadas: 0, rateLimitHits, ultimoErro };
  }

  return await consolidarResultadosTermo(mon, diaYmd, tribunal, resultados, rateLimitHits, ultimoErro);
}

/**
 * Consolida (filtra, dedup, persiste) os resultados de uma busca para um único
 * monitoramento. Extraído de `processarTermoEmTribunal` para ser reutilizado
 * pelo caminho de busca agrupada (OR).
 */
async function consolidarResultadosTermo(
  mon: Monitoramento,
  diaYmd: string,
  tribunal: string,
  resultados: any[],
  rateLimitHitsIn: number,
  ultimoErroIn: string | null,
): Promise<{ novas: number; duplicadas: number; descartadas: number; rateLimitHits: number; ultimoErro: string | null }> {
  let rateLimitHits = rateLimitHitsIn;
  let ultimoErro = ultimoErroIn;

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
    const exc = mon.tipo === 'parte'
      ? temExclusaoEmPartes(pub, mon.exclusoes)
      : temExclusao(pub, mon.exclusoes);
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
    const concomitanteOk = mon.tipo === 'parte'
      ? condicaoConcomitanteAtendidaEmPartes(pub, mon.condicao_concomitante)
      : condicaoConcomitanteAtendida(pub, mon.condicao_concomitante);
    if (!concomitanteOk) {
      descartadas++;
      pubsDescartadas.push({ ...pub, motivo_descarte: `condicao_concomitante: ${mon.condicao_concomitante || ''}`.trim() });
      return false;
    }
    return true;
  });

  const hashMap = new Map<string, any>();
  let semIdSeq = 0;
  for (const pub of pubsValidas) {
    const conteudo = pub.texto || pub.conteudo || pub.teor || '';
    const dataDisp = extrairDataDisponibilizacaoYmd(pub) || diaYmd;
    const procNum = pub.numeroProcesso || pub.numero_processo || pub.processo_numero || pub.processo || '';
    const idDjen = extrairIdDjen(pub);
    // Deduplicação em memória também segue a regra oficial:
    // só colapsa quando o próprio id_djen é igual. Sem id_djen, preserva linha.
    const uniqueKey = idDjen ? `id_djen:${idDjen}` : `sem-id:${semIdSeq++}`;
    const hash = gerarHashPublicacao(conteudo, dataDisp, procNum, idDjen);
    if (!hashMap.has(uniqueKey)) hashMap.set(uniqueKey, { ...pub, id_djen: idDjen, hash_conteudo: hash, data_disponibilizacao_ymd: dataDisp });
  }
  const pubsUnicas = Array.from(hashMap.values());
  const pubsParaDedup = pubsUnicas;

  if (foraDoPeriodo > 0) {
    ultimoErro = `API devolveu ${foraDoPeriodo} resultado(s) fora de ${diaYmd}; ignorados.`;
    console.warn(`[DJEN Paralela][${tribunal}] ${mon.termo_busca}: ${foraDoPeriodo} resultado(s) fora de ${diaYmd} ignorados.`);
  }

  const idsDjenCandidatos = pubsParaDedup.map((p) => extrairIdDjen(p)).filter(Boolean) as string[];
  let idsDjenEncontrados = new Set<string>();
  if (idsDjenCandidatos.length > 0) {
    let idQuery = supabase
      .from('publicacoes_djen')
      .select('id_djen')
      .eq('status', 'encontrada')
      .in('id_djen', idsDjenCandidatos);
    idQuery = mon.coordenacao_id
      ? idQuery.eq('coordenacao_id', mon.coordenacao_id)
      : idQuery.is('coordenacao_id', null);
    const { data: existentesPorIdDjen } = await idQuery;
    idsDjenEncontrados = new Set((existentesPorIdDjen || []).map((r: any) => String(r.id_djen || '')));
  }

  const novas = pubsParaDedup.filter((p) => {
    const idDjen = extrairIdDjen(p);
    if (idDjen) return !idsDjenEncontrados.has(idDjen);
    return true;
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
        id_djen: extrairIdDjen(pub),
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
      // Marca cada publicação com a execução atual (1ª que viu)
      const currentExecutionId = state.executionId;
      if (currentExecutionId) {
        for (const p of payload as any[]) p.execucao_id = currentExecutionId;
      }
      // A busca SEMPRE já foi feita. Duplicidade DJEN é somente
      // coordenacao_id + id_djen; hash/conteúdo não bloqueiam comunicação real.
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
          else if (oneIsConflict && row.id_djen) {
            let reviveQuery = supabase
              .from('publicacoes_djen')
              .update({
                monitoramento_id: mon.id,
                status: 'encontrada',
                lida: false,
                conteudo: row.conteudo,
                hash_conteudo: row.hash_conteudo,
                processo_numero: row.processo_numero,
                data_disponibilizacao: row.data_disponibilizacao,
                data_publicacao: row.data_publicacao,
                tribunal: row.tribunal,
                fonte: row.fonte,
                orgao: row.orgao,
                tipo_comunicacao: row.tipo_comunicacao,
                meio: row.meio,
                advogados_json: row.advogados_json,
                partes_json: row.partes_json,
              })
              .eq('id_djen', row.id_djen);
            reviveQuery = mon.coordenacao_id
              ? reviveQuery.eq('coordenacao_id', mon.coordenacao_id)
              : reviveQuery.is('coordenacao_id', null);
            const { error: reviveErr } = await reviveQuery;
            if (!reviveErr) inseridosCount += 1;
            else console.error(`[DJEN Paralela][${tribunal}] revive conflict error:`, reviveErr);
          }
          else if (!oneIsConflict) console.error(`[DJEN Paralela][${tribunal}] insert individual error:`, oneErr);
        }
      }
      // Releitura confirmatória apenas para ids oficiais desta coordenação.
      let efetivamenteEncontradas = inseridosCount;
      const idsPayload = (payload as any[]).map((p) => p.id_djen).filter(Boolean);
      if (idsPayload.length > 0) {
        let encQuery = supabase
          .from('publicacoes_djen')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'encontrada')
          .in('id_djen', idsPayload);
        encQuery = mon.coordenacao_id
          ? encQuery.eq('coordenacao_id', mon.coordenacao_id)
          : encQuery.is('coordenacao_id', null);
        const { count: encCount } = await encQuery;
        if (typeof encCount === 'number') efetivamenteEncontradas = encCount;
      }
      novasInseridasEfetivas = efetivamenteEncontradas;
      duplicadasReclassificadas = Math.max(0, idsPayload.length - efetivamenteEncontradas);

      // Registrar junção publicação×execução (DJEN Local "Execuções do dia")
      // Busca ids reais por (coordenacao_id, id_djen) — ignora se já existe a junção.
      if (currentExecutionId) {
        try {
          const idsDjenPayload = (payload as any[])
            .map((p) => p.id_djen)
            .filter((v): v is string => !!v);
          if (idsDjenPayload.length > 0) {
            let q = supabase
              .from('publicacoes_djen')
              .select('id')
              .in('id_djen', idsDjenPayload);
            q = mon.coordenacao_id
              ? q.eq('coordenacao_id', mon.coordenacao_id)
              : q.is('coordenacao_id', null);
            const { data: pubsIds } = await q;
            if (pubsIds && pubsIds.length > 0) {
              const junctionRows = pubsIds.map((r: any) => ({
                publicacao_id: r.id,
                execucao_id: currentExecutionId,
                tipo_engine: 'paralela',
              }));
              for (const chunk of chunkArray(junctionRows, 100)) {
                await (supabase as any)
                  .from('publicacoes_djen_execucoes')
                  .upsert(chunk, { onConflict: 'publicacao_id,execucao_id', ignoreDuplicates: true });
              }
            }
          }
        } catch (e) {
          console.warn('[DJEN Paralela] junção execução falhou (não-crítico):', e);
        }
      }
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
      const idDjen = extrairIdDjen(pub);
      const hash = gerarHashPublicacao(conteudoFormatado + (pub.motivo_descarte || ''), dataDisp, procNum, idDjen);
      if (descMap.has(hash)) continue;
      const advogados = extrairAdvogadosEstruturados(pub);
      const partes = extrairPartesEstruturadas(pub);
      descMap.set(hash, {
        monitoramento_id: mon.id,
        coordenacao_id: mon.coordenacao_id ?? null,
        id_djen: idDjen,
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
            .update({
              status: 'cancelado',
              finalizado_em: new Date().toISOString(),
              detalhes: { ...detalhes, mensagem: 'Execução interrompida (navegador fechado ou aba inativa por mais de 15 min sem heartbeat)' },
            })
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
    // Excluir sentinela "__CAPTURA_TOTAL_KURIER__": é apenas um marcador interno
    // usado pela edge function `kurier-consultar-publicacoes` para etiquetar
    // publicações capturadas em modo "captura total". Não deve virar uma busca real.
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true)
      .neq('somente_kurier', true)
      .neq('termo_busca', '__CAPTURA_TOTAL_KURIER__');
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

    // Distribuição POR TIPO DE BUSCA × tribunal.
    // 1) Agrupar monitoramentos por tipo de worker (nome → palavra-chave).
    // 2) Para cada tipo, calcular o conjunto de tribunais aplicáveis.
    const monsPorTipo = new Map<WorkerTipo, Monitoramento[]>();
    for (const m of monitoramentos) {
      const t = mapMonTipoToWorkerTipo(m.tipo);
      const arr = monsPorTipo.get(t) || [];
      arr.push(m);
      monsPorTipo.set(t, arr);
    }

    const tribunaisPorTipo = new Map<WorkerTipo, string[]>();
    const tribunaisGlobalSet = new Set<string>();
    for (const tipo of WORKER_TIPOS_ORDER) {
      const mons = monsPorTipo.get(tipo) || [];
      if (mons.length === 0) continue;
      const set = new Set<string>();
      let temTodos = false;
      for (const m of mons) {
        const tribs = expandirTribunaisDoMon(m.tribunais);
        if (tribs.length === 0) temTodos = true;
        else for (const x of tribs) set.add(x);
      }
      if (temTodos) {
        TODOS_TRT.forEach(x => set.add(x));
        TODOS_CIVEIS.forEach(x => set.add(x));
        ['STF', 'STJ', 'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6'].forEach(x => set.add(x));
      }
      const ordered = ordenarTribunais(Array.from(set));
      tribunaisPorTipo.set(tipo, ordered);
      ordered.forEach(x => tribunaisGlobalSet.add(x));
    }

    const tribunais = ordenarTribunais(Array.from(tribunaisGlobalSet));
    const tiposAtivos: WorkerTipo[] = WORKER_TIPOS_ORDER.filter(t => (tribunaisPorTipo.get(t) || []).length > 0);
    if (tribunais.length === 0 || tiposAtivos.length === 0) {
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
    const monitoramentoIdsKey = [...(monitoramentoIds || [])]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .sort()
      .join(',') || 'todos';
    const runKey = `${dataInicioYmd}..${dataFimYmd}|coord:${coordenacaoId || 'todas'}|mon:${monitoramentoIdsKey}`;
    // Checkpoint isolado por coordenação e filtro de monitoramentos, igual ao
    // Servidor. Checkpoints antigos não casam e serão refeitos com segurança.
    const unidadesJaConcluidas = new Set<string>(
      cp && cp.runKey === runKey ? cp.tribunaisConcluidos : []
    );

    type PlannedUnit = {
      id: string;
      cardKey: string;
      tipo: WorkerTipo;
      tribunal: string;
      monId: string | null;
      monitoramentoIds: string[];
      label: string | null;
      total: number;
      shardIdx: number;
      shardTotal: number;
    };

    const grupos = new Map<string, { tipo: WorkerTipo; tribunal: string; monitoramentos: Monitoramento[] }>();
    for (const mon of monitoramentos) {
      const tipo = mapMonTipoToWorkerTipo(mon.tipo);
      const tribsDeclarados = expandirTribunaisDoMon(mon.tribunais);
      const tribsDoTipo = tribunaisPorTipo.get(tipo) || [];
      const tribsEfetivos = tribsDeclarados.length > 0 ? tribsDeclarados : tribsDoTipo;
      for (const tribunal of tribsEfetivos) {
        if (!tribsDoTipo.includes(tribunal)) continue;
        const key = `${tipo}|${tribunal}`;
        if (!grupos.has(key)) grupos.set(key, { tipo, tribunal, monitoramentos: [] });
        grupos.get(key)!.monitoramentos.push(mon);
      }
    }

    const plannedUnits: PlannedUnit[] = [];
    const gruposOrdenados = Array.from(grupos.values()).sort((a, b) =>
      (tribunalPriorityRank(a.tribunal) - tribunalPriorityRank(b.tribunal)) ||
      (tipoPriorityRank(a.tipo) - tipoPriorityRank(b.tipo))
    );
    for (const grupo of gruposOrdenados) {
      const totalMons = grupo.monitoramentos.length;
      if (totalMons === 0) continue;
      const cardKey = `${grupo.tipo}|${grupo.tribunal}`;
      const deveShardear = totalMons > SHARD_MIN;
      const chunks = deveShardear
        ? chunkArray(grupo.monitoramentos, SHARD_SIZE)
        : [grupo.monitoramentos];
      chunks.forEach((chunk, idx) => {
        const monId = deveShardear ? `shard${idx}` : null;
        plannedUnits.push({
          id: deveShardear ? `${cardKey}|shard${idx}` : cardKey,
          cardKey,
          tipo: grupo.tipo,
          tribunal: grupo.tribunal,
          monId,
          monitoramentoIds: chunk.map((m) => m.id),
          label: deveShardear
            ? `${chunk.length} termos (${idx + 1}/${chunks.length})`
            : totalMons > 1
              ? `${totalMons} termos`
              : (chunk[0]?.descricao || chunk[0]?.termo_busca || null),
          total: chunk.length * datas.length,
          shardIdx: idx,
          shardTotal: chunks.length,
        });
      });
    }

    const plannedUnitIds = new Set(plannedUnits.map((u) => u.id));
    const unidadesJaConcluidasValidas = new Set(
      Array.from(unidadesJaConcluidas).filter((id) => plannedUnitIds.has(id)),
    );

    // Inicializar tracks exatamente no mesmo nível das units do Servidor:
    // card pequeno = 1 unit por (tipo, tribunal); card grande = shards.
    const tracks: TrackProgress[] = plannedUnits.map((unit) => {
      const jaConcluido = unidadesJaConcluidasValidas.has(unit.id) || unidadesJaConcluidasValidas.has(trackKey(unit.tipo, unit.tribunal, unit.monId));
      return {
        tribunal: unit.tribunal,
        tipo: unit.tipo,
        monId: unit.monId,
        monLabel: unit.label,
        status: jaConcluido ? 'concluido' : 'pendente',
        current: jaConcluido ? unit.total : 0,
        total: unit.total,
        novas: 0,
        duplicadas: 0,
        descartadas: 0,
        mensagem: jaConcluido ? 'Já processado (checkpoint)' : 'Aguardando VPS...',
        termoAtual: unit.shardTotal > 1 ? unit.label : null,
        diaAtual: null,
        rateLimitHits: 0,
        ultimoErro: null,
        startedAt: null,
        finishedAt: jaConcluido ? Date.now() : null,
        lastViaId: null,
        lastViaLabel: null,
        lastViaKind: null,
        callsDirect: 0,
        callsByProxy: {},
      };
    });
    const totalUnidades = tracks.length;
    const unidadesConcluidasInicial = tracks.filter(t => t.status === 'concluido').length;
    const totalWorkInicial = tracks.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const currentWorkInicial = tracks.reduce((sum, t) => sum + Number(t.current || 0), 0);
    const percentageInicial = totalWorkInicial > 0
      ? Math.min(100, Math.max(0, Math.round((currentWorkInicial / totalWorkInicial) * 100)))
      : 0;

    updateProgress({
      status: 'executando',
      tracks,
      totalTribunais: totalUnidades,
      tribunaisConcluidos: unidadesConcluidasInicial,
      percentage: percentageInicial,
      novas: cp?.novas || 0,
      duplicadas: cp?.duplicadas || 0,
      descartadas: cp?.descartadas || 0,
      dataInicioYmd,
      dataFimYmd,
      mensagem: `Preparando workers para ${totalUnidades} unidades (${tribunais.length} tribunais × ${tiposAtivos.length} tipos)...`,
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
          detalhes: {
            runKey,
            totalTribunais: totalUnidades,
            dataInicioYmd,
            dataFimYmd,
            // Concorrência real = nº de VPS habilitadas (1 worker por VPS).
            // Fallback 1 quando não houver pool (executa direto pelo browser).
            concorrencia: (() => {
              try {
                if (!isDjenProxyPoolEnabled()) return 1;
                const n = loadDjenProxyPool().filter((s) => s.enabled && s.id && s.baseUrl && s.token).length;
                return n > 0 ? n : 1;
              } catch { return 1; }
            })(),
            tiposAtivos,
          },
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
    // FILAS COM PARIDADE DJEN SERVIDOR
    // ========================================================================
    // 0) TST/STF/STJ/TRTs dos tipos principais
    // 1) demais tribunais dos tipos principais
    // 2) processo em qualquer tribunal
    // Sem trava rígida entre bandas: worker livre puxa a melhor próxima unit,
    // como o Servidor, evitando VPS ociosa enquanto outro shard ainda pagina.
    type WorkUnit = PlannedUnit & { band: 0 | 1 | 2 };

    const comparePriorityUnits = (a: WorkUnit, b: WorkUnit) =>
      (a.shardIdx - b.shardIdx) ||
      (tribunalPriorityRank(a.tribunal) - tribunalPriorityRank(b.tribunal)) ||
      (tipoPriorityRank(a.tipo) - tipoPriorityRank(b.tipo)) ||
      ((Number(b.total) || 0) - (Number(a.total) || 0));

    const filaBand0: WorkUnit[] = [];
    const filaBand1: WorkUnit[] = [];
    const filaBand2: WorkUnit[] = [];

    for (const unit of plannedUnits) {
      if (unidadesJaConcluidasValidas.has(unit.id)) continue;
      const band: 0 | 1 | 2 = unit.tipo === 'processo'
        ? 2
        : isTribunalPrioritario(unit.tribunal) && MAIN_TIPOS.includes(unit.tipo)
          ? 0
          : 1;
      const target = { ...unit, band };
      if (band === 0) filaBand0.push(target);
      else if (band === 1) filaBand1.push(target);
      else filaBand2.push(target);
    }

    const bands: WorkUnit[][] = [filaBand0, filaBand1, filaBand2];
    for (const b of bands) b.sort(comparePriorityUnits);
    const totalUnidadesPendentes = bands.reduce((a, b) => a + b.length, 0);
    const totalStepsPendentes = totalUnidadesPendentes;
    const unidadesConcluidasLista: string[] = Array.from(unidadesJaConcluidasValidas);

    // Inicializa progresso por unidade (steps) para a barra refletir realidade.
    state.unitTotal = totalStepsPendentes + unidadesConcluidasLista.length;
    state.unitDone = unidadesConcluidasLista.length;

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
    // Se houver VPS no pool, NÃO usar o browser como via — evita que um worker
    // fique preso no IP do navegador (sujeito a Failed to fetch do CloudFront
    // do PJE Comunica), penalizando os tribunais alocados a ele (ex.: TST).
    const vias: ViaSpec[] = viasProxy.length > 0
      ? viasProxy
      : [{ id: DIRECT_SLOT_ID, label: 'Direto (browser)' }];
    const usandoPoolVps = viasProxy.length > 0;

    // ------------------------------------------------------------------
    // FILA COMPARTILHADA (espelha DJEN Servidor): qualquer VPS livre pega a
    // próxima unidade prioritária; se uma via falhar com 5xx/timeout, a própria
    // chamada pode tentar outra VPS do pool antes de desistir daquele par.
    // ------------------------------------------------------------------

    // Concorrência efetiva = mín(nº vias, nº unidades pendentes).
    const concorrenciaEfetiva = Math.max(1, Math.min(vias.length, totalUnidadesPendentes || 1));
    try {
      console.log('[DJEN Paralela] 🚀 Spawning workers (bandas)', {
        viasDisponiveis: vias.length,
        concorrenciaEfetiva,
        totalUnidadesPendentes,
        bandas: {
          band0_prioritarios: filaBand0.length,
          band1_outros: filaBand1.length,
          band2_processo: filaBand2.length,
        },
        vias: vias.map(v => v.label),
        poolAtivo,
      });
    } catch {}
    updateProgress({
      concorrencia: concorrenciaEfetiva,
      mensagem: `Prioritários: ${filaBand0.length} • Outros: ${filaBand1.length} • Processo: ${filaBand2.length} — ${concorrenciaEfetiva} workers`,
    });
    syncExecutionProgress({
      pool_enabled: usandoPoolVps,
      vias: vias.map(v => ({ id: v.id, label: v.label })),
      tipos_ativos: tiposAtivos,
    }, true);

    // ========================================================================
    // DISPATCH PULL-DOWN — sem trava rígida entre bandas, igual ao Servidor.
    // ========================================================================
    const emProcessamentoPorBand = [0, 0, 0];

    const pickNextUnit = (_viaId: string): WorkUnit | null => {
      // Fila compartilhada: qualquer worker livre pega a próxima unidade
      // de maior prioridade disponível (0→1→2), sem esperar banda drenar.
      for (let b = 0; b < bands.length; b++) {
        if (bands[b].length > 0) {
          return bands[b].shift() as WorkUnit;
        }
      }
      return null;
    };

    const BAND_LABEL: Record<number, string> = { 0: 'prioritários', 1: 'outros', 2: 'processo' };

    const worker = async (via: ViaSpec) => {
      let processed = 0;
      const t0 = Date.now();
      console.log(`[DJEN Paralela][worker ${via.label}] ▶ iniciado`);
      while (!signal.aborted) {
        const unit = pickNextUnit(via.id);
        if (!unit) {
          if (emProcessamentoPorBand.some((n) => n > 0)) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          console.log(`[DJEN Paralela][worker ${via.label}] ⏹ filas vazias, encerrando após ${processed} unidades em ${Math.round((Date.now() - t0) / 1000)}s`);
          break;
        }
        processed++;
        emProcessamentoPorBand[unit.band]++;
        try {
          let unidadeOk = true;
          try {
            await processarTribunalTrack(unit.tribunal, unit.tipo, monitoramentos, datas, signal, via.id, unit.monId, unit.monitoramentoIds);
            const tr = state.progress.tracks.find(
              t => t.tribunal === unit.tribunal && t.tipo === unit.tipo && (t.monId ?? null) === (unit.monId ?? null),
            );
            if (tr?.status === 'erro') {
              throw new Error(tr.ultimoErro || tr.mensagem || 'Track terminou com erro');
            }
          } catch (e) {
            unidadeOk = false;
            console.error(`[DJEN Paralela][worker ${via.label}] erro ${unit.tipo} ${unit.tribunal}${unit.monId ? ` ${unit.monId}` : ''}:`, e);
          }
          if (!unidadeOk) continue;
          unidadesConcluidasLista.push(unit.id);
          state.unitDone = Math.min(state.unitTotal, state.unitDone + 1);
          saveCheckpoint({
            runKey,
            dataInicioYmd,
            dataFimYmd,
            tribunaisConcluidos: unidadesConcluidasLista,
            novas: state.progress.novas,
            duplicadas: state.progress.duplicadas,
            descartadas: state.progress.descartadas,
            tempoInicio,
          });
          updateProgress({
            mensagem: `Banda ${unit.band} (${BAND_LABEL[unit.band]}) — ${state.unitDone}/${state.unitTotal} unidades`,
          });
          syncExecutionProgress({}, true);
          if (CONFIG.delay_between_terms > 0 && !signal.aborted) {
            await abortableDelay(CONFIG.delay_between_terms, signal);
          }
        } finally {
          emProcessamentoPorBand[unit.band]--;
        }
      }
    };

    const workersToRun = vias.slice(0, concorrenciaEfetiva).map((v) => worker(v));
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
  // Quando NÃO é retomada, limpa imediatamente os cards/tracks da execução
  // anterior para que a UI não fique mostrando o estado antigo enquanto o
  // loop assíncrono prepara os novos workers.
  if (!retomar) {
    state.progress = createDefaultProgress();
    state.lastUpdatedAt = Date.now();
    notifyListeners();
  }
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
          status: 'cancelado',
          finalizado_em: new Date().toISOString(),
          detalhes: { ...det, mensagem: 'Execução interrompida (navegador fechado ou aba inativa por mais de 15 min sem heartbeat)' },
        })
        .eq('id', data.id);
      data.status = 'cancelado';
      det.mensagem = 'Execução interrompida (navegador fechado ou aba inativa por mais de 15 min sem heartbeat)';
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
      tipo: (WORKER_TIPOS_ORDER.includes(t?.tipo) ? t.tipo : 'palavra-chave') as WorkerTipo,
      monId: t?.monId ?? null,
      monLabel: t?.monLabel ?? null,
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

    const tempoComputado = finalStatus === 'executando' && data.iniciado_em
      ? Math.floor(Math.max(0, Date.now() - new Date(data.iniciado_em).getTime()) / 1000)
      : Number(det.tempoDecorrido || 0)
        || (data.iniciado_em && data.finalizado_em
            ? Math.floor(Math.max(0, new Date(data.finalizado_em).getTime() - new Date(data.iniciado_em).getTime()) / 1000)
            : 0);
    // Mantém o tempo monotônico — nunca diminui durante uma execução ativa
    // (snapshots remotos podem estar atrasados em relação ao relógio local).
    const tempoAtualLocal = Number(state.progress.tempoDecorrido || 0);
    const tempoDecorrido = finalStatus === 'executando'
      ? Math.max(tempoComputado, tempoAtualLocal)
      : tempoComputado;

    const registrosEncontrados = Number((data as any).registros_encontrados || 0);
    const registrosProcessados = Number((data as any).registros_processados || 0);
    const lotesProcessados = Number((data as any).lotes_processados || 0);
    const totalLotes = Number((data as any).total_lotes || 0);

    state.progress = {
      ...createDefaultProgress(),
      status: finalStatus,
      tracks,
      totalTribunais: Math.max(Number(det.totalTribunais || 0), totalLotes, tracks.length),
      tribunaisConcluidos: finalStatus === 'executando'
        ? Math.max(Number(det.tribunaisConcluidos || 0), aggregateFromTracks.concluidos, lotesProcessados, Number(state.progress.tribunaisConcluidos || 0))
        : Math.max(Number(det.tribunaisConcluidos || 0), aggregateFromTracks.concluidos, lotesProcessados),
      novas: Math.max(Number(det.novas || 0), aggregateFromTracks.novas, registrosEncontrados),
      duplicadas: Math.max(Number(det.duplicadas || 0), aggregateFromTracks.duplicadas),
      descartadas: Math.max(Number(det.descartadas || 0), aggregateFromTracks.descartadas, registrosProcessados),
      percentage: (() => {
        // Preferir o cálculo a partir dos tracks concluídos (alinhado ao
        // header "X/Y tribunais"). Cair para det.percentage só se não houver
        // tracks. Nunca usar Math.max com o estado anterior — isso travava
        // a barra em 100% após o estado ficar contaminado.
        if (tracks.length > 0) {
          return Math.min(100, Math.max(0, Math.round((aggregateFromTracks.concluidos / tracks.length) * 100)));
        }
        return Math.min(100, Math.max(0, Number(det.percentage || 0)));
      })(),
      mensagem: String(det.mensagem || `Última execução agendada — ${finalStatus}`),
      tempoDecorrido,
      iniciadoEm: data.iniciado_em ?? det.iniciadoEm ?? null,
      dataInicioYmd: det.dataInicioYmd ?? null,
      dataFimYmd: det.dataFimYmd ?? null,
      concorrencia: Number(det.concorrencia || 1),
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
    // Checkpoint v2: cada item já vem como "tipo|tribunal". Itens v1 (só sigla)
    // são interpretados como concluídos para todos os tipos (legado).
    const parsed = concluidos.map((raw) => {
      const s = String(raw || '');
      const sep = s.indexOf('|');
      if (sep > 0) {
        const tipo = s.slice(0, sep) as WorkerTipo;
        const trib = s.slice(sep + 1);
        return { tipo: WORKER_TIPOS_ORDER.includes(tipo) ? tipo : ('palavra-chave' as WorkerTipo), tribunal: trib };
      }
      return { tipo: 'palavra-chave' as WorkerTipo, tribunal: s };
    }).filter(x => x.tribunal);
    const tracks: TrackProgress[] = parsed.map(({ tipo, tribunal }) => ({
      tribunal,
      tipo,
      status: 'concluido',
      current: 0,
      total: 0,
      novas: 0,
      duplicadas: 0,
      descartadas: 0,
      mensagem: `${tipo}: concluído (checkpoint)`,
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