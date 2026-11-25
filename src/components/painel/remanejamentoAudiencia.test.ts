import { describe, it, expect } from "vitest";
import { aplicarRegra } from "./RemanejamentoTarefasSheet";

describe("remanejamento de audiência", () => {
  it("adiar mantém o horário da audiência (BRT)", () => {
    // 20/11/2026 14:30 BRT
    const r = aplicarRegra("2026-11-20T17:30:00.000Z", { modo: "deslocar", dias: 3, diaUtil: true, data: "" }, true);
    expect(r).toBe("2026-11-23T17:30:00.000Z");
  });
  it("nova data mantém o horário", () => {
    const r = aplicarRegra("2026-11-20T17:30:00.000Z", { modo: "fixa", data: "2026-12-02", dias: 0, diaUtil: false }, true);
    expect(r).toBe("2026-12-02T17:30:00.000Z");
  });
});
