// DJEN Servidor: replica a lógica do "DJEN Termos Paralela" no daemon Node.
// Não chama a edge monitorar-djen; cada worker usa uma VPS do djen_proxy_pool.

const { djenFetchSlot, loadPool } = require("../proxyPool");

const TODOS_CIVEIS = ["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"];
const TODOS_TRT = ["TST","TRT1","TRT2","TRT3","TRT4","TRT5","TRT6","TRT7","TRT8","TRT9","TRT10","TRT11","TRT12","TRT13","TRT14","TRT15","TRT16","TRT17","TRT18","TRT19","TRT20","TRT21","TRT22","TRT23","TRT24"];
const TODOS_TRIBUNAIS = [...TODOS_TRT, "STF", "STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", ...TODOS_CIVEIS];
const TIPO_ORDER = ["parte", "advogado", "palavra-chave", "processo"];
const MAIN_TIPOS = ["parte", "advogado", "palavra-chave"];
const PAGE_DELAY_MS = Math.max(0, Number(process.env.PARALELA_PAGE_DELAY_MS || 800));
const TERM_DELAY_MS = Math.max(0, Number(process.env.PARALELA_TERM_DELAY_MS || 1200));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapTipo(tipo) {
  return tipo === "nome" ? "palavra-chave" : (tipo || "palavra-chave");
}

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
  const v = obj?.id ?? pub?.id ?? pub?.id_djen ?? pub?.numeroComunicacao ?? pub?.numero_comunicacao ?? null;
  return v === null || v === undefined ? null : String(v).trim() || null;
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

function contemTermo(conteudo, mon) {
  const text = normalize(conteudo);
  const termos = [mon.termo_busca, ...(mon.termos_or || [])].map(normalize).filter(Boolean);
  if (termos.length === 0) return true;
  if (mon.tipo === "parte") return true;
  if (mon.oab && text.includes(String(mon.oab).replace(/\D/g, ""))) return true;
  return termos.some((t) => text.includes(t));
}

function shouldExclude(conteudo, mon, metadata) {
  const excs = Array.isArray(mon.exclusoes) ? mon.exclusoes : [];
  if (excs.length === 0) return false;
  const text = normalize([conteudo, JSON.stringify(metadata?.partes_json || []), JSON.stringify(metadata?.advogados_json || [])].join("\n"));
  return excs.some((e) => {
    const n = normalize(e);
    return n && text.includes(n);
  });
}

async function buscarPaginado(slot, params) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page < 1000; page++) {
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
      out = await djenFetchSlot(slot, query).catch((e) => {
        lastErr = e;
        return null;
      });
      if (out && out.status !== 429 && out.status < 500) break;
      await delay(out?.status === 429 ? 8000 * (attempt + 1) : 3000 * (attempt + 1));
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
    if (items.length === 0 || items.length < 50 || added === 0) break;
    if (typeof total === "number" && page * 50 >= total) break;
    if (PAGE_DELAY_MS > 0) await delay(PAGE_DELAY_MS);
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

async function buscarTermo(slot, mon, dia, tribunal) {
  const tipo = mapTipo(mon.tipo);
  if (tipo === "parte") {
    const results = [];
    for (const nomeParte of termosDeParte(mon)) {
      results.push(...await buscarPaginado(slot, { ...baseParams(mon, dia, tribunal), nomeParte }));
      if (TERM_DELAY_MS > 0) await delay(TERM_DELAY_MS);
    }
    return results;
  }
  return await buscarPaginado(slot, baseParams(mon, dia, tribunal));
}

async function persistPublicacoes(sb, pubs, mon, tribunal, dia, execucaoId) {
  const stats = { novas: 0, descartadas: 0, duplicatas: 0 };
  for (const pub of pubs) {
    const conteudo = getConteudo(pub);
    const metadata = metadataFromRaw(pub);
    if (!conteudo || !contemTermo(conteudo, mon) || shouldExclude(conteudo, mon, metadata)) {
      stats.descartadas++;
      continue;
    }
    const dataDisponibilizacao = getDataDisponibilizacao(pub, dia);
    const idDjen = getIdDjen(pub);
    const hashConteudo = generateHash(conteudo + dataDisponibilizacao);
    const coordenacaoId = mon.coordenacao_id || null;
    let exists = null;
    if (idDjen && coordenacaoId) {
      const { data } = await sb.from("publicacoes_djen_servidor").select("id").eq("coordenacao_id", coordenacaoId).eq("id_djen", idDjen).maybeSingle();
      exists = data || null;
    }
    if (!exists) {
      const { data } = coordenacaoId
        ? await sb.from("publicacoes_djen_servidor").select("id").eq("coordenacao_id", coordenacaoId).eq("hash_conteudo", hashConteudo).maybeSingle()
        : await sb.from("publicacoes_djen_servidor").select("id").eq("monitoramento_id", mon.id).eq("hash_conteudo", hashConteudo).maybeSingle();
      exists = data || null;
    }
    if (exists) {
      stats.duplicatas++;
      continue;
    }
    const { error } = await sb.from("publicacoes_djen_servidor").insert({
      monitoramento_id: mon.id,
      coordenacao_id: coordenacaoId,
      hash_conteudo: hashConteudo,
      id_djen: idDjen,
      conteudo,
      data_publicacao: nextBusinessDateYmd(dataDisponibilizacao),
      data_disponibilizacao: dataDisponibilizacao,
      processo_numero: extractProcesso(pub, conteudo),
      tribunal,
      ...metadata,
      origem: "servidor",
      execucao_id: execucaoId || null,
    });
    if (error) stats.descartadas++;
    else stats.novas++;
  }
  return stats;
}

async function run({ sb, payload, log, job }) {
  const dataInicio = payload?.dataInicio || payload?.diarioYmd || ymdToday();
  const dataFim = payload?.dataFim || payload?.diarioYmd || dataInicio;
  const coordenacaoId = payload?.coordenacaoId || null;
  const monitoramentoIdsFiltro = Array.isArray(payload?.monitoramentoIds) && payload.monitoramentoIds.length > 0 ? payload.monitoramentoIds : null;
  const dias = expandirDias(dataInicio, dataFim);

  log("paralela.start", { dataInicio, dataFim, dias: dias.length, coordenacaoId, monitoramentoIdsFiltro });

  let q = sb.from("monitoramentos_djen").select("id, descricao, termo_busca, termos_or, tipo, oab, uf, coordenacao_id, tribunais, exclusoes").eq("ativo", true);
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
      if (!grouped.has(key)) grouped.set(key, { tipo, tribunal, monitoramentos: [] });
      grouped.get(key).monitoramentos.push(m);
    }
  }

  const itens = Array.from(grouped.values()).sort((a, b) => {
    const ta = TODOS_TRIBUNAIS.indexOf(a.tribunal);
    const tb = TODOS_TRIBUNAIS.indexOf(b.tribunal);
    return (ta - tb) || (TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo));
  }).map((g) => ({
    id: `${g.tipo}|${g.tribunal}`,
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
    const concluidos = itens.filter((i) => i.status === "concluido" || i.status === "erro").length;
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

  const isCancelled = async () => {
    if (!job?.id) return false;
    const { data } = await sb.from("execucoes_servidor").select("status").eq("id", job.id).maybeSingle();
    return data?.status === "cancelado";
  };

  const slots = await loadPool(sb);
  if (slots.length === 0) throw new Error("Nenhuma VPS ativa em djen_proxy_pool. O DJEN Servidor não roda sem VPS.");

  const byKey = new Map(itens.map((i) => [i.id, i]));
  const band0 = [];
  const band1 = [];
  const band2 = [];
  const band3 = [];
  for (const tipo of MAIN_TIPOS) {
    const item = byKey.get(`${tipo}|TST`);
    if (item) for (const monId of item.monitoramentoIds) band0.push({ band: 0, item, monIds: [monId] });
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
  let cancelled = false;
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
          if (cancelled || (await isCancelled())) { cancelled = true; return; }
          item.mensagem = `${item.tribunal} ${dia}: ${item.current}/${item.total} via ${item.via.label}`;
          const pubs = await buscarTermo(slot, { ...mon, tipo: item.tipo }, dia, item.tribunal);
          const stats = await persistPublicacoes(sb, pubs, mon, item.tribunal, dia, job?.id || null);
          item.novas += stats.novas;
          item.descartadas += stats.descartadas;
          item.duplicatas += stats.duplicatas;
          item.current += 1;
          await flushProgresso();
          if (TERM_DELAY_MS > 0) await delay(TERM_DELAY_MS);
        }
      }
      if (item.current >= item.total) {
        item.status = "concluido";
        item.mensagem = `Concluído: ${item.novas} novas, ${item.duplicatas} duplicadas, ${item.descartadas} descartadas`;
        totalNovas += item.novas;
        totalDescartadas += item.descartadas;
        totalDuplicatas += item.duplicatas;
      }
    } catch (e) {
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
  if (cancelled) log("paralela.cancelled", { remaining: itens.filter((i) => i.status === "pendente").length });
  await flushProgresso(true);
  log("paralela.done", { monitoramentos: itens.length, novas: totalNovas, descartadas: totalDescartadas, duplicatas: totalDuplicatas, erros: totalErros });

  return { novas: totalNovas, descartadas: totalDescartadas, duplicatas: totalDuplicatas, erros: totalErros, monitoramentos: itens.length, dataInicio, dataFim, vps: slots.length };
}

module.exports = { run };