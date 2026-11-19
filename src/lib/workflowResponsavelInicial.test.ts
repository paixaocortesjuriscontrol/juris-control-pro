import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolverResponsavelEtapa } from "./workflowExecutor";
const etapa = { regra_responsavel: "iniciador" } as any;
test("ao iniciar, a pessoa escolhida vence a regra 'quem iniciou'", () => {
  assert.equal(resolverResponsavelEtapa(etapa, { iniciadorId: "lis", responsavelInicial: "sanny", inicioDoFluxo: true }), "sanny");
});
test("sem escolha, fica com quem iniciou", () => {
  assert.equal(resolverResponsavelEtapa(etapa, { iniciadorId: "lis", inicioDoFluxo: true }), "lis");
});
