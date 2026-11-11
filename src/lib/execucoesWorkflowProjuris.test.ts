import { describe, it, expect } from "vitest";
import { montarExecucoesWorkflow } from "./execucoesWorkflowProjuris";

const imp = [
  { chave: "11", workflowOrigem: "100", etapaId: "E1", ordem: 1, titulo: "PGTO DE CUSTAS", tipoItem: "prazo" },
  { chave: "12", workflowOrigem: "100", etapaId: "E2", ordem: 2, titulo: "COMPROVAÇÃO", tipoItem: "prazo" },
];
const wfs = [{ cdworkflow: "100", cdworkfloworiginal: "" }, { cdworkflow: "200", cdworkfloworiginal: "100" }];
const etapas = [
  { cdetapaworkflow: "11", cdetapaworkflowanterior: "", detitulo: "PGTO DE CUSTAS" },
  { cdetapaworkflow: "21", cdetapaworkflowanterior: "", detitulo: "Pgto de custas" },
  { cdetapaworkflow: "22", cdetapaworkflowanterior: "21", detitulo: "outro nome" },
];

describe("montarExecucoesWorkflow", () => {
  it("fluxo parado na 1ª etapa continua automático: etapa aberta materializada e a próxima pendente", () => {
    const { planos } = montarExecucoesWorkflow(wfs, etapas,
      [{ cdworkflowcontrole: "C1", cdworkflow: "100", flativo: "t", cdmodulo: "3", cdregistrovinculo: "P9", dtinicio: "2026-01-08 10:00" }],
      [{ cdworkflowcontrole: "C1", cdetapaworkflow: "11", cdmodulo: "4", cdregistrovinculo: "T1", dtinicio: "2026-01-08", flativo: "t" }], imp);
    expect(planos[0].status).toBe("em_andamento");
    expect(planos[0].cdprocesso).toBe("P9");
    expect(planos[0].etapas.map((e) => [e.status, e.cdtarefa])).toEqual([["materializada", "T1"], ["pendente", null]]);
  });

  it("versão antiga do modelo liga pelo título e depois pela posição; fluxo encerrado vira histórico", () => {
    const { planos } = montarExecucoesWorkflow(wfs, etapas,
      [{ cdworkflowcontrole: "C2", cdworkflow: "200", flativo: "t", cdmodulo: "17", dtinicio: "2025-05-01" }],
      [
        { cdworkflowcontrole: "C2", cdetapaworkflow: "21", cdmodulo: "4", cdregistrovinculo: "T2", dtinicio: "2025-05-01", dtconclusao: "2025-05-02", flativo: "t" },
        { cdworkflowcontrole: "C2", cdetapaworkflow: "22", cdmodulo: "4", cdregistrovinculo: "T3", dtinicio: "2025-05-02", dtconclusao: "2025-05-09", flativo: "t" },
      ], imp);
    expect(planos[0].status).toBe("concluido");
    expect(planos[0].etapas.map((e) => [e.status, e.cdtarefa])).toEqual([["concluida", "T2"], ["concluida", "T3"]]);
  });

  it("ignora fluxos excluídos e de modelos não importados", () => {
    const r = montarExecucoesWorkflow(wfs, etapas, [
      { cdworkflowcontrole: "C3", cdworkflow: "100", flativo: "f" },
      { cdworkflowcontrole: "C4", cdworkflow: "999", flativo: "t" },
    ], [], imp);
    expect(r.planos).toHaveLength(0);
    expect(r.semModelo).toBe(1);
  });
});
