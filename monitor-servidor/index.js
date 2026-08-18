require("dotenv").config({ path: __dirname + "/.env" });
const os = require("os");
// Encadeamos vários AbortSignal por rodada (orçamento por tribunal + cancelamento
// global), o que estoura o limite default de 10 listeners e polui o log.
try { require("events").setMaxListeners(100); } catch { /* noop */ }
const { makeSupabase } = require("./proxyPool");

const ENGINES = {
  djen_paralela_servidor: require("./engines/paralela"),
  kurier_servidor: require("./engines/kurier"),
  djet_pautas_servidor: require("./engines/pautas"),
  busca_publicacao_servidor: require("./engines/buscaProcessos"),
  djen_stf_servidor: require("./engines/stfServidor"),
};

const WORKER_BASE = process.env.WORKER_ID_BASE || "hostinger-01";
const POLL = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);
const HB = parseInt(process.env.HEARTBEAT_MS || "30000", 10);

const SLOTS = Object.keys(ENGINES).map((tipo) => ({
  worker_id: `${WORKER_BASE}-${tipo}`,
  tipos: [tipo],
}));

const sb = makeSupabase();
const log = (msg, extra = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

async function upsertWorker(worker_id, patch) {
  await sb
    .from("workers_servidor")
    .upsert(
      { worker_id, host: os.hostname(), heartbeat_at: new Date().toISOString(), ...patch },
      { onConflict: "worker_id" }
    );
}

async function runSlot(slot) {
  await upsertWorker(slot.worker_id, {
    status: "idle",
    current_tipo: null,
    current_execucao_id: null,
  });

  setInterval(() => {
    upsertWorker(slot.worker_id, {}).catch((e) => log("hb_error", { e: e.message }));
  }, HB);

  while (true) {
    try {
      const { data: job, error } = await sb.rpc("lease_proxima_execucao_servidor", {
        p_worker_id: slot.worker_id,
        p_tipos: slot.tipos,
      });
      if (error) {
        log("lease_error", { e: error.message });
        await new Promise((r) => setTimeout(r, POLL));
        continue;
      }
      if (!job || !job.id || !job.tipo) {
        await new Promise((r) => setTimeout(r, POLL));
        continue;
      }

      log("job_started", { id: job.id, tipo: job.tipo });
      await upsertWorker(slot.worker_id, {
        status: "busy",
        current_tipo: job.tipo,
        current_execucao_id: job.id,
      });

      const engine = ENGINES[job.tipo];
      if (!engine || typeof engine.run !== "function") {
        const msg = `Engine não encontrada para tipo: ${job.tipo}`;
        await sb
          .from("execucoes_servidor")
          .update({
            status: "erro",
            finalizado_em: new Date().toISOString(),
            erro: msg,
          })
          .eq("id", job.id);
        log("job_error", { id: job.id, tipo: job.tipo, e: msg });
        continue;
      }
      try {
        const resultado = await engine.run({ sb, payload: job.payload || {}, log, job });
        const statusFinal = resultado && resultado.cancelado ? "cancelado" : "concluido";
        await sb
          .from("execucoes_servidor")
          .update({
            status: statusFinal,
            finalizado_em: new Date().toISOString(),
            resultado,
          })
          .eq("id", job.id);
        log("job_done", { id: job.id, resultado });
      } catch (e) {
        await sb
          .from("execucoes_servidor")
          .update({
            status: "erro",
            finalizado_em: new Date().toISOString(),
            erro: String(e && e.stack ? e.stack : e),
          })
          .eq("id", job.id)
          .neq("status", "cancelado");
        log("job_error", { id: job.id, e: e.message });
      }

      await upsertWorker(slot.worker_id, {
        status: "idle",
        current_tipo: null,
        current_execucao_id: null,
      });
    } catch (e) {
      log("loop_error", { e: e.message });
      await new Promise((r) => setTimeout(r, POLL));
    }
  }
}

(async () => {
  log("boot", { slots: SLOTS.map((s) => s.worker_id), host: os.hostname() });
  await Promise.all(SLOTS.map(runSlot));
})();