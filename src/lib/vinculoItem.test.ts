import { test } from "node:test";
import { strict as assert } from "node:assert";
import { itemSemProcessoEPublicacao } from "./vinculoItem";

test("item sem processo e sem publicação entra no filtro", () => {
  assert.equal(itemSemProcessoEPublicacao({ processo_id: null }, false), true);
});

test("item com processo não entra mesmo sem publicação", () => {
  assert.equal(itemSemProcessoEPublicacao({ processo_id: "proc-1" }, false), false);
});

test("item sem processo com publicação vinculada não entra", () => {
  assert.equal(itemSemProcessoEPublicacao({ processo_id: null }, true), false);
});

test("processo aninhado também conta como vínculo", () => {
  assert.equal(itemSemProcessoEPublicacao({ processo: { id: "proc-2" } }), false);
});

test("data da publicação de origem conta como vínculo", () => {
  assert.equal(itemSemProcessoEPublicacao({ data_publicacao_origem: "2026-11-11" }), false);
});
