import { describe, expect, test as it } from "bun:test";
import { papelDoUsuario } from "../src/lib/minhasResponsabilidades";

const U = "u1";
describe("papelDoUsuario", () => {
  it("responsável principal", () => expect(papelDoUsuario({ responsavel_id: U }, U)).toBe("responsavel"));
  it("responsável na lista", () => expect(papelDoUsuario({ responsaveis: ["x", U] }, U)).toBe("responsavel"));
  it("responsável vence envolvido", () =>
    expect(papelDoUsuario({ responsaveis: [U], envolvidos: [U] }, U)).toBe("responsavel"));
  it("envolvido", () => expect(papelDoUsuario({ envolvidos: [{ usuario_id: U }] }, U)).toBe("envolvido"));
  it("só criador não aparece", () => expect(papelDoUsuario({ responsavel_id: "x" }, U)).toBeNull());
});
