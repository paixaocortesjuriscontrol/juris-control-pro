import { test } from "node:test";
import { strict as assert } from "node:assert";
import { agregarVinculos } from "./agregarVinculosUsuarios";

const a = agregarVinculos([
  { processo_id: "p1", usuario_id: "u", coordenacao_id: "c1", papel: "responsavel" },
  { processo_id: "p1", usuario_id: "u", coordenacao_id: "c1", papel: "Responsável" },
  { processo_id: "p2", usuario_id: "u", coordenacao_id: "c2", papel: "apoio" },
  { processo_id: "p1", usuario_id: "u", coordenacao_id: "c2", papel: "supervisor" },
]);
test("conta processos distintos por papel", () => {
  assert.deepEqual(a.geral("u"), { responsavel: 1, envolvido: 2, total: 2 });
});
test("separa por coordenação", () => {
  assert.deepEqual(a.coord("u", "c1"), { responsavel: 1, envolvido: 0, total: 1 });
  assert.deepEqual(a.coord("u", "c2"), { responsavel: 0, envolvido: 2, total: 2 });
});
