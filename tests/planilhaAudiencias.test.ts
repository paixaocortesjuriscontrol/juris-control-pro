import { describe, it, expect } from "bun:test";
import { tipoComModalidade, dedupLinhasAudiencia } from "../src/lib/planilhaAudiencias";

describe("planilha de audiências", () => {
  it("não repete Presencial", () => {
    expect(tipoComModalidade("Instrução Presencial", "Presencial")).toBe("Instrução Presencial");
    expect(tipoComModalidade("Inicial", "Presencial")).toBe("Inicial Presencial");
  });
  it("mesma audiência repetida vira uma linha", () => {
    const l = { processo: "0001915-25.2025.5.18.0053", data: "17/11/2026", hora: "11:30" };
    expect(dedupLinhasAudiencia([l, { ...l }])).toHaveLength(1);
  });
});

describe("cadastro repetido na planilha", () => {
  it("mostra as duas horas de cadastro na mesma linha", () => {
    const l = { processo: "0001915-25.2025.5.18.0053", data: "17/11/2026", hora: "11:30" };
    const r = dedupLinhasAudiencia([{ ...l, cadastro: "03/11/2026 12:31" }, { ...l, cadastro: "06/11/2026 16:12" }]);
    expect(r).toHaveLength(1);
    expect(r[0].cadastro).toBe("03/11/2026 12:31 | 06/11/2026 16:12");
  });
});
