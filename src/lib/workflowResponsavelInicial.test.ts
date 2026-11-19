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

const b = { id: "e" } as any;
test("etapa seguinte: pessoa fixa do modelo continua valendo", () => {
  assert.equal(resolverResponsavelEtapa({ ...b, regra_responsavel: "predefinido", responsavel_id: "fixo" }, { concluidoPor: "ana" }), "fixo");
});
test("etapa seguinte com regra 'Etapa anterior' fica com quem concluiu", () => {
  assert.equal(resolverResponsavelEtapa({ ...b, regra_responsavel: "etapa_anterior" }, { concluidoPor: "ana", responsavelAnterior: "bia" }), "ana");
});
test("etapa seguinte com regra 'Quem iniciou' fica com quem concluiu", () => {
  assert.equal(resolverResponsavelEtapa({ ...b, regra_responsavel: "iniciador" }, { concluidoPor: "ana", iniciadorId: "lis" }), "ana");
});
