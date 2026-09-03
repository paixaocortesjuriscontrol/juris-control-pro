// Engine Kurier no VPS: invoca a edge function kurier-consultar-publicacoes
// para CADA credencial ativa e mirroriza as inserções em publicacoes_djen_servidor.
// Reaproveita 100% da lógica existente (sem porte).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_LOTES = parseInt(process.env.KURIER_MAX_LOTES || "5", 10);
// Cada chamada à edge function processa poucos lotes: chamadas longas estouram o
// limite de recurso do worker da Supabase (HTTP 546 WORKER_RESOURCE_LIMIT).
const LOTES_POR_CHAMADA = Math.max(1, parseInt(process.env.KURIER_LOTES_POR_CHAMADA || "2", 10));
const MAX_CHAMADAS_POR_CRED = Math.max(1, parseInt(process.env.KURIER_MAX_CHAMADAS || "12", 10));
const PER_CRED_DELAY_MS = parseInt(process.env.KURIER_DELAY_MS || "1200", 10);
const { recordFalha, marcarFalhaResolvida, lerFalhasPendentes } = require("../falhasRefila");
const TIPO_ENGINE = "kurier_servidor";

async function invokeKurier(credencialId, maxLotes, loteSize) {
  const url = `${SUPABASE_URL}/functions/v1/kurier-consultar-publicacoes`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9 * 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ credencial_id: credencialId, max_lotes: maxLotes, lote_size: loteSize, persist_mode: "servidor" }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return { status: res.status, body };
  } finally {
    clearTimeout(to);
  }
}

// Drena a fila de uma credencial em várias chamadas curtas. Ao receber 546
// (estouro de recurso do worker) reduz o tamanho do lote pela metade e tenta de
// novo; só desiste se estourar já com 1 lote por chamada.
async function drenarCredencial(credencialId, log) {
  let lotesPorChamada = Math.max(1, Math.min(LOTES_POR_CHAMADA, MAX_LOTES));
  let novas = 0;
  let processadas = 0;
  let chamadas = 0;
  let ultimoStatus = 200;
  let loteSize = 25;

  while (chamadas < MAX_CHAMADAS_POR_CRED) {
    chamadas++;
    const { status, body } = await invokeKurier(credencialId, lotesPorChamada, loteSize);
    ultimoStatus = status;

    if (status === 546 || status === 503 || status === 504) {
      if (lotesPorChamada > 1) {
        lotesPorChamada = Math.max(1, Math.floor(lotesPorChamada / 2));
        log?.("kurier.reduz_lote", { credencial_id: credencialId, status, lotesPorChamada });
        continue;
      }
      if (loteSize > 10) {
        loteSize = 10;
        log?.("kurier.reduz_publicacoes", { credencial_id: credencialId, status, loteSize });
        continue;
      }
      throw new Error(`HTTP ${status}: limite de recurso da função mesmo com 1 lote`);
    }
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }

    novas += Number(body?.total_novas || body?.totalNovas || body?.inseridas || 0);
    processadas += Number(body?.total_recebidas || body?.totalProcessadas || body?.processadas || 0);

    if (body?.erro) throw new Error(String(body.erro).slice(0, 200));
    // Sem o indicador (função antiga) paramos após a primeira chamada bem-sucedida.
    if (body?.fila_vazia !== false) break;
    if (PER_CRED_DELAY_MS > 0) await new Promise((r) => setTimeout(r, PER_CRED_DELAY_MS));
  }

  return { status: ultimoStatus, novas, processadas, chamadas };
}


async function run({ sb, payload, log, job }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env do VPS");
  }

  const maxLotes = Number(payload?.max_lotes) || MAX_LOTES;
  const filtroCred = payload?.credencial_id || null;

  let q = sb
    .from("kurier_credenciais")
    .select("id, login, ativo, prioridade")
    .eq("ativo", true)
    .order("prioridade", { ascending: false });
  if (filtroCred) q = q.eq("id", filtroCred);

  const { data: creds, error } = await q;
  if (error) throw new Error(`load_credenciais: ${error.message}`);

  const results = [];
  let totalNovas = 0;
  let totalProcessadas = 0;

  // Reprocessa credenciais que falharam em rodadas anteriores do mesmo dia
  // antes da varredura normal.
  try {
    const pendentes = await lerFalhasPendentes(sb, TIPO_ENGINE);
    if (pendentes.length > 0) {
      log("kurier.retry_pendentes", { qtd: pendentes.length });
      for (const f of pendentes) {
        const credId = f.payload?.credencial_id;
        const cred = (creds || []).find((c) => c.id === credId);
        if (!credId || !cred) {
          await marcarFalhaResolvida(sb, TIPO_ENGINE, f.item_key);
          continue;
        }
        try {
          const { status, novas, processadas: proc, chamadas } = await drenarCredencial(credId, log);
          totalNovas += novas;
          totalProcessadas += proc;
          results.push({ credencial_id: credId, login: cred.login, status, novas, processadas: proc, chamadas, ok: true, retry: true });
          await marcarFalhaResolvida(sb, TIPO_ENGINE, f.item_key);
        } catch (e) {
          await recordFalha(sb, {
            tipo: TIPO_ENGINE,
            execucaoId: job?.id || null,
            itemKey: f.item_key,
            payload: f.payload,
            erro: e?.message || e,
          });
          results.push({ credencial_id: credId, login: cred.login, error: String(e.message || e), retry: true });
        }
        if (PER_CRED_DELAY_MS > 0) await new Promise((r) => setTimeout(r, PER_CRED_DELAY_MS));
      }
    }
  } catch (e) {
    log("kurier.retry_loop_error", { e: String(e?.message || e).slice(0, 300) });
  }

  for (const c of creds || []) {
    log("kurier.cred_start", { credencial_id: c.id, login: c.login });
    const itemKeyFalha = `kurier|${c.id}`;
    try {
      const { status, novas, processadas: proc, chamadas } = await drenarCredencial(c.id, log);
      totalNovas += novas;
      totalProcessadas += proc;
      results.push({ credencial_id: c.id, login: c.login, status, novas, processadas: proc, chamadas, ok: true });
      log("kurier.cred_done", { credencial_id: c.id, status, novas, processadas: proc, chamadas });
      await marcarFalhaResolvida(sb, TIPO_ENGINE, itemKeyFalha).catch(() => {});
    } catch (e) {
      results.push({ credencial_id: c.id, login: c.login, error: String(e.message || e) });
      log("kurier.cred_error", { credencial_id: c.id, e: String(e.message || e) });
      await recordFalha(sb, {
        tipo: TIPO_ENGINE,
        execucaoId: job?.id || null,
        itemKey: itemKeyFalha,
        payload: { credencial_id: c.id },
        erro: e?.message || e,
      }).catch(() => {});
    }
    if (PER_CRED_DELAY_MS > 0) await new Promise((r) => setTimeout(r, PER_CRED_DELAY_MS));
  }

  return {
    credenciaisProcessadas: results.length,
    totalNovas,
    totalProcessadas,
    detalhes: results,
  };
}

module.exports = { run };