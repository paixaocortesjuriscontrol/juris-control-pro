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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === 'ultimo-dje') {
      const r = await undiciFetch(`${STF_BASE}/ultimo-dje`, {
        method: 'GET',
        headers: STF_HEADERS,
        dispatcher: insecureAgent,
      });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { ...corsHeaders, 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
      });
    }

    if (action === 'publicacoes') {
      const payload = body?.payload ?? {};
      const r = await undiciFetch(`${STF_BASE}/publicacoes`, {
        method: 'POST',
        headers: STF_HEADERS,
        body: JSON.stringify(payload),
        dispatcher: insecureAgent,
      });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { ...corsHeaders, 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
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
