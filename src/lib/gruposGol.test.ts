import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { COORDENACAO_GOL_ID, podeDistribuirPublicacaoGol } from "./gruposGol";

describe("acesso à distribuição individual", () => {
  test("Admin acessa publicação de termos sem depender da coordenação selecionada", () => {
    assert.equal(podeDistribuirPublicacaoGol(true, null, "termo"), true);
    assert.equal(podeDistribuirPublicacaoGol(true, "outra-coordenacao", "processo"), true);
  });
  test("demais usuários mantêm distribuição restrita à GOL", () => {
    assert.equal(podeDistribuirPublicacaoGol(false, COORDENACAO_GOL_ID, "termo"), true);
    assert.equal(podeDistribuirPublicacaoGol(false, "outra-coordenacao", "termo"), false);
  });
  test("origens sem suporte não oferecem distribuição", () => {
    assert.equal(podeDistribuirPublicacaoGol(true, COORDENACAO_GOL_ID, "datajud"), false);
    assert.equal(podeDistribuirPublicacaoGol(true, COORDENACAO_GOL_ID, "descartada"), false);
  });
});