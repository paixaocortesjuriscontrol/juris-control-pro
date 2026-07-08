// Busca Publicação (Admin TST): motor servidor dedicado.
// Roda no mesmo daemon do DJEN Termos Servidor, mas com TIPO_ENGINE próprio,
// nova tabela de resultados e sem tocar em `paralela.js`. Reusa apenas
// infraestrutura genérica (proxyPool -> djenFetch) para chamar a API PJE
// Comunica por número de processo em uma lista de tribunais e período.

const { djenFetchSlot, loadPool } = require("../proxyPool");

const TIPO_ENGINE = "busca_publicacao_servidor";
const ENGINE_VERSION = "2026-07-08-busca-publicacao-v2-parallel";

const PAGE_DELAY_MS = Math.max(0, Number(process.env.BUSCA_PUBL_PAGE_DELAY_MS || 300));
const TASK_DELAY_MS = Math.max(0, Number(process.env.BUSCA_PUBL_TASK_DELAY_MS || 100));
const PROGRESS_EVERY_MS = Math.max(500, Number(process.env.BUSCA_PUBL_PROGRESS_MS || 1500));
const INSERT_BATCH = 200;
const MAX_ITENS_LOG = 200;

const delay = (ms, signal) => new Promise((resolve) => {
  if (!ms || ms <= 0 || signal?.aborted) return resolve();
  const t = setTimeout(done, ms);
  function done() {
    clearTimeout(t);
    signal?.removeEventListener?.("abort", done);
    resolve();
  }
  signal?.addEventListener?.("abort", done, { once: true });
});

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.comunicacoes || data.items || data.results || data.content || [];
}

function rawObj(pub) {
  return (pub && typeof pub === "object") ? pub : {};
}

function getIdDjen(pub) {
  const obj = rawObj(pub);
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const cands = [obj.id_djen, obj.id, obj.codigoComunicacao, obj.codigo_comunicacao, obj.idComunicacao, obj.id_comunicacao];
  for (const c of cands) {
    if (c === null || c === undefined) continue;
    const v = String(c).trim();
    if (!v || isUuid(v)) continue;
    return v;
  }
  return null;
}

function getDataDisponibilizacao(pub) {
  const o = rawObj(pub);
  return o.dataDisponibilizacao || o.data_disponibilizacao || o.dataDJe || o.dtDisponibilizacao || null;
}

function getConteudo(pub) {
  const o = rawObj(pub);
  return String(o.conteudo || o.texto || o.teor || o.descricao || "");
}

function nextBusinessYmd(ymd) {
  if (!ymd) return null;
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function normalizarDispBrt(dispRaw) {
  if (!dispRaw) return null;
  const ymd = String(dispRaw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return `${ymd}T15:00:00.000Z`;
}

function hashConteudo(processoDig, disp, conteudo) {
  const base = `${processoDig}|${disp || ""}|${(conteudo || "").slice(0, 300)}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = ((h << 5) - h + base.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(36)}`;
}

async function buscarPaginado(slot, params, signal) {
  const all = [];
  const seen = new Set();
  const EMPTY_STREAK_LIMIT = 2;
  const NO_NEW_STREAK_LIMIT = 3;
  const FAIL_STREAK_LIMIT = 3;
  let emptyStreak = 0;
  let noNewStreak = 0;
  let failStreak = 0;

  for (let page = 0; page < 500; page++) {
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
      out = await djenFetchSlot(slot, query, signal).catch((e) => { lastErr = e; return null; });
      if (out && out.status !== 429 && out.status < 500) break;
      await delay(out?.status === 429 ? 8000 * (attempt + 1) : 3000 * (attempt + 1), signal);
    }
    if (!out || out.status === 404 || out.status < 200 || out.status >= 300) {
      failStreak += 1;
      if (failStreak >= FAIL_STREAK_LIMIT) {
        if (!out) throw lastErr || new Error("Falha ao consultar VPS DJEN");
        if (out.status === 404) break;
        throw new Error(`HTTP ${out.status}`);
      }
      if (PAGE_DELAY_MS > 0) await delay(PAGE_DELAY_MS, signal);
      continue;
    }
    failStreak = 0;
    const data = typeof out.body === "string" ? JSON.parse(out.body) : out.body;
    const items = extractItems(data);
    let added = 0;
    for (const it of items) {
      const id = getIdDjen(it);
      const key = id ? `id:${id}` : JSON.stringify(it).slice(0, 400);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(it);
      added++;
    }
    if (items.length === 0) {
      emptyStreak += 1;
      if (emptyStreak >= EMPTY_STREAK_LIMIT) break;
    } else if (added === 0) {
      emptyStreak = 0;
      noNewStreak += 1;
      if (noNewStreak >= NO_NEW_STREAK_LIMIT) break;
    } else {
      emptyStreak = 0;
      noNewStreak = 0;
    }
    if (PAGE_DELAY_MS > 0) await delay(PAGE_DELAY_MS, signal);
  }
  return all;
}

async function run({ sb, payload, log, job }) {
  const execucaoId = job.id;
  const abort = new AbortController();
  const signal = abort.signal;

  const processos = Array.isArray(payload?.processos) ? payload.processos : [];
  const tribunais = Array.isArray(payload?.tribunais) ? payload.tribunais.filter(Boolean) : [];
  const dataInicio = String(payload?.dataInicio || "").slice(0, 10);
  const dataFim = String(payload?.dataFim || dataInicio || "").slice(0, 10);

  if (!processos.length || !tribunais.length || !dataInicio || !dataFim) {
    return { ok: false, engine: TIPO_ENGINE, version: ENGINE_VERSION, motivo: "payload_invalido" };
  }

  const slots = await loadPool(sb);
  if (!slots || slots.length === 0) {
    return { ok: false, engine: TIPO_ENGINE, version: ENGINE_VERSION, motivo: "sem_vps_ativas" };
  }

  // Polling leve para cancelamento (status='cancelado' na execucoes_servidor)
  const cancelChecker = setInterval(async () => {
    try {
      const { data } = await sb
        .from("execucoes_servidor")
        .select("status")
        .eq("id", execucaoId)
        .maybeSingle();
      if (data && data.status === "cancelado") abort.abort();
    } catch { /* ignore */ }
  }, 5000);

  const totalProcessos = processos.length;
  const totalTribunais = tribunais.length;
  const totalTarefas = totalProcessos * totalTribunais;
  let tarefasFeitas = 0;
  let processados = 0;
  let totalPublicacoes = 0;
  let erros = 0;
  const bufferInsert = [];
  const itensLog = []; // últimos eventos concluídos por (proc,tribunal)
  const atualPorVia = new Map(); // slot.label -> { processo, tribunal, iniciado_em }
  // Contador por processo (quantos tribunais restam) para marcar processados
  const restanteProc = new Map();
  for (const p of processos) {
    restanteProc.set(String(p?.processo_digitos || ""), totalTribunais);
  }

  const flushBuffer = async () => {
    if (bufferInsert.length === 0) return;
    const batch = bufferInsert.splice(0, bufferInsert.length);
    const { error } = await sb
      .from("buscas_publicacao_resultados")
      .upsert(batch, { onConflict: "execucao_id,processo_digitos,dedupe_key", ignoreDuplicates: true });
    if (error) log("busca_publicacao_insert_error", { e: error.message, batch_size: batch.length });
  };

  const atualizarProgresso = async (extra = {}) => {
    const vias = Array.from(atualPorVia.entries()).map(([label, v]) => ({ label, ...v }));
    const progresso = {
      engine: TIPO_ENGINE,
      version: ENGINE_VERSION,
      total_processos: totalProcessos,
      processados,
      total_publicacoes: totalPublicacoes,
      tribunais_count: totalTribunais,
      total_tarefas: totalTarefas,
      tarefas_feitas: tarefasFeitas,
      erros,
      vps_ativas: slots.length,
      vias,
      itens: itensLog.slice(-MAX_ITENS_LOG),
      data_inicio: dataInicio,
      data_fim: dataFim,
      ...extra,
    };
    await sb
      .from("execucoes_servidor")
      .update({
        progresso,
        progresso_atualizado_em: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", execucaoId);
  };

  await atualizarProgresso();
  // Throttle de progresso para não sobrecarregar o postgres
  let lastProgressAt = 0;
  const marcarProgressoTalvez = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastProgressAt < PROGRESS_EVERY_MS) return;
    lastProgressAt = now;
    await atualizarProgresso();
  };

  // Fila de tarefas (processo × tribunal)
  const fila = [];
  for (const proc of processos) {
    const digitos = String(proc?.processo_digitos || "").replace(/\D/g, "");
    const original = String(proc?.processo_original || proc?.processo || digitos || "");
    if (!digitos) {
      // Já contabiliza como processado; nada para pesquisar.
      processados++;
      tarefasFeitas += totalTribunais;
      restanteProc.delete("");
      continue;
    }
    for (const tribunal of tribunais) {
      fila.push({ digitos, original, tribunal });
    }
  }

  let cursor = 0;
  const nextTask = () => (cursor < fila.length ? fila[cursor++] : null);

  try {
    // Um worker por VPS ativa
    const worker = async (slot) => {
      const via = slot.label || slot.id;
      while (!signal.aborted) {
        const task = nextTask();
        if (!task) break;
        const { digitos, original, tribunal } = task;
        atualPorVia.set(via, { processo: original, tribunal, iniciado_em: new Date().toISOString() });
        const params = {
          numeroProcesso: digitos,
          siglaTribunal: tribunal,
          dataDisponibilizacaoInicio: dataInicio,
          dataDisponibilizacaoFim: dataFim,
        };
        let items = [];
        let taskStatus = "concluido";
        let taskErro = null;
        try {
          items = await buscarPaginado(slot, params, signal);
        } catch (e) {
          taskStatus = "erro";
          taskErro = e.message;
          erros += 1;
          log("busca_publicacao_page_error", { processo: digitos, tribunal, via, e: e.message });
        }
        let novasNesta = 0;
        for (const it of items) {
          const idDjen = getIdDjen(it);
          const dispRaw = getDataDisponibilizacao(it);
          const dispTs = normalizarDispBrt(dispRaw);
          const conteudo = getConteudo(it);
          const dedupe = idDjen ? `id:${idDjen}` : hashConteudo(digitos, dispRaw, conteudo);
          const dataPubl = dispRaw ? nextBusinessYmd(dispRaw) : null;
          const o = rawObj(it);
          bufferInsert.push({
            execucao_id: execucaoId,
            processo_original: original,
            processo_digitos: digitos,
            id_djen: idDjen,
            tribunal: String(o.siglaTribunal || o.sigla_tribunal || tribunal || "").toUpperCase(),
            data_disponibilizacao: dispTs,
            data_publicacao: dataPubl,
            orgao: o.nomeOrgao || o.orgao || null,
            tipo_comunicacao: o.tipoComunicacao || o.tipo_comunicacao || null,
            conteudo,
            raw_json: it,
            dedupe_key: dedupe,
          });
          totalPublicacoes++;
          novasNesta++;
          if (bufferInsert.length >= INSERT_BATCH) await flushBuffer();
        }
        tarefasFeitas += 1;
        const restantes = (restanteProc.get(digitos) || 0) - 1;
        restanteProc.set(digitos, restantes);
        if (restantes <= 0) processados += 1;
        itensLog.push({
          id: `${digitos}-${tribunal}-${Date.now()}`,
          label: `${original} · ${tribunal}`,
          via,
          status: taskStatus,
          novas: novasNesta,
          mensagem: taskErro,
        });
        if (itensLog.length > MAX_ITENS_LOG) itensLog.splice(0, itensLog.length - MAX_ITENS_LOG);
        await marcarProgressoTalvez();
        if (TASK_DELAY_MS > 0) await delay(TASK_DELAY_MS, signal);
      }
      atualPorVia.delete(via);
    };

    await Promise.all(slots.map((s) => worker(s)));

    await flushBuffer();
    await atualizarProgresso();

    return {
      ok: true,
      engine: TIPO_ENGINE,
      version: ENGINE_VERSION,
      total_processos: totalProcessos,
      processados,
      total_publicacoes: totalPublicacoes,
      erros,
      vps_utilizadas: slots.length,
      cancelado: signal.aborted,
    };
  } finally {
    clearInterval(cancelChecker);
  }
}

module.exports = { run, TIPO_ENGINE, ENGINE_VERSION };