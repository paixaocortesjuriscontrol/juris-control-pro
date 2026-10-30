import { test } from "node:test";
import assert from "node:assert/strict";
import { coordenacaoPermiteLote, lerLinhasLote } from "./loteProcessosSantander";

const cab = ["Tipo", "Número do processo", "Responsável", "Coordenção Responsável", "Rito processual", "Valor da causa"];

test("só Santander Cível e Trabalhista permitem lote", () => {
  assert.equal(coordenacaoPermiteLote("Coordenação Santander Cível"), true);
  assert.equal(coordenacaoPermiteLote("Coordenação Santander Trabalhista"), true);
  assert.equal(coordenacaoPermiteLote("Coordenação GOL"), false);
});

test("mapeia colunas do modelo", () => {
  const [l] = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "ISABELA", "Coordenação Santander Cível", "Juizado Especial Civel", 15000]], "Coordenação Santander Cível");
  assert.equal(l.erro, undefined);
  assert.equal(l.campos.numero, "0803543-57.2025.8.19.0014");
  assert.equal(l.campos.rito_processual, "Juizado Especial Cível");
  assert.equal(l.campos.valor_causa, 15000);
});

test("rejeita outra coordenação e número inválido", () => {
  const r = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "X", "Coordenação GOL"], [null, "123"]], "Coordenação Santander Cível");
  assert.match(r[0].erro!, /Coordenação diferente/);
  assert.match(r[1].erro!, /inválido/);
});
