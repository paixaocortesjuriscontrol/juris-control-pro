// DJEN Servidor: replica a lógica do "DJEN Termos Paralela" no daemon Node.
// Não chama a edge monitorar-djen; cada worker usa uma VPS do djen_proxy_pool.

const { djenFetchSlot, loadPool } = require("../proxyPool");
const { recordFalha, marcarFalhaResolvida, lerFalhasPendentes } = require("../falhasRefila");
const { randomUUID } = require("crypto");

const TIPO_ENGINE = "djen_paralela_servidor";
const ENGINE_VERSION = "2026-07-01-sublotes-8";

// Sub-lotes: quebra grupos grandes (tipo+tribunal) em pedaços de até
// CHUNK_MAX termos. Sem isso, TST parte (118 termos) ficava serial em 1 VPS
// enquanto as outras VPS ficavam ociosas. Com 8, TST parte vira mais unidades
// independentes que se distribuem no pool.
const CHUNK_MAX = Math.max(1, Number(process.env.PARALELA_CHUNK_MAX || 8));

const TODOS_CIVEIS = ["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"];
const TODOS_TRT = ["TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24"];
const TODOS_TRIBUNAIS = [...TODOS_TRT, "STF", "STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", ...TODOS_CIVEIS];
const TIPO_ORDER = ["parte", "advogado", "palavra-chave", "processo"];
const MAIN_TIPOS = ["parte", "advogado", "palavra-chave"];
// Paridade com DJEN Termos Paralela do browser (src/hooks/useDjenTermosParalelaEngine.ts CONFIG):
//   paginação default 800ms quando não informado, delay_between_terms 2500ms,
//   delay_between_termos_or 1800ms. Fallbacks extras ficam desligados por padrão.
// Cada VPS do pool tem IP próprio — rate-limit do PJE Comunica é por IP.
// Delays altos só serializavam trabalho no mesmo worker.
const PAGE_DELAY_MS = Math.max(0, Number(process.env.PARALELA_PAGE_DELAY_MS || 800));
const TERM_DELAY_MS = Math.max(0, Number(process.env.PARALELA_TERM_DELAY_MS || 400));
const TERMOS_OR_DELAY_MS = Math.max(0, Number(process.env.PARALELA_TERMOS_OR_DELAY_MS || 300));
const PARTE_OR_DELAY_MS = Math.max(0, Number(process.env.PARALELA_PARTE_OR_DELAY_MS || 600));
const CANCEL_CHECK_MS = Math.max(1000, Number(process.env.PARALELA_CANCEL_CHECK_MS || 3000));
// Regras simples (sem flags): nenhum fallback é executado.
//  - parte    → só nas partes (nomeParte na API + metadados/seção Parte(s))
//  - advogado → só nos advogados (nomeAdvogado/numeroOab na API + metadados)
//  - palavra-chave → só no conteúdo da publicação
// Cada coordenação é independente; dedup só dentro da mesma coordenação.

const delay = (ms, signal) => new Promise((resolve) => {
  if (!ms || ms <= 0 || signal?.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", done);
    resolve();
  }
  signal?.addEventListener?.("abort", done, { once: true });
});

function mapTipo(tipo) {
  if (tipo === "nome" || tipo === "geral") return "palavra-chave";
  return tipo || "palavra-chave";
}

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.map((v) => String(v || "").trim()).filter(Boolean).sort()
    : [];
}

function sameMonitoramentoFilter(a, b) {
  const aa = normalizeIdList(a);
  const bb = normalizeIdList(b);
  if (aa.length !== bb.length) return false;
  return aa.every((id, idx) => id === bb[idx]);
}

function runKeyFromPayload(payload, dataInicio, dataFim, coordenacaoId) {
  const monIds = normalizeIdList(payload?.monitoramentoIds);
  const monKey = monIds.length ? monIds.join(",") : "todos";
  return `${dataInicio || payload?.diarioYmd || ""}..${dataFim || payload?.diarioYmd || dataInicio || ""}|coord:${coordenacaoId || "todas"}|mon:${monKey}`;
}

function isSameRunWindow(exec, runKey, dataInicio, dataFim, coordenacaoId, monitoramentoIdsFiltro, currentJobId) {
  if (!exec || exec.id === currentJobId) return false;
  const p = exec.payload || {};
  const di = p.dataInicio || p.diarioYmd || null;
  const df = p.dataFim || p.diarioYmd || di;
  const coord = p.coordenacaoId || null;
  const prevRunKey = exec.progresso?.checkpoint?.runKey || runKeyFromPayload(p, di, df, coord);
  if (prevRunKey === runKey) return true;
  return di === dataInicio
    && df === dataFim
    && coord === coordenacaoId
    && sameMonitoramentoFilter(p.monitoramentoIds, monitoramentoIdsFiltro);
}

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&\/\\]/g, " ")
    .replace(/[^0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contemFrase(textoNorm, fraseNorm) {
  if (!fraseNorm) return true;
  return new RegExp(`(?:^|\\s)${escapeRegex(fraseNorm)}(?:\\s|$)`).test(textoNorm);
}

function contemFraseComAnd(textoNorm, termoRaw) {
  if (!termoRaw) return true;
  if (!termoRaw.includes("+")) return contemFrase(textoNorm, normalize(termoRaw));
  const partes = termoRaw.split("+").map((p) => p.trim()).filter(Boolean);
  return partes.every((p) => {
    if (/^OAB\s/i.test(p)) return true;
    const pn = normalize(p);
    return !pn || contemFrase(textoNorm, pn);
  });
}

function normalizeForApi(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generateHash(input) {
  let hash = 0;
  const s = String(input || "");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function generatePublicacaoHash(conteudo, dataDisponibilizacao, processoNumero, idDjen) {
  const proc = String(processoNumero || "").replace(/\D/g, "");
  const data = String(dataDisponibilizacao || "").slice(0, 10);
  const base = idDjen
    ? `id_djen:${idDjen}|${data}|${proc}`
    : `${data}|${proc}|${String(conteudo || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 800)}`;
  return generateHash(base);
}

function ymdToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function expandirDias(dataInicio, dataFim) {
  const out = [];
  if (!dataInicio) return out;
  const start = new Date(`${dataInicio}T12:00:00Z`);
  const end = new Date(`${dataFim || dataInicio}T12:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [dataInicio];
  for (const cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

function expandirTribunais(tribunais) {
  if (!Array.isArray(tribunais) || tribunais.length === 0) return TODOS_TRIBUNAIS;
  const set = new Set();
  for (const raw of tribunais) {
    const t = String(raw || "").trim();
    if (t === "TODOS_CIVEIS") TODOS_CIVEIS.forEach((x) => set.add(x));
    else if (t === "TODOS_TRT") TODOS_TRT.forEach((x) => set.add(x));
    else if (t) set.add(t);
  }
  return set.size > 0 ? TODOS_TRIBUNAIS.filter((t) => set.has(t)) : TODOS_TRIBUNAIS;
}

function termosDeParte(mon) {
  const seen = new Set();
  return [mon.termo_busca, ...(mon.termos_or || [])]
    .map((x) => String(x || "").trim())
    .filter((x) => {
      const key = normalize(x);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractItems(data) {
  const raw = data?.items ?? data?.content ?? data?.comunicacoes ?? data?.publicacoes ?? data ?? [];
  return Array.isArray(raw) ? raw : [];
}

function getTotal(data) {
  const n = data?.totalElements ?? data?.count ?? data?.total ?? data?.totalCount;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function rawObj(pub) {
  return pub?.comunicacao && typeof pub.comunicacao === "object" ? pub.comunicacao : pub;
}

// ============================================================
// Sanitização de HTML/entidades quebradas (parity c/ browser)
// Aplica-se ao conteudo e aos nomes em advogados_json / partes_json
// para impedir lixo do tipo "<a href=", "&Eacute\nU", etc.
// ============================================================
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
  if (!s || typeof s !== "string") return s || "";
  return s
    .replace(/&([a-zA-Z]+)\s*;?/g, (m, name) => (NAMED_ENTITIES[name] ?? m))
    .replace(/&#(\d+);?/g, (_m, n) => { try { return String.fromCodePoint(+n); } catch { return _m; } })
    .replace(/&#x([0-9a-fA-F]+);?/g, (_m, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _m; } });
}
function htmlToPlain(input) {
  if (input == null) return "";
  let s = String(input);
  if (!/[<&]/.test(s)) return s;
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\s*\/(p|div|tr|li|h[1-6])\s*>/gi, "\n");
  s = s.replace(/<\s*\/td\s*>\s*<\s*td[^>]*>/gi, " | ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeLooseEntities(s);
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}
function sanitizeMetadataName(value) {
  if (value == null) return "";
  let s = htmlToPlain(String(value));
  s = s.replace(/\s+/g, " ").trim();
  if (!s || s.length > 160) return "";
  if (/[<>]|&[a-zA-Z#]/.test(s)) return "";
  return s;
}
function sanitizeMetadataArray(arr) {
  if (!Array.isArray(arr)) return arr;
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const nome = sanitizeMetadataName(item.nome ?? item.nomeAdvogado ?? item.nomeParte ?? item.name);
    if (!nome) continue;
    out.push({ ...item, nome });
  }
  return out;
}

function getConteudo(pub) {
  const obj = rawObj(pub);
  const raw = String(obj?.conteudo || obj?.texto || obj?.teor || pub?.conteudo || pub?.texto || pub?.teor || pub?.descricao || "");
  return htmlToPlain(raw);
}

function getIdDjen(pub) {
  const obj = rawObj(pub);
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  // O ID oficial usado pelo browser é `id`/`id_djen` da comunicação.
  // `numeroComunicacao` é apenas número sequencial interno e gerou a dobra
  // 1847/645971040 para a mesma publicação; por isso não entra na chave.
  const candidates = [
    obj?.id_djen,
    pub?.id_djen,
    obj?.id,
    pub?.id,
    obj?.codigoComunicacao,
    pub?.codigoComunicacao,
    obj?.codigo_comunicacao,
    pub?.codigo_comunicacao,
    obj?.idComunicacao,
    pub?.idComunicacao,
    obj?.id_comunicacao,
    pub?.id_comunicacao,
  ];
  for (const raw of candidates) {
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (!value || isUuid(value)) continue;
    return value;
  }
  return null;
}

function getDataDisponibilizacao(pub, fallbackDia) {
  const obj = rawObj(pub);
  return obj?.dataDisponibilizacao || obj?.data_disponibilizacao || obj?.dataDJe || obj?.dtDisponibilizacao || pub?.dataDisponibilizacao || pub?.data_disponibilizacao || fallbackDia;
}

// Normaliza data_disponibilizacao para BRT 12:00 (= 15:00 UTC) do dia da
// publicação. Mantém parity com o Browser, que grava o próximo dia útil ao
// meio-dia. Aqui usamos o próprio dia da disponibilização (não o próximo dia
// útil) para preservar o "dia DJEN" original — `data_publicacao` (next biz
// day) já cobre a parte de prazo.
function normalizarDataDispBrt(dataLike) {
  const ymd = String(dataLike || ymdToday()).slice(0, 10);
  return `${ymd}T15:00:00.000Z`;
}

function nextBusinessDateYmd(dateLike) {
  const d = new Date(`${String(dateLike || ymdToday()).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function extractProcesso(pub, conteudo) {
  const obj = rawObj(pub);
  const explicit = obj?.numeroProcesso || obj?.processo || pub?.numeroProcesso || pub?.processo || null;
  if (explicit) return String(explicit);
  const m = String(conteudo || "").match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  return m ? m[0] : null;
}

function metadataFromRaw(pub) {
  const obj = rawObj(pub);
  const partesRaw = obj?.partes || obj?.destinatarios || null;
  const advogadosRaw = obj?.advogados || obj?.destinatarioadvogados || null;
  const partesExtraidas = partesRaw ? null : extrairPartesEstruturadas(pub);
  const advogadosExtraidos = advogadosRaw ? null : extrairAdvogadosParaPersistencia(pub);
  return {
    orgao: obj?.orgao || obj?.nomeOrgao || null,
    tipo_comunicacao: obj?.tipoComunicacao || obj?.tipo || obj?.tipo_comunicacao || null,
    meio: obj?.meio || null,
    partes_json: sanitizeMetadataArray(partesRaw || (partesExtraidas?.length ? partesExtraidas : null)),
    advogados_json: sanitizeMetadataArray(advogadosRaw || (advogadosExtraidos?.length ? advogadosExtraidos : null)),
  };
}

function parseArrayLike(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function getTextoPublicacao(pub) {
  const obj = rawObj(pub);
  return String(obj?.texto || obj?.conteudo || obj?.teor || pub?.texto || pub?.conteudo || pub?.teor || "");
}

function extrairSecaoAdvogadosTexto(pub) {
  const texto = getTextoPublicacao(pub);
  if (!texto) return "";
  const headerRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?\s*/ig;
  const stopRe = /\b(?:Parte\s*\(\s*s\s*\)|Destinat[áa]rio(?:\(a\))?|Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out = [];
  let m;
  while ((m = headerRe.exec(texto)) !== null) {
    const start = m.index + m[0].length;
    const after = texto.slice(start, start + 1800);
    const stop = after.search(stopRe);
    const section = (stop >= 0 ? after.slice(0, stop) : after).trim();
    if (section) out.push(section);
  }
  return out.join("\n");
}

function extrairSecoesPartesTexto(pub) {
  const texto = getTextoPublicacao(pub);
  if (!texto) return [];
  const headers = [
    /\bParte\s*\(\s*s\s*\)\s*:?\s*/ig,
    /\bPolo\s+ativo\s*:?\s*/ig,
    /\bPolo\s+passivo\s*:?\s*/ig,
    /\bDestinat[áa]rio(?:\(a\))?\s*:?\s*/ig,
  ];
  const stopRe = /\bAdvogados?\s*(?:\(\s*s\s*\))?\s*:?|(?:^|\n)\s*(?:Órgão|Data\s+de\s+disponibiliza|Tipo\s+de\s+comunica|Meio|Processo|Inteiro\s+teor)\s*:?|\bPolo\s+(?:ativo|passivo)\b/i;
  const out = [];
  for (const re of headers) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const start = m.index + m[0].length;
      const after = texto.slice(start, start + 1800);
      const stop = after.search(stopRe);
      const secao = (stop >= 0 ? after.slice(0, stop) : after).trim();
      if (secao) out.push(secao);
    }
  }
  return out;
}

function buildTextoCompleto(pub, conteudo) {
  const obj = rawObj(pub);
  const partes = [String(conteudo || "")];
  const advs = obj?.destinatarioadvogados || obj?.advogados || pub?.destinatarioadvogados || pub?.advogados;
  if (Array.isArray(advs)) {
    for (const entry of advs) {
      const adv = entry?.advogado || entry;
      if (adv?.nome) partes.push(String(adv.nome));
      if (adv?.numero_oab) partes.push(`OAB ${adv.uf_oab || ""} ${adv.numero_oab}`);
    }
  }
  const dest = obj?.destinatarios || pub?.destinatarios;
  if (Array.isArray(dest)) for (const d of dest) if (d?.nome) partes.push(String(d.nome));
  return partes.join("\n");
}

function extrairPartesEstruturadas(pub) {
  const obj = rawObj(pub);
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    if (!raw) return;
    const s = typeof raw === "string"
      ? raw
      : (raw?.nome || raw?.nomeParte || raw?.parte || raw?.nomeDestinatario || raw?.destinatarioNome || "");
    if (!s) return;
    for (const n of String(s).split(/\s*,\s*|\s*;\s*/).map((x) => x.trim()).filter(Boolean)) {
      const key = normalize(n);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  };
  const dest = obj?.destinatarios || pub?.destinatarios;
  for (const d of parseArrayLike(dest)) add(d);
  add(obj?.poloAtivo || obj?.polo_ativo || pub?.poloAtivo || pub?.polo_ativo);
  add(obj?.poloPassivo || obj?.polo_passivo || pub?.poloPassivo || pub?.polo_passivo);
  add(obj?.nomeDestinatario || obj?.destinatarioNome || obj?.destinatario_nome || pub?.nomeDestinatario || pub?.destinatarioNome || pub?.destinatario_nome);
  const pjson = obj?.partes || obj?.partes_json || pub?.partes || pub?.partes_json;
  for (const p of parseArrayLike(pjson)) add(p);
  for (const secao of extrairSecoesPartesTexto(pub)) {
    for (const linha of secao.split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean)) add(linha.replace(/^[-•\s]+/, "").trim());
  }
  return out;
}

function validarAdvogadoMetadados(pub, oab, nome) {
  const advs = coletarAdvogadosEstruturados(pub);
  if (advs.length === 0) return false;
  const oabDigits = oab ? String(oab).replace(/\D/g, "") : "";
  const nomeNorm = nome ? normalize(nome) : "";
  const oabFallbackAtivo = pub?.__advogadoOabFallback === true;
  for (const adv of advs) {
    if (oabFallbackAtivo && oabDigits && String(adv.oabDigits || adv.numero_oab || "").replace(/\D/g, "") === oabDigits) return true;
    if (nomeNorm && adv.nome) {
      const an = normalize(adv.nome);
      if (contemFrase(an, nomeNorm)) return true;
    }
  }
  return false;
}

function nomesAlvoAdvogado(mon) {
  const nomes = [mon?.termo_busca, ...(mon?.termos_or || []).map((t) => parsearTermoOr(t)?.nome)]
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const seen = new Set();
  return nomes.filter((n) => {
    const key = normalize(n);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nomeAdvogadoCasa(advNome, mon) {
  const advNorm = normalize(advNome);
  if (!advNorm) return false;
  return nomesAlvoAdvogado(mon).some((nome) => {
    const alvo = normalize(nome);
    if (!alvo) return false;
    return contemFrase(advNorm, alvo);
  });
}

function parseOabFromString(raw) {
  const text = normalize(raw);
  if (!text) return null;
  let m = text.match(/OAB\s+([A-Z]{2})\s*(\d{3,7})/i);
  if (m) return { uf: m[1].toUpperCase(), oabDigits: m[2] };
  m = text.match(/OAB\s+(\d{3,7})\s*([A-Z]{2})/i);
  if (m) return { uf: m[2].toUpperCase(), oabDigits: m[1] };
  m = text.match(/\b([A-Z]{2})\s*(\d{3,7})\b/i);
  if (m) return { uf: m[1].toUpperCase(), oabDigits: m[2] };
  return null;
}

function coletarAdvogadosEstruturados(pub) {
  const obj = rawObj(pub);
  const out = [];
  const seen = new Set();
  const add = (entry) => {
    if (!entry) return;
    let item = entry;
    if (typeof entry === "string") {
      const parsed = parseOabFromString(entry);
      item = { nome: entry.replace(/\s*-?\s*OAB\b.*$/i, "").trim(), ...(parsed || {}) };
    } else {
      const adv = entry?.advogado || entry;
      if (!adv || typeof adv !== "object") return;
      item = {
        nome: adv.nome || adv.nomeAdvogado || adv.nome_representante || adv.nomeRepresentante || adv.nomeProcurador || "",
        oabDigits: String(adv.numero_oab || adv.numeroOab || adv.oab || adv.inscricaoOab || "").replace(/\D/g, ""),
        uf: String(adv.uf_oab || adv.ufOab || adv.uf || adv.siglaUf || "").trim().toUpperCase(),
      };
    }
    const nome = String(item.nome || "").trim();
    if (!nome) return;
    const key = normalize(`${nome}|${item.uf || item.uf_oab || ""}|${item.oabDigits || item.numero_oab || ""}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  for (const root of [pub, obj]) {
    for (const arr of [root?.destinatarioadvogados, root?.advogados, root?.representantes, root?.procuradores, root?.advogados_json]) {
      for (const entry of parseArrayLike(arr)) add(entry);
    }
  }
  const dest = obj?.destinatarios || pub?.destinatarios;
  if (Array.isArray(dest)) {
    for (const d of dest) {
      for (const entry of parseArrayLike(d?.advogados)) add(entry);
      for (const entry of parseArrayLike(d?.representantes)) add(entry);
      for (const entry of parseArrayLike(d?.procuradores)) add(entry);
      if (d?.nomeAdvogado) add({ nome: d.nomeAdvogado, numeroOab: d.numeroOab, ufOab: d.ufOab });
    }
  }
  return out;
}

function validarAdvogadoSecaoAdvogados(pub, oab, nome) {
  const secaoNorm = normalize(extrairSecaoAdvogadosTexto(pub));
  if (!secaoNorm) return false;
  const nomeNorm = nome ? normalize(nome) : "";
  if (nomeNorm && contemFrase(secaoNorm, nomeNorm)) return true;
  if (pub?.__advogadoOabFallback && oab) {
    const oabDigits = String(oab || "").replace(/\D/g, "");
    if (oabDigits.length >= 3 && secaoNorm.includes(oabDigits)) return true;
  }
  return false;
}

function extrairAdvogadosParaPersistencia(pub) {
  const out = [];
  const seen = new Set();
  const add = (nome, oabDigits, uf) => {
    const nomeTrim = String(nome || "").trim();
    if (!nomeTrim) return;
    const od = String(oabDigits || "").replace(/\D/g, "");
    const u = String(uf || "").trim().toUpperCase();
    const key = normalize(`${nomeTrim}|${u}|${od}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(od ? `${nomeTrim} - OAB ${u}${od}` : nomeTrim);
  };
  for (const adv of coletarAdvogadosEstruturados(pub)) {
    add(adv.nome, adv.oabDigits || adv.numero_oab, adv.uf || adv.uf_oab);
  }
  const secao = extrairSecaoAdvogadosTexto(pub);
  if (secao) {
    for (const linha of secao.split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean)) {
      const cleaned = linha.replace(/^[-•\s]+/, "").trim();
      if (cleaned.length >= 3) add(cleaned);
    }
  }
  return out;
}

function mesclarItensPorId(destino, extras, mark = {}) {
  const seen = new Set((destino || []).map((it) => {
    const id = getIdDjen(it);
    return id ? `id_djen:${id}` : JSON.stringify(it).slice(0, 400);
  }));
  let added = 0;
  for (const it of extras || []) {
    const id = getIdDjen(it);
    const key = id ? `id_djen:${id}` : JSON.stringify(it).slice(0, 400);
    if (seen.has(key)) continue;
    seen.add(key);
    Object.assign(it, mark);
    destino.push(it);
    added++;
  }
  return added;
}

async function registrarDescartadaServidor(sb, pub, mon, tribunal, dia, motivo, execucaoId, logDebug) {
  if (process.env.DJEN_SERVIDOR_PERSIST_DESCARTADAS !== "true") return;
  const conteudo = getConteudo(pub);
  const idDjen = getIdDjen(pub);
  const dataDisponibilizacao = normalizarDataDispBrt(getDataDisponibilizacao(pub, dia));
  const processoNumero = extractProcesso(pub, conteudo);
  const hashConteudo = generatePublicacaoHash(`${conteudo}|DESCARTADA:${motivo}`, dataDisponibilizacao, processoNumero, idDjen);
  const metadata = metadataFromRaw(pub);
  const row = {
    monitoramento_id: mon.id,
    coordenacao_id: mon.coordenacao_id || null,
    hash_conteudo: hashConteudo,
    id_djen: idDjen ? `desc:${mon.id}:${idDjen}` : null,
    conteudo,
    data_publicacao: nextBusinessDateYmd(dataDisponibilizacao),
    data_disponibilizacao: dataDisponibilizacao,
    processo_numero: processoNumero,
    tribunal,
    ...metadata,
    origem: "servidor",
    fonte: metadata.fonte || "DJEN-PARALELA-DESCARTADA",
    tipo_publicacao: "descartada",
    execucao_id: execucaoId || null,
  };
  const { error } = await sb.from("publicacoes_djen_servidor").upsert(row, {
    onConflict: "coordenacao_id,id_djen",
    ignoreDuplicates: true,
  });
  if (error) logDebug?.("paralela.descartada_persist_error", { monitoramentoId: mon.id, tribunal, dia, motivo, idDjen, error: error.message });
}

function validarParteMetadados(pub, nomeParte) {
  const nomeNorm = normalize(nomeParte);
  if (!nomeNorm) return false;
  for (const p of extrairPartesEstruturadas(pub)) {
    const cn = normalize(p);
    if (cn && contemFrase(cn, nomeNorm)) return true;
  }
  return false;
}

function validarParteSecaoPartes(pub, nomeParte) {
  const nomeNorm = normalize(nomeParte);
  if (!nomeNorm) return false;
  return extrairSecoesPartesTexto(pub).some((secao) => {
    const secaoNorm = normalize(secao);
    return secaoNorm.length >= 3 && contemFrase(secaoNorm, nomeNorm);
  });
}

async function buscarPublicacoesJaEncontradasEmOutraCoordenacao(sb, mon, dia, tribunal, log) {
  if (!mon?.coordenacao_id) return [];
  const tipo = mapTipo(mon.tipo);
  if (!MAIN_TIPOS.includes(tipo)) return [];
  // RESGATE ISOLADO (v3): o DJEN Servidor é uma estrutura separada e NÃO pode
  // ler de `publicacoes_djen` (Browser). Aqui só reaproveitamos entre
  // coordenações DO PRÓPRIO Servidor, lendo apenas `publicacoes_djen_servidor`.
  const termosBuscaParte = tipo === "parte" ? termosDeParte(mon) : [];
  const resgatadas = new Map();
  const BATCH = 1000;
  const cols = "id, id_djen, hash_conteudo, processo_numero, conteudo, data_disponibilizacao, data_publicacao, tribunal, fonte, orgao, tipo_comunicacao, meio, advogados_json, partes_json, coordenacao_id";
  const collect = async (table) => {
    let from = 0;
    while (true) {
      let q = sb
        .from(table)
        .select(cols)
        .eq("tribunal", tribunal)
        .gte("data_disponibilizacao", `${dia}T00:00:00.000Z`)
        .lte("data_disponibilizacao", `${dia}T23:59:59.999Z`)
        .neq("coordenacao_id", mon.coordenacao_id)
        .range(from, from + BATCH - 1);
      const { data, error } = await q;
      if (error) {
        log?.("paralela.resgate_query_error", { table, monitoramentoId: mon.id, tribunal, dia, error: error.message });
        return;
      }
      const rows = data || [];
      for (const row of rows) {
        const candidato = {
          ...row,
          id: row.id_djen || row.id,
          texto: row.conteudo,
          dataDisponibilizacao: row.data_disponibilizacao,
          dataPublicacao: row.data_publicacao,
          siglaTribunal: row.tribunal,
          numeroProcesso: row.processo_numero,
          destinatarioadvogados: row.advogados_json,
          advogados: row.advogados_json,
          destinatarios: row.partes_json,
          partes: row.partes_json,
        };
        const conteudoCand = getConteudo(candidato);
        let casa = false;
        if (tipo === "parte") {
          casa = termosBuscaParte.some((t) => validarParteMetadados(candidato, t) || validarParteSecaoPartes(candidato, t));
        } else {
          casa = contemTermo(conteudoCand, { ...mon, tipo }, candidato);
        }
        if (!casa) continue;
        if (shouldExclude(conteudoCand, { ...mon, tipo }, candidato)) continue;
        if (!condicaoConcomitanteAtendida(candidato, { ...mon, tipo }, conteudoCand)) continue;
        const key = row.id_djen ? `id_djen:${row.id_djen}` : `row:${table}:${row.id}`;
        if (resgatadas.has(key)) continue;
        resgatadas.set(key, {
          ...candidato,
          ...(tipo === "parte" ? { __matchedByNomeParte: true } : {}),
          __resgatadaDeOutraCoordenacao: row.coordenacao_id,
          __resgatadaDeFonte: table,
        });
      }
      if (rows.length < BATCH) break;
      from += BATCH;
      if (from > 10000) break; // sanity
    }
  };
  await collect("publicacoes_djen_servidor");
  return Array.from(resgatadas.values());
}

// Parse termos_or no formato "12345/NOME" ou "NOME/12345" ou "TJSP - Adv. NOME"
function parsearTermoOr(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{3,6})\s*\/\s*(.+)$/);
  if (m) return { oabDigits: m[1], nome: m[2].trim() };
  m = t.match(/^(.+?)\s*\/\s*(\d{3,6})$/);
  if (m) return { oabDigits: m[2], nome: m[1].trim() };
  let clean = t
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, "")
    .replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, "")
    .replace(/^Adv\.?\s*/i, "")
    .trim();
  return clean ? { nome: clean } : null;
}

function termoParteParaBusca(raw) {
  const parsed = parsearTermoOr(raw);
  return String(parsed?.nome || raw || "").trim();
}

function contemTermo(conteudo, mon, pub) {
  // Regras simples, sem fallback (alinhadas com o DJEN Browser homologado):
  // - 'parte'         → casa SOMENTE em metadados estruturados ou na seção
  //                     Parte(s) da publicação. Nunca olha o corpo do texto.
  // - 'advogado'      → casa SOMENTE nos metadados de advogados (nome OU OAB).
  //                     Nunca olha o corpo do texto.
  // - 'palavra-chave' → casa SOMENTE no conteúdo da publicação (corpo puro,
  //                     sem concatenar advogados/destinatários).
  // - 'processo'      → casa por número de processo (somente dígitos).
  const tipo = mapTipo(mon.tipo);
  // Busca Geral: aceita match em qualquer campo (partes, advogados, conteúdo,
  // nº de processo). Identificada pelo tipo original do monitoramento.
  if (mon.tipo === "geral") {
    const termos = [mon.termo_busca, ...((mon.termos_or) || [])]
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    const textoNorm = normalize(buildTextoCompleto(pub, conteudo));
    const pn = String(
      pub?.numeroProcesso || pub?.numero_processo || pub?.processo_numero || pub?.processo || "",
    ).replace(/\D/g, "");
    for (const t of termos) {
      const tn = normalize(t);
      if (!tn) continue;
      if (contemFrase(textoNorm, tn)) return true;
      if (validarParteMetadados(pub, t)) return true;
      if (validarParteSecaoPartes(pub, t)) return true;
      if (validarAdvogadoMetadados(pub, undefined, t)) return true;
      if (validarAdvogadoSecaoAdvogados(pub, undefined, t)) return true;
      const td = t.replace(/\D/g, "");
      if (td && pn && pn.includes(td)) return true;
    }
    return false;
  }
  if (tipo === "parte") {
    if (validarParteMetadados(pub, mon.termo_busca)) return true;
    if (validarParteSecaoPartes(pub, mon.termo_busca)) return true;
    for (const t of mon.termos_or || []) {
      if (validarParteMetadados(pub, String(t))) return true;
      if (validarParteSecaoPartes(pub, String(t))) return true;
    }
    // Nunca confiar apenas no filtro `nomeParte` da API: parte valida só parte.
    return false;
  }
  if (tipo === "advogado") {
    if (validarAdvogadoMetadados(pub, mon.oab, mon.termo_busca)) return true;
    if (validarAdvogadoSecaoAdvogados(pub, mon.oab, mon.termo_busca)) return true;
    for (const t of mon.termos_or || []) {
      const p = parsearTermoOr(t);
      if (!p) continue;
      if (validarAdvogadoMetadados(pub, p.oabDigits, p.nome)) return true;
      if (validarAdvogadoSecaoAdvogados(pub, p.oabDigits, p.nome)) return true;
    }
    return false;
  }
  if (tipo === "processo") {
    const nd = String(mon.termo_busca || "").replace(/\D/g, "");
    const pn = String(pub?.numeroProcesso || pub?.numero_processo || pub?.processo_numero || pub?.processo || "").replace(/\D/g, "");
    return pn.includes(nd);
  }
  // palavra-chave / nome — texto completo (corpo + advogados + destinatários
  // + partes), espelhando o Browser (useDjenTermosParalelaEngine.ts).
  const textoNorm = normalize(buildTextoCompleto(pub, conteudo));
  if (contemFraseComAnd(textoNorm, mon.termo_busca)) return true;
  for (const t of mon.termos_or || []) {
    const p = parsearTermoOr(t);
    if (!p) continue;
    if (contemFraseComAnd(textoNorm, p.nome)) return true;
  }
  return false;
}

function condicaoConcomitanteAtendida(pub, mon, conteudo) {
  const cond = mon?.condicao_concomitante;
  if (!cond) return true;
  const grupos = String(cond).split("|").map((g) => g.trim()).filter(Boolean);
  if (grupos.length === 0) return true;
  const tipo = mapTipo(mon?.tipo);
  const textoNorm = mon.tipo === "parte"
    ? normalize([...extrairPartesEstruturadas(pub), ...extrairSecoesPartesTexto(pub)].join("\n"))
    : normalize(buildTextoCompleto(pub, conteudo));
  if (!textoNorm) return tipo !== "parte";
  return grupos.some((g) => {
    const ts = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every((t) => contemFrase(textoNorm, normalize(t)));
  });
}

function shouldExclude(conteudo, mon, pub) {
  const excs = Array.isArray(mon.exclusoes) ? mon.exclusoes : [];
  if (excs.length === 0) return false;
  const tipo = mapTipo(mon?.tipo);
  const text = tipo === "parte"
    ? normalize([...extrairPartesEstruturadas(pub), ...extrairSecoesPartesTexto(pub)].join("\n"))
    : normalize(buildTextoCompleto(pub, conteudo));
  if (!text) return false;
  return excs.some((e) => {
    const n = normalize(e);
    return n && text.includes(n);
  });
}

async function buscarPaginado(slot, params, signal) {
  const all = [];
  const seen = new Set();
  // Para tolerar instabilidade da API PJE Comunica (páginas vazias / só
  // duplicados / erros HTTP intermitentes no meio do stream), só encerramos
  // depois de N ocorrências CONSECUTIVAS. Qualquer página com item novo
  // zera os contadores. Espelha src/utils/pjeComunicaClient.ts.
  const EMPTY_PAGE_STREAK_LIMIT = 2;
  const NO_NEW_ITEMS_STREAK_LIMIT = 3;
  const CONSECUTIVE_FAILED_PAGES_LIMIT = 3;
  let emptyStreak = 0;
  let noNewStreak = 0;
  let failedStreak = 0;
  for (let page = 1; page < 1000; page++) {
    if (signal?.aborted) throw new Error("cancelado");
    const query = {
      ...params,
      pagina: String(page),
      page: String(page),
      tamanhoPagina: "50",
      size: "50",
      itensPorPagina: "50",
    };
    let out;
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      out = await djenFetchSlot(slot, query, signal).catch((e) => {
        lastErr = e;
        return null;
      });
      if (out && out.status !== 429 && out.status < 500) break;
      await delay(out?.status === 429 ? 8000 * (attempt + 1) : 3000 * (attempt + 1), signal);
    }
    if (!out || out.status === 404 || out.status < 200 || out.status >= 300) {
      // Falha de página isolada não deve abortar toda a busca: a API PJE
      // Comunica frequentemente erra páginas no meio e volta a responder.
      failedStreak += 1;
      if (failedStreak >= CONSECUTIVE_FAILED_PAGES_LIMIT) {
        if (!out) throw lastErr || new Error("Falha ao consultar VPS DJEN");
        if (out.status === 404) break;
        throw new Error(`HTTP ${out.status}`);
      }
      if (PAGE_DELAY_MS > 0) await delay(PAGE_DELAY_MS, signal);
      continue;
    }
    failedStreak = 0;
    const data = typeof out.body === "string" ? JSON.parse(out.body) : out.body;
    const items = extractItems(data);
    let added = 0;
    for (const item of items) {
      const id = getIdDjen(item);
      const key = id ? `id:${id}` : JSON.stringify(item).slice(0, 400);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(item);
      added++;
    }
    // Encerramento por streaks (tolera vazio/duplicado intermitente).
    // NÃO usamos totalElements/count para parar — a API mente.
    if (items.length === 0) {
      emptyStreak += 1;
      if (emptyStreak >= EMPTY_PAGE_STREAK_LIMIT) break;
    } else if (added === 0) {
      emptyStreak = 0;
      noNewStreak += 1;
      if (noNewStreak >= NO_NEW_ITEMS_STREAK_LIMIT) break;
    } else {
      emptyStreak = 0;
      noNewStreak = 0;
    }
    if (PAGE_DELAY_MS > 0) await delay(PAGE_DELAY_MS, signal);
  }
  return all;
}

function baseParams(mon, dia, tribunal) {
  const tipo = mapTipo(mon.tipo);
  const params = {
    siglaTribunal: tribunal,
    dataDisponibilizacaoInicio: dia,
    dataDisponibilizacaoFim: dia,
  };
  if (tipo === "advogado") {
    // Regra nova: primária SOMENTE por nomeAdvogado. OAB vira fallback feito
    // em buscarTermo quando a primária retornar 0 (uma única chamada extra).
    if (mon.termo_busca) {
      params.nomeAdvogado = normalizeForApi(mon.termo_busca);
    } else {
      const oab = String(mon.oab || "").replace(/\D/g, "");
      const uf = String(mon.uf || "").trim().toUpperCase();
      const ufValida = uf && !uf.includes(",") && uf !== "TODAS" && uf !== "UNDEFINED";
      if (oab && ufValida) {
        params.numeroOab = oab;
        params.ufOab = uf;
      }
    }
  } else if (tipo === "processo") {
    params.numeroProcesso = String(mon.termo_busca || "").replace(/\D/g, "");
  } else if (tipo !== "parte") {
    const termo = String(mon.termo_busca || "");
    params.texto = normalizeForApi(termo.includes("+") ? termo.split("+").map((p) => p.trim()).filter((p) => !/^OAB\s/i.test(p)).sort((a, b) => b.length - a.length)[0] || termo : termo);
  }
  return params;
}

async function buscarTermo(slot, mon, dia, tribunal, signal) {
  const tipo = mapTipo(mon.tipo);
  if (tipo === "parte") {
    const results = [];
    for (const nomeParte of termosDeParte(mon)) {
      if (signal?.aborted) throw new Error("cancelado");
      const termoBusca = termoParteParaBusca(nomeParte);
      const params = { ...baseParams(mon, dia, tribunal), nomeParte: termoBusca };
      // Sem 2ª passada em resultado vazio: buscarPaginado já tolera
      // instabilidade internamente (retries por página + streaks). Vazio aqui
      // é ausência real.
      const items = await buscarPaginado(slot, params, signal);
      for (const it of items) it.__matchedByNomeParte = true;
      results.push(...items);
      if (PARTE_OR_DELAY_MS > 0) await delay(PARTE_OR_DELAY_MS, signal);
    }
    return results;
  }
  const params = baseParams(mon, dia, tribunal);
  // Sem 2ª passada em resultado vazio (buscarPaginado já cobre instabilidade
  // via retries por página). Se vier 0, o fallback por OAB abaixo trata o
  // caso de advogado com OAB+UF específica.
  let items = await buscarPaginado(slot, params, signal);
  // Regra nova: fallback OAB. Se a busca primária por nomeAdvogado veio vazia
  // E temos OAB + UF específica, fazemos UMA segunda chamada por OAB+UF e
  // marcamos cada item com __advogadoOabFallback para que a validação posterior
  // aceite o match por número de OAB (que, fora do fallback, é ignorado).
  const tentarFallbackOab = async (nomeRaw, oabRaw, ufRaw, prevItems) => {
    if (signal?.aborted) return prevItems;
    if (prevItems.length > 0) return prevItems;
    const oab = String(oabRaw || "").replace(/\D/g, "");
    const uf = String(ufRaw || "").trim().toUpperCase();
    if (!oab || oab.length < 3) return prevItems;
    if (!uf || uf === "TODAS" || !/^[A-Z]{2}$/.test(uf)) return prevItems;
    const paramsFallback = {
      siglaTribunal: tribunal,
      dataDisponibilizacaoInicio: dia,
      dataDisponibilizacaoFim: dia,
      numeroOab: oab,
      ufOab: uf,
    };
    await delay(800, signal);
    if (signal?.aborted) return prevItems;
    try {
      const fallbackItems = await buscarPaginado(slot, paramsFallback, signal);
      for (const it of fallbackItems) it.__advogadoOabFallback = true;
      return fallbackItems;
    } catch (_) {
      return prevItems;
    }
  };
  if (!signal?.aborted && tipo === "advogado") {
    items = await tentarFallbackOab(mon.termo_busca, mon.oab, mon.uf, items);
    // Iterar termos_or como buscas separadas (nome primário, OAB fallback).
    if (Array.isArray(mon.termos_or) && mon.termos_or.length > 0) {
      for (const termoOr of mon.termos_or) {
        if (signal?.aborted) break;
        const parsed = parsearTermoOr(String(termoOr));
        if (!parsed?.nome) continue;
        if (normalize(parsed.nome) === normalize(mon.termo_busca || "")) continue;
        const paramsOr = {
          siglaTribunal: tribunal,
          dataDisponibilizacaoInicio: dia,
          dataDisponibilizacaoFim: dia,
          nomeAdvogado: normalizeForApi(parsed.nome),
        };
        if (TERMOS_OR_DELAY_MS > 0) await delay(TERMOS_OR_DELAY_MS, signal);
        if (signal?.aborted) break;
        try {
          let orItems = await buscarPaginado(slot, paramsOr, signal);
          orItems = await tentarFallbackOab(parsed.nome, parsed.oabDigits, mon.uf, orItems);
          mesclarItensPorId(items, orItems, { __termoOrAdvogado: String(termoOr) });
        } catch (_) {
          // best-effort
        }
      }
    }
  }
  return items;
}

async function persistPublicacoes(sb, pubs, mon, tribunal, dia, execucaoId) {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  // Regra simples: monitoramento SEM coordenação não persiste, para evitar
  // que uma publicação caia em "ninguém" e seja contabilizada como duplicata
  // (ou pior, atravesse coordenações em queries futuras). O usuário deve
  // associar o monitoramento a uma coordenação.
  if (!mon?.coordenacao_id) {
    const logSemCoord = typeof mon?.__log === "function" ? mon.__log : null;
    logSemCoord?.("paralela.sem_coordenacao", { monitoramentoId: mon?.id || null, tribunal, dia, total: pubs?.length || 0 });
    stats.descartadas = pubs?.length || 0;
    return stats;
  }
  const tribunaisMon = Array.isArray(mon.tribunais) ? expandirTribunais(mon.tribunais) : [];
  const logDebug = typeof mon.__log === "function" ? mon.__log : null;
  const seenRunKeys = new Set();
  const coordenacaoIdMon = mon.coordenacao_id || null;
  const existingByIdDjen = new Map();
  const execLinks = [];
  if (coordenacaoIdMon) {
    const idsDjen = Array.from(new Set((pubs || []).map((pub) => getIdDjen(pub)).filter(Boolean)));
    for (let i = 0; i < idsDjen.length; i += 500) {
      const chunk = idsDjen.slice(i, i + 500);
      const { data: existentes } = await sb
        .from("publicacoes_djen_servidor")
        .select("id, id_djen")
        .eq("coordenacao_id", coordenacaoIdMon)
        .in("id_djen", chunk);
      for (const row of existentes || []) {
        if (row?.id_djen && row?.id) existingByIdDjen.set(String(row.id_djen), row.id);
      }
    }
  }
  for (const pub of pubs) {
    const conteudo = getConteudo(pub);
    const metadata = metadataFromRaw(pub);
    const idDjen = getIdDjen(pub);
    const dataDisponibilizacao = normalizarDataDispBrt(getDataDisponibilizacao(pub, dia));
    const processoNumero = extractProcesso(pub, conteudo);
    const hashConteudo = generatePublicacaoHash(conteudo, dataDisponibilizacao, processoNumero, idDjen);
    const coordenacaoId = coordenacaoIdMon;
    const runKey = idDjen ? `id_djen:${idDjen}` : `row:${Math.random().toString(36).slice(2)}:${hashConteudo}`;
    if (seenRunKeys.has(runKey)) {
      stats.duplicatas++;
      logDebug?.("paralela.dedup_runtime", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo });
      continue;
    }
    seenRunKeys.add(runKey);
    // Filtro por tribunais permitidos no monitoramento (espelha browser)
    if (tribunaisMon.length > 0 && !tribunaisMon.includes(tribunal)) {
      stats.descartadas++;
      await registrarDescartadaServidor(sb, pub, mon, tribunal, dia, "tribunal_nao_permitido", execucaoId, logDebug);
      logDebug?.("paralela.descartada_tribunal", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo });
      continue;
    }
    if (
      !conteudo ||
      shouldExclude(conteudo, mon, pub) ||
      !contemTermo(conteudo, mon, pub) ||
      !condicaoConcomitanteAtendida(pub, mon, conteudo)
    ) {
      stats.descartadas++;
      const motivo = !conteudo
        ? "conteudo_vazio"
        : shouldExclude(conteudo, mon, pub)
          ? "excluido"
          : !contemTermo(conteudo, mon, pub)
            ? "termo_nao_encontrado"
            : "condicao_concomitante";
      await registrarDescartadaServidor(sb, pub, mon, tribunal, dia, motivo, execucaoId, logDebug);
      logDebug?.("paralela.descartada_filtro", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, temConteudo: !!conteudo, termo: mon.termo_busca, tipo: mon.tipo });
      continue;
    }
    // Regra única de duplicidade do DJEN Servidor:
    // dentro da MESMA coordenação, o mesmo id_djen só pode existir uma vez.
    // Sem id_djen ou sem coordenação, sempre inserimos (o banco não tem como
    // afirmar duplicidade) — duplicatas residuais ficam por conta da unique
    // index parcial (coordenacao_id, id_djen) WHERE id_djen IS NOT NULL.
    let exists = null;
    let existsReason = null;
    if (idDjen && coordenacaoId) {
      const existingId = existingByIdDjen.get(String(idDjen));
      exists = existingId ? { id: existingId } : null;
      if (exists) existsReason = "same_coordenacao_id_djen";
    }
    if (exists) {
      stats.duplicatas++;
      logDebug?.("paralela.duplicata_existente", { reason: existsReason, monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, existing: exists });
      if (execucaoId) {
        execLinks.push({ publicacao_id: exists.id, execucao_id: execucaoId, tipo_engine: "paralela" });
      }
      continue;
    }
    const newId = randomUUID();
    const insertRow = {
      id: newId,
      monitoramento_id: mon.id,
      coordenacao_id: coordenacaoId,
      hash_conteudo: hashConteudo,
      id_djen: idDjen,
      conteudo,
      data_publicacao: nextBusinessDateYmd(dataDisponibilizacao),
      data_disponibilizacao: dataDisponibilizacao,
      processo_numero: processoNumero,
      tribunal,
      ...metadata,
      origem: "servidor",
      execucao_id: execucaoId || null,
    };
    // Não usar upsert aqui: a unicidade oficial é um índice parcial
    // (coordenacao_id, id_djen) WHERE id_djen/coordenacao_id IS NOT NULL.
    // PostgREST não consegue inferir índice parcial via `onConflict`, então o
    // upsert falha e a publicação válida acabava contabilizada como descartada.
    // Como já consultamos a duplicidade acima, o caminho correto é INSERT e,
    // se houver corrida, tratar 23505 como duplicata logo abaixo.
    const insertQuery = sb.from("publicacoes_djen_servidor").insert(insertRow);
    const { error } = await insertQuery;
    if (error) {
      const msg = String(error.message || "");
      const isConflict = error.code === "23505" || msg.includes("duplicate key");
      if (isConflict) {
        let conflictQuery = sb.from("publicacoes_djen_servidor").select("id, monitoramento_id, coordenacao_id, id_djen, hash_conteudo, tribunal, data_disponibilizacao");
        conflictQuery = idDjen && coordenacaoId
          ? conflictQuery.eq("coordenacao_id", coordenacaoId).eq("id_djen", idDjen)
          : conflictQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        const { data: conflictRows } = await conflictQuery.limit(5);
        if (conflictRows && conflictRows.length > 0) {
          stats.duplicatas++;
          if (idDjen && conflictRows[0]?.id) existingByIdDjen.set(String(idDjen), conflictRows[0].id);
          if (execucaoId && conflictRows[0]?.id) {
            execLinks.push({ publicacao_id: conflictRows[0].id, execucao_id: execucaoId, tipo_engine: "paralela" });
          }
          logDebug?.("paralela.duplicata_constraint_confirmada", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, constraint: error.details || msg, conflictRows });
        } else {
          stats.descartadas++;
          logDebug?.("paralela.insert_conflict_sem_linha_visivel", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, code: error.code, message: msg, details: error.details });
        }
      } else {
        stats.descartadas++;
        logDebug?.("paralela.insert_error", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, code: error.code, message: msg, details: error.details });
      }
    } else {
      stats.novas++;
      if (idDjen && coordenacaoId) existingByIdDjen.set(String(idDjen), newId);
      logDebug?.("paralela.nova_inserida", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, publicacaoId: newId });
      if (execucaoId) {
        execLinks.push({ publicacao_id: newId, execucao_id: execucaoId, tipo_engine: "paralela" });
      }
    }
  }
  for (let i = 0; i < execLinks.length; i += 500) {
    await sb.from("publicacoes_djen_servidor_execucoes").upsert(
      execLinks.slice(i, i + 500),
      { onConflict: "publicacao_id,execucao_id", ignoreDuplicates: true }
    );
  }
  return stats;
}

async function persistirResgatesOutraCoordenacao(sb, mon, tribunal, dia, execucaoId, log) {
  const resgatadas = await buscarPublicacoesJaEncontradasEmOutraCoordenacao(sb, mon, dia, tribunal, log);
  if (resgatadas.length === 0) return { novas: 0, descartadas: 0, duplicatas: 0, resgatadas: 0 };
  const stats = await persistPublicacoes(sb, resgatadas, { ...mon, __log: log }, tribunal, dia, execucaoId);
  log?.("paralela.resgate_outra_coord", {
    execucaoId: execucaoId || null,
    monitoramentoId: mon.id,
    coordenacaoId: mon.coordenacao_id || null,
    tipo: mapTipo(mon.tipo),
    tribunal,
    dia,
    resgatadas: resgatadas.length,
    ...stats,
  });
  return { ...stats, resgatadas: resgatadas.length };
}

async function run({ sb, payload, log, job }) {
  const dataInicio = payload?.dataInicio || payload?.diarioYmd || ymdToday();
  const dataFim = payload?.dataFim || payload?.diarioYmd || dataInicio;
  const coordenacaoId = payload?.coordenacaoId || null;
  const monitoramentoIdsFiltro = Array.isArray(payload?.monitoramentoIds) && payload.monitoramentoIds.length > 0 ? payload.monitoramentoIds : null;
  const dias = expandirDias(dataInicio, dataFim);
  const runKey = runKeyFromPayload(payload, dataInicio, dataFim, coordenacaoId);

  log("paralela.start", {
    engineVersion: ENGINE_VERSION,
    dataInicio,
    dataFim,
    dias: dias.length,
    coordenacaoId,
    monitoramentoIdsFiltro,
    regras: [
      "1) coordenacoes independentes; dedup so dentro da mesma coordenacao",
      "2) parte → somente nas partes (nomeParte + metadados); sem fallback",
      "3) advogado → somente nos advogados (nome/OAB nos metadados); sem fallback",
      "4) palavra-chave → somente no conteudo da publicacao",
    ],
  });

  // Excluir sentinela "__CAPTURA_TOTAL_KURIER__": marcador interno do Kurier,
  // não é uma busca real.
  let q = sb
    .from("monitoramentos_djen")
    .select("id, descricao, termo_busca, termos_or, tipo, oab, uf, coordenacao_id, tribunais, exclusoes, condicao_concomitante")
    .eq("ativo", true)
    .neq("termo_busca", "__CAPTURA_TOTAL_KURIER__");
  if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
  if (monitoramentoIdsFiltro) q = q.in("id", monitoramentoIdsFiltro);
  const { data: monitoramentos, error: monErr } = await q;
  if (monErr) throw new Error(`Falha ao listar monitoramentos: ${monErr.message}`);
  const lista = monitoramentos || [];

  const monsPorId = new Map(lista.map((m) => [m.id, m]));
  const grouped = new Map();
  for (const m of lista) {
    const tipo = mapTipo(m.tipo);
    for (const tribunal of expandirTribunais(m.tribunais)) {
      const key = `${tipo}|${tribunal}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(m);
    }
  }

  // Sub-lotes: cada (tipo, tribunal) vira 1..N unidades de até CHUNK_MAX
  // termos, para que várias VPS ataquem o mesmo tribunal pesado em paralelo.
  const grupos = [];
  for (const [baseKey, mons] of grouped.entries()) {
    const [tipo, tribunal] = baseKey.split("|");
    if (mons.length <= CHUNK_MAX) {
      grupos.push({ id: baseKey, tipo, tribunal, monitoramentos: mons });
    } else {
      for (let i = 0; i < mons.length; i += CHUNK_MAX) {
        const slice = mons.slice(i, i + CHUNK_MAX);
        const chunkIdx = Math.floor(i / CHUNK_MAX);
        grupos.push({
          id: `${baseKey}|c${chunkIdx}`,
          tipo,
          tribunal,
          monitoramentos: slice,
          __chunkIdx: chunkIdx,
          __chunkTotal: Math.ceil(mons.length / CHUNK_MAX),
        });
      }
    }
  }

  const itens = grupos.sort((a, b) => {
    const ta = TODOS_TRIBUNAIS.indexOf(a.tribunal);
    const tb = TODOS_TRIBUNAIS.indexOf(b.tribunal);
    return (ta - tb) || (TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo)) || ((a.__chunkIdx || 0) - (b.__chunkIdx || 0));
  }).map((g) => ({
    id: g.id,
    label: (() => {
      const single = g.monitoramentos.length === 1;
      if (single) return g.monitoramentos[0]?.descricao || g.monitoramentos[0]?.termo_busca || g.tribunal;
      if (g.__chunkTotal && g.__chunkTotal > 1) {
        return `${g.monitoramentos.length} termos (lote ${(g.__chunkIdx || 0) + 1}/${g.__chunkTotal})`;
      }
      return `${g.monitoramentos.length} termos`;
    })(),
    tribunal: g.tribunal,
    tipo: g.tipo,
    monitoramentoIds: g.monitoramentos.map((m) => m.id),
    status: "pendente",
    current: 0,
    total: g.monitoramentos.length * Math.max(1, dias.length),
    mensagem: "Aguardando VPS...",
    novas: 0,
    descartadas: 0,
    duplicatas: 0,
    erro: null,
    via: null,
  }));

  // === CHECKPOINT igual ao DJEN browser ===
  // Em vez de depender só da última execução, faz união de todas as unidades
  // já concluídas em execuções anteriores da mesma janela. Assim cancelar e
  // clicar "Executar agora" nunca refaz o que já terminou.
  let checkpointPulados = 0;
  const unidadesConcluidasCheckpoint = new Set();
  const statsCheckpointPorId = new Map();
  const monitoramentosAtuais = new Set(lista.map((m) => m.id));
  const absorverProgressoCheckpoint = (progresso) => {
    for (const rawKey of progresso?.checkpoint?.unidadesConcluidas || []) {
      const key = String(rawKey);
      const monId = key.split("|")[2] || null;
      if (!monId || monitoramentosAtuais.has(monId)) unidadesConcluidasCheckpoint.add(key);
    }
    for (const pi of progresso?.itens || []) {
      if (!pi?.id || pi.status !== "concluido") continue;
      if (pi.monitoramentoIds?.length && !pi.monitoramentoIds.some((id) => monitoramentosAtuais.has(id))) continue;
      unidadesConcluidasCheckpoint.add(String(pi.id));
      if (!statsCheckpointPorId.has(pi.id)) statsCheckpointPorId.set(pi.id, pi);
    }
  };
  // Checkpoint: auto-retomada quando existe execução recente da MESMA janela
  // que terminou em 'falhou'/'cancelado'/'erro' (ex.: reaper matou por heartbeat).
  // Assim, ao clicar "Executar novamente" após falha, NÃO recomeça do zero.
  // resetCheckpoint=true força recomeço total.
  const forcarReset = !!payload?.resetCheckpoint;
  const usarCheckpoint = !forcarReset;
  if (!usarCheckpoint) {
    log("paralela.checkpoint_skipped", { runKey, motivo: "resetCheckpoint" });
  }
  try {
    if (!usarCheckpoint) throw new Error("__skip_checkpoint__");
    const selfRunKey = job?.progresso?.checkpoint?.runKey;
    if (!selfRunKey || selfRunKey === runKey) absorverProgressoCheckpoint(job?.progresso);

    const { data: anteriores } = await sb
      .from("execucoes_servidor")
      .select("id, status, payload, progresso, created_at")
      .eq("tipo", TIPO_ENGINE)
      .in("status", ["cancelado", "erro", "concluido", "falhou"])
      .order("created_at", { ascending: false })
      .limit(50);
    for (const ant of anteriores || []) {
      if (!isSameRunWindow(ant, runKey, dataInicio, dataFim, coordenacaoId, monitoramentoIdsFiltro, job?.id)) continue;
      absorverProgressoCheckpoint(ant.progresso);
    }
    for (const item of itens) {
      if (!unidadesConcluidasCheckpoint.has(item.id)) continue;
      const prev = statsCheckpointPorId.get(item.id);
      item.status = "concluido";
      item.current = item.total;
      item.novas = Number(prev?.novas) || 0;
      item.descartadas = Number(prev?.descartadas) || 0;
      item.duplicatas = Number(prev?.duplicatas) || 0;
      item.mensagem = "Já processado (checkpoint)";
      checkpointPulados++;
    }
    log("paralela.checkpoint_loaded", { runKey, pulados: checkpointPulados, total: itens.length });
  } catch (e) {
    if (String(e?.message) !== "__skip_checkpoint__") {
      log("paralela.checkpoint_error", { e: String(e?.message || e).slice(0, 300) });
    }
  }

  let lastFlush = 0;
  const flushProgresso = async (force = false) => {
    if (!job?.id) return;
    const now = Date.now();
    // Throttle: 3s entre flushes reduz o volume de UPDATEs em
    // execucoes_servidor (era o 2º gargalo do banco). Heartbeat independente
    // continua batendo a cada 30s para o watchdog.
    if (!force && now - lastFlush < 3000) return;
    lastFlush = now;
    const concluidos = itens.filter((i) => i.status === "concluido" || i.status === "erro").length;
    const falhas = itens.filter((i) => i.status === "erro").length;
    const executando = itens.filter((i) => i.status === "executando");
    const totais = itens.reduce((acc, i) => {
      acc.novas += Number(i.novas) || 0;
      acc.duplicatas += Number(i.duplicatas) || 0;
      acc.descartadas += Number(i.descartadas) || 0;
      return acc;
    }, { novas: 0, duplicatas: 0, descartadas: 0 });
    await sb.from("execucoes_servidor").update({
      progresso: {
        totalItens: itens.length,
        concluidos,
        falhas,
        novas: totais.novas,
        duplicatas: totais.duplicatas,
        descartadas: totais.descartadas,
        atual: executando[0] ? { id: executando[0].id, label: executando[0].label } : null,
        itens,
        janela: { dataInicio, dataFim },
        checkpoint: {
          runKey,
          unidadesConcluidas: itens.filter((i) => i.status === "concluido").map((i) => i.id),
        },
        pool_enabled: true,
        vias: executando.map((i) => i.via).filter(Boolean),
      },
      progresso_atualizado_em: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    }).eq("id", job.id);
  };

  const abortController = new AbortController();
  const signal = abortController.signal;
  let cancelled = false;
  const isCancelled = async () => {
    if (!job?.id) return false;
    const { data } = await sb.from("execucoes_servidor").select("status").eq("id", job.id).maybeSingle();
    return data?.status === "cancelado";
  };
  const slots = await loadPool(sb);
  if (slots.length === 0) throw new Error("Nenhuma VPS ativa em djen_proxy_pool. O DJEN Servidor não roda sem VPS.");
  const cancelPoll = setInterval(async () => {
    if (!cancelled && await isCancelled().catch(() => false)) {
      cancelled = true;
      abortController.abort();
    }
  }, CANCEL_CHECK_MS);

  // Heartbeat independente: garante que o dispatcher (timeout 5min em
  // reset_jobs_orfaos_servidor) não marque o job como órfão quando um
  // worker está preso paginando um termo grande do TST (>5min sem
  // flushProgresso). Atualiza heartbeat_at a cada 30s.
  const heartbeatTick = setInterval(async () => {
    if (!job?.id || cancelled) return;
    try {
      await sb.from("execucoes_servidor")
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (_) { /* swallow: heartbeat best-effort */ }
  }, 30_000);

  // Agora cada item é (tipo, tribunal, monitoramento). Distribui em 4 bandas
  // por prioridade de tribunal/tipo. Iterar `itens` (em vez de `byKey.get`) é
  // necessário porque as keys passaram a incluir o monId.
  const band0 = []; // TST principais
  const band1 = []; // STF/STJ principais
  const band2 = []; // demais tribunais principais
  const band3 = []; // processo (qualquer tribunal)
  for (const item of itens) {
    if (item.status === "concluido") continue;
    if (item.tipo === "processo") {
      band3.push({ band: 3, item, monIds: item.monitoramentoIds });
    } else if (item.tribunal === "TST" && MAIN_TIPOS.includes(item.tipo)) {
      band0.push({ band: 0, item, monIds: item.monitoramentoIds });
    } else if ((item.tribunal === "STF" || item.tribunal === "STJ") && MAIN_TIPOS.includes(item.tipo)) {
      band1.push({ band: 1, item, monIds: item.monitoramentoIds });
    } else if (MAIN_TIPOS.includes(item.tipo)) {
      band2.push({ band: 2, item, monIds: item.monitoramentoIds });
    }
  }
  const bands = [band0, band1, band2, band3];

  // Acumula totais já vindos do checkpoint
  let totalNovas = 0, totalDescartadas = 0, totalDuplicatas = 0, totalErros = 0;
  for (const item of itens) {
    if (item.status === "concluido") {
      totalNovas += item.novas;
      totalDescartadas += item.descartadas;
      totalDuplicatas += item.duplicatas;
    }
  }
  let bandAtual = 0;
  const inBand = [0, 0, 0, 0];
  const pickNext = () => {
    // Sem trava entre bandas: pega o item da banda de maior prioridade
    // que ainda tenha itens pendentes. Workers livres não esperam mais
    // a banda atual drenar antes de avançar (ex.: enquanto 1 VPS roda
    // os 31 termos do STF, as outras 7 VPS já podem atacar TRTs/TRFs).
    for (let b = 0; b < bands.length; b++) {
      if (bands[b].length > 0) {
        bandAtual = b;
        return bands[b].shift();
      }
    }
    return null;
  };

  await flushProgresso(true);
  log("paralela.pool", { vias: slots.length, totalItens: itens.length, bandas: { tst: band0.length, superiores: band1.length, outros: band2.length, processo: band3.length } });

  // === RETRY: refila falhas pendentes do mesmo dia BRT como units extras ===
  // Em vez do loop serial bloqueante de 1 VPS, injeta cada falha pendente
  // como uma unit sintética na banda correspondente, para que TODAS as VPS
  // do pool consumam retries e novas units em paralelo.
  try {
    const pendentes = await lerFalhasPendentes(sb, TIPO_ENGINE);
    if (pendentes.length > 0) {
      log("paralela.retry_pendentes_injetadas", { qtd: pendentes.length });
      for (const f of pendentes) {
        const p = f.payload || {};
        const tribunal = p.tribunal;
        const monId = p.monitoramentoId;
        const dia = p.dia;
        const tipoMon = p.tipo;
        const mon = monId ? monsPorId.get(monId) : null;
        if (!tribunal || !mon || !dia || !tipoMon) {
          await marcarFalhaResolvida(sb, TIPO_ENGINE, f.item_key).catch(() => {});
          continue;
        }
        const syntheticItem = {
          id: `retry|${tribunal}|${monId}|${dia}`,
          label: `RETRY ${mon.descricao || mon.termo_busca || tribunal}`,
          tribunal,
          tipo: tipoMon,
          monitoramentoIds: [monId],
          status: "pendente",
          current: 0,
          total: 1,
          mensagem: "Aguardando VPS (retry)...",
          novas: 0, descartadas: 0, duplicatas: 0,
          erro: null, via: null,
          __retry: true,
          __retryItemKey: f.item_key,
          __overrideDias: [dia],
        };
        itens.push(syntheticItem);
        const unit = { item: syntheticItem, monIds: [monId] };
        if (tribunal === "TST" && MAIN_TIPOS.includes(tipoMon)) { unit.band = 0; band0.push(unit); }
        else if ((tribunal === "STF" || tribunal === "STJ") && MAIN_TIPOS.includes(tipoMon)) { unit.band = 1; band1.push(unit); }
        else if (tipoMon === "processo") { unit.band = 3; band3.push(unit); }
        else { unit.band = 2; band2.push(unit); }
      }
    }
  } catch (e) {
    log("paralela.retry_loop_error", { e: String(e?.message || e).slice(0, 300) });
  }

  const processUnit = async (unit, slot) => {
    const item = unit.item;
    item.status = "executando";
    item.via = { id: slot.id, label: slot.label || slot.url };
    item.mensagem = `${item.tribunal}: processando via ${item.via.label}`;
    await flushProgresso();
    const diasEfetivos = Array.isArray(item.__overrideDias) && item.__overrideDias.length > 0 ? item.__overrideDias : dias;
    try {
      for (const monId of unit.monIds) {
        const mon = monsPorId.get(monId);
        if (!mon) continue;
        for (const dia of diasEfetivos) {
          if (cancelled || signal.aborted || (await isCancelled())) {
            cancelled = true;
            abortController.abort();
            item.status = "cancelado";
            item.mensagem = "Cancelado pelo usuário";
            return;
          }
          item.mensagem = `${item.tribunal} ${dia}: ${item.current}/${item.total} via ${item.via.label}`;
          // Try/catch por (mon, dia): falha de um par específico (ex: TJES
          // 504) não derruba os outros pares do mesmo item; o par é gravado
          // em execucoes_servidor_falhas para refila na próxima execução
          // do mesmo dia BRT.
          const itemKeyFalha = `paralela|${item.tribunal}|${monId}|${dia}`;
          try {
            let pubs;
            try {
              pubs = await buscarTermo(slot, { ...mon, tipo: item.tipo }, dia, item.tribunal, signal);
            } catch (firstErr) {
              const msg = String(firstErr?.message || firstErr || "");
              const is5xx = /HTTP\s*5\d\d/.test(msg) || /Falha ao consultar VPS/.test(msg);
              if (!is5xx || cancelled || signal.aborted) throw firstErr;
              // Failover entre VPS: o slot atual derruba persistentemente esta
              // tupla (tribunal, mon, dia). Tenta os demais slots do pool antes
              // de empurrar para a refila — espelha o fallback do browser que
              // alterna entre VPS quando uma devolve 5xx.
              const outrosSlots = slots.filter((s) => s.id !== slot.id);
              let recovered = null;
              let lastErr = firstErr;
              for (const alt of outrosSlots) {
                if (cancelled || signal.aborted) break;
                try {
                  log("paralela.failover_slot", { de: slot.label || slot.url, para: alt.label || alt.url, tribunal: item.tribunal, monId, dia, motivo: msg.slice(0, 160) });
                  recovered = await buscarTermo(alt, { ...mon, tipo: item.tipo }, dia, item.tribunal, signal);
                  item.via = { id: alt.id, label: alt.label || alt.url };
                  break;
                } catch (altErr) {
                  lastErr = altErr;
                  const altMsg = String(altErr?.message || altErr || "");
                  if (!/HTTP\s*5\d\d/.test(altMsg) && !/Falha ao consultar VPS/.test(altMsg)) throw altErr;
                }
              }
              if (!recovered) throw lastErr;
              pubs = recovered;
            }
            // (removido) empty_cross_slot_rescue: refazia a busca em todas as
            // outras VPS sempre que vinha 0 — situação majoritária — e
            // multiplicava por 5 o custo da execução. O retry interno de
            // página vazia (delay 600ms) em buscarTermo já cobre a
            // instabilidade real da API PJE Comunica.
            log("paralela.termo_result", { execucaoId: job?.id || null, monitoramentoId: mon.id, coordenacaoId: mon.coordenacao_id || null, tipo: item.tipo, tribunal: item.tribunal, dia, encontrados: pubs.length });
            const stats = await persistPublicacoes(sb, pubs, { ...mon, tipo: item.tipo, __log: log }, item.tribunal, dia, job?.id || null);
            log("paralela.termo_persist", { execucaoId: job?.id || null, monitoramentoId: mon.id, coordenacaoId: mon.coordenacao_id || null, tipo: item.tipo, tribunal: item.tribunal, dia, encontrados: pubs.length, ...stats });
            item.novas += stats.novas;
            item.descartadas += stats.descartadas;
            item.duplicatas += stats.duplicatas;
            // se havia falha pendente p/ este par, marca como resolvido
            await marcarFalhaResolvida(sb, TIPO_ENGINE, itemKeyFalha).catch(() => {});
            if (item.__retry && item.__retryItemKey) {
              await marcarFalhaResolvida(sb, TIPO_ENGINE, item.__retryItemKey).catch(() => {});
            }
          } catch (e) {
            if (cancelled || signal.aborted || String(e?.message || e).includes("cancel")) throw e;
            await recordFalha(sb, {
              tipo: TIPO_ENGINE,
              execucaoId: job?.id || null,
              itemKey: itemKeyFalha,
              payload: { tribunal: item.tribunal, monitoramentoId: monId, dia, tipo: item.tipo },
              erro: e?.message || e,
            }).catch((ee) => log("paralela.recordFalha_error", { e: String(ee?.message || ee) }));
            item.erro = String(e?.message || e).slice(0, 500);
            log("paralela.par_error", { tribunal: item.tribunal, monId, dia, e: item.erro });
            // Não rethrow: segue para próximos (monId, dia). O par foi
            // marcado para refila na próxima rodada do dia.
          }
          item.current += 1;
          await flushProgresso();
        }
      }
      const teveFalhaParcial = !!item.erro;
      if (item.current >= item.total && !teveFalhaParcial) {
        item.status = "concluido";
        item.mensagem = `Concluído: ${item.novas} novas, ${item.duplicatas} duplicadas, ${item.descartadas} descartadas`;
        totalNovas += item.novas;
        totalDescartadas += item.descartadas;
        totalDuplicatas += item.duplicatas;
      } else if (item.current >= item.total && teveFalhaParcial) {
        item.status = "concluido";
        item.mensagem = `Parcial: ${item.novas} novas, ${item.duplicatas} duplicadas, ${item.descartadas} descartadas · pares com falha serão reexecutados`;
        totalNovas += item.novas;
        totalDescartadas += item.descartadas;
        totalDuplicatas += item.duplicatas;
      }
    } catch (e) {
      if (cancelled || signal.aborted || String(e?.message || e).includes("cancel")) {
        cancelled = true;
        abortController.abort();
        item.status = "cancelado";
        item.mensagem = "Cancelado pelo usuário";
        return;
      }
      item.status = "erro";
      item.current = item.total;
      item.erro = String(e?.message || e).slice(0, 500);
      item.mensagem = `Erro: ${item.erro}`;
      totalErros += 1;
      log("paralela.item_error", { id: item.id, via: item.via?.label, e: item.erro });
    } finally {
      await flushProgresso();
    }
  };

  const worker = async (slot) => {
    log("paralela.worker_start", { via: slot.label || slot.url });
    while (!cancelled) {
      const unit = pickNext();
      if (!unit) {
        if (bandAtual < bands.length && inBand[bandAtual] > 0) { await delay(500); continue; }
        break;
      }
      inBand[unit.band]++;
      try { await processUnit(unit, slot); }
      finally { inBand[unit.band]--; }
      // Paridade com browser: delay_between_terms aplicado ENTRE units
      // consumidas por uma mesma VPS (não dentro da unit). Mantém o
      // espaçamento contra a API PJE Comunica sem serializar (mon, dia).
      if (TERM_DELAY_MS > 0 && !cancelled) await delay(TERM_DELAY_MS, signal);
    }
    log("paralela.worker_done", { via: slot.label || slot.url });
  };

  await Promise.all(slots.map((slot) => worker(slot)));
  clearInterval(cancelPoll);
  clearInterval(heartbeatTick);
  if (cancelled) {
    for (const item of itens) {
      if (item.status === "pendente" || item.status === "executando") {
        item.status = "cancelado";
        item.mensagem = "Cancelado pelo usuário";
      }
    }
    log("paralela.cancelled", { remaining: itens.filter((i) => i.status === "pendente").length });
  }
  await flushProgresso(true);
  log("paralela.done", { monitoramentos: itens.length, novas: totalNovas, descartadas: totalDescartadas, duplicatas: totalDuplicatas, erros: totalErros });

  return { novas: totalNovas, descartadas: totalDescartadas, duplicatas: totalDuplicatas, erros: totalErros, monitoramentos: itens.length, dataInicio, dataFim, vps: slots.length };
}

module.exports = { run };