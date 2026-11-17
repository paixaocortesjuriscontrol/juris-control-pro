import { describe, it, expect } from "vitest";
import { escolherCoordenacaoProcesso } from "./coordenacaoDoUsuarioNoProcesso";

describe("escolherCoordenacaoProcesso", () => {
  it("usa a coordenação do usuário quando o processo está em duas", () => {
    expect(escolherCoordenacaoProcesso("santander", ["santander", "beatriz"], ["beatriz"])).toBe("beatriz");
  });
  it("usa a principal quando o usuário não está em nenhuma", () => {
    expect(escolherCoordenacaoProcesso("santander", ["beatriz"], ["gol"])).toBe("santander");
  });
});
