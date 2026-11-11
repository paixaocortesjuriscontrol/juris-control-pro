import { describe, it, expect } from "bun:test";
import { tipoComModalidade, ordenarLinhasAudiencia } from "../src/lib/planilhaAudiencias";

describe("planilha de audiências", () => {
  it("não repete Presencial", () => {
    expect(tipoComModalidade("Instrução Presencial", "Presencial")).toBe("Instrução Presencial");
    expect(tipoComModalidade("Inicial", "Presencial")).toBe("Inicial Presencial");
  });

  it("audiência cadastrada duas vezes sai em duas linhas, cada uma com a sua data de cadastro", () => {
    const l = {
      processo: "0001915-25.2025.5.18.0053",
      data: "17/11/2026",
      hora: "11:30",
      _ordemData: "2026-11-17",
      _ordemHora: "11:30",
    };
    const r = ordenarLinhasAudiencia([
      { ...l, cadastro: "03/11/2026 12:31" },
      { ...l, cadastro: "06/11/2026 16:12" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.cadastro)).toEqual(["03/11/2026 12:31", "06/11/2026 16:12"]);
  });

  it("ordena por data e depois por hora", () => {
    const r = ordenarLinhasAudiencia([
      { data: "10/11/2026", hora: "15:00", _ordemData: "2026-11-10", _ordemHora: "15:00" },
      { data: "10/11/2026", hora: "09:00", _ordemData: "2026-11-10", _ordemHora: "09:00" },
      { data: "09/11/2026", hora: "18:00", _ordemData: "2026-11-09", _ordemHora: "18:00" },
    ]);
    expect(r.map((x) => `${x.data} ${x.hora}`)).toEqual([
      "09/11/2026 18:00",
      "10/11/2026 09:00",
      "10/11/2026 15:00",
    ]);
  });
});
