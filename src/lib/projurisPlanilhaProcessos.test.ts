import { test } from "node:test";
import { strict as assert } from "node:assert";
import { complementosPlanilhaProcessos, fontesPlanilhaProcessos, normalizarSistemaJudicial } from "./projurisPlanilhaProcessos";

test("ajusta grafias do Sistema Judicial à lista", () => {
  assert.equal(normalizarSistemaJudicial("Portal do Adv"), "Portal do Advogado");
  assert.equal(normalizarSistemaJudicial("Jpe"), "JPE");
  assert.equal(normalizarSistemaJudicial("ESAJ"), "Esaj");
});

test("usa Sistema quando Sistema Judicial está vazio", () => {
  assert.equal(complementosPlanilhaProcessos({ "Sistema Judicial": "", Sistema: "PROJUDI" }).sistema, "Projudi");
});

test("converte data, valores, UF e segredo", () => {
  const c = complementosPlanilhaProcessos({ "Data distribuição": new Date(2024, 11, 5), "Valor ação": 2640, "Valor provisionado": 0, Estado: "São Paulo", "Segredo de justiça": "Sim" });
  assert.equal(c.data_distribuicao, "2024-12-05");
  assert.equal(c.valor_causa, 2640);
  assert.equal(c.uf, "SP");
  assert.equal(c.segredo_justica, true);
  assert.equal(c.valor_provisionado, undefined);
});

test("ignora CNJ repetido com dados diferentes", () => {
  const cnj = "0005964-51.2023.8.01.0070";
  const r = fontesPlanilhaProcessos([{ "Número CNJ": cnj, Assunto: "A" }, { "Número CNJ": cnj, Assunto: "B" }, { "Número CNJ": "" }]);
  assert.equal(r.fontes.length, 0);
  assert.equal(r.ambiguos, 1);
  assert.equal(r.semCnj, 1);
});
