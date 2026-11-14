import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoWorkflow, chaveWorkflow } from "./tarefasWorkflowProjuris";

test("tipo vem da CLASSIFICAÇÃO", () => {
  assert.equal(tipoWorkflow("PRAZO"), "prazo");
  assert.equal(tipoWorkflow("TAREFA"), "tarefa");
  assert.equal(tipoWorkflow(""), null);
});
test("chave ignora formatação do número e caixa do título", () => {
  assert.equal(chaveWorkflow("4002346-55.2026.8.26.0126", "Comprovação de OF", "2026-11-17"), chaveWorkflow("40023465520268260126", "COMPROVAÇÃO DE OF", "2026-11-17"));
  assert.notEqual(chaveWorkflow("40023465520268260126", "X", "2026-11-17"), chaveWorkflow("40023465520268260126", "X", "2026-11-18"));
});
