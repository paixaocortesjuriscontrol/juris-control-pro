import { test } from "node:test";
import { strict as assert } from "node:assert";
import { analisarRepasse, aplicarSubstituicao } from "./substituirResponsaveis";

test("com substituir, Bia para Fernanda deixa só Fernanda responsável", () => {
  const a = analisarRepasse({ originalResp: ["bia"], originalEnv: [], resp: ["bia"], env: ["fernanda"] });
  assert.equal(a.perguntar, true);
  assert.deepEqual(aplicarSubstituicao(["bia"], ["fernanda"], a.novasPessoas, a.anteriores), { resp: ["fernanda"], env: [] });
});
test("sem substituir, Bia continua e Fernanda é nova", () => {
  const a = analisarRepasse({ originalResp: ["bia"], originalEnv: [], resp: ["bia", "fernanda"], env: [] });
  assert.deepEqual(a.novasPessoas, ["fernanda"]);
  assert.deepEqual(a.anteriores, ["bia"]);
});
test("coordenador fixo não é removido", () => {
  const a = analisarRepasse({ originalResp: ["coord", "bia"], originalEnv: [], resp: ["coord", "bia", "fernanda"], env: [], fixos: ["coord"] });
  assert.deepEqual(aplicarSubstituicao(["coord", "bia", "fernanda"], [], a.novasPessoas, a.anteriores).resp.sort(), ["coord", "fernanda"]);
});
test("sem pessoa nova não pergunta", () => {
  assert.equal(analisarRepasse({ originalResp: ["bia"], originalEnv: ["x"], resp: ["bia"], env: ["x"] }).perguntar, false);
});
