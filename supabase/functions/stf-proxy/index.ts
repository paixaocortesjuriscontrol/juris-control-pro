// Edge Function: proxy server-side para o portal público STF Digital.
// Mantida para o motor Flash do navegador; o motor VPS usa implementação Node própria.

import { connect } from "node:net";
import { TLSSocket } from "node:tls";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HOST = "digital.stf.jus.br";
const STF_BASE = "/decisoes-publicacoes/api/public";

const STF_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Referer: "https://digital.stf.jus.br/publico/publicacoes",
  Origin: "https://digital.stf.jus.br",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "X-Requested-With": "XMLHttpRequest",
};

let sessionCookie: string | null = null;
let sessionXsrf: string | null = null;

function parseSetCookies(values: string[]): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const line of values) {
    const first = line.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

function updateSession(headers: Record<string, string[]>) {
  const jar = parseSetCookies(headers["set-cookie"] || []);
  if (jar["XSRF-TOKEN"]) sessionXsrf = jar["XSRF-TOKEN"];
  const entries = Object.entries(jar);
  if (entries.length) sessionCookie = entries.map(([k, v]) => `${k}=${v}`).join("; ");
}

function decodeChunked(body: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(body);
  let i = 0;
  const chunks: Uint8Array[] = [];
  while (i < text.length) {
    const lineEnd = text.indexOf("\r\n", i);
    if (lineEnd < 0) break;
    const size = parseInt(text.slice(i, lineEnd).split(";")[0], 16);
    if (!size) break;
    const start = lineEnd + 2;
    const raw = text.slice(start, start + size);
    chunks.push(new TextEncoder().encode(raw));
    i = start + size + 2;
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function stfRequest(path: string, method: "GET" | "POST", body?: string, extraHeaders: Record<string, string> = {}) {
  const socket = connect({ host: HOST, port: 443 });
  const tls = new TLSSocket(socket, { servername: HOST, requestCert: false });

  // O portal usa cadeia ICP-Brasil, não reconhecida no ambiente Edge.
  // Em Node/Deno compat, `rejectUnauthorized` não é honrado pelo tipo do construtor,
  // mas o campo interno é lido pelo handshake TLS.
  (tls as any).rejectUnauthorized = false;

  await new Promise<void>((resolve, reject) => {
    tls.once("secureConnect", resolve);
    tls.once("error", reject);
  });

  const headers: Record<string, string> = {
    Host: HOST,
    Connection: "close",
    ...STF_HEADERS,
    ...extraHeaders,
  };
  if (body) headers["Content-Length"] = String(new TextEncoder().encode(body).length);

  const head = [
    `${method} ${path} HTTP/1.1`,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    "",
    body || "",
  ].join("\r\n");

  const chunks: Uint8Array[] = [];
  tls.write(head);

  const raw = await new Promise<Uint8Array>((resolve, reject) => {
    tls.on("data", (c) => chunks.push(c));
    tls.once("end", () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.length; }
      resolve(out);
    });
    tls.once("error", reject);
  });

  const marker = new TextEncoder().encode("\r\n\r\n");
  let headerEnd = -1;
  for (let i = 0; i <= raw.length - marker.length; i++) {
    if (marker.every((b, j) => raw[i + j] === b)) { headerEnd = i; break; }
  }
  if (headerEnd < 0) throw new Error("stf_invalid_response");

  const headerText = new TextDecoder().decode(raw.slice(0, headerEnd));
  const bodyBytesRaw = raw.slice(headerEnd + marker.length);
  const lines = headerText.split("\r\n");
  const status = Number(lines[0].match(/HTTP\/\d\.\d\s+(\d+)/)?.[1] || 0);
  const respHeaders: Record<string, string[]> = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).toLowerCase();
    const val = line.slice(idx + 1).trim();
    (respHeaders[key] ||= []).push(val);
  }
  const isChunked = (respHeaders["transfer-encoding"] || []).some((v) => /chunked/i.test(v));
  const bodyBytes = isChunked ? decodeChunked(bodyBytesRaw) : bodyBytesRaw;
  updateSession(respHeaders);
  return {
    status,
    text: new TextDecoder().decode(bodyBytes),
    contentType: respHeaders["content-type"]?.[0] || "application/json",
  };
}

async function ensureCsrf(force = false) {
  if (!force && sessionCookie && sessionXsrf) return;
  await stfRequest(`${STF_BASE}/ultimo-dje`, "GET");
  if (!sessionXsrf) throw new Error("stf_csrf_indisponivel");
}

async function requestWithSession(path: string, method: "GET" | "POST", body?: string) {
  if (method === "POST") await ensureCsrf();
  const extra: Record<string, string> = {};
  if (method === "POST") {
    if (sessionCookie) extra.Cookie = sessionCookie;
    if (sessionXsrf) extra["X-XSRF-TOKEN"] = sessionXsrf;
  }
  let res = await stfRequest(path, method, body, extra);
  if (method === "POST" && (res.status === 403 || /CSRF/i.test(res.text))) {
    await ensureCsrf(true);
    res = await stfRequest(path, method, body, {
      Cookie: sessionCookie || "",
      "X-XSRF-TOKEN": sessionXsrf || "",
    });
  }
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === "ultimo-dje") {
      const res = await requestWithSession(`${STF_BASE}/ultimo-dje`, "GET");
      return new Response(res.text, { status: res.status, headers: { ...corsHeaders, "Content-Type": res.contentType } });
    }

    if (action === "publicacoes") {
      const payload = JSON.stringify(body?.payload ?? {});
      const res = await requestWithSession(`${STF_BASE}/publicacoes`, "POST", payload);
      return new Response(res.text, { status: res.status, headers: { ...corsHeaders, "Content-Type": res.contentType } });
    }

    return new Response(JSON.stringify({ error: "invalid_action", expected: ["ultimo-dje", "publicacoes"] }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "proxy_error", message: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});