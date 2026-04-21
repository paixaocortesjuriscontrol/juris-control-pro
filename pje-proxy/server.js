// PJE mTLS Proxy - servidor mínimo (Node nativo, sem Express)
// Uso: PROXY_TOKEN=xxx PORT=8088 node server.js

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8088', 10);
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';

if (!PROXY_TOKEN) {
  console.error('FATAL: PROXY_TOKEN não definido. Defina via env var.');
  process.exit(1);
}

function readBody(req, maxBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
    res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function handlePjeMni(req, res) {
  if (req.headers['x-proxy-token'] !== PROXY_TOKEN) {
    return json(res, 401, { error: 'unauthorized' });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw.toString('utf-8'));
  } catch (e) {
    return json(res, 400, { error: 'invalid_json', detail: String(e) });
  }

  const { endpoint, soap_action, soap_body, pfx_base64, pfx_password, timeout_ms } = payload || {};
  if (!endpoint || !soap_body || !pfx_base64) {
    return json(res, 400, { error: 'missing_fields', required: ['endpoint', 'soap_body', 'pfx_base64'] });
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return json(res, 400, { error: 'invalid_endpoint' });
  }

  const pfx = Buffer.from(pfx_base64, 'base64');
  const timeout = Math.min(Math.max(parseInt(timeout_ms || 30000, 10), 5000), 60000);

  const startedAt = Date.now();

  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': soap_action || '""',
      'Accept': 'text/xml, application/soap+xml, application/xml',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Length': Buffer.byteLength(soap_body, 'utf-8'),
      'User-Agent': 'Apache-CXF/3.5.5',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
    },
    pfx,
    passphrase: pfx_password || '',
    rejectUnauthorized: false, // alguns PJEs usam cadeias antigas
    timeout,
  };

  const upstream = https.request(options, (upRes) => {
    const chunks = [];
    upRes.on('data', (c) => chunks.push(c));
    upRes.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      json(res, 200, {
        status: upRes.statusCode,
        headers: upRes.headers,
        body,
        elapsed_ms: Date.now() - startedAt,
      });
    });
  });

  upstream.on('timeout', () => {
    upstream.destroy(new Error('upstream_timeout'));
  });

  upstream.on('error', (err) => {
    json(res, 502, {
      error: 'upstream_error',
      code: err.code || null,
      message: err.message,
      elapsed_ms: Date.now() - startedAt,
    });
  });

  upstream.write(soap_body);
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  // CORS básico (não estritamente necessário, mas ajuda em testes)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-proxy-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, service: 'pje-mtls-proxy', uptime_s: Math.floor(process.uptime()) });
  }

  if (req.method === 'POST' && req.url === '/pje-mni') {
    return handlePjeMni(req, res);
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pje-mtls-proxy] listening on 127.0.0.1:${PORT}`);
});