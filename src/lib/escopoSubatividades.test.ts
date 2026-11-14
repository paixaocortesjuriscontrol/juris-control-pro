import { test } from "node:test";
import { strict as assert } from "node:assert";
import { subatividadeNaCoordenacao } from "./escopoSubatividades";

test("subatividade de outra coordenação não aparece na coordenação filtrada", () => {
  assert.equal(subatividadeNaCoordenacao("santander", "gol"), false);
  assert.equal(subatividadeNaCoordenacao("santander", "santander"), true);
  assert.equal(subatividadeNaCoordenacao("santander", undefined), false);
  assert.equal(subatividadeNaCoordenacao("todas", "gol"), true);
});
