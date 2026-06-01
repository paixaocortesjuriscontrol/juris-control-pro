// DJEN Comunica Proxy v3 — multi-IP por VM Google Cloud
//
// Modo legado (LOCAL_IPS não definido):
//   - GET /proxy?url=<URL>     → repassa cru ao upstream usando IP padrão da VM
//   - GET /health              → { ok, ip (padrão) }
//   - GET /whoami              → IP público real saindo pelo socket padrão
//
// Modo multi-IP (LOCAL_IPS="ip1,ip2,...,ipN"):
//   - GET /proxy/<N>?url=<URL> → repassa cru ao upstream usando LOCAL_IPS[N-1]
//   - GET /whoami/<N>          → IP público real saindo por LOCAL_IPS[N-1]
//   - rotas legadas /proxy e /whoami continuam funcionando (IP padrão).
//
// Reload graceful: rode via pm2 e use `pm2 reload djen-proxy` — conexões em
// voo terminam antes do swap. Se LOCAL_IPS for removido, o servidor cai
// automaticamente em modo legado (mesmo comportamento da versão anterior).
//
// Uso:
//   PROXY_TOKEN=xxx PORT=8089 LOCAL_IPS=10.0.0.2,10.0.0.3,10.0.0.4,10.0.0.5,10.0.0.6 \
//     node server.js
//
// Importante: LOCAL_IPS são os **IPs internos** da nic0 (alias ranges /32),
// não os IPs públicos. O GCP faz NAT 1:1 entre cada IP interno alias e
// o IP externo correspondente do access-config.

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8089', 10);
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const LOCAL_IPS = (process.env.LOCAL_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const STARTED_AT = Date.now();

if (!PROXY_TOKEN) {
  console.error('FATAL: PROXY_TOKEN não definido. Defina via env var.');
  process.exit(1);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-proxy-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function json(res, status, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(),
    ...(extra || {}),
  });
  res.end(body);
}

function getDefaultLocalIp() {
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

// ---------------------------------------------------------------------------
// /whoami — consulta IP público real através de api.ipify.org
// ---------------------------------------------------------------------------
function fetchPublicIp(localAddress, cb) {
  const opts = {
    method: 'GET',
    hostname: 'api.ipify.org',
    port: 443,
    path: '/',
    timeout: 8000,
    headers: { 'User-Agent': 'djen-proxy/3.0' },
  };
  if (localAddress) opts.localAddress = localAddress;

  const req = https.request(opts, (r) => {
    const chunks = [];
    r.on('data', (c) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks).toString('utf-8').trim()));
  });
  req.on('timeout', () => req.destroy(new Error('whoami_timeout')));
  req.on('error', (err) => cb(err));
  req.end();
}

function handleWhoami(res, idx /* 0-based or null */) {
  let localAddress = null;
  if (idx !== null) {
    if (!LOCAL_IPS.length) {
      return json(res, 503, { error: 'multi_ip_disabled', hint: 'set LOCAL_IPS env' });
    }
    if (idx < 0 || idx >= LOCAL_IPS.length) {
      return json(res, 404, { error: 'index_out_of_range', total: LOCAL_IPS.length });
    }
    localAddress = LOCAL_IPS[idx];
  }
  fetchPublicIp(localAddress, (err, ip) => {
    if (err) return json(res, 502, { error: 'whoami_failed', message: err.message });
    json(res, 200, { ok: true, ip, localAddress, index: idx === null ? null : idx + 1 });
  });
}

// ---------------------------------------------------------------------------
// /proxy[/N]?url=... — repassa cru ao upstream
// ---------------------------------------------------------------------------
function handleProxy(req, res, parsedUrl, idx /* 0-based or null */) {
  if (req.headers['x-proxy-token'] !== PROXY_TOKEN) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const target = parsedUrl.searchParams.get('url');
  if (!target) return json(res, 400, { error: 'missing_url_param' });

  let upstreamUrl;
  try {
    upstreamUrl = new URL(target);
  } catch {
    return json(res, 400, { error: 'invalid_url' });
  }
  if (upstreamUrl.protocol !== 'https:' && upstreamUrl.protocol !== 'http:') {
    return json(res, 400, { error: 'invalid_protocol' });
  }

  let localAddress = null;
  if (idx !== null) {
    if (!LOCAL_IPS.length) {
      return json(res, 503, { error: 'multi_ip_disabled' });
    }
    if (idx < 0 || idx >= LOCAL_IPS.length) {
      return json(res, 404, { error: 'index_out_of_range', total: LOCAL_IPS.length });
    }
    localAddress = LOCAL_IPS[idx];
  }

  const opts = {
    method: 'GET',
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (upstreamUrl.protocol === 'https:' ? 443 : 80),
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
  if (localAddress) opts.localAddress = localAddress;

  const lib = upstreamUrl.protocol === 'https:' ? https : http;
  const upstream = lib.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode || 502, {
      'Content-Type': upRes.headers['content-type'] || 'application/json; charset=utf-8',
      ...corsHeaders(),
    });
    upRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('upstream_timeout')));
  upstream.on('error', (err) => {
    if (res.headersSent) return res.destroy();
    json(res, 502, { error: 'upstream_error', code: err.code || null, message: err.message });
  });
  upstream.end();
}

// ---------------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return json(res, 400, { error: 'invalid_url' });
  }
  const rawPath = parsedUrl.pathname;

  // Normaliza prefixo opcional `/proxy/N` — assim cada IP pode ser cadastrado
  // como slot independente no Pool com baseUrl `.../proxy/N`, e as rotas
  // `/health`, `/whoami` e o próprio `/proxy?url=…` continuam respondendo.
  let prefixIdx = null; // 0-based
  let path = rawPath;
  const m = rawPath.match(/^\/proxy\/(\d+)(\/.*)?$/);
  if (m) {
    prefixIdx = parseInt(m[1], 10) - 1;
    path = m[2] || '/';
  }

  if (req.method === 'GET' && path === '/health') {
    if (prefixIdx !== null) {
      // Health do slot multi-IP: devolve o IP público real daquele índice.
      if (!LOCAL_IPS.length) return json(res, 503, { error: 'multi_ip_disabled' });
      if (prefixIdx < 0 || prefixIdx >= LOCAL_IPS.length) {
        return json(res, 404, { error: 'index_out_of_range', total: LOCAL_IPS.length });
      }
      return fetchPublicIp(LOCAL_IPS[prefixIdx], (err, ip) => {
        json(res, 200, {
          ok: true,
          service: 'djen-vps-proxy',
          version: '3.0-multi-ip',
          uptime_s: Math.floor((Date.now() - STARTED_AT) / 1000),
          ip: ip || null,
          index: prefixIdx + 1,
          localAddress: LOCAL_IPS[prefixIdx],
          whoami_error: err ? err.message : undefined,
        });
      });
    }
    return json(res, 200, {
      ok: true,
      service: 'djen-vps-proxy',
      version: '3.0-multi-ip',
      uptime_s: Math.floor((Date.now() - STARTED_AT) / 1000),
      ip: getDefaultLocalIp(),
      multi_ip: LOCAL_IPS.length > 0,
      ip_count: LOCAL_IPS.length,
    });
  }

  if (req.method === 'GET' && path === '/whoami') {
    return handleWhoami(res, prefixIdx);
  }

  // /whoami/N (sem prefixo /proxy/X)
  if (req.method === 'GET' && prefixIdx === null) {
    const w = rawPath.match(/^\/whoami\/(\d+)$/);
    if (w) return handleWhoami(res, parseInt(w[1], 10) - 1);
  }

  // /proxy[/N]?url=…  — quando o prefixo /proxy/N foi consumido acima,
  //   o path remanescente é '/'.
  if (req.method === 'GET' && (path === '/proxy' || (prefixIdx !== null && path === '/'))) {
    return handleProxy(req, res, parsedUrl, prefixIdx);
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[djen-vps-proxy] listening 127.0.0.1:${PORT} — multi-IP=${LOCAL_IPS.length > 0 ? LOCAL_IPS.length : 'off'}`,
  );
});

// Graceful shutdown para `pm2 reload`
function shutdown(signal) {
  console.log(`[djen-vps-proxy] received ${signal}, draining…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));