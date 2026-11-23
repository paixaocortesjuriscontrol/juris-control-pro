import { describe, it, expect } from "vitest";
import { limparCamposAutomaticosPrazo } from "./camposEdicaoPrazo";
describe("limparCamposAutomaticosPrazo", () => {
  it("prazo sem data base mudando só a situação não envia data base", () => {
    expect(limparCamposAutomaticosPrazo({ data_base: null, prazo_dias: null }, { status: "revisao", data_base: "2026-11-23" })).toEqual({ status: "revisao" });
  });
  it("mantém data base quando as datas mudaram", () => {
    expect(limparCamposAutomaticosPrazo({ data_base: null }, { data_vencimento: "2026-11-30", data_base: "2026-11-23" })).toHaveProperty("data_base");
  });
});
