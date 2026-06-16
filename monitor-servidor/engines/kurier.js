// Engine Kurier no VPS: invoca a edge function kurier-consultar-publicacoes
// para CADA credencial ativa e mirroriza as inserções em publicacoes_djen_servidor.
// Reaproveita 100% da lógica existente (sem porte).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_LOTES = parseInt(process.env.KURIER_MAX_LOTES || "5", 10);
const PER_CRED_DELAY_MS = parseInt(process.env.KURIER_DELAY_MS || "1200", 10);

async function invokeKurier(credencialId, maxLotes) {
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
      body: JSON.stringify({ credencial_id: credencialId, max_lotes: maxLotes, persist_mode: "servidor" }),
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

async function run({ sb, payload, log }) {
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

  for (const c of creds || []) {
    log("kurier.cred_start", { credencial_id: c.id, login: c.login });
    try {
      const { status, body } = await invokeKurier(c.id, maxLotes);
      const novas = Number(body?.totalNovas || body?.inseridas || 0);
      const proc = Number(body?.totalProcessadas || body?.processadas || 0);
      totalNovas += novas;
      totalProcessadas += proc;
      results.push({ credencial_id: c.id, login: c.login, status, novas, processadas: proc, ok: status >= 200 && status < 300 });
      log("kurier.cred_done", { credencial_id: c.id, status, novas, processadas: proc });
    } catch (e) {
      results.push({ credencial_id: c.id, login: c.login, error: String(e.message || e) });
      log("kurier.cred_error", { credencial_id: c.id, e: String(e.message || e) });
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