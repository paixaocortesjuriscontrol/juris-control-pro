import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizarEquipeTst, normalizarReclamada, relatorSoNome, horarioPadrao } from "./pautaPadrao";

test("equipe curta ganha o prefixo Jurídico Trabalhista", () => {
  assert.equal(normalizarEquipeTst("Núcleo Sudeste"), "Jurídico Trabalhista - Núcleo Sudeste");
  assert.equal(normalizarEquipeTst("Adm e Coligadas"), "Jurídico Trabalhista - Núcleo Adm e Coligadas");
  assert.equal(normalizarEquipeTst("\tJurídico Trabalhista - Núcleo de Terceiros"), "Jurídico Trabalhista - Núcleo de Terceiros");
});
test("reclamada vira uma das quatro opções", () => {
  assert.equal(normalizarReclamada("BANCO SANTANDER (BRASIL) S.A."), "SANTANDER");
  assert.equal(normalizarReclamada("Aymoré Crédito"), "AYMORÉ");
  assert.equal(normalizarReclamada("Santander Corretora de Seguros"), "SANTANDER CORRETORA");
});
test("relator só com o nome em maiúsculas", () => {
  assert.equal(relatorSoNome("MINISTRO ALEXANDRE DE SOUZA AGRA BELMONTE."), "ALEXANDRE DE SOUZA AGRA BELMONTE");
  assert.equal(relatorSoNome("Ministra Delaíde Alves"), "DELAÍDE ALVES");
});
test("horário vazio vira 00:00", () => {
  assert.equal(horarioPadrao(null), "00:00");
  assert.equal(horarioPadrao("9h30"), "09:30");
});
