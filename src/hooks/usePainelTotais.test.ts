import { test } from "node:test";
import assert from "node:assert/strict";
import { parametrosPainelTotais } from "./usePainelTotais";

test("coordenação única vira lista e datas vão em AAAA-MM-DD", () => {
  const p = parametrosPainelTotais({
    coordenacaoId: "c1", dataInicio: new Date(2026, 9, 1), dataFim: new Date(2026, 9, 31, 23, 59),
  });
  assert.deepEqual(p.coordenacaoIds, ["c1"]);
  assert.equal(p.dataInicio, "2026-10-01");
  assert.equal(p.dataFim, "2026-10-31");
});

test("lista de coordenações tem prioridade", () => {
  assert.deepEqual(parametrosPainelTotais({ coordenacaoId: "c1", coordenacaoIds: ["a", "b"] }).coordenacaoIds, ["a", "b"]);
});
