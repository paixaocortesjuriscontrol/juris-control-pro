// Motor STF Servidor no VPS.
// Espelha DJEN Termos Servidor (paralela.js) para monitoramentos com busca_stf_ativa=true.
// STF publica apenas em digital.stf.jus.br (fora do DJEN/PJe Comunica). Fetch direto via
// https nativo com rejectUnauthorized:false (cadeia ICP-Brasil não é aceita pelo store
// padrão em alguns hosts). Endpoint é público.
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { loadPool } = require("../proxyPool");

const TIPO_ENGINE = "djen_stf_servidor";
const STF_URL = "https://digital.stf.jus.br/decisoes-publicacoes/api/public/publicacoes";
const STF_CSRF_URL = "https://digital.stf.jus.br/decisoes-publicacoes/api/public/ultimo-dje";
const PAGE_DELAY_MS = Math.max(0, Number(process.env.STF_PAGE_DELAY_MS || 800));
const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const TERM_DELAY_MS = Math.max(0, Number(process.env.STF_TERM_DELAY_MS || 800));
const REQ_TIMEOUT_MS = 45_000;

const STF_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Referer: "https://digital.stf.jus.br/publico/publicacoes",
  Origin: "https://digital.stf.jus.br",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const insecureAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// Sessão CSRF: o backend do STF exige X-XSRF-TOKEN + cookie JSESSIONID/XSRF-TOKEN.
// Mantemos uma sessão por via/VPS para permitir execução distribuída sem misturar cookies.
const sessionByVia = new Map();

function viaKey(via) {
  return via?.id ? String(via.id) : "__direct__";
}

function viaLabel(via) {
  return via?.label || via?.url || "direto";
}

function proxyUrl(via, targetUrl) {
  if (!via?.url) return targetUrl;
  return `${String(via.url).replace(/\/$/, "")}/proxy?url=${encodeURIComponent(targetUrl)}`;
}

function parseSetCookies(headers) {
  const raw = headers?.["set-cookie"] || headers?.["Set-Cookie"] || headers?.setCookie || headers?.set_cookie;
  const arr = Array.isArray(raw) ? raw : (typeof raw === "string" ? [raw] : []);
  if (arr.length === 0) return {};
  const jar = {};
  for (const line of arr) {
    const eq = line.indexOf("=");
    const semi = line.indexOf(";");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1, semi < 0 ? undefined : semi).trim();
    jar[name] = value;
  }
  return jar;
}

function normalizeProxyResult(res, body) {
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (_) {}
  if (parsed && typeof parsed === "object" && "body" in parsed) {
    const headers = parsed.headers || parsed.responseHeaders || {};
    const rawBody = typeof parsed.body === "string" ? parsed.body : JSON.stringify(parsed.body ?? null);
    return { status: Number(parsed.status || res.statusCode || 0), headers, body: rawBody };
  }
  return { status: res.statusCode || 0, headers: res.headers || {}, body };
}

function httpRequest(url, { method = "GET", headers = {}, body = null, via = null } = {}) {
  return new Promise((resolve, reject) => {
    const target = via?.url ? proxyUrl(via, url) : url;
    const isProxy = !!via?.url;
    const finalHeaders = isProxy
      ? { "x-proxy-token": via.token, ...headers }
      : headers;
    const client = String(target).startsWith("http://") ? http : https;
    const opts = String(target).startsWith("https://")
      ? { method, headers: finalHeaders, agent: insecureAgent, timeout: REQ_TIMEOUT_MS }
      : { method, headers: finalHeaders, timeout: REQ_TIMEOUT_MS };
    const req = client.request(target, opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(isProxy ? normalizeProxyResult(res, raw) : { status: res.statusCode || 0, headers: res.headers, body: raw });
      });
    });
    req.on("timeout", () => req.destroy(new Error("stf_timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function ensureCsrf(via = null, force = false) {
  const key = viaKey(via);
  const current = sessionByVia.get(key) || {};
  if (!force && current.cookies && current.xsrf) return current;
  const res = await httpRequest(STF_CSRF_URL, { method: "GET", headers: STF_HEADERS, via });
  if (res.status < 200 || res.status >= 300) throw new Error(`stf_csrf_http_${res.status}`);
  const jar = parseSetCookies(res.headers);
  const next = { ...current };
  if (jar["XSRF-TOKEN"]) next.xsrf = jar["XSRF-TOKEN"];
  const parts = [];
  for (const [k, v] of Object.entries(jar)) parts.push(`${k}=${v}`);
  if (parts.length) next.cookies = parts.join("; ");
  if (!next.xsrf) throw new Error("stf_csrf_indisponivel");
  sessionByVia.set(key, next);
  return next;
}

function sanitizeTermoStfApi(s) {
  // O endpoint STF valida termo com /^[a-zA-Z\d\,\-\s]{0,2010}$/.
  // Enviar acentos/apóstrofos/etc. causa 422 e a execução termina sem achados.
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\d,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2010);
}

function todayBrtYmd() {
  // Hoje BRT (UTC-3), formato YYYY-MM-DD
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function ymdToEpochMs(ymd, endOfDay) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (endOfDay) return Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999);
  return Date.UTC(y, m - 1, d, 3, 0, 0, 0);
}

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sect: "§",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  Acirc: "Â", Ecirc: "Ê", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û",
  agrave: "à", Agrave: "À", uuml: "ü", Uuml: "Ü",
  ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", hellip: "…",
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", mdash: "—", ndash: "–",
};

function decodeLooseEntities(s) {
  return String(s || "")
    .replace(/&([a-zA-Z]+)\s*;?/g, (m, name) => (NAMED_ENTITIES[name] ?? m))
    .replace(/&#(\d+)\s*;?/g, (_m, n) => { try { return String.fromCodePoint(+n); } catch { return _m; } })
    .replace(/&#x([0-9a-fA-F]+)\s*;?/g, (_m, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _m; } });
}

function normalize(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[&\/\\]/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contemFrase(texto, frase) {
  const t = normalize(texto);
  const f = normalize(frase);
  if (!f) return false;
  return t.includes(f);
}

function contemTodasPalavras(texto, termo) {
  const t = normalize(texto);
  const palavras = normalize(termo)
    .split(" ")
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  if (palavras.length === 0) return false;
  return palavras.every((p) => new RegExp(`(?:^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(t));
}

function contemTermoStf(texto, termo, { fallbackTodasPalavras = false } = {}) {
  return contemFrase(texto, termo) || (fallbackTodasPalavras && contemTodasPalavras(texto, termo));
}

function parsearTermoOr(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{3,6})\s*\/\s*(.+)$/);
  if (m) return { oabDigits: m[1], nome: m[2].trim() };
  m = t.match(/^(.+?)\s*\/\s*(\d{3,6})$/);
  if (m) return { oabDigits: m[2], nome: m[1].trim() };
  const clean = t
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, "")
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, "")
    .replace(/^Adv\.?\s*/i, "")
    .trim();
  return clean ? { nome: clean } : null;
}

function stripTags(html) {
  return decodeLooseEntities(String(html || "")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(p|div|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stringifyStfValue(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return stripTags(String(value));
  if (Array.isArray(value)) return value.map(stringifyStfValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return [
      value.nome,
      value.nomeParte,
      value.nomeAdvogado,
      value.categoria,
      value.polo,
      value.tipo,
      value.numero,
      value.oab,
      value.numeroOab,
      value.ufOab,
      value.identificacao,
      stringifyStfValue(value.identificacoes),
      stringifyStfValue(value.advogados),
      stringifyStfValue(value.procuradores),
      stringifyStfValue(value.representantes),
    ].filter(Boolean).join(" ");
  }
  return "";
}

function hashConteudo(processo, texto) {
  return crypto
    .createHash("sha256")
    .update(`${processo || ""}|${(texto || "").slice(0, 4000)}`)
    .digest("hex");
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") {
    const s = v.trim();
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (br) {
      const [, dd, mm, yyyy, hh = "12", mi = "00"] = br;
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00.000Z`;
    }
    const isoDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T12:00:00.000Z`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function ymdFromDateLike(v, fallbackYmd) {
  const parsed = parseDate(v);
  if (parsed) return parsed.slice(0, 10);
  return fallbackYmd || todayBrtYmd();
}

function dataDisponibilizacaoStf(v, fallbackYmd) {
  const ymd = ymdFromDateLike(v, fallbackYmd);
  return `${ymd}T15:00:00.000Z`;
}

function nextBusinessDateYmd(dateLike) {
  const d = new Date(`${String(dateLike || todayBrtYmd()).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function hashDjenStyle(conteudo, dataDisponibilizacao, processoNumero, idDjen) {
  const proc = String(processoNumero || "").replace(/\D/g, "");
  const data = String(dataDisponibilizacao || "").slice(0, 10);
  const base = idDjen
    ? `id_djen:${idDjen}|${data}|${proc}`
    : `${data}|${proc}|${String(conteudo || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 800)}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

function postStfPage({ termo, processo, pagina, dataInicio, dataFim, via }) {
  const payload = JSON.stringify({
    termo: String(termo || "").trim(),
    processo: String(processo || "").trim(),
    pagina,
    quantidade: PAGE_SIZE,
    data: ymdToEpochMs(dataInicio, false),
    dataFim: ymdToEpochMs(dataFim, true),
    tipoPesquisa: ["PUBLICACAO", "DIVULGACAO"],
    filtros: { Tipo: [], Relator: [], "Sessão": [], Colegiado: [] },
  });
  const key = viaKey(via);
  const sess = sessionByVia.get(key) || {};
  const headers = {
    ...STF_HEADERS,
    "Content-Length": Buffer.byteLength(payload),
    "X-XSRF-TOKEN": sess.xsrf || "",
    Cookie: sess.cookies || "",
  };
  return httpRequest(STF_URL, { method: "POST", headers, body: payload, via }).then((res) => {
    const jar = parseSetCookies(res.headers);
    if (Object.keys(jar).length) {
      const next = { ...(sessionByVia.get(key) || {}) };
      if (jar["XSRF-TOKEN"]) next.xsrf = jar["XSRF-TOKEN"];
      const parts = [];
      for (const [k, v] of Object.entries(jar)) parts.push(`${k}=${v}`);
      if (parts.length) next.cookies = parts.join("; ");
      sessionByVia.set(key, next);
    }
    try {
      return { status: res.status || 0, body: JSON.parse(res.body) };
    } catch {
      return { status: res.status || 0, body: null, raw: String(res.body || "").slice(0, 300) };
    }
  });
}

async function buscarTodasPaginas({ termo, processo, dataInicio, dataFim, log, via }) {
  const acc = [];
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    let resp;
    try {
      await ensureCsrf(via);
      resp = await postStfPage({ termo, processo, pagina, dataInicio, dataFim, via });
      // Se CSRF expirou (403) ou faltou, renova e tenta 1x
      if (resp.status === 403 || (typeof resp.raw === "string" && /CSRF/i.test(resp.raw))) {
        log("stf.csrf_renew", { status: resp.status, via: viaLabel(via) });
        await ensureCsrf(via, true);
        resp = await postStfPage({ termo, processo, pagina, dataInicio, dataFim, via });
      }
    } catch (e) {
      log("stf.fetch_error", { termo, processo, pagina, via: viaLabel(via), e: e.message });
      break;
    }
    if (resp.status < 200 || resp.status >= 300) {
      log("stf.http_error", { termo, processo, pagina, via: viaLabel(via), status: resp.status, raw: resp.raw });
      break;
    }
    const data = resp.body || {};
    const items =
      (Array.isArray(data.publicacoes) && data.publicacoes) ||
      (Array.isArray(data.content) && data.content) ||
      (Array.isArray(data) && data) ||
      [];
    const total = Number(data.total ?? data.totalElements ?? data.totalItems ?? items.length) || items.length;
    acc.push(...items);
    if (items.length === 0) break;
    if (pagina * PAGE_SIZE >= total) break;
    if (PAGE_DELAY_MS > 0) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }
  return acc;
}

function extractProcessoNumero(pub) {
  return (
    pub.processo ||
    pub.numeroProcesso ||
    pub.numero_processo ||
    (pub.processoId ? String(pub.processoId) : "") ||
    ""
  );
}

function extractTextoLimpo(pub) {
  return stripTags(pub.texto || pub.textoPublicacao || pub.conteudo || pub.ementa || "");
}

function buildTextoValidacao(pub) {
  return [
    extractTextoLimpo(pub),
    extractProcessoNumero(pub),
    pub.tipo,
    extractRelator(pub),
    pub.observacao,
    pub.responsavel,
    pub.descricao,
    stringifyStfValue(pub.envolvidos),
  ].filter(Boolean).join(" ");
}

function extractStfId(pub) {
  const raw = pub.id ?? pub.publicacaoId ?? pub.processoId ?? "";
  return raw ? String(raw) : null;
}

function extractRelator(pub) {
  return pub.relator || pub.relatorNome || null;
}

function passaValidacao(mon, pub) {
  const texto = buildTextoValidacao(pub);
  const processo = extractProcessoNumero(pub);
  const termoPrincipal = mon.termo_busca || "";
  const tipo = mon.tipo === "nome" ? "advogado" : mon.tipo === "geral" ? "palavra-chave" : mon.tipo || "palavra-chave";

  // Match do termo principal
  let match = false;
  if (tipo === "processo") {
    const digitos = String(termoPrincipal).replace(/\D/g, "");
    const pDigitos = String(processo).replace(/\D/g, "");
    match = digitos.length >= 15 && pDigitos.includes(digitos);
  } else {
    // A busca pública do STF não é frase-exata: para termos com várias palavras
    // ela devolve documentos onde todas aparecem, mesmo separadas (ex. hospitais,
    // clínicas, agência/estado). Portanto a validação STF precisa aceitar esse
    // mesmo critério para não descartar tudo que o próprio STF retornou.
    match = contemTermoStf(texto, termoPrincipal, { fallbackTodasPalavras: true });
  }

  // Termos OR: se houver, basta 1 match (incluindo o principal)
  const termosOr = Array.isArray(mon.termos_or) ? mon.termos_or.filter(Boolean) : [];
  if (!match && termosOr.length > 0) {
    match = termosOr.some((t) => {
      const parsed = parsearTermoOr(t);
      return contemTermoStf(texto, parsed?.nome || t, { fallbackTodasPalavras: true });
    });
  }
  if (!match) return { ok: false, motivo: "sem_match" };

  // Exclusões
  const exclusoes = Array.isArray(mon.exclusoes) ? mon.exclusoes.filter(Boolean) : [];
  for (const e of exclusoes) {
    if (contemFrase(texto, e)) return { ok: false, motivo: `excluido: ${e}` };
  }

  // Condição concomitante (todos os termos separados por | devem aparecer)
  const cond = String(mon.condicao_concomitante || "").trim();
  if (cond) {
    const partes = cond.split("|").map((s) => s.trim()).filter(Boolean);
    for (const p of partes) {
      if (!contemTermoStf(texto, p, { fallbackTodasPalavras: true })) return { ok: false, motivo: `sem concomitante: ${p}` };
    }
  }

  return { ok: true };
}

async function publicacaoExistentePorIdDjen(sb, row) {
  if (!row.id_djen) return null;
  let q = sb
    .from("publicacoes_djen")
    .select("id")
    .eq("id_djen", row.id_djen)
    .limit(1);
  q = row.coordenacao_id ? q.eq("coordenacao_id", row.coordenacao_id) : q.is("coordenacao_id", null);
  const { data } = await q.maybeSingle();
  return data || null;
}

async function inserirPublicacaoDjen(sb, row) {
  const existing = await publicacaoExistentePorIdDjen(sb, row);
  if (existing) return { status: "duplicata", id: existing.id };
  const { data, error } = await sb.from("publicacoes_djen").insert(row).select("id").single();
  if (!error && data?.id) return { status: "nova", id: data.id };
  const msg = String(error?.message || "");
  const isConflict = error?.code === "23505" || msg.includes("duplicate key") || msg.includes("duplicate");
  if (isConflict) return { status: "duplicata", error };
  return { status: "erro", error };
}

async function processarMonitoramento({ sb, mon, dataInicio, dataFim, log, execucaoId, via }) {
  const tipo = mon.tipo === "nome" ? "advogado" : mon.tipo === "geral" ? "palavra-chave" : mon.tipo || "palavra-chave";
  const termoPrincipal = String(mon.termo_busca || "").trim();
  if (!termoPrincipal) return { novas: 0, descartadas: 0, duplicatas: 0 };

  // Termos a consultar (principal + termos_or)
  const termos = [termoPrincipal];
  if (Array.isArray(mon.termos_or)) {
    for (const t of mon.termos_or) {
      const v = String(t || "").trim();
      if (v && !termos.includes(v)) termos.push(v);
    }
  }

  const vistos = new Set();
  let novas = 0;
  let descartadas = 0;
  let duplicatas = 0;
  let falhas = 0;

  for (const termo of termos) {
    const termoApi = tipo === "processo" ? termo.replace(/\D/g, "") : sanitizeTermoStfApi(termo);
    if (!termoApi) continue;
    const params = tipo === "processo"
      ? { termo: "", processo: termoApi, dataInicio, dataFim, log, via }
      : { termo: termoApi, processo: "", dataInicio, dataFim, log, via };

    const publicacoes = await buscarTodasPaginas(params);

    for (const pub of publicacoes) {
      const stf_id = extractStfId(pub);
      const key = stf_id || `${extractProcessoNumero(pub)}|${(extractTextoLimpo(pub) || "").slice(0, 200)}`;
      if (vistos.has(key)) { duplicatas++; continue; }
      vistos.add(key);

      const validacao = passaValidacao(mon, pub);
      const processo_numero = extractProcessoNumero(pub) || null;
      const texto_limpo = extractTextoLimpo(pub);
      const stfIdRaw = stf_id ? `stf:${stf_id}` : null;
      const dataDisponibilizacao = dataDisponibilizacaoStf(pub.divulgacao, dataInicio);
      const dataPublicacao = parseDate(pub.publicacao) || `${nextBusinessDateYmd(dataDisponibilizacao)}T15:00:00.000Z`;
      const hash = hashDjenStyle(texto_limpo, dataDisponibilizacao, processo_numero, stfIdRaw) || hashConteudo(processo_numero, texto_limpo);

      if (!validacao.ok) {
        descartadas++;
        // Registra descarte para relatório (idempotente por (monitoramento_id, hash_conteudo))
        try {
          await sb.from("publicacoes_djen_descartadas").insert({
            monitoramento_id: mon.id,
            coordenacao_id: mon.coordenacao_id || null,
            hash_conteudo: hash,
            processo_numero,
            conteudo: texto_limpo.slice(0, 8000),
            fonte: "stf",
            motivo_descarte: validacao.motivo,
            data_publicacao: dataPublicacao,
          });
        } catch (_) {}
        continue;
      }

      const row = {
        monitoramento_id: mon.id,
        coordenacao_id: mon.coordenacao_id || null,
        processo_numero,
        tipo_publicacao: "intimacao",
        tribunal: "STF",
        orgao: extractRelator(pub) || null,
        tipo_comunicacao: pub.tipo || null,
        meio: "D",
        id_djen: stfIdRaw,
        data_disponibilizacao: dataDisponibilizacao,
        data_publicacao: dataPublicacao,
        conteudo: texto_limpo,
        hash_conteudo: hash,
        fonte: "stf_digital",
        lida: false,
        execucao_id: execucaoId || null,
      };
      const inserted = await inserirPublicacaoDjen(sb, row);
      if (inserted.status === "nova") {
        novas++;
      } else if (inserted.status === "duplicata") {
        duplicatas++;
      } else {
        falhas++;
        log("stf.insert_error", { monitoramento_id: mon.id, via: viaLabel(via), e: inserted.error?.message || "erro desconhecido" });
      }
    }
    if (TERM_DELAY_MS > 0) await new Promise((r) => setTimeout(r, TERM_DELAY_MS));
  }

  return { novas, descartadas, duplicatas, falhas };
}

async function run({ sb, payload, log, job }) {
  const dataInicio = (payload && payload.dataInicio) || todayBrtYmd();
  const dataFim = (payload && payload.dataFim) || dataInicio;
  const coordenacaoId = payload && payload.coordenacaoId;
  const monitoramentoIds = Array.isArray(payload && payload.monitoramentoIds) ? payload.monitoramentoIds : null;

  log("stf.start", { dataInicio, dataFim, coordenacaoId, monitoramentoIds });

  let q = sb
    .from("monitoramentos_djen")
    .select("id, tipo, termo_busca, oab, uf, coordenacao_id, exclusoes, condicao_concomitante, termos_or, busca_stf_ativa, ativo, arquivado")
    .eq("ativo", true)
    .eq("arquivado", false)
    .eq("busca_stf_ativa", true);
  if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
  if (monitoramentoIds && monitoramentoIds.length) q = q.in("id", monitoramentoIds);
  const { data: monitoramentos, error } = await q;
  if (error) throw new Error(`stf: falha lendo monitoramentos: ${error.message}`);

  const lista = monitoramentos || [];
  // O endpoint público do STF exige CSRF (cookie XSRF-TOKEN + header X-XSRF-TOKEN).
  // O proxy /proxy?url= das VPS não preserva o fluxo de cookies entre GET/POST,
  // portanto todas as VPS retornam 0 resultados. Mantemos conexão direta e
  // paralelizamos com múltiplos workers (não é serial) para distribuir a carga.
  const STF_CONCURRENCY = Math.max(1, Number(process.env.STF_CONCURRENCY || 6));
  const vias = Array.from({ length: Math.min(STF_CONCURRENCY, Math.max(1, lista.length)) }, (_, i) => ({
    id: `direct-${i + 1}`,
    label: `direto #${i + 1}`,
    url: null,
    token: null,
  }));
  const totais = { totalItens: lista.length, concluidos: 0, novas: 0, duplicatas: 0, descartadas: 0, falhas: 0, itens: [] };
  const escreverProgresso = async (patch) => {
    if (!job?.id) return;
    try {
      await sb
        .from("execucoes_servidor")
        .update({
          progresso: { ...totais, ...patch, janela: { dataInicio, dataFim }, pool_enabled: false, vps: vias.length },
          progresso_atualizado_em: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (_) {}
  };

  for (const mon of lista) {
    totais.itens.push({
      id: mon.id,
      label: `${mon.tipo}: ${mon.termo_busca}`,
      tribunal: "STF",
      tipo: mon.tipo,
      status: "pendente",
      current: 0,
      total: 1,
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
      falhas: 0,
      via: null,
    });
  }

  await escreverProgresso({});

  const fila = [...totais.itens];
  const monPorId = new Map(lista.map((m) => [m.id, m]));
  const nextItem = () => fila.shift() || null;

  const worker = async (via) => {
    log("stf.worker_start", { via: viaLabel(via) });
    while (true) {
      const item = nextItem();
      if (!item) break;
      const mon = monPorId.get(item.id);
      if (!mon) continue;
      item.status = "executando";
      item.via = { id: viaKey(via), label: viaLabel(via) };
      totais.atual = { id: mon.id, label: item.label };
      await escreverProgresso({ vias: totais.itens.filter((i) => i.status === "executando").map((i) => i.via).filter(Boolean) });

      try {
        const r = await processarMonitoramento({ sb, mon, dataInicio, dataFim, log, execucaoId: job?.id, via });
        item.status = "concluido";
        item.current = 1;
        item.novas = r.novas;
        item.descartadas = r.descartadas;
        item.duplicatas = r.duplicatas;
        item.falhas = r.falhas || 0;
        totais.novas += r.novas;
        totais.descartadas += r.descartadas;
        totais.duplicatas += r.duplicatas;
        totais.falhas += r.falhas || 0;
      } catch (e) {
        item.status = "erro";
        item.current = 1;
        item.erro = e.message;
        totais.falhas += 1;
        log("stf.mon_error", { id: mon.id, via: viaLabel(via), e: e.message });
      }
      totais.concluidos = totais.itens.filter((i) => i.status !== "executando" && i.status !== "pendente").length;
      await escreverProgresso({ vias: totais.itens.filter((i) => i.status === "executando").map((i) => i.via).filter(Boolean) });
    }
    log("stf.worker_done", { via: viaLabel(via) });
  };

  await Promise.all(vias.map((via) => worker(via)));
  totais.atual = null;
  await escreverProgresso({});

  log("stf.done", { totais });
  return {
    tipo: TIPO_ENGINE,
    dataInicio,
    dataFim,
    total: totais.totalItens,
    novas: totais.novas,
    duplicatas: totais.duplicatas,
    descartadas: totais.descartadas,
    falhas: totais.falhas,
    vps: vias.length,
  };
}

module.exports = { run };