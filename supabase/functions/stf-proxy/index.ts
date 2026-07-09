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

/**
 * Tenta múltiplas estratégias para alcançar o STF:
 * 1) fetch nativo do Deno (com cadeia TLS oficial)
 * 2) undici com TLS relaxado (fallback para ICP-Brasil)
 */
async function tentarFetch(url: string, method: 'GET' | 'POST', body?: string) {
  // Estratégia 1: fetch nativo (Deno)
  try {
    const r = await fetch(url, {
      method,
      headers: STF_HEADERS_BROWSER,
      body,
    });
    const text = await r.text();
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
    headers: STF_HEADERS_BROWSER,
    body,
    dispatcher: insecureAgent,
  });
  const text = await r.text();
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