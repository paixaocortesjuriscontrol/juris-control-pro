import { test } from "node:test";
import { strict as assert } from "node:assert";
import { aliasesTribunalDjen, correspondeTribunalDjen } from "./filtroTribunalDjen";

test("TRT3 inclui TRT 3_DJEN recebido do Kurier", () => {
  assert.equal(correspondeTribunalDjen("TRT 3_DJEN", "TRT3"), true);
  assert.equal(aliasesTribunalDjen("TRT3").includes("TRT 3_DJEN"), true);
});
test("TRT3 não inclui TRT13 ou TRT30", () => {
  for (const tribunal of ["TRT13", "TRT 13_DJEN", "TRT30", "TRT 30_DJEN"]) {
    assert.equal(correspondeTribunalDjen(tribunal, "TRT3"), false);
    assert.equal(aliasesTribunalDjen("TRT3").includes(tribunal), false);
  }
});
test("outras regiões e tribunais aceitam os nomes Kurier e DJEN", () => {
  for (const [valor, filtro] of [["TRT - 3 REGIAO", "TRT3"], ["TRF 3_DJEN", "TRF3"], ["TST_DJEN", "TST"], ["TJSP_DJEN", "TJSP"]]) {
    assert.equal(correspondeTribunalDjen(valor, filtro), true);
  }
});