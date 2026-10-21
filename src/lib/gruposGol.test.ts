import { describe, expect, test } from "bun:test";
import { COORDENACAO_GOL_ID, podeDistribuirPublicacaoGol } from "./gruposGol";

describe("acesso à distribuição individual", () => {
  test("Admin acessa publicação de termos sem depender da coordenação selecionada", () => {
    expect(podeDistribuirPublicacaoGol(true, null, "termo")).toBe(true);
    expect(podeDistribuirPublicacaoGol(true, "outra-coordenacao", "processo")).toBe(true);
  });
  test("demais usuários mantêm distribuição restrita à GOL", () => {
    expect(podeDistribuirPublicacaoGol(false, COORDENACAO_GOL_ID, "termo")).toBe(true);
    expect(podeDistribuirPublicacaoGol(false, "outra-coordenacao", "termo")).toBe(false);
  });
  test("origens sem suporte não oferecem distribuição", () => {
    expect(podeDistribuirPublicacaoGol(true, COORDENACAO_GOL_ID, "datajud")).toBe(false);
    expect(podeDistribuirPublicacaoGol(true, COORDENACAO_GOL_ID, "descartada")).toBe(false);
  });
});