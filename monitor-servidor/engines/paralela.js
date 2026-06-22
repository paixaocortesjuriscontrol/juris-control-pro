// DJEN Servidor: replica a lógica do "DJEN Termos Paralela" no daemon Node.
// Não chama a edge monitorar-djen; cada worker usa uma VPS do djen_proxy_pool.

const { djenFetchSlot, loadPool } = require("../proxyPool");
const { recordFalha, marcarFalhaResolvida, lerFalhasPendentes } = require("../falhasRefila");

const TIPO_ENGINE = "djen_paralela_servidor";
const ENGINE_VERSION = "2026-06-22-id-djen-oficial-coord-dedup-v3";

const TODOS_CIVEIS = ["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"];
const TODOS_TRT = ["TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24"];
const TODOS_TRIBUNAIS = [...TODOS_TRT, "STF", "STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", ...TODOS_CIVEIS];
const TIPO_ORDER = ["parte", "advogado", "palavra-chave", "processo"];
const MAIN_TIPOS = ["parte", "advogado", "palavra-chave"];
const PAGE_DELAY_MS = Math.max(0, Number(process.env.PARALELA_PAGE_DELAY_MS || 800));
const TERM_DELAY_MS = Math.max(0, Number(process.env.PARALELA_TERM_DELAY_MS || 1200));
const CANCEL_CHECK_MS = Math.max(1000, Number(process.env.PARALELA_CANCEL_CHECK_MS || 3000));

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
  return tipo === "nome" ? "palavra-chave" : (tipo || "palavra-chave");
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

function getConteudo(pub) {
  const obj = rawObj(pub);
  return String(obj?.conteudo || obj?.texto || obj?.teor || pub?.conteudo || pub?.texto || pub?.teor || pub?.descricao || "");
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
  return {
    orgao: obj?.orgao || obj?.nomeOrgao || null,
    tipo_comunicacao: obj?.tipoComunicacao || obj?.tipo || obj?.tipo_comunicacao || null,
    meio: obj?.meio || null,
    partes_json: obj?.partes || obj?.destinatarios || null,
    advogados_json: obj?.advogados || obj?.destinatarioadvogados || null,
  };
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
  const add = (raw) => {
    if (!raw) return;
    const s = typeof raw === "string"
      ? raw
      : (raw?.nome || raw?.nomeParte || raw?.parte || raw?.nomeDestinatario || raw?.destinatarioNome || "");
    if (!s) return;
    for (const n of String(s).split(/\s*,\s*|\s*;\s*/).map((x) => x.trim()).filter(Boolean)) out.push(n);
  };
  const dest = obj?.destinatarios || pub?.destinatarios;
  if (Array.isArray(dest)) for (const d of dest) add(d);
  add(obj?.poloAtivo || obj?.polo_ativo || pub?.poloAtivo || pub?.polo_ativo);
  add(obj?.poloPassivo || obj?.polo_passivo || pub?.poloPassivo || pub?.polo_passivo);
  add(obj?.nomeDestinatario || obj?.destinatarioNome || obj?.destinatario_nome || pub?.nomeDestinatario || pub?.destinatarioNome || pub?.destinatario_nome);
  const pjson = obj?.partes || obj?.partes_json || pub?.partes || pub?.partes_json;
  const arr = typeof pjson === "string" ? (() => { try { return JSON.parse(pjson); } catch { return []; } })() : pjson;
  if (Array.isArray(arr)) for (const p of arr) add(p);
  return out;
}

function validarAdvogadoMetadados(pub, oab, nome) {
  const obj = rawObj(pub);
  const advs = obj?.destinatarioadvogados || obj?.advogados || pub?.destinatarioadvogados || pub?.advogados;
  if (!Array.isArray(advs) || advs.length === 0) return false;
  const oabDigits = oab ? String(oab).replace(/\D/g, "") : "";
  const nomeNorm = nome ? normalize(nome) : "";
  for (const entry of advs) {
    const adv = entry?.advogado || entry;
    if (!adv) continue;
    if (oabDigits && adv.numero_oab && String(adv.numero_oab).replace(/\D/g, "") === oabDigits) return true;
    if (nomeNorm && adv.nome) {
      const an = normalize(adv.nome);
      if (an === nomeNorm || an.includes(nomeNorm) || nomeNorm.includes(an)) return true;
    }
  }
  return false;
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
  const obj = rawObj(pub);
  const texto = String(obj?.texto || obj?.conteudo || obj?.teor || pub?.texto || pub?.conteudo || pub?.teor || "");
  const nomeNorm = normalize(nomeParte);
  if (!texto || !nomeNorm) return false;
  const header = texto.match(/\bParte\s*\(\s*s\s*\)\s*:?\s*/i);
  if (!header || header.index === undefined) return false;
  const after = texto.slice(header.index + header[0].length, header.index + header[0].length + 2500);
  const advIdx = after.search(/(?:^|\n)\s*Advogados?\s*(?:\(\s*s\s*\))?\s*:?/i);
  const secao = advIdx >= 0 ? after.slice(0, advIdx) : after;
  return secao.split(/\r?\n/).map((l) => normalize(l.trim())).some((ln) => ln.length >= 3 && contemFrase(ln, nomeNorm));
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

function partePareceAdvogado(mon) {
  if (mapTipo(mon.tipo) !== "parte") return false;
  if (String(mon.oab || "").replace(/\D/g, "").length >= 3) return true;
  return (mon.termos_or || []).some((t) => {
    const parsed = parsearTermoOr(t);
    return parsed?.oabDigits && parsed.oabDigits.length >= 3 && parsed?.nome;
  });
}

function textoCompletoContemTermoParte(pub, conteudo, mon) {
  const textoNorm = normalize(buildTextoCompleto(pub, conteudo));
  if (!textoNorm) return false;
  return termosDeParte(mon).some((raw) => {
    const termoNorm = normalize(termoParteParaBusca(raw));
    return termoNorm && contemFrase(textoNorm, termoNorm);
  });
}

async function buscarPublicacoesParteServidorJaEncontradas(sb, mon, dia, tribunal) {
  if (!sb || mapTipo(mon.tipo) !== "parte" || !mon.coordenacao_id) return [];
  const resgatadas = new Map();
  const termosBusca = termosDeParte(mon).map(termoParteParaBusca).filter(Boolean);
  if (termosBusca.length === 0) return [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await sb
      .from("publicacoes_djen_servidor")
      .select("id, id_djen, hash_conteudo, processo_numero, conteudo, data_disponibilizacao, data_publicacao, tribunal, fonte, orgao, tipo_comunicacao, meio, advogados_json, partes_json, coordenacao_id")
      .eq("tribunal", tribunal)
      .gte("data_disponibilizacao", `${dia}T00:00:00.000Z`)
      .lte("data_disponibilizacao", `${dia}T23:59:59.999Z`)
      .neq("coordenacao_id", mon.coordenacao_id)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) continue;
    if (!data || data.length === 0) break;
    for (const row of data || []) {
      const candidato = {
        ...row,
        id: row.id_djen || row.id,
        texto: row.conteudo,
        dataDisponibilizacao: row.data_disponibilizacao,
        dataPublicacao: row.data_publicacao,
        siglaTribunal: row.tribunal,
        numeroProcesso: row.processo_numero,
        advogados: row.advogados_json,
        destinatarioadvogados: row.advogados_json,
        partes: row.partes_json,
        destinatarios: row.partes_json,
        __matchedByNomeParte: true,
        __matchedByServidorCorpus: true,
      };
      if (!termosBusca.some((termoBusca) => textoCompletoContemTermoParte(candidato, row.conteudo, { ...mon, termo_busca: termoBusca, termos_or: [] }))) continue;
      const key = row.id_djen ? `id_djen:${row.id_djen}` : `row:${row.id}`;
      resgatadas.set(key, candidato);
    }
    if (data.length < 1000) break;
  }
  return Array.from(resgatadas.values());
}

async function buscarTribunalDiaCompleto(slot, dia, tribunal, signal, fallbackSlots, scanCache) {
  const key = `${dia}|${tribunal}`;
  if (scanCache?.has(key)) return scanCache.get(key);
  const params = {
    siglaTribunal: tribunal,
    dataDisponibilizacaoInicio: dia,
    dataDisponibilizacaoFim: dia,
  };
  let items = [];
  const slots = [slot, ...(Array.isArray(fallbackSlots) ? fallbackSlots : [])].filter(Boolean);
  for (const currentSlot of slots) {
    try {
      items = await buscarPaginado(currentSlot, params, signal);
      if (items.length > 0) break;
    } catch (_e) {
      // Tenta a próxima VPS. A varredura é uma proteção extra, não deve derrubar o monitoramento.
    }
  }
  scanCache?.set(key, items);
  return items;
}

function contemTermo(conteudo, mon, pub) {
  // Espelha src/hooks/useDjenTermosParalelaEngine.ts > validarTermo (estrito):
  // - 'parte': SÓ casa em metadados estruturados ou na seção Parte(s).
  // - 'advogado': metadados estruturados OU nome/oab no texto completo (frase exata).
  // - 'palavra-chave': frase exata (word-boundary) no texto completo, com suporte a '+'.
  const tipo = mapTipo(mon.tipo);
  if (tipo === "parte") {
    if (pub?.__matchedByNomeParte) return true;
    if (pub?.__matchedByParteAdvogadoFallback) {
      if (validarAdvogadoMetadados(pub, null, mon.termo_busca)) return true;
      const textoNorm = normalize(buildTextoCompleto(pub, conteudo));
      if (contemFrase(textoNorm, normalize(mon.termo_busca))) return true;
      for (const t of mon.termos_or || []) {
        if (validarAdvogadoMetadados(pub, null, String(t))) return true;
        if (contemFrase(textoNorm, normalize(String(t)))) return true;
      }
    }
    if (validarParteMetadados(pub, mon.termo_busca)) return true;
    if (validarParteSecaoPartes(pub, mon.termo_busca)) return true;
    for (const t of mon.termos_or || []) {
      if (validarParteMetadados(pub, String(t))) return true;
      if (validarParteSecaoPartes(pub, String(t))) return true;
    }
    return false;
  }
  const textoNorm = normalize(buildTextoCompleto(pub, conteudo));
  if (tipo === "advogado") {
    if (validarAdvogadoMetadados(pub, mon.oab, mon.termo_busca)) return true;
    const nomeNorm = normalize(mon.termo_busca);
    if (nomeNorm && contemFrase(textoNorm, nomeNorm)) return true;
    if (mon.oab) {
      const od = String(mon.oab).replace(/\D/g, "");
      if (od.length >= 3 && textoNorm.includes(od)) return true;
    }
    for (const t of mon.termos_or || []) {
      const p = parsearTermoOr(t);
      if (!p) continue;
      if (validarAdvogadoMetadados(pub, p.oabDigits, p.nome)) return true;
      const nn = normalize(p.nome);
      if (nn && contemFrase(textoNorm, nn)) return true;
      if (p.oabDigits && p.oabDigits.length >= 3 && textoNorm.includes(p.oabDigits)) return true;
    }
    return false;
  }
  if (tipo === "processo") {
    const nd = String(mon.termo_busca || "").replace(/\D/g, "");
    const pn = String(pub?.numeroProcesso || pub?.numero_processo || pub?.processo_numero || pub?.processo || "").replace(/\D/g, "");
    return pn.includes(nd);
  }
  // palavra-chave / nome
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
  const textoNorm = mon.tipo === "parte"
    ? normalize(extrairPartesEstruturadas(pub).join("\n"))
    : normalize(buildTextoCompleto(pub, conteudo));
  if (!textoNorm) return mon.tipo !== "parte";
  return grupos.some((g) => {
    const ts = g.split(",").map((t) => t.trim()).filter(Boolean);
    if (ts.length === 0) return true;
    return ts.every((t) => contemFrase(textoNorm, normalize(t)));
  });
}

function shouldExclude(conteudo, mon, pub) {
  const excs = Array.isArray(mon.exclusoes) ? mon.exclusoes : [];
  if (excs.length === 0) return false;
  const text = mon.tipo === "parte"
    ? normalize(extrairPartesEstruturadas(pub).join("\n"))
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
  // continueUntilEmpty: a API PJE Comunica frequentemente retorna páginas
  // curtas (< 50) ou hasMore=false no meio do stream. Só paramos quando a
  // página vier vazia OU quando nenhum item novo for adicionado (todos
  // duplicados via id_djen). Espelha o comportamento do browser
  // (memória: features/monitoring/djen-paralela-pagination-fix).
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
    if (!out) throw lastErr || new Error("Falha ao consultar VPS DJEN");
    if (out.status === 404) break;
    if (out.status < 200 || out.status >= 300) throw new Error(`HTTP ${out.status}`);
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
    const total = getTotal(data);
    // Espelha Browser (src/utils/pjeComunicaClient.ts > continueUntilEmpty):
    // encerra na 1ª página vazia. A regra antiga de "2 vazias seguidas" era
    // exclusiva do Servidor e não muda paridade — mantemos igual ao Browser.
    if (items.length === 0) break;
    // Se nenhum item novo foi adicionado, provavelmente estamos em loop
    // de duplicatas — encerra.
    if (items.length > 0 && added === 0) break;
    if (typeof total === "number" && total > 0 && all.length >= total) break;
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
    const oab = String(mon.oab || "").replace(/\D/g, "");
    const uf = String(mon.uf || "").trim().toUpperCase();
    const ufValida = uf && !uf.includes(",") && uf !== "TODAS" && uf !== "UNDEFINED";
    if (ufValida && oab) {
      params.numeroOab = oab;
      params.ufOab = uf;
      if (mon.termo_busca) params.nomeAdvogado = normalizeForApi(mon.termo_busca);
    } else if (mon.termo_busca) {
      params.nomeAdvogado = normalizeForApi(mon.termo_busca);
    } else if (oab) {
      params.numeroOab = oab;
    }
  } else if (tipo === "processo") {
    params.numeroProcesso = String(mon.termo_busca || "").replace(/\D/g, "");
  } else if (tipo !== "parte") {
    const termo = String(mon.termo_busca || "");
    params.texto = normalizeForApi(termo.includes("+") ? termo.split("+").map((p) => p.trim()).filter((p) => !/^OAB\s/i.test(p)).sort((a, b) => b.length - a.length)[0] || termo : termo);
  }
  return params;
}

async function buscarTermo(slot, mon, dia, tribunal, signal, fallbackSlots, scanCache, sb) {
  const tipo = mapTipo(mon.tipo);
  if (tipo === "parte") {
    const results = [];
    for (const nomeParte of termosDeParte(mon)) {
      if (signal?.aborted) throw new Error("cancelado");
      const termoBusca = termoParteParaBusca(nomeParte);
      const params = { ...baseParams(mon, dia, tribunal), nomeParte: termoBusca };
      let items = await buscarPaginado(slot, params, signal);
      // Espelha Browser (useDjenTermosParalelaEngine.ts:1311-1320):
      // a API PJE Comunica devolve listagem vazia intermitentemente sem
      // erro HTTP. Refaz a MESMA chamada uma única vez após 1.5s.
      if (!signal?.aborted && items.length === 0) {
        await delay(1500, signal);
        if (!signal?.aborted) {
          items = await buscarPaginado(slot, params, signal);
        }
      }
      // Espelha Browser (useDjenTermosParalelaEngine.ts:1321-1331):
      // se a VPS ainda devolveu vazio sem erro, validamos OBRIGATORIAMENTE
      // em outra VPS do pool (o Browser cai no caminho Direto). Sem isso,
      // intermitências da VPS principal somem com publicações reais —
      // foi a causa das 8 ausências de OSMAR MENDES PAIXAO CORTES em
      // TJES/TJMT/TJPI/TJMA no comparador de 22/06/2026.
      if (!signal?.aborted && items.length === 0 && Array.isArray(fallbackSlots) && fallbackSlots.length > 0) {
        for (const alt of fallbackSlots) {
          if (signal?.aborted) break;
          if (!alt || alt.id === slot.id) continue;
          await delay(1500, signal);
          if (signal?.aborted) break;
          try {
            const altItems = await buscarPaginado(alt, params, signal);
            if (altItems.length > 0) {
              items = altItems;
              break;
            }
          } catch (_e) {
            // Tenta próxima VPS — não derruba o termo se uma alternativa falhar.
          }
        }
      }
      for (const it of items) it.__matchedByNomeParte = true;
      results.push(...items);
      const paramsAdvogado = { ...baseParams(mon, dia, tribunal), nomeAdvogado: normalizeForApi(termoBusca) };
      let advogadoItems = await buscarPaginado(slot, paramsAdvogado, signal);
      if (!signal?.aborted && advogadoItems.length === 0) {
        await delay(1500, signal);
        if (!signal?.aborted) advogadoItems = await buscarPaginado(slot, paramsAdvogado, signal);
      }
      if (!signal?.aborted && advogadoItems.length === 0 && Array.isArray(fallbackSlots) && fallbackSlots.length > 0) {
        for (const alt of fallbackSlots) {
          if (signal?.aborted) break;
          if (!alt || alt.id === slot.id) continue;
          await delay(1500, signal);
          if (signal?.aborted) break;
          try {
            const altItems = await buscarPaginado(alt, paramsAdvogado, signal);
            if (altItems.length > 0) {
              advogadoItems = altItems;
              break;
            }
          } catch (_e) {
            // Tenta próxima VPS — não derruba o termo se uma alternativa falhar.
          }
        }
      }
      if (!signal?.aborted && partePareceAdvogado(mon) && items.length === 0 && advogadoItems.length === 0) {
        const scanItems = await buscarTribunalDiaCompleto(slot, dia, tribunal, signal, fallbackSlots, scanCache);
        const scanMatches = scanItems.filter((it) => textoCompletoContemTermoParte(it, getConteudo(it), mon));
        for (const it of scanMatches) it.__matchedByParteAdvogadoFallback = true;
        results.push(...scanMatches);
      }
      for (const it of advogadoItems) it.__matchedByParteAdvogadoFallback = true;
      results.push(...advogadoItems);
      if (TERM_DELAY_MS > 0) await delay(TERM_DELAY_MS, signal);
    }
    const jaEncontradas = await buscarPublicacoesParteServidorJaEncontradas(sb, mon, dia, tribunal);
    results.push(...jaEncontradas);
    return results;
  }
  const params = baseParams(mon, dia, tribunal);
  let items = await buscarPaginado(slot, params, signal);
  // Espelha Browser (useDjenTermosParalelaEngine.ts:1354-1383):
  // se 1ª passada veio vazia, espera 1.5s e refaz a MESMA chamada uma vez.
  if (!signal?.aborted && items.length === 0 && tipo !== "processo") {
    await delay(1500, signal);
    if (!signal?.aborted) {
      items = await buscarPaginado(slot, params, signal);
    }
  }
  return items;
}

async function persistPublicacoes(sb, pubs, mon, tribunal, dia, execucaoId) {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  const tribunaisMon = Array.isArray(mon.tribunais) ? expandirTribunais(mon.tribunais) : [];
  const logDebug = typeof mon.__log === "function" ? mon.__log : null;
  const seenRunKeys = new Set();
  for (const pub of pubs) {
    const conteudo = getConteudo(pub);
    const metadata = metadataFromRaw(pub);
    const idDjen = getIdDjen(pub);
    const dataDisponibilizacao = getDataDisponibilizacao(pub, dia);
    const processoNumero = extractProcesso(pub, conteudo);
    const hashConteudo = generatePublicacaoHash(conteudo, dataDisponibilizacao, processoNumero, idDjen);
    const coordenacaoId = mon.coordenacao_id || null;
    const runKey = idDjen ? `id_djen:${idDjen}` : `hash:${hashConteudo}`;
    if (seenRunKeys.has(runKey)) {
      logDebug?.("paralela.dedup_runtime", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, origem: pub?.__matchedByServidorCorpus ? "servidor_corpus" : "api" });
      continue;
    }
    seenRunKeys.add(runKey);
    // Filtro por tribunais permitidos no monitoramento (espelha browser)
    if (tribunaisMon.length > 0 && !tribunaisMon.includes(tribunal)) {
      stats.descartadas++;
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
      logDebug?.("paralela.descartada_filtro", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, temConteudo: !!conteudo, termo: mon.termo_busca, tipo: mon.tipo });
      continue;
    }
    let exists = null;
    let existsReason = null;
    if (idDjen && coordenacaoId) {
      const { data } = await sb.from("publicacoes_djen_servidor").select("id, monitoramento_id, coordenacao_id, id_djen, hash_conteudo").eq("coordenacao_id", coordenacaoId).eq("id_djen", idDjen).maybeSingle();
      exists = data || null;
      if (exists) existsReason = "same_coordenacao_id_djen";
    }
    if (!exists) {
      let existingQuery = sb.from("publicacoes_djen_servidor").select("id, monitoramento_id, coordenacao_id, id_djen, hash_conteudo").eq("hash_conteudo", hashConteudo);
      existingQuery = coordenacaoId ? existingQuery.eq("coordenacao_id", coordenacaoId) : existingQuery.eq("monitoramento_id", mon.id);
      const { data } = await existingQuery.maybeSingle();
      exists = data || null;
      if (exists) existsReason = coordenacaoId ? "same_coordenacao_hash" : "same_monitoramento_hash";
    }
    if (exists) {
      stats.duplicatas++;
      logDebug?.("paralela.duplicata_existente", { reason: existsReason, monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, existing });
      if (execucaoId) {
        await sb.from("publicacoes_djen_servidor_execucoes").upsert(
          { publicacao_id: exists.id, execucao_id: execucaoId, tipo_engine: "paralela" },
          { onConflict: "publicacao_id,execucao_id", ignoreDuplicates: true }
        );
      }
      continue;
    }
    const insertRow = {
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
    const insertQuery = idDjen && coordenacaoId
      ? sb.from("publicacoes_djen_servidor").upsert(insertRow, { onConflict: "coordenacao_id,id_djen", ignoreDuplicates: true }).select("id")
      : sb.from("publicacoes_djen_servidor").insert(insertRow).select("id");
    const { data: insertedRows, error } = await insertQuery;
    const inserted = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    if (error) {
      const msg = String(error.message || "");
      const isConflict = error.code === "23505" || msg.includes("duplicate key");
      if (isConflict) {
        let conflictQuery = sb.from("publicacoes_djen_servidor").select("id, monitoramento_id, coordenacao_id, id_djen, hash_conteudo, tribunal, data_disponibilizacao");
        conflictQuery = idDjen && coordenacaoId
          ? conflictQuery.eq("coordenacao_id", coordenacaoId).eq("id_djen", idDjen)
          : conflictQuery.eq("monitoramento_id", mon.id).eq("hash_conteudo", hashConteudo);
        const { data: conflictRows } = await conflictQuery.limit(5);
        if (conflictRows && conflictRows.length > 0) {
          stats.duplicatas++;
          logDebug?.("paralela.duplicata_constraint_confirmada", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, constraint: error.details || msg, conflictRows });
        } else {
          stats.descartadas++;
          logDebug?.("paralela.insert_conflict_sem_linha_visivel", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, code: error.code, message: msg, details: error.details });
        }
      } else {
        stats.descartadas++;
        logDebug?.("paralela.insert_error", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, code: error.code, message: msg, details: error.details });
      }
    } else if (!inserted?.id) {
      stats.duplicatas++;
      logDebug?.("paralela.upsert_ignorado", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo });
    } else {
      stats.novas++;
      logDebug?.("paralela.nova_inserida", { monitoramentoId: mon.id, coordenacaoId, tribunal, dia, idDjen, hashConteudo, publicacaoId: inserted?.id || null });
      if (execucaoId && inserted?.id) {
        await sb.from("publicacoes_djen_servidor_execucoes").upsert(
          { publicacao_id: inserted.id, execucao_id: execucaoId, tipo_engine: "paralela" },
          { onConflict: "publicacao_id,execucao_id", ignoreDuplicates: true }
        );
      }
    }
  }
  return stats;
}

async function run({ sb, payload, log, job }) {
  const dataInicio = payload?.dataInicio || payload?.diarioYmd || ymdToday();
  const dataFim = payload?.dataFim || payload?.diarioYmd || dataInicio;
  const coordenacaoId = payload?.coordenacaoId || null;
  const monitoramentoIdsFiltro = Array.isArray(payload?.monitoramentoIds) && payload.monitoramentoIds.length > 0 ? payload.monitoramentoIds : null;
  const dias = expandirDias(dataInicio, dataFim);

  log("paralela.start", { engineVersion: ENGINE_VERSION, dataInicio, dataFim, dias: dias.length, coordenacaoId, monitoramentoIdsFiltro });

  let q = sb.from("monitoramentos_djen").select("id, descricao, termo_busca, termos_or, tipo, oab, uf, coordenacao_id, tribunais, exclusoes, condicao_concomitante").eq("ativo", true);
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
      const splitTst = tribunal === "TST" && tipo !== "processo";
      const key = splitTst ? `${tipo}|${tribunal}|${m.id}` : `${tipo}|${tribunal}`;
      if (!grouped.has(key)) grouped.set(key, { id: key, tipo, tribunal, monitoramentos: [] });
      grouped.get(key).monitoramentos.push(m);
    }
  }

  const itens = Array.from(grouped.values()).sort((a, b) => {
    const ta = TODOS_TRIBUNAIS.indexOf(a.tribunal);
    const tb = TODOS_TRIBUNAIS.indexOf(b.tribunal);
    return (ta - tb) || (TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo));
  }).map((g) => ({
    id: g.id,
    label: g.monitoramentos.length > 1 ? `${g.monitoramentos.length} termos` : (g.monitoramentos[0]?.descricao || g.monitoramentos[0]?.termo_busca || g.tribunal),
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

  let lastFlush = 0;
  const flushProgresso = async (force = false) => {
    if (!job?.id) return;
    const now = Date.now();
    if (!force && now - lastFlush < 800) return;
    lastFlush = now;
    const concluidos = itens.filter((i) => i.status === "concluido" || i.status === "erro" || i.status === "cancelado").length;
    const falhas = itens.filter((i) => i.status === "erro").length;
    const executando = itens.filter((i) => i.status === "executando");
    await sb.from("execucoes_servidor").update({
      progresso: {
        totalItens: itens.length,
        concluidos,
        falhas,
        atual: executando[0] ? { id: executando[0].id, label: executando[0].label } : null,
        itens,
        janela: { dataInicio, dataFim },
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
  const scanCache = new Map();
  const cancelPoll = setInterval(async () => {
    if (!cancelled && await isCancelled().catch(() => false)) {
      cancelled = true;
      abortController.abort();
    }
  }, CANCEL_CHECK_MS);

  const byKey = new Map(itens.map((i) => [i.id, i]));
  const band0 = [];
  const band1 = [];
  const band2 = [];
  const band3 = [];
  for (const item of itens) {
    if (item.tribunal === "TST" && MAIN_TIPOS.includes(item.tipo)) band0.push({ band: 0, item, monIds: item.monitoramentoIds });
  }
  const pushTipoUnits = (fila, band, tribunal) => {
    for (const tipo of MAIN_TIPOS) {
      const item = byKey.get(`${tipo}|${tribunal}`);
      if (item) fila.push({ band, item, monIds: item.monitoramentoIds });
    }
  };
  for (const tribunal of ["STF", "STJ"]) pushTipoUnits(band1, 1, tribunal);
  for (const tribunal of TODOS_TRIBUNAIS) if (tribunal !== "TST" && tribunal !== "STF" && tribunal !== "STJ") pushTipoUnits(band2, 2, tribunal);
  for (const tribunal of TODOS_TRIBUNAIS) {
    const item = byKey.get(`processo|${tribunal}`);
    if (item) band3.push({ band: 3, item, monIds: item.monitoramentoIds });
  }
  const bands = [band0, band1, band2, band3];

  let totalNovas = 0, totalDescartadas = 0, totalDuplicatas = 0, totalErros = 0;
  let bandAtual = 0;
  const inBand = [0, 0, 0, 0];
  const pickNext = () => {
    while (bandAtual < bands.length) {
      if (bands[bandAtual].length > 0) return bands[bandAtual].shift();
      if (inBand[bandAtual] > 0) return null;
      bandAtual++;
    }
    return null;
  };

  await flushProgresso(true);
  log("paralela.pool", { vias: slots.length, totalItens: itens.length, bandas: { tst: band0.length, superiores: band1.length, outros: band2.length, processo: band3.length } });

  // === RETRY: refila falhas pendentes do mesmo dia BRT ===
  // Reprocessa (tribunal, monitoramento, dia) que falharam em execuções
  // anteriores antes de varrer a fila principal. Itens com tentativas >= 5
  // viram 'abandonado' automaticamente em recordFalha.
  try {
    const pendentes = await lerFalhasPendentes(sb, TIPO_ENGINE);
    if (pendentes.length > 0) {
      log("paralela.retry_pendentes", { qtd: pendentes.length });
      for (const f of pendentes) {
        if (cancelled || signal.aborted) break;
        const p = f.payload || {};
        const tribunal = p.tribunal;
        const monId = p.monitoramentoId;
        const dia = p.dia;
        const tipoMon = p.tipo;
        const mon = monId ? monsPorId.get(monId) : null;
        if (!tribunal || !mon || !dia || !tipoMon) {
          await marcarFalhaResolvida(sb, TIPO_ENGINE, f.item_key);
          continue;
        }
        const slot = slots[0];
        try {
          const fallbackSlots = slots.filter((s) => s && s.id !== slot.id);
          const pubs = await buscarTermo(slot, { ...mon, tipo: tipoMon }, dia, tribunal, signal, fallbackSlots, scanCache, sb);
          log("paralela.retry_result", { execucaoId: job?.id || null, monitoramentoId: mon.id, coordenacaoId: mon.coordenacao_id || null, tipo: tipoMon, tribunal, dia, encontrados: pubs.length });
          const stats = await persistPublicacoes(sb, pubs, { ...mon, tipo: tipoMon, __log: log }, tribunal, dia, job?.id || null);
          totalNovas += stats.novas;
          totalDescartadas += stats.descartadas;
          totalDuplicatas += stats.duplicatas;
          await marcarFalhaResolvida(sb, TIPO_ENGINE, f.item_key);
          log("paralela.retry_ok", { tribunal, monId, dia, novas: stats.novas });
        } catch (e) {
          await recordFalha(sb, {
            tipo: TIPO_ENGINE,
            execucaoId: job?.id || null,
            itemKey: f.item_key,
            payload: p,
            erro: e?.message || e,
          });
          log("paralela.retry_fail", { tribunal, monId, dia, e: String(e?.message || e).slice(0, 300) });
        }
        if (TERM_DELAY_MS > 0) await delay(TERM_DELAY_MS, signal);
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
    try {
      for (const monId of unit.monIds) {
        const mon = monsPorId.get(monId);
        if (!mon) continue;
        for (const dia of dias) {
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
            const fallbackSlots = slots.filter((s) => s && s.id !== slot.id);
            const pubs = await buscarTermo(slot, { ...mon, tipo: item.tipo }, dia, item.tribunal, signal, fallbackSlots, scanCache, sb);
            log("paralela.termo_result", { execucaoId: job?.id || null, monitoramentoId: mon.id, coordenacaoId: mon.coordenacao_id || null, tipo: item.tipo, tribunal: item.tribunal, dia, encontrados: pubs.length });
            const stats = await persistPublicacoes(sb, pubs, { ...mon, tipo: item.tipo, __log: log }, item.tribunal, dia, job?.id || null);
            log("paralela.termo_persist", { execucaoId: job?.id || null, monitoramentoId: mon.id, coordenacaoId: mon.coordenacao_id || null, tipo: item.tipo, tribunal: item.tribunal, dia, encontrados: pubs.length, ...stats });
            item.novas += stats.novas;
            item.descartadas += stats.descartadas;
            item.duplicatas += stats.duplicatas;
            // se havia falha pendente p/ este par, marca como resolvido
            await marcarFalhaResolvida(sb, TIPO_ENGINE, itemKeyFalha).catch(() => {});
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
          if (TERM_DELAY_MS > 0) await delay(TERM_DELAY_MS, signal);
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
    }
    log("paralela.worker_done", { via: slot.label || slot.url });
  };

  await Promise.all(slots.map((slot) => worker(slot)));
  clearInterval(cancelPoll);
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