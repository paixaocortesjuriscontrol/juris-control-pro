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

// Importa o cliente Supabase de forma lazy para evitar ciclo de import
// e permitir que o pool funcione mesmo se a conexão falhar (cai pro cache local).
import { supabase } from "@/integrations/supabase/client";

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

/** Identificação da rota usada por cada chamada (para a UI). */
export interface PoolViaInfo {
  id: string;          // DIRECT_SLOT_ID ou slot.id
  label: string;       // texto curto pra UI
  kind: "direct" | "proxy";
}

/**
 * Anota a Response com headers identificando qual slot atendeu a chamada.
 * Usamos um Response novo porque headers de respostas opacas/cross-origin
 * podem ser readonly no browser.
 */
function annotateVia(
  resp: Response,
  id: string,
  label: string,
  kind: "direct" | "proxy"
): Response {
  try {
    const headers = new Headers(resp.headers);
    headers.set("x-djen-via-id", id);
    headers.set("x-djen-via-label", label);
    headers.set("x-djen-via-kind", kind);
    // Evita reler body — clonamos e devolvemos. Para responses já consumidas
    // (caso do envelope reconstruído), basta criar um novo Response com o body.
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  } catch {
    return resp;
  }
}

/** Lê os headers anotados em uma Response — usado pelo cliente PJE Comunica. */
export function readPoolViaFromResponse(resp: Response): PoolViaInfo | null {
  const id = resp.headers.get("x-djen-via-id");
  const label = resp.headers.get("x-djen-via-label");
  const kind = resp.headers.get("x-djen-via-kind");
  if (!id || !label || (kind !== "direct" && kind !== "proxy")) return null;
  return { id, label, kind };
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

// ---------------------------------------------------------------------------
// Persistência REMOTA (Supabase) — fonte da verdade
// ---------------------------------------------------------------------------
// O cadastro das VPS agora vive na tabela `djen_proxy_pool` (RLS: admin/coord).
// O localStorage continua sendo usado como cache em memória durante a sessão
// para não bloquear chamadas do round-robin enquanto o fetch está em andamento.

/** Carrega do Supabase e atualiza o cache local. Retorna a lista atual. */
export async function syncDjenProxyPoolFromSupabase(): Promise<ProxySlotConfig[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("djen_proxy_pool")
      .select("id, label, base_url, token, enabled, pool_enabled_global")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const slots: ProxySlotConfig[] = rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      baseUrl: r.base_url,
      token: r.token,
      enabled: !!r.enabled,
    }));
    saveDjenProxyPool(slots);
    // Toggle global: se houver pelo menos uma linha, usa o flag dela; caso
    // contrário, mantém o estado local atual.
    if (rows.length > 0) {
      const globalOn = rows.some((r: any) => r.pool_enabled_global !== false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_ENABLED, globalOn ? "1" : "0");
      }
    }
    return slots;
  } catch (e) {
    console.warn("[djenProxyPool] Falha ao sincronizar do Supabase:", e);
    return loadDjenProxyPool();
  }
}

/** Insere uma nova VPS no Supabase e atualiza o cache local. */
export async function addProxySlotRemote(
  input: { label: string; baseUrl: string; token: string },
): Promise<ProxySlotConfig> {
  const payload = {
    label: input.label,
    base_url: input.baseUrl,
    token: input.token,
    enabled: true,
  };
  const { data, error } = await (supabase as any)
    .from("djen_proxy_pool")
    .insert(payload)
    .select("id, label, base_url, token, enabled")
    .single();
  if (error) throw error;
  const slot: ProxySlotConfig = {
    id: data.id,
    label: data.label,
    baseUrl: data.base_url,
    token: data.token,
    enabled: !!data.enabled,
  };
  saveDjenProxyPool([...loadDjenProxyPool(), slot]);
  return slot;
}

/** Atualiza um slot (label/baseUrl/token/enabled) no Supabase. */
export async function updateProxySlotRemote(
  id: string,
  patch: Partial<{ label: string; baseUrl: string; token: string; enabled: boolean }>,
): Promise<void> {
  const update: Record<string, any> = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.baseUrl !== undefined) update.base_url = patch.baseUrl;
  if (patch.token !== undefined) update.token = patch.token;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  const { error } = await (supabase as any)
    .from("djen_proxy_pool")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  const next = loadDjenProxyPool().map((s) =>
    s.id === id
      ? {
          ...s,
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
          ...(patch.token !== undefined ? { token: patch.token } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        }
      : s,
  );
  saveDjenProxyPool(next);
}

/** Remove um slot do Supabase e do cache local. */
export async function removeProxySlotRemote(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("djen_proxy_pool")
    .delete()
    .eq("id", id);
  if (error) throw error;
  saveDjenProxyPool(loadDjenProxyPool().filter((s) => s.id !== id));
}

/**
 * Atualiza o flag global "pool ligado" no Supabase (gravado em todas as linhas
 * para manter simples — a coluna pool_enabled_global é o "switch" único).
 */
export async function setPoolEnabledRemote(enabled: boolean): Promise<void> {
  setDjenProxyPoolEnabled(enabled);
  try {
    const slots = loadDjenProxyPool();
    if (slots.length === 0) return;
    const { error } = await (supabase as any)
      .from("djen_proxy_pool")
      .update({ pool_enabled_global: enabled })
      .in("id", slots.map((s) => s.id));
    if (error) throw error;
  } catch (e) {
    console.warn("[djenProxyPool] Falha ao salvar toggle global no Supabase:", e);
  }
}

export function isDjenProxyPoolEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(STORAGE_ENABLED);
  // Se o usuário nunca tocou no toggle (valor null), liga automaticamente
  // quando houver pelo menos 1 VPS configurada e habilitada. Isso evita o
  // caso "VPS cadastradas mas pool desligado por esquecimento".
  if (stored === null) {
    try {
      const slots = loadDjenProxyPool();
      return slots.some((s) => s.enabled);
    } catch {
      return false;
    }
  }
  return stored === "1";
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

/**
 * Constrói a URL do endpoint /djen da VPS replicando os query params da
 * chamada direta ao PJE Comunica. O server.js da VPS lê os params com
 * `parsedUrl.searchParams` e os repassa ao upstream.
 */
function buildProxyDjenUrl(baseUrl: string, fullDirectUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  try {
    const u = new URL(fullDirectUrl);
    const qs = u.searchParams.toString();
    return qs ? `${base}/djen?${qs}` : `${base}/djen`;
  } catch {
    // fallback: assume que veio só a query string ou URL malformada
    const idx = fullDirectUrl.indexOf("?");
    const qs = idx >= 0 ? fullDirectUrl.slice(idx + 1) : "";
    return qs ? `${base}/djen?${qs}` : `${base}/djen`;
  }
}

/**
 * Desempacota o envelope JSON `{ status, body, elapsed_ms }` retornado pelo
 * server.js da VPS. Se a resposta não for JSON ou não tiver o formato
 * esperado, devolve o texto cru com status 200 (compatibilidade defensiva).
 */
async function parseProxyEnvelope(
  resp: Response,
): Promise<{ status: number; body: string }> {
  const text = await resp.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "body" in parsed) {
      const status = typeof parsed.status === "number" ? parsed.status : 200;
      const body = typeof parsed.body === "string"
        ? parsed.body
        : JSON.stringify(parsed.body ?? null);
      return { status, body };
    }
    // JSON sem envelope — devolve como body cru
    return { status: 200, body: text };
  } catch {
    return { status: 200, body: text };
  }
}

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
  init: RequestInit,
  routing?: {
    /**
     * Força uma via específica (DIRECT_SLOT_ID ou slot.id). Quando definido,
     * desabilita o round-robin e tenta APENAS essa via. Se ela falhar e
     * `fallbackToDirect` for true, cai para Direto. Usado pelo motor Paralela
     * para criar workers dedicados por IP (1 worker = 1 via).
     */
    forceVia?: string;
    fallbackToDirect?: boolean;
  }
): Promise<Response> {
  if (!isDjenProxyPoolEnabled() && !routing?.forceVia) {
    sessionStats.total++;
    sessionStats.direct++;
    const r = await fetch(fullDirectUrl, init);
    return annotateVia(r, DIRECT_SLOT_ID, "Direto (browser)", "direct");
  }

  // Modo "via forçada": ignora round-robin e usa exatamente a via pedida.
  if (routing?.forceVia) {
    const callDirect = async (): Promise<Response> => {
      sessionStats.total++;
      sessionStats.direct++;
      const r = await fetch(fullDirectUrl, init);
      return annotateVia(r, DIRECT_SLOT_ID, "Direto (browser)", "direct");
    };

    if (routing.forceVia === DIRECT_SLOT_ID) {
      return callDirect();
    }

    const slot = loadDjenProxyPool().find((s) => s.id === routing.forceVia);
    if (!slot || !slot.enabled) {
      if (routing.fallbackToDirect) {
        return callDirect();
      }
      throw new Error(`Via forçada indisponível: ${routing.forceVia}`);
    }

    try {
      sessionStats.total++;
      // Formato esperado pela VPS djen-proxy (server.js):
      //   GET /djen?<query-params-do-upstream>  (com header X-Proxy-Token)
      // A VPS devolve um ENVELOPE JSON: { status, body, elapsed_ms }.
      // Reconstroi os query params a partir da URL direta do PJE Comunica.
      const proxyUrl = buildProxyDjenUrl(slot.baseUrl, fullDirectUrl);
      const headers = new Headers(init.headers || {});
      headers.set("X-Proxy-Token", slot.token);
      const proxyResp = await fetch(proxyUrl, {
        method: "GET",
        headers,
        signal: init.signal,
      });
      if (!proxyResp.ok) {
        const txt = await proxyResp.text().catch(() => "");
        markOffline(slot.id, `proxy HTTP ${proxyResp.status} ${txt.slice(0, 80)}`);
        sessionStats.errorsByProxy[slot.id] =
          (sessionStats.errorsByProxy[slot.id] || 0) + 1;
        if (routing.fallbackToDirect) return callDirect();
        throw new Error(`VPS ${slot.label} respondeu HTTP ${proxyResp.status}`);
      }
      // Desempacota o envelope { status, body, elapsed_ms } da VPS.
      const envelope = await parseProxyEnvelope(proxyResp);
      const upstreamStatus = envelope.status;
      const upstreamBody = envelope.body;
      if (upstreamStatus === 429) {
        sessionStats.rateLimitsByProxy[slot.id] =
          (sessionStats.rateLimitsByProxy[slot.id] || 0) + 1;
      }
      sessionStats.byProxy[slot.id] = (sessionStats.byProxy[slot.id] || 0) + 1;
      const rebuilt = new Response(upstreamBody, {
        status: upstreamStatus || 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      return annotateVia(rebuilt, slot.id, slot.label || slot.baseUrl, "proxy");
    } catch (err: any) {
      if (err?.name === "AbortError") throw err;
      markOffline(slot.id, err?.message || String(err));
      sessionStats.errorsByProxy[slot.id] =
        (sessionStats.errorsByProxy[slot.id] || 0) + 1;
      if (routing.fallbackToDirect) return callDirect();
      throw err;
    }
  }

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
        return annotateVia(resp, DIRECT_SLOT_ID, "Direto (browser)", "direct");
      }

      const proxyUrl = buildProxyDjenUrl(slot.baseUrl, fullDirectUrl);
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

      // VPS devolve envelope { status, body, elapsed_ms } — desempacota.
      const envelope = await parseProxyEnvelope(proxyResp);
      const upstreamStatus = envelope.status;
      const upstreamBody = envelope.body;

      if (upstreamStatus === 429) {
        sessionStats.rateLimitsByProxy[slot.id] =
          (sessionStats.rateLimitsByProxy[slot.id] || 0) + 1;
      }
      sessionStats.byProxy[slot.id] = (sessionStats.byProxy[slot.id] || 0) + 1;

      // Reconstroi uma Response equivalente à direta para o cliente consumir.
      const rebuilt = new Response(upstreamBody, {
        status: upstreamStatus || 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      return annotateVia(rebuilt, slot.id, slot.label || slot.baseUrl, "proxy");
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