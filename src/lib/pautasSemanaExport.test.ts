import { test } from "node:test";
import { strict as assert } from "node:assert";
import { corCabecalhoModelo, valorPadraoPauta, COLUNAS_PAUTA } from "./pautasSemanaExport";

test("cores do cabeçalho seguem o modelo", () => {
  assert.equal(corCabecalhoModelo(0), "FFD9D9D9");
  assert.equal(corCabecalhoModelo(22), "FFF9CB9C");
  assert.equal(corCabecalhoModelo(28), "FFC00000");
  assert.equal(corCabecalhoModelo(29), "FFD0CECE");
});
test("planilha tem 31 colunas e AC são os comentários", () => {
  assert.equal(COLUNAS_PAUTA.length, 31);
  assert.equal(COLUNAS_PAUTA[28][1], "comentarios_advogado");
});
test("vazios saem A PREENCHER", () => {
  assert.equal(valorPadraoPauta({}, "comentarios_advogado"), "A PREENCHER");
  assert.equal(valorPadraoPauta({}, "advogado_interno"), "A PREENCHER");
  assert.equal(valorPadraoPauta({}, "parte_recorrente"), "A PREENCHER");
});
