/**
 * DJEN Proxy Pool — POC
 *
 * Round-robin client-side entre uma chamada DIRETA ao PJE Comunica e N VPS
 * configuradas pelo usuário. Cada slot é tentado uma vez por chamada; em caso
 * de falha de rede ou 5xx do proxy, o slot é marcado como offline por 60s e
 * a chamada cai para o próximo slot (fallback transparente).
 *
 * - Configuração persiste em localStorage (`djen_proxy_pool`)
 * - Toggle global em localStorage (`djen_proxy_pool_enabled`)
 * - 429 do upstream NÃO é tratado aqui — propagamos a Response intacta
 *   para o motor (pjeComunicaClient) aplicar o cooldown global como hoje.
 *
 * Esta camada NÃO altera Pro / Flash / STF Flash. A integração no motor
 * Paralela é feita via flag passada no fetch.
 */

const PJE_COMUNICA_BASE = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const STORAGE_POOL = "djen_proxy_pool";
const STORAGE_ENABLED = "djen_proxy_pool_enabled";
const OFFLINE_COOLDOWN_MS = 60_000;

export interface ProxySlotConfig {
  /** Identificador estável (uuid simples). */
  id: string;
  /** Nome curto exibido na UI. */
  label: string;
  /** URL base sem barra final, ex: https://meu.com/djen-proxy */
  baseUrl: string;
  /** Token enviado no header X-Proxy-Token */
  token: string;
  /** Se false, é ignorado pelo round-robin. */
  enabled: boolean;
}

interface SlotRuntimeState {
  offlineUntil: number;
  lastError: string | null;
}

const runtime: Record<string, SlotRuntimeState> = {};
let cursor = 0;

/** Sessão atual: estatísticas para a UI / console. */
export interface PoolSessionStats {
  total: number;
  direct: number;
  byProxy: Record<string, number>;
  rateLimitsByProxy: Record<string, number>;
  errorsByProxy: Record<string, number>;
}

let sessionStats: PoolSessionStats = createEmptyStats();

function createEmptyStats(): PoolSessionStats {
  return {
    total: 0,
    direct: 0,
    byProxy: {},
    rateLimitsByProxy: {},
    errorsByProxy: {},
  };
}

export function resetDjenProxyPoolStats(): void {
  sessionStats = createEmptyStats();
}

export function getDjenProxyPoolStats(): PoolSessionStats {
  // shallow copy para evitar mutação externa
  return {
    total: sessionStats.total,
    direct: sessionStats.direct,
    byProxy: { ...sessionStats.byProxy },
    rateLimitsByProxy: { ...sessionStats.rateLimitsByProxy },
    errorsByProxy: { ...sessionStats.errorsByProxy },
  };
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

export function loadDjenProxyPool(): ProxySlotConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_POOL);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (s): s is ProxySlotConfig =>
        s && typeof s.id === "string" && typeof s.baseUrl === "string"
    );
  } catch {
    return [];
  }
}

export function saveDjenProxyPool(slots: ProxySlotConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_POOL, JSON.stringify(slots));
}

export function isDjenProxyPoolEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_ENABLED) === "1";
}

export function setDjenProxyPoolEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_ENABLED, enabled ? "1" : "0");
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface ProxyHealth {
  ok: boolean;
  ip?: string | null;
  uptime_s?: number;
  error?: string;
}

export async function checkDjenProxyHealth(
  baseUrl: string,
  signal?: AbortSignal
): Promise<ProxyHealth> {
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  try {
    const resp = await fetch(url, { method: "GET", signal });
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ok: !!data?.ok, ip: data?.ip ?? null, uptime_s: data?.uptime_s };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Round-robin
// ---------------------------------------------------------------------------

/** Slot virtual representando "chamada direta". */
const DIRECT_SLOT_ID = "__direct__";

function isOnline(slot: ProxySlotConfig): boolean {
  const st = runtime[slot.id];
  if (!st) return true;
  return Date.now() >= st.offlineUntil;
}

function markOffline(slotId: string, error: string) {
  runtime[slotId] = {
    offlineUntil: Date.now() + OFFLINE_COOLDOWN_MS,
    lastError: error,
  };
}

/**
 * Devolve a sequência ordenada de slots a tentar, na rodada atual,
 * começando pelo cursor. Inclui sempre o slot DIRETO ao final (fallback
 * universal). Slots offline são pulados, mas o slot direto nunca é pulado.
 */
function buildAttemptOrder(): Array<ProxySlotConfig | null> {
  const all = loadDjenProxyPool().filter((s) => s.enabled && isOnline(s));
  const order: Array<ProxySlotConfig | null> = [];

  if (all.length === 0) {
    // Sem proxies disponíveis — só direto.
    order.push(null);
    return order;
  }

  // Round-robin: avança o cursor entre proxies + 1 slot virtual "direto".
  // Slots possíveis: [...proxies, null]
  const slotsForRR: Array<ProxySlotConfig | null> = [...all, null];
  const n = slotsForRR.length;
  cursor = (cursor + 1) % n;

  for (let i = 0; i < n; i++) {
    order.push(slotsForRR[(cursor + i) % n]);
  }

  return order;
}

// ---------------------------------------------------------------------------
// Fetch principal
// ---------------------------------------------------------------------------

/**
 * Faz a chamada à API PJE Comunica usando o pool (se habilitado).
 *
 * IMPORTANTE: a interface devolve uma `Response` do fetch padrão, para que
 * o `pjeComunicaClient` continue tratando 429, content-type, etc., sem
 * precisar saber se a chamada veio do pool ou direta.
 */
export async function fetchDjenViaPool(
  fullDirectUrl: string,
  init: RequestInit
): Promise<Response> {
  if (!isDjenProxyPoolEnabled()) {
    sessionStats.total++;
    sessionStats.direct++;
    return fetch(fullDirectUrl, init);
  }

  // Extrai a query string da URL direta para repassar ao proxy.
  const queryString = fullDirectUrl.includes("?")
    ? fullDirectUrl.slice(fullDirectUrl.indexOf("?") + 1)
    : "";

  const order = buildAttemptOrder();
  let lastErr: any = null;

  for (const slot of order) {
    try {
      sessionStats.total++;

      if (!slot) {
        // Slot direto (chamada igual à de hoje).
        sessionStats.direct++;
        const resp = await fetch(fullDirectUrl, init);
        // Se direct deu 429, ainda é informação útil para o motor — devolve.
        return resp;
      }

      const proxyUrl = `${slot.baseUrl.replace(/\/$/, "")}/djen?${queryString}`;
      const headers = new Headers(init.headers || {});
      headers.set("X-Proxy-Token", slot.token);

      const proxyResp = await fetch(proxyUrl, {
        method: "GET",
        headers,
        signal: init.signal,
      });

      if (!proxyResp.ok) {
        // 4xx/5xx do proxy em si (ex: 401 token errado, 502 upstream caiu).
        // Marca offline curto e tenta próximo slot.
        const txt = await proxyResp.text().catch(() => "");
        markOffline(slot.id, `proxy HTTP ${proxyResp.status} ${txt.slice(0, 80)}`);
        sessionStats.errorsByProxy[slot.id] =
          (sessionStats.errorsByProxy[slot.id] || 0) + 1;
        continue;
      }

      const envelope = await proxyResp.json();
      // O proxy devolve { status, body, elapsed_ms } onde body é a string crua do upstream.
      const upstreamStatus: number = envelope?.status ?? 0;
      const upstreamBody: string = envelope?.body ?? "";

      if (upstreamStatus === 429) {
        sessionStats.rateLimitsByProxy[slot.id] =
          (sessionStats.rateLimitsByProxy[slot.id] || 0) + 1;
      }
      sessionStats.byProxy[slot.id] = (sessionStats.byProxy[slot.id] || 0) + 1;

      // Reconstroi uma Response equivalente à direta para o cliente consumir.
      return new Response(upstreamBody, {
        status: upstreamStatus || 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    } catch (err: any) {
      lastErr = err;
      if (err?.name === "AbortError") throw err;
      if (slot) {
        markOffline(slot.id, err?.message || String(err));
        sessionStats.errorsByProxy[slot.id] =
          (sessionStats.errorsByProxy[slot.id] || 0) + 1;
      }
      // Tenta próximo slot
      continue;
    }
  }

  throw lastErr || new Error("Pool DJEN: todos os slots falharam");
}

/** Retorna o estado runtime (online/offline) de cada slot configurado. */
export function getDjenProxySlotsRuntime(): Array<
  ProxySlotConfig & { online: boolean; lastError: string | null; offlineUntil: number }
> {
  return loadDjenProxyPool().map((s) => {
    const st = runtime[s.id];
    const online = !st || Date.now() >= st.offlineUntil;
    return {
      ...s,
      online,
      lastError: st?.lastError ?? null,
      offlineUntil: st?.offlineUntil ?? 0,
    };
  });
}

export function clearDjenProxyOfflineMark(slotId: string): void {
  delete runtime[slotId];
}

/** Helper para gerar id único leve (sem uuid). */
export function generateProxySlotId(): string {
  return `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Marker exportado só para tornar explícito que existe o conceito de slot direto.
export { DIRECT_SLOT_ID, PJE_COMUNICA_BASE };