import { describe, it, expect } from "vitest";
import { analisarRepasse, aplicarSubstituicao } from "./substituirResponsaveis";

describe("repasse de responsáveis", () => {
  it("com substituir, Bia para Fernanda deixa só Fernanda responsável", () => {
    const a = analisarRepasse({ originalResp: ["bia"], originalEnv: [], resp: ["bia"], env: ["fernanda"] });
    expect(a.perguntar).toBe(true);
    expect(aplicarSubstituicao(["bia"], ["fernanda"], a.novasPessoas, a.anteriores)).toEqual({ resp: ["fernanda"], env: [] });
  });
  it("sem substituir, ficam Bia e Fernanda", () => {
    const a = analisarRepasse({ originalResp: ["bia"], originalEnv: [], resp: ["bia", "fernanda"], env: [] });
    expect(a.perguntar).toBe(true);
    expect(a.novasPessoas).toEqual(["fernanda"]);
    expect(a.anteriores).toEqual(["bia"]);
  });
  it("coordenador fixo não é removido nem conta como pessoa nova", () => {
    const a = analisarRepasse({ originalResp: ["coord", "bia"], originalEnv: [], resp: ["coord", "bia", "fernanda"], env: [], fixos: ["coord"] });
    expect(aplicarSubstituicao(["coord", "bia", "fernanda"], [], a.novasPessoas, a.anteriores).resp.sort()).toEqual(["coord", "fernanda"]);
  });
  it("sem pessoa nova não pergunta", () => {
    expect(analisarRepasse({ originalResp: ["bia"], originalEnv: ["x"], resp: ["bia"], env: ["x"] }).perguntar).toBe(false);
  });
});
