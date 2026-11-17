import { test } from "node:test";
import { strict as assert } from "node:assert";
import { escolherCoordenacaoProcesso } from "./coordenacaoDoUsuarioNoProcesso";

test("usa a coordenação do usuário quando o processo está em duas", () => {
  assert.equal(escolherCoordenacaoProcesso("santander", ["santander", "beatriz"], ["beatriz"]), "beatriz");
});
test("usa a principal quando o usuário não está em nenhuma", () => {
  assert.equal(escolherCoordenacaoProcesso("santander", ["beatriz"], ["gol"]), "santander");
});
