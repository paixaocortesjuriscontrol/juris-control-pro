// Motor STF Servidor no VPS.
// Espelha DJEN Termos Servidor (paralela.js) para monitoramentos com busca_stf_ativa=true.
// STF publica apenas em digital.stf.jus.br (fora do DJEN/PJe Comunica). Fetch direto via
// https nativo com rejectUnauthorized:false (cadeia ICP-Brasil não é aceita pelo store
// padrão em alguns hosts). Endpoint é público.
const crypto = require("crypto");
const https = require("https");

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
// Fazemos um GET inicial para obter os cookies, e refazemos quando expiram (403).
let sessionCookies = null; // "k=v; k2=v2"
let sessionXsrf = null;

function parseSetCookies(headers) {
  const arr = headers["set-cookie"];
  if (!Array.isArray(arr)) return {};
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

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers: STF_HEADERS, agent: insecureAgent, timeout: REQ_TIMEOUT_MS }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("stf_csrf_timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function ensureCsrf(force = false) {
  if (!force && sessionCookies && sessionXsrf) return;
  const res = await httpGet(STF_CSRF_URL);
  if (res.status < 200 || res.status >= 300) throw new Error(`stf_csrf_http_${res.status}`);
  const jar = parseSetCookies(res.headers);
  if (jar["XSRF-TOKEN"]) sessionXsrf = jar["XSRF-TOKEN"];
  const parts = [];
  for (const [k, v] of Object.entries(jar)) parts.push(`${k}=${v}`);
  if (parts.length) sessionCookies = parts.join("; ");
  if (!sessionXsrf) throw new Error("stf_csrf_indisponivel");
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

function postStfPage({ termo, processo, pagina, dataInicio, dataFim }) {
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
  return new Promise((resolve, reject) => {
    const headers = {
      ...STF_HEADERS,
      "Content-Length": Buffer.byteLength(payload),
      "X-XSRF-TOKEN": sessionXsrf || "",
      Cookie: sessionCookies || "",
    };
    const req = https.request(
      STF_URL,
      { method: "POST", headers, agent: insecureAgent, timeout: REQ_TIMEOUT_MS },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          // Renova cookies se o servidor mandar novos (rotação de sessão)
          const jar = parseSetCookies(res.headers);
          if (jar["XSRF-TOKEN"]) sessionXsrf = jar["XSRF-TOKEN"];
          if (Object.keys(jar).length) {
            const parts = [];
            for (const [k, v] of Object.entries(jar)) parts.push(`${k}=${v}`);
            sessionCookies = parts.join("; ");
          }
          try {
            const parsed = JSON.parse(body);
            resolve({ status: res.statusCode || 0, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 0, body: null, raw: body.slice(0, 300) });
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("stf_timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function buscarTodasPaginas({ termo, processo, dataInicio, dataFim, log }) {
  const acc = [];
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    let resp;
    try {
      await ensureCsrf();
      resp = await postStfPage({ termo, processo, pagina, dataInicio, dataFim });
      // Se CSRF expirou (403) ou faltou, renova e tenta 1x
      if (resp.status === 403 || (typeof resp.raw === "string" && /CSRF/i.test(resp.raw))) {
        log("stf.csrf_renew", { status: resp.status });
        await ensureCsrf(true);
        resp = await postStfPage({ termo, processo, pagina, dataInicio, dataFim });
      }
    } catch (e) {
      log("stf.fetch_error", { termo, processo, pagina, e: e.message });
      break;
    }
    if (resp.status < 200 || resp.status >= 300) {
      log("stf.http_error", { termo, processo, pagina, status: resp.status, raw: resp.raw });
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

function parseDate(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
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
    match = contemFrase(texto, termoPrincipal);
  }

  // Termos OR: se houver, basta 1 match (incluindo o principal)
  const termosOr = Array.isArray(mon.termos_or) ? mon.termos_or.filter(Boolean) : [];
  if (!match && termosOr.length > 0) {
    match = termosOr.some((t) => contemFrase(texto, t));
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
      if (!contemFrase(texto, p)) return { ok: false, motivo: `sem concomitante: ${p}` };
    }
  }

  return { ok: true };
}

async function processarMonitoramento({ sb, mon, dataInicio, dataFim, log, execucaoId }) {
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

  for (const termo of termos) {
    const termoApi = tipo === "processo" ? termo.replace(/\D/g, "") : sanitizeTermoStfApi(termo);
    if (!termoApi) continue;
    const params = tipo === "processo"
      ? { termo: "", processo: termoApi, dataInicio, dataFim, log }
      : { termo: termoApi, processo: "", dataInicio, dataFim, log };

    const publicacoes = await buscarTodasPaginas(params);

    for (const pub of publicacoes) {
      const stf_id = extractStfId(pub);
      const key = stf_id || `${extractProcessoNumero(pub)}|${(extractTextoLimpo(pub) || "").slice(0, 200)}`;
      if (vistos.has(key)) { duplicatas++; continue; }
      vistos.add(key);

      const validacao = passaValidacao(mon, pub);
      const processo_numero = extractProcessoNumero(pub) || null;
      const texto_limpo = extractTextoLimpo(pub);
      const hash = hashConteudo(processo_numero, texto_limpo);

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
            data_publicacao: parseDate(pub.publicacao || pub.divulgacao),
          });
        } catch (_) {}
        continue;
      }

      const row = {
        monitoramento_id: mon.id,
        coordenacao_id: mon.coordenacao_id || null,
        stf_id,
        processo_numero,
        tipo: pub.tipo || null,
        relator: extractRelator(pub),
        data_divulgacao: parseDate(pub.divulgacao),
        data_publicacao: parseDate(pub.publicacao),
        texto_html: pub.texto || null,
        texto_limpo,
        hash_conteudo: hash,
        fonte: "stf_digital",
      };
      const { error } = await sb
        .from("publicacoes_stf")
        .upsert(row, { onConflict: "monitoramento_id,hash_conteudo", ignoreDuplicates: true });
      if (error) {
        log("stf.upsert_error", { monitoramento_id: mon.id, e: error.message });
        descartadas++;
      } else {
        novas++;
      }
    }
    if (TERM_DELAY_MS > 0) await new Promise((r) => setTimeout(r, TERM_DELAY_MS));
  }

  return { novas, descartadas, duplicatas };
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

  const totais = { totalItens: monitoramentos.length, concluidos: 0, novas: 0, duplicatas: 0, descartadas: 0, itens: [] };
  const escreverProgresso = async (patch) => {
    if (!job?.id) return;
    try {
      await sb
        .from("execucoes_servidor")
        .update({
          progresso: { ...totais, ...patch, janela: { dataInicio, dataFim } },
          progresso_atualizado_em: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (_) {}
  };

  await escreverProgresso({});

  for (const mon of monitoramentos) {
    const item = {
      id: mon.id,
      label: `${mon.tipo}: ${mon.termo_busca}`,
      tribunal: "STF",
      tipo: mon.tipo,
      status: "executando",
      current: 0,
      total: 1,
      novas: 0,
      descartadas: 0,
      duplicatas: 0,
    };
    totais.itens.push(item);
    totais.atual = { id: mon.id, label: item.label };
    await escreverProgresso({});

    try {
      const r = await processarMonitoramento({ sb, mon, dataInicio, dataFim, log, execucaoId: job?.id });
      item.status = "concluido";
      item.current = 1;
      item.novas = r.novas;
      item.descartadas = r.descartadas;
      item.duplicatas = r.duplicatas;
      totais.novas += r.novas;
      totais.descartadas += r.descartadas;
      totais.duplicatas += r.duplicatas;
    } catch (e) {
      item.status = "erro";
      item.erro = e.message;
      log("stf.mon_error", { id: mon.id, e: e.message });
    }
    totais.concluidos = totais.itens.filter((i) => i.status !== "executando" && i.status !== "pendente").length;
    await escreverProgresso({});
  }

  log("stf.done", { totais });
  return {
    tipo: TIPO_ENGINE,
    dataInicio,
    dataFim,
    total: totais.totalItens,
    novas: totais.novas,
    duplicatas: totais.duplicatas,
    descartadas: totais.descartadas,
  };
}

module.exports = { run };