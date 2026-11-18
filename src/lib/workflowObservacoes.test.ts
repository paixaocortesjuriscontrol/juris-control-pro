import { test } from "node:test";
import { strict as assert } from "node:assert";
import { juntarObservacoesWorkflow } from "./workflowExecutor";
test("usa a observação do início quando a etapa não tem", () => {
  assert.equal(juntarObservacoesWorkflow(null, "tj 25/11"), "tj 25/11");
});
test("junta observação do início e da etapa", () => {
  assert.equal(juntarObservacoesWorkflow("da etapa", "do início"), "do início\n\nda etapa");
});
test("não duplica", () => {
  assert.equal(juntarObservacoesWorkflow("docs para pericia oulier", "docs para pericia"), "docs para pericia oulier");
});
