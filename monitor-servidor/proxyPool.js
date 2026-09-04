// Replica src/utils/djenProxyPool.ts em Node (round-robin, offline 60s, cooldown 429)
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const OFFLINE_MS = 60_000;
const COOLDOWN_429_MS = 30_000;
// Timeout por requisição alinhado ao Browser (src/utils/pjeComunicaClient.ts):
// 90s, suficiente para tribunais lentos (TJES/TJMT/TJPI/TJMA) que ocasionalmente
// devolvem páginas tarde demais. Antes era 60s e o Servidor podia abortar antes
// do Browser, gerando capturas a menor.
const PROXY_REQUEST_TIMEOUT_MS = Math.max(10_000, Number(process.env.DJEN_PROXY_TIMEOUT_MS || 90_000));
const HEALTH_TIMEOUT_MS = 5_000;

let cache = { fetchedAt: 0, slots: [] };
const TTL = 30_000;

let cursor = 0;
const slotState = new Map();
const dialectCache = new Map(); // slot.id → 'v1-djen' | 'v3-proxy'
const PJE_COMUNICA_API = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

async function loadPool(sb) {
  const now = Date.now();
  if (now - cache.fetchedAt < TTL) return cache.slots;

  const { data: pool, error } = await sb
    .from("djen_proxy_pool")
    .select("id, label, base_url, token, enabled, pool_enabled_global, created_at")
    .eq("enabled", true)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const slots = (pool || [])
    .filter((r) => r.pool_enabled_global !== false)
    .map((r) => ({ id: r.id, label: r.label, url: r.base_url, token: r.token }));

  // Removido INCLUDE_LOCAL_PROXY: nas VPSs de produção (Hostinger/etc) não há
  // proxy local em 127.0.0.1:8089, então injetar esse slot só gera "fetch failed"
  // em série. O daemon usa apenas o pool em djen_proxy_pool.

  cache = { fetchedAt: now, slots };
  return slots;
}

async function detectDialect(slot) {
  if (dialectCache.has(slot.id)) return dialectCache.get(slot.id);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  let dialect = "v3-proxy"; // default conservador (mesma escolha do browser)
  try {
    const base = slot.url.replace(/\/$/, "");
    const res = await fetch(`${base}/health`, { method: "GET", signal: ctrl.signal });
    if (res.ok) {
      const j = await res.json().catch(() => null);
      const service = String(j?.service || "");
      const version = String(j?.version || "");
      const isV1 = /comunica/i.test(service);
      const isV3 = !isV1 && (
        service === "djen-vps-proxy" ||
        /proxy/i.test(service) ||
        version.startsWith("3.") ||
        version.includes("https")
      );
      dialect = isV1 ? "v1-djen" : (isV3 ? "v3-proxy" : "v1-djen");
    }
  } catch {
    // mantém default v3-proxy; auto-swap abaixo corrige se errar
  } finally {
    clearTimeout(to);
  }
  dialectCache.set(slot.id, dialect);
  return dialect;
}

function buildUpstreamUrl(queryParams) {
  const qs = new URLSearchParams(queryParams).toString();
  return `${PJE_COMUNICA_API}?${qs}`;
}

function buildSlotUrl(slot, dialect, queryParams) {
  const base = slot.url.replace(/\/$/, "");
  const qs = new URLSearchParams(queryParams).toString();
  if (dialect === "v3-proxy") {
    return `${base}/proxy?url=${encodeURIComponent(buildUpstreamUrl(queryParams))}`;
  }
  return qs ? `${base}/djen?${qs}` : `${base}/djen`;
}

// Distingue um 403 do NOSSO proxy (JSON curto: unauthorized / host_not_allowed)
// de um 403 do UPSTREAM (comunicaapi.pje.jus.br), que chega como página HTML de
// bloqueio do nginx/WAF. O segundo é temporário (primo do 429) e NÃO deve ser
// tratado como erro de token.
function isUpstreamBlockBody(body) {
  const txt = typeof body === "string" ? body : JSON.stringify(body ?? "");
  if (!txt) return true; // sem corpo nosso identificável → assume bloqueio upstream
  if (/"error"\s*:\s*"(unauthorized|host_not_allowed|forbidden)"/i.test(txt)) return false;
  return /<html|nginx|forbidden|cloudfront|access denied|<center>/i.test(txt);
}

async function parseProxyResponse(slot, res) {
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (parsed && typeof parsed === "object" && "body" in parsed) {
    return { slot, status: Number(parsed.status || res.status || 200), body: parsed.body };
  }
  // Quando o status do proxy é 4xx/5xx (ex.: 401 token errado, 403 IP bloqueado,
  // 502 upstream), surfa um corpo curto e legível para diagnóstico.
  const status = res.status || 200;
  if (status >= 400) {
    const snippet = (text || "").slice(0, 200);
    return { slot, status, body: parsed ?? snippet, errorSnippet: snippet };
  }
  return { slot, status, body: parsed ?? text };
}


function combineSignal(signal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function djenFetchSlot(slot, queryParams, signal) {
  // Detecta dialeto via /health (cacheado por slot.id) — mesma estratégia do
  // browser. Em caso de 404/502, faz auto-swap e re-tenta no outro dialeto.
  // Envie apenas um header: em Node/undici, chaves que diferem só por casing
  // podem chegar no proxy como "token, token", falhando a comparação exata.
  const headers = { "x-proxy-token": slot.token };
  const doFetch = async (dialect) => {
    const url = buildSlotUrl(slot, dialect, queryParams);
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: combineSignal(signal, PROXY_REQUEST_TIMEOUT_MS),
    });
    return { res, dialect };
  };

  let dialect = await detectDialect(slot);
  let lastErr;
  try {
    let { res } = await doFetch(dialect);
    if (res.status === 404 || res.status === 502) {
      const swapped = dialect === "v3-proxy" ? "v1-djen" : "v3-proxy";
      dialectCache.set(slot.id, swapped);
      ({ res } = await doFetch(swapped));
      dialect = swapped;
    }
    const out = await parseProxyResponse(slot, res);
    if (out.status === 403 && isUpstreamBlockBody(out.errorSnippet ?? out.body)) {
      // Bloqueio temporário do DJEN (WAF) contra o IP desta VPS: trata como
      // rate limit — cooldown curto na via e o chamador repete/faz failover.
      out.upstreamBlocked = true;
      markFail(slot.url, "429");
      console.log(`[proxyPool] bloqueio temporário do DJEN (403) na ${slot.label || slot.url} — via em cooldown`);
      return out;
    }
    if (out.status === 401 || out.status === 403) {
      // surfa o motivo real para o log do daemon — quase sempre token errado
      markFail(slot.url, "err");
      const reason = out.errorSnippet || (typeof out.body === "string" ? out.body.slice(0, 200) : JSON.stringify(out.body).slice(0, 200));
      throw new Error(`HTTP ${out.status} (${slot.label || slot.url}): ${reason}`);
    }
    if (out.status === 429) markFail(slot.url, "429");
    else if (out.status >= 500) markFail(slot.url, "err");
    else markOk(slot.url);
    return out;

  } catch (e) {
    if (signal?.aborted) throw e;
    lastErr = e;
    markFail(slot.url, "err");
    throw lastErr;
  }
}

function pickNext(slots) {
  if (slots.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[(cursor + i) % slots.length];
    const st = slotState.get(s.url) || {};
    if ((st.offlineUntil || 0) > now) continue;
    if ((st.cooldownUntil || 0) > now) continue;
    cursor = (cursor + i + 1) % slots.length;
    return s;
  }
  return null;
}

function markFail(url, kind) {
  const st = slotState.get(url) || {};
  if (kind === "429") {
    st.cooldownUntil = Date.now() + COOLDOWN_429_MS;
  } else {
    st.failCount = (st.failCount || 0) + 1;
    if (st.failCount >= 3) {
      st.offlineUntil = Date.now() + OFFLINE_MS;
      st.failCount = 0;
    }
  }
  slotState.set(url, st);
}

function markOk(url) {
  const st = slotState.get(url) || {};
  st.failCount = 0;
  slotState.set(url, st);
}

async function djenFetch(sb, queryParams, signal) {
  // ── In-flight dedup: quando N workers (vários monitoramentos com mesmo
  // advogado/tribunal/dia) disparam a MESMA query concorrentemente,
  // compartilham UMA única resposta em vez de baterem N vezes na API.
  const dedupKey = signal ? null : JSON.stringify(queryParams);
  if (dedupKey) {
    const existing = inflight.get(dedupKey);
    if (existing) return existing;
  }
  const exec = (async () => {
  const slots = await loadPool(sb);
  let attempt = 0;
  while (attempt < slots.length * 2) {
    attempt++;
    const slot = pickNext(slots);
    if (!slot) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    try {
      const out = await djenFetchSlot(slot, queryParams, signal);
      if (out.status === 429 || out.status >= 500) continue;
      return out;
    } catch (e) {
      markFail(slot.url, "err");
    }
  }
  throw new Error("Pool exausto");
  })();
  if (dedupKey) {
    inflight.set(dedupKey, exec);
    exec.finally(() => inflight.delete(dedupKey));
  }
  return exec;
}

const inflight = new Map();

function makeSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });
}

module.exports = { djenFetch, djenFetchSlot, loadPool, makeSupabase };