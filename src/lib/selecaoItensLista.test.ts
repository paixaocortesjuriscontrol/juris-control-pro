import { test } from "node:test";
import { strict as assert } from "node:assert";
import { podeSelecionarItemLista } from "./selecaoItensLista";

test("evento pode ser selecionado para conclusão em lote", () => {
  assert.equal(podeSelecionarItemLista({ id: "evento-1", tipo: "evento", origem: "evento" }), true);
});

test("ocorrência de evento recorrente pode ser selecionada", () => {
  assert.equal(podeSelecionarItemLista({ id: "evento-1::2026-11-16", tipo: "evento", origem: "evento" }), true);
});

test("audiência pode ser selecionada para conclusão em lote", () => {
  assert.equal(podeSelecionarItemLista({ id: "audiencia-det-1", tipo: "audiencia", origem: "evento" }), true);
});

test("prazo TST e parcela continuam fora da conclusão em lote", () => {
  assert.equal(podeSelecionarItemLista({ id: "prazo-tst-1", tipo: "prazo", origem: "tarefa" }), false);
  assert.equal(podeSelecionarItemLista({ id: "parcela-1", tipo: "prazo_parcela", origem: "evento" }), false);
});
