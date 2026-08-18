// DJEN Comunica Proxy - servidor mínimo (Node nativo, sem dependências)
// Repassa GETs para https://comunicaapi.pje.jus.br/api/v1/comunicacao
// para sair de um IP diferente do navegador (mitigar 429).
//
// Uso: PROXY_TOKEN=xxx PORT=8089 node server.js

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8089', 10);
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const UPSTREAM = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const STARTED_AT = Date.now();

if (!PROXY_TOKEN) {
  console.error('FATAL: PROXY_TOKEN não definido. Defina via env var.');
  process.exit(1);
}

function json(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...(extraHeaders || {}),
  });
  res.end(body);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-proxy-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function getOutboundIp() {
  // Best-effort: inspeciona interfaces IPv4 não-loopback.
  try {
    const os = require('os');
    const ifs = os.networkInterfaces();
    for (const name of Object.keys(ifs)) {
      for (const it of ifs[name] || []) {
        if (it.family === 'IPv4' && !it.internal) return it.address;
      }
    }
  } catch (_) {}
  return null;
}

function handleHealth(req, res) {
  json(res, 200, {
    ok: true,
    service: 'djen-comunica-proxy',
    uptime_s: Math.floor((Date.now() - STARTED_AT) / 1000),
    ip: getOutboundIp(),
  }, corsHeaders());
}

function handleDjen(req, res, parsedUrl) {
  const receivedToken = String(req.headers['x-proxy-token'] || '')
    .split(',')
    .map((t) => t.trim())
    .find(Boolean) || '';
  if (receivedToken !== PROXY_TOKEN) {
    return json(res, 401, { error: 'unauthorized' }, corsHeaders());
  }

  // Repassa todos os query params recebidos para o upstream.
  const upstreamUrl = new URL(UPSTREAM);
  for (const [k, v] of parsedUrl.searchParams.entries()) {
    upstreamUrl.searchParams.append(k, v);
  }

  const startedAt = Date.now();
  const opts = {
    method: 'GET',
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || 443,
    path: upstreamUrl.pathname + upstreamUrl.search,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://comunica.pje.jus.br',
      Referer: 'https://comunica.pje.jus.br/',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
    timeout: 90000,
  };

  const upstream = https.request(opts, (upRes) => {
    const chunks = [];
    upRes.on('data', (c) => chunks.push(c));
    upRes.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      json(
        res,
        200,
        {
          status: upRes.statusCode,
          body,
          elapsed_ms: Date.now() - startedAt,
        },
        corsHeaders()
      );
    });
  });

  upstream.on('timeout', () => upstream.destroy(new Error('upstream_timeout')));

  upstream.on('error', (err) => {
    json(
      res,
      502,
      {
        error: 'upstream_error',
        code: err.code || null,
        message: err.message,
        elapsed_ms: Date.now() - startedAt,
      },
      corsHeaders()
    );
  });

  upstream.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (_) {
    return json(res, 400, { error: 'invalid_url' }, corsHeaders());
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    return handleHealth(req, res);
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/djen') {
    return handleDjen(req, res, parsedUrl);
  }

  json(res, 404, { error: 'not_found' }, corsHeaders());
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[djen-comunica-proxy] listening on 127.0.0.1:${PORT}`);
});