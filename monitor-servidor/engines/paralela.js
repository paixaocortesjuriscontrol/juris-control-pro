// Stub do engine "DJEN Termos Paralela" no servidor.
// FASE 1: arquitetura + heartbeat + lease. A lógica real será portada de
// useDjenTermosParalelaEngine.ts em PR separado, mantendo este shape:
//   run({ sb, payload, log }) -> { totalEncontradas, totalNovas, detalhes }
async function run({ sb, payload, log }) {
  log("paralela.run iniciado", { payload });
  await new Promise((r) => setTimeout(r, 1500));
  return { totalEncontradas: 0, totalNovas: 0, detalhes: "stub" };
}
module.exports = { run };