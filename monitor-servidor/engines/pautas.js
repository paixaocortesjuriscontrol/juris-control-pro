// Engine DJET Pautas no VPS: invoca a edge function executar-djet-pautas-agendado.
// Como o dispatcher do servidor já aplica a janela de horário, passamos force=true
// para evitar duplo gating quando o job é enfileirado dentro da janela.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEOUT_MS = parseInt(process.env.PAUTAS_TIMEOUT_MS || "1500000", 10); // 25min
const { recordFalha, marcarFalhaResolvida, lerFalhasPendentes } = require("../falhasRefila");
const TIPO_ENGINE = "djet_pautas_servidor";

async function invokePautas(body) {
  const url = `${SUPABASE_URL}/functions/v1/executar-djet-pautas-agendado`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(to);
  }
}

async function run({ payload, log, job }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env do VPS");
  }
  log("pautas.start", { payload });
  const force = payload?.force !== false; // default true
  const itemKeyFalha = `pautas|run`;
  const reqBody = {
    force,
    persist_mode: "servidor",
    execucaoServidorId: job?.id,
    dataInicio: payload?.dataInicio,
    dataFim: payload?.dataFim,
  };
  try {
    // Drena falha pendente do dia (se houver) antes de marcar essa execução
    // como sucesso. Como pautas é um único job global, basta uma marcação.
    const pendentes = await lerFalhasPendentes(require("./pautas") && undefined && undefined, TIPO_ENGINE).catch(() => []);
    if (Array.isArray(pendentes) && pendentes.length > 0) {
      log("pautas.retry_pendentes", { qtd: pendentes.length });
    }
  } catch {}
  let resp;
  try {
    resp = await invokePautas(reqBody);
  } catch (e) {
    // network/timeout — registra para refila
    try {
      const sb = require("../proxyPool").makeSupabase();
      await recordFalha(sb, {
        tipo: TIPO_ENGINE,
        execucaoId: job?.id || null,
        itemKey: itemKeyFalha,
        payload: reqBody,
        erro: e?.message || e,
      });
    } catch {}
    throw e;
  }
  const { status, body } = resp;
  if (status < 200 || status >= 300) {
    try {
      const sb = require("../proxyPool").makeSupabase();
      await recordFalha(sb, {
        tipo: TIPO_ENGINE,
        execucaoId: job?.id || null,
        itemKey: itemKeyFalha,
        payload: reqBody,
        erro: `HTTP ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      });
    } catch {}
    throw new Error(`executar-djet-pautas-agendado status ${status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  try {
    const sb = require("../proxyPool").makeSupabase();
    await marcarFalhaResolvida(sb, TIPO_ENGINE, itemKeyFalha);
  } catch {}
  log("pautas.done", { status, body });
  return { status, ...body };
}

module.exports = { run };
