import assert from "node:assert/strict";
import test from "node:test";
import { criarAtualizacaoObservacaoProcesso } from "./observacaoProcesso";

test("a atualização contém somente a observação do advogado", () => {
  const atualizacao = criarAtualizacaoObservacaoProcesso("  Ligar para o cliente.  ");
  assert.deepEqual(atualizacao, { observacao_advogado: "Ligar para o cliente." });
  assert.deepEqual(Object.keys(atualizacao), ["observacao_advogado"]);
});

test("observação vazia limpa somente o campo, sem apagar outros dados", () => {
  assert.deepEqual(criarAtualizacaoObservacaoProcesso("  \n  "), {
    observacao_advogado: null,
  });
});

test("quebras de linha internas da observação são preservadas", () => {
  assert.deepEqual(criarAtualizacaoObservacaoProcesso("Primeira linha\nSegunda linha"), {
    observacao_advogado: "Primeira linha\nSegunda linha",
  });
});
