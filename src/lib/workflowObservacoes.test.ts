import { describe, it, expect } from "vitest";
import { juntarObservacoesWorkflow } from "./workflowExecutor";
describe("observações do workflow nas atividades", () => {
  it("usa a observação do início quando a etapa não tem", () => {
    expect(juntarObservacoesWorkflow(null, "tj 25/11")).toBe("tj 25/11");
  });
  it("junta observação do início e da etapa", () => {
    expect(juntarObservacoesWorkflow("da etapa", "do início")).toBe("do início\n\nda etapa");
  });
  it("não duplica", () => {
    expect(juntarObservacoesWorkflow("docs para pericia oulier", "docs para pericia")).toBe("docs para pericia oulier");
  });
});
