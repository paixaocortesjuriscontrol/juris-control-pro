// Edge Function: proxy server-side para o portal público STF Digital
// Resolve o problema de CORS que bloqueia chamadas diretas do navegador
// para https://digital.stf.jus.br/decisoes-publicacoes/api/public/*
// Usa undici (npm:) para contornar a cadeia ICP-Brasil que o store TLS
// padrão do Deno não reconhece (UnknownIssuer). Endpoint é público e read-only.

import { Agent, fetch as undiciFetch } from "npm:undici@6.19.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STF_BASE = 'https://digital.stf.jus.br/decisoes-publicacoes/api/public';

const STF_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Referer': 'https://digital.stf.jus.br/publico/publicacoes',
  'Origin': 'https://digital.stf.jus.br',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

// Headers extras para simular um navegador real (passar por AWS WAF challenge)
const STF_HEADERS_BROWSER = {
  ...STF_HEADERS,
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest',
};

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

let sessionCookie: string | null = null;
let sessionXsrf: string | null = null;

function parseSetCookie(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  const raw = headers.get('set-cookie');
  if (!raw) return jar;
  for (const part of raw.split(/,(?=\s*[^;=]+=[^;]+)/g)) {
    const first = part.trim().split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar[first.slice(0, eq)] = first.slice(eq + 1);
  }
  return jar;
}

function mergeSessionCookies(headers: Headers) {
  const jar = parseSetCookie(headers);
  if (jar['XSRF-TOKEN']) sessionXsrf = jar['XSRF-TOKEN'];
  const entries = Object.entries(jar);
  if (entries.length) sessionCookie = entries.map(([k, v]) => `${k}=${v}`).join('; ');
}

async function ensureCsrf(force = false) {
  if (!force && sessionCookie && sessionXsrf) return;
  const r = await undiciFetch(`${STF_BASE}/ultimo-dje`, {
    method: 'GET',
    headers: STF_HEADERS_BROWSER,
    dispatcher: insecureAgent,
  });
  await r.text();
  mergeSessionCookies(r.headers);
  if (!sessionXsrf) throw new Error('stf_csrf_indisponivel');
}

/**
 * Tenta múltiplas estratégias para alcançar o STF:
 * 1) fetch nativo do Deno (com cadeia TLS oficial)
 * 2) undici com TLS relaxado (fallback para ICP-Brasil)
 */
async function tentarFetch(url: string, method: 'GET' | 'POST', body?: string) {
  const headers = { ...STF_HEADERS_BROWSER } as Record<string, string>;
  if (method === 'POST') {
    await ensureCsrf();
    if (sessionCookie) headers['Cookie'] = sessionCookie;
    if (sessionXsrf) headers['X-XSRF-TOKEN'] = sessionXsrf;
  }

  // Estratégia 1: fetch nativo (Deno)
  try {
    const r = await fetch(url, {
      method,
      headers,
      body,
    });
    const text = await r.text();
    mergeSessionCookies(r.headers);
    if (method === 'POST' && (r.status === 403 || /CSRF/i.test(text))) {
      await ensureCsrf(true);
      const retryHeaders = { ...headers, Cookie: sessionCookie ?? '', 'X-XSRF-TOKEN': sessionXsrf ?? '' };
      const retry = await fetch(url, { method, headers: retryHeaders, body });
      const retryText = await retry.text();
      mergeSessionCookies(retry.headers);
      return {
        text: retryText,
        status: retry.status,
        contentType: retry.headers.get('content-type') ?? 'application/json',
      };
    }
    if (r.status < 500) {
      return {
        text,
        status: r.status,
        contentType: r.headers.get('content-type') ?? 'application/json',
      };
    }
    console.log(`[stf-proxy] fetch nativo retornou ${r.status}, tentando undici...`);
  } catch (e) {
    console.log(`[stf-proxy] fetch nativo falhou: ${(e as Error).message}, tentando undici...`);
  }

  // Estratégia 2: undici com TLS relaxado
  const r = await undiciFetch(url, {
    method,
    headers,
    body,
    dispatcher: insecureAgent,
  });
  const text = await r.text();
  mergeSessionCookies(r.headers);
  return {
    text,
    status: r.status,
    contentType: r.headers.get('content-type') ?? 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === 'ultimo-dje') {
      const { text, status, contentType } = await tentarFetch(`${STF_BASE}/ultimo-dje`, 'GET');
      return new Response(text, {
        status,
        headers: { ...corsHeaders, 'Content-Type': contentType },
      });
    }

    if (action === 'publicacoes') {
      const payload = body?.payload ?? {};
      const { text, status, contentType } = await tentarFetch(`${STF_BASE}/publicacoes`, 'POST', JSON.stringify(payload));
      return new Response(text, {
        status,
        headers: { ...corsHeaders, 'Content-Type': contentType },
      });
    }

    return new Response(
      JSON.stringify({ error: 'invalid_action', expected: ['ultimo-dje', 'publicacoes'] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'proxy_error', message: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
