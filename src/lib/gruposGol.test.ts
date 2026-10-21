import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { COORDENACAO_GOL_ID, podeDistribuirPublicacaoGol, agruparDuplicadasDistribuicao } from "./gruposGol";

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
describe("duplicadas na distribuição", () => {
  const base = { processo_numero: "0001234-56.2025.5.10.0001", data_disponibilizacao: "2026-10-20", conteudo: "Intimação  da parte" };
  test("3 cópias do mesmo processo viram 1 linha", () => {
    const g = agruparDuplicadasDistribuicao([{ id: "a", ...base }, { id: "b", ...base, conteudo: "Intimacao da parte" }, { id: "c", ...base }]);
    assert.equal(g.length, 1);
    assert.equal(g[0].length, 3);
  });
  test("processos diferentes ficam separados", () => {
    const g = agruparDuplicadasDistribuicao([{ id: "a", ...base }, { id: "b", ...base, processo_numero: "0009999-56.2025.5.10.0001" }]);
    assert.equal(g.length, 2);
  });
});
