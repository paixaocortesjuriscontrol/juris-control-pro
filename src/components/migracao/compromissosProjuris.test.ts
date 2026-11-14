import { describe, it, expect } from "vitest";
import { tipoCompromisso, cnjDoTexto } from "./compromissosProjuris";

describe("compromissos Projuris", () => {
  it("tipo vem da primeira coluna", () => {
    expect(tipoCompromisso("AUDIÊNCIA")).toBe("audiencia");
    expect(tipoCompromisso("TAREFA")).toBe("tarefa");
    expect(tipoCompromisso("EVENTO")).toBe("evento");
    expect(tipoCompromisso("PRAZO X")).toBeNull();
  });
  it("extrai o processo da observação", () => {
    expect(cnjDoTexto("16/11/2026\t10:00\t0001770-32.2026.5.18.0053\tANÁPOLIS")).toBe("00017703220265180053");
    expect(cnjDoTexto("sem número")).toBeNull();
  });
});
