import { test } from "node:test";
import { strict as assert } from "node:assert";
import { rotuloContagemAba, rotuloParcialAba, totalPublicacoesFicha } from "./contagensFichaItem";

test("publicações do processo e da atividade somam", () => {
  assert.equal(totalPublicacoesFicha(3, 2), 5);
});

test("atividade sem publicação mostra só as do processo", () => {
  assert.equal(totalPublicacoesFicha(7, 0), 7);
});

test("valores negativos ou inválidos não entram na soma", () => {
  assert.equal(totalPublicacoesFicha(-4, Number.NaN), 0);
});

test("aba com zero itens não recebe indicador", () => {
  assert.equal(rotuloContagemAba(0), "");
});

test("aba com itens mostra o total", () => {
  assert.equal(rotuloContagemAba(12), "12");
});

test("contagem indisponível não mostra indicador", () => {
  assert.equal(rotuloContagemAba(null), "");
  assert.equal(rotuloContagemAba(Number.NaN), "");
});

test("parcial mostra feitos sobre total", () => {
  assert.equal(rotuloParcialAba(2, 5), "2/5");
});

test("parcial sem itens fica vazio", () => {
  assert.equal(rotuloParcialAba(0, 0), "");
});

test("parcial não ultrapassa o total", () => {
  assert.equal(rotuloParcialAba(9, 5), "5/5");
});
