import { test } from "node:test";
import { strict as assert } from "node:assert";
import { selecionarExecucoesExcel } from "./workflowsResponsabilidade";
const ex = [
  { id: "1", workflow_id: "A", iniciado_por: "x" },
  { id: "2", workflow_id: "B", iniciado_por: "eu" },
  { id: "3", workflow_id: "C", iniciado_por: "x" },
  { id: "1", workflow_id: "A", iniciado_por: "x" },
];
test("inclui workflows listados e os iniciados pela pessoa, sem repetir", () => {
  assert.deepEqual(selecionarExecucoesExcel(ex, ["A"], "eu").map((e) => e.id), ["1", "2"]);
});
test("com filtro de busca/papel, não inclui as iniciadas de fora da lista", () => {
  assert.deepEqual(selecionarExecucoesExcel(ex, ["A"], "eu", false).map((e) => e.id), ["1"]);
});
