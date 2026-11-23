import { test } from "node:test";
import { strict as assert } from "node:assert";
import { limparCamposAutomaticosPrazo } from "./camposEdicaoPrazo";
test("prazo sem data base mudando só a situação não envia data base", () => {
  assert.deepEqual(limparCamposAutomaticosPrazo({ data_base: null, prazo_dias: null }, { status: "revisao", data_base: "2026-11-23" }), { status: "revisao" });
});
test("mantém data base quando as datas mudaram", () => {
  assert.ok("data_base" in limparCamposAutomaticosPrazo({ data_base: null }, { data_vencimento: "2026-11-30", data_base: "2026-11-23" }));
});
