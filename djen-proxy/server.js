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

// Hosts permitidos no repasse binário (/fetch). Necessário para baixar os
// cadernos do DEJT: o portal responde 403 (WAF) para IPs de datacenter,
// mas libera o acesso a partir das VPS do pool.
const ALLOWED_FETCH_HOSTS = new Set([
  'comunicaapi.pje.jus.br',
  'dejt.jt.jus.br',
  'diario.jt.jus.br',
]);

// GET /fetch?url=<url absoluta permitida>
// Repassa a resposta BINÁRIA do upstream (PDF etc.) sem transformar em JSON.
function handleFetch(req, res, parsedUrl) {
  const receivedToken = String(req.headers['x-proxy-token'] || '')
    .split(',')
    .map((t) => t.trim())
    .find(Boolean) || '';
  if (receivedToken !== PROXY_TOKEN) {
    return json(res, 401, { error: 'unauthorized' }, corsHeaders());
  }

  const raw = parsedUrl.searchParams.get('url') || '';
  let target;
  try {
    target = new URL(raw);
  } catch (_) {
    return json(res, 400, { error: 'invalid_target_url' }, corsHeaders());
  }
  if (target.protocol !== 'https:' || !ALLOWED_FETCH_HOSTS.has(target.hostname)) {
    return json(res, 403, { error: 'host_not_allowed', host: target.hostname }, corsHeaders());
  }

  const opts = {
    method: 'GET',
    hostname: target.hostname,
    port: target.port || 443,
    path: target.pathname + target.search,
    headers: {
      Accept: 'application/pdf,application/json,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: `https://${target.hostname}/`,
      Connection: 'keep-alive',
    },
    timeout: 180000,
  };

  const upstream = https.request(opts, (upRes) => {
    const headers = {
      ...corsHeaders(),
      'Content-Type': upRes.headers['content-type'] || 'application/octet-stream',
      'X-Upstream-Status': String(upRes.statusCode || 0),
    };
    if (upRes.headers['content-length']) headers['Content-Length'] = upRes.headers['content-length'];
    if (upRes.headers['last-modified']) headers['Last-Modified'] = upRes.headers['last-modified'];
    res.writeHead(upRes.statusCode || 502, headers);
    upRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('upstream_timeout')));
  upstream.on('error', (err) => {
    if (res.headersSent) return res.destroy();
    json(res, 502, { error: 'upstream_error', code: err.code || null, message: err.message }, corsHeaders());
  });
  upstream.end();
}

// ===== DJEN Cadernos: baixa, descompacta e devolve o caderno em páginas =====
// GET /caderno?tribunal=TST&data=2026-11-13&meio=D&offset=0&limit=1000
// O processamento pesado fica na VPS; o Supabase só grava cada página.
const zlib = require('zlib');
const CADERNO_CACHE = new Map(); // chave -> { quando, total, itens, meta }
const CADERNO_EM_ANDAMENTO = new Map();

function baixarBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }, timeout: 300000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirects < 5) {
        r.resume();
        return resolve(baixarBuffer(new URL(r.headers.location, url).toString(), redirects + 1));
      }
      const partes = [];
      r.on('data', (c) => partes.push(c));
      r.on('end', () => resolve({ status: r.statusCode, tipo: r.headers['content-type'] || '', buf: Buffer.concat(partes) }));
      r.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('upstream_timeout')));
    req.on('error', reject);
  });
}

function lerZip(buf) {
  // Lê o diretório central do ZIP e devolve [{ nome, conteudo }].
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip_invalido');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip_diretorio_invalido');
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const lNome = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.slice(p + 46, p + 46 + lNome).toString('utf8');
    p += 46 + lNome + lExtra + lCom;
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.slice(ini, ini + tamComp);
    const conteudo = metodo === 0 ? dados : metodo === 8 ? zlib.inflateRawSync(dados) : null;
    if (conteudo) out.push({ nome, conteudo });
  }
  return out;
}

function txt(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map((x) => typeof x === 'string' ? x : (x && (x.nome || (x.advogado && x.advogado.nome))) || '').filter(Boolean).join(' | ');
  return String(v);
}
function mapearComunicacao(c, data) {
  const num = c.numeroprocessocommascara || c.numero_processo || c.numeroProcesso || '';
  const a = c.destinatarioadvogados || c.advogados || [];
  const advogados = Array.isArray(a) ? a.map((x) => { const ad = x.advogado || x; return [ad.nome, ad.numero_oab && `OAB ${ad.numero_oab}/${ad.uf_oab || ''}`].filter(Boolean).join(' '); }).join(' | ') : txt(a);
  return {
    comunicacao_id: String(c.id != null ? c.id : (c.hash || '')),
    numero_processo: num,
    numero_digitos: String(num).replace(/\D/g, ''),
    partes: txt((c.destinatarios || []).map((d) => d.nome)),
    advogados,
    orgao: c.nomeOrgao || c.orgao || null,
    tipo: c.tipoComunicacao || c.tipoDocumento || null,
    data_disponibilizacao: String(c.data_disponibilizacao || c.datadisponibilizacao || data).slice(0, 10),
    texto: String(c.texto || '').slice(0, 6000),
  };
}
function itensDe(d) { return Array.isArray(d) ? d : (d && (d.items || d.comunicacoes || d.data)) || []; }

async function prepararCaderno(trib, data, meio) {
  const r1 = await baixarBuffer(`https://comunicaapi.pje.jus.br/api/v1/caderno/${trib}/${data}/${meio}`);
  const corpo1 = r1.buf.toString('utf8');
  if (r1.status === 404 && corpo1.includes('Nenhum caderno')) return { semCaderno: true };
  if (r1.status !== 200) return { erro: `DJEN respondeu ${r1.status}: ${corpo1.slice(0, 200)}`, status: r1.status };
  let meta = null, arquivo = r1;
  if (r1.tipo.includes('json')) {
    meta = JSON.parse(corpo1);
    const link = meta && (meta.url || meta.link || meta.urlArquivo);
    if (!link) return { total: itensDe(meta).length, itens: itensDe(meta).map((c) => mapearComunicacao(c, data)), meta };
    arquivo = await baixarBuffer(link);
    if (arquivo.status !== 200) return { erro: `Arquivo do caderno respondeu ${arquivo.status}`, status: arquivo.status };
  }
  const itens = [];
  const ehZip = arquivo.buf[0] === 0x50 && arquivo.buf[1] === 0x4b;
  const arquivos = ehZip ? lerZip(arquivo.buf) : [{ nome: 'x.json', conteudo: arquivo.buf }];
  for (const f of arquivos) {
    if (!/\.json$/i.test(f.nome)) continue;
    for (const c of itensDe(JSON.parse(f.conteudo.toString('utf8')))) itens.push(mapearComunicacao(c, data));
  }
  if (meta) { delete meta.url; delete meta.link; delete meta.urlArquivo; }
  return { total: itens.length, itens, meta, tamanho: arquivo.buf.length };
}

async function handleCaderno(req, res, parsedUrl) {
  const tk = String(req.headers['x-proxy-token'] || '').split(',').map((t) => t.trim()).find(Boolean) || '';
  if (tk !== PROXY_TOKEN) return json(res, 401, { error: 'unauthorized' }, corsHeaders());
  const trib = String(parsedUrl.searchParams.get('tribunal') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const data = String(parsedUrl.searchParams.get('data') || '');
  const meio = String(parsedUrl.searchParams.get('meio') || 'D').toUpperCase().replace(/[^A-Z]/g, '');
  const offset = Math.max(0, parseInt(parsedUrl.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(3000, Math.max(1, parseInt(parsedUrl.searchParams.get('limit') || '1000', 10) || 1000));
  if (!trib || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !meio) return json(res, 400, { error: 'parametros_invalidos' }, corsHeaders());
  const chave = `${trib}|${data}|${meio}`;
  try {
    let c = CADERNO_CACHE.get(chave);
    if (!c || offset === 0 && parsedUrl.searchParams.get('renovar') === '1') {
      let p = CADERNO_EM_ANDAMENTO.get(chave);
      if (!p) { p = prepararCaderno(trib, data, meio).finally(() => CADERNO_EM_ANDAMENTO.delete(chave)); CADERNO_EM_ANDAMENTO.set(chave, p); }
      c = await p;
      if (c.semCaderno) return json(res, 404, { semCaderno: true }, corsHeaders());
      if (c.erro) return json(res, 502, { error: c.erro, upstream_status: c.status || null }, corsHeaders());
      c.quando = Date.now();
      CADERNO_CACHE.set(chave, c);
      for (const [k, v] of CADERNO_CACHE) if (Date.now() - v.quando > 3600000) CADERNO_CACHE.delete(k);
    }
    const itens = c.itens.slice(offset, offset + limit);
    json(res, 200, { total: c.total, offset, proximo: offset + itens.length < c.total ? offset + itens.length : null, tamanho: c.tamanho || null, meta: c.meta || null, itens }, corsHeaders());
  } catch (e) {
    json(res, 500, { error: String((e && e.message) || e) }, corsHeaders());
  }
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

  if (req.method === 'GET' && parsedUrl.pathname === '/fetch') {
    return handleFetch(req, res, parsedUrl);
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/caderno') {
    return handleCaderno(req, res, parsedUrl);
  }


  json(res, 404, { error: 'not_found' }, corsHeaders());
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[djen-comunica-proxy] listening on 127.0.0.1:${PORT}`);
});