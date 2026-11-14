import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoCompromisso, cnjDoTexto } from "./compromissosProjuris";

test("tipo vem da primeira coluna", () => {
  assert.equal(tipoCompromisso("AUDIÊNCIA"), "audiencia");
  assert.equal(tipoCompromisso("TAREFA"), "tarefa");
  assert.equal(tipoCompromisso("EVENTO"), "evento");
  assert.equal(tipoCompromisso("PRAZO X"), null);
});
test("extrai o processo da observação", () => {
  assert.equal(cnjDoTexto("16/11/2026\t10:00\t0001770-32.2026.5.18.0053\tANÁPOLIS"), "00017703220265180053");
  assert.equal(cnjDoTexto("sem número"), null);
});
