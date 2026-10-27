import { describe, it, expect } from "vitest";
import { complementosPlanilhaProcessos, fontesPlanilhaProcessos, normalizarSistemaJudicial } from "./projurisPlanilhaProcessos";

describe("planilha de processos Projuris", () => {
  it("ajusta grafias do Sistema Judicial à lista", () => {
    expect(normalizarSistemaJudicial("Portal do Adv")).toBe("Portal do Advogado");
    expect(normalizarSistemaJudicial("Jpe")).toBe("JPE");
    expect(normalizarSistemaJudicial("ESAJ")).toBe("Esaj");
  });
  it("usa Sistema quando Sistema Judicial está vazio", () => {
    expect(complementosPlanilhaProcessos({ "Sistema Judicial": "", Sistema: "PROJUDI" }).sistema).toBe("Projudi");
  });
  it("converte data, valores, UF e segredo", () => {
    const c = complementosPlanilhaProcessos({ "Data distribuição": new Date(2024, 11, 5), "Valor ação": 2640, "Valor provisionado": 0, Estado: "São Paulo", "Segredo de justiça": "Sim" });
    expect(c).toMatchObject({ data_distribuicao: "2024-12-05", valor_causa: 2640, uf: "SP", segredo_justica: true });
    expect(c.valor_provisionado).toBeUndefined();
  });
  it("ignora CNJ repetido com dados diferentes", () => {
    const cnj = "0005964-51.2023.8.01.0070";
    const r = fontesPlanilhaProcessos([{ "Número CNJ": cnj, Assunto: "A" }, { "Número CNJ": cnj, Assunto: "B" }, { "Número CNJ": "" }]);
    expect(r.fontes).toHaveLength(0);
    expect(r.ambiguos).toBe(1);
    expect(r.semCnj).toBe(1);
  });
});
