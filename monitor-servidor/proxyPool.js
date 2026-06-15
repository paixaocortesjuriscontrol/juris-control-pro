// Replica src/utils/djenProxyPool.ts em Node (round-robin, offline 60s, cooldown 429)
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const OFFLINE_MS = 60_000;
const COOLDOWN_429_MS = 30_000;

let cache = { fetchedAt: 0, slots: [] };
const TTL = 30_000;

let cursor = 0;
const slotState = new Map();

async function loadPool(sb) {
  const now = Date.now();
  if (now - cache.fetchedAt < TTL) return cache.slots;

  const { data: pool, error } = await sb
    .from("djen_proxy_pool")
    .select("url, token, ativo, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) throw error;

  const slots = (pool || []).map((r) => ({ url: r.url, token: r.token }));

  if (process.env.INCLUDE_LOCAL_PROXY === "true") {
    slots.unshift({
      url: process.env.LOCAL_PROXY_URL || "http://127.0.0.1:8089",
      token: process.env.LOCAL_PROXY_TOKEN || "",
      local: true,
    });
  }

  cache = { fetchedAt: now, slots };
  return slots;
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

async function djenFetch(sb, queryParams) {
  const slots = await loadPool(sb);
  let attempt = 0;
  while (attempt < slots.length * 2) {
    attempt++;
    const slot = pickNext(slots);
    if (!slot) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const qs = new URLSearchParams(queryParams).toString();
    const url = `${slot.url.replace(/\/$/, "")}/djen?${qs}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "x-proxy-token": slot.token },
        signal: AbortSignal.timeout(90_000),
      });
      const json = await res.json();
      if (json.status === 429) {
        markFail(slot.url, "429");
        continue;
      }
      if (!res.ok || (json.status && json.status >= 500)) {
        markFail(slot.url, "err");
        continue;
      }
      markOk(slot.url);
      return { slot, status: json.status || res.status, body: json.body };
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

module.exports = { djenFetch, loadPool, makeSupabase };