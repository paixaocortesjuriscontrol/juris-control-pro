import { describe, expect, test as it } from "bun:test";
import { grupoAgendaResponsabilidade, papelDoUsuario } from "../src/lib/minhasResponsabilidades";

const U = "u1";
describe("papelDoUsuario", () => {
  it("responsável principal", () => expect(papelDoUsuario({ responsavel_id: U }, U)).toBe("responsavel"));
  it("responsável na lista", () => expect(papelDoUsuario({ responsaveis: ["x", U] }, U)).toBe("responsavel"));
  it("responsável vence envolvido", () =>
    expect(papelDoUsuario({ responsaveis: [U], envolvidos: [U] }, U)).toBe("responsavel"));
  it("envolvido", () => expect(papelDoUsuario({ envolvidos: [{ usuario_id: U }] }, U)).toBe("envolvido"));
  it("só criador não aparece", () => expect(papelDoUsuario({ responsavel_id: "x" }, U)).toBeNull());
});

describe("agenda de Minhas Responsabilidades", () => {
  it("coloca item vencido e pendente em Atrasadas", () =>
    expect(grupoAgendaResponsabilidade({ data_fatal: "2026-11-13" }, "2026-11-14", "atrasada")).toBe("atrasadas"));
  it("coloca item da data atual em Hoje", () =>
    expect(grupoAgendaResponsabilidade({ data_vencimento: "2026-11-14T09:00:00-03:00" }, "2026-11-14", "pendente")).toBe("hoje"));
  it("coloca item posterior em Futuras", () =>
    expect(grupoAgendaResponsabilidade({ data_inicio: "2026-11-15" }, "2026-11-14", "pendente")).toBe("futuras"));
  it("não apresenta item passado já cumprido como atrasado", () =>
    expect(grupoAgendaResponsabilidade({ data_fatal: "2026-11-13" }, "2026-11-14", "cumprida")).toBeNull());
  it("não inventa grupo para item sem data", () =>
    expect(grupoAgendaResponsabilidade({}, "2026-11-14", "pendente")).toBeNull());
});
