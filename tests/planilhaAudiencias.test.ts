import { describe, it, expect } from "bun:test";
import { tipoComModalidade } from "../src/lib/planilhaAudiencias";

describe("planilha de audiências", () => {
  it("não repete Presencial", () => {
    expect(tipoComModalidade("Instrução Presencial", "Presencial")).toBe("Instrução Presencial");
    expect(tipoComModalidade("Inicial", "Presencial")).toBe("Inicial Presencial");
  });
});
