import { describe, it, expect } from "vitest";
import { tipoWorkflow, chaveWorkflow } from "./tarefasWorkflowProjuris";

describe("tarefas de workflows Projuris", () => {
  it("tipo vem da CLASSIFICAÇÃO", () => {
    expect(tipoWorkflow("PRAZO")).toBe("prazo");
    expect(tipoWorkflow("TAREFA")).toBe("tarefa");
    expect(tipoWorkflow("")).toBeNull();
  });
  it("chave ignora formatação do número e caixa do título", () => {
    expect(chaveWorkflow("4002346-55.2026.8.26.0126", "Comprovação de OF", "2026-11-17"))
      .toBe(chaveWorkflow("40023465520268260126", "COMPROVAÇÃO DE OF", "2026-11-17"));
    expect(chaveWorkflow("40023465520268260126", "X", "2026-11-17")).not.toBe(chaveWorkflow("40023465520268260126", "X", "2026-11-18"));
  });
});
