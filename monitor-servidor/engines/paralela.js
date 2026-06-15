// Engine DJEN Paralela no VPS: invoca a edge function monitorar-djen.
// Reaproveita 100% da lógica existente; resultado agregado vai para
// execucoes_servidor.resultado.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEOUT_MS = parseInt(process.env.PARALELA_TIMEOUT_MS || "1500000", 10); // 25min

async function invokeDjen(body) {
  const url = `${SUPABASE_URL}/functions/v1/monitorar-djen`;
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

async function run({ payload, log }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env do VPS");
  }
  log("paralela.start", { payload });
  const { status, body } = await invokeDjen({
    diarioYmd: payload?.diarioYmd,
    execucaoId: payload?.execucaoId,
  });
  if (status < 200 || status >= 300) {
    throw new Error(`monitorar-djen status ${status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  log("paralela.done", { status, body });
  return {
    status,
    novas: body?.novas ?? 0,
    descartadas: body?.descartadas ?? 0,
    duplicatas: body?.duplicatas ?? 0,
    monitoramentos: body?.monitoramentos ?? 0,
  };
}

module.exports = { run };
