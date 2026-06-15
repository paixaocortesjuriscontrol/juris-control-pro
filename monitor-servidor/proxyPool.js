// Replica src/utils/djenProxyPool.ts em Node (round-robin, offline 60s, cooldown 429)
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const OFFLINE_MS = 60_000;
const COOLDOWN_429_MS = 30_000;
const PROXY_REQUEST_TIMEOUT_MS = Math.max(10_000, Number(process.env.DJEN_PROXY_TIMEOUT_MS || 60_000));

let cache = { fetchedAt: 0, slots: [] };
const TTL = 30_000;

let cursor = 0;
const slotState = new Map();
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

  if (process.env.INCLUDE_LOCAL_PROXY === "true") {
    slots.unshift({
      id: "local",
      label: "Local VPS",
      url: process.env.LOCAL_PROXY_URL || "http://127.0.0.1:8089",
      token: process.env.LOCAL_PROXY_TOKEN || "",
      local: true,
    });
  }

  cache = { fetchedAt: now, slots };
  return slots;
}

function buildUpstreamUrl(queryParams) {
  const qs = new URLSearchParams(queryParams).toString();
  return `${PJE_COMUNICA_API}?${qs}`;
}

async function parseProxyResponse(slot, res) {
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (parsed && typeof parsed === "object" && "body" in parsed) {
    return { slot, status: Number(parsed.status || res.status || 200), body: parsed.body };
  }
  return { slot, status: res.status || 200, body: parsed ?? text };
}

function combineSignal(signal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

async function djenFetchSlot(slot, queryParams, signal) {
  const upstreamUrl = buildUpstreamUrl(queryParams);
  const qs = new URLSearchParams(queryParams).toString();
  const base = slot.url.replace(/\/$/, "");
  const urls = [
    `${base}/proxy?url=${encodeURIComponent(upstreamUrl)}`,
    `${base}/djen?${qs}`,
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "x-proxy-token": slot.token, "X-Proxy-Token": slot.token },
        signal: combineSignal(signal, PROXY_REQUEST_TIMEOUT_MS),
      });
      if (res.status === 404 || res.status === 502) {
        lastErr = new Error(`proxy_route_${res.status}`);
        continue;
      }
      const out = await parseProxyResponse(slot, res);
      if (out.status === 429) markFail(slot.url, "429");
      else if (out.status >= 500) markFail(slot.url, "err");
      else markOk(slot.url);
      return out;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      markFail(slot.url, "err");
    }
  }
  throw lastErr || new Error("Falha no proxy DJEN");
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
}

function makeSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });
}

module.exports = { djenFetch, djenFetchSlot, loadPool, makeSupabase };