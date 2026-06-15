async function run({ sb, payload, log }) {
  log("pautas.run iniciado", { payload });
  await new Promise((r) => setTimeout(r, 1500));
  return { totalEncontradas: 0, totalNovas: 0, detalhes: "stub" };
}
module.exports = { run };