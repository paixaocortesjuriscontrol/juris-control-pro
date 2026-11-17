import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ehDataPassada, itensComDataPassada, avisoDataPassada } from "./dataPassada";
test("bloqueia dia anterior", () => assert.equal(ehDataPassada("2026-11-15", "2026-11-16"), true));
test("permite hoje", () => assert.equal(ehDataPassada("2026-11-16T10:00", "2026-11-16"), false));
test("permite futuro", () => assert.equal(ehDataPassada("2026-11-17", "2026-11-16"), false));
test("importação separa só os itens com data anterior a hoje", () => {
  const itens = [
    { t: "ontem", d: "2026-11-15" },
    { t: "hoje", d: "2026-11-16" },
    { t: "amanhã", d: "2026-11-17" },
    { t: "sem data", d: null },
  ];
  assert.deepEqual(itensComDataPassada(itens, (i) => i.d, "2026-11-16").map((i) => i.t), ["ontem"]);
});
test("aviso do fim da importação só aparece quando há atrasados", () => {
  assert.equal(avisoDataPassada(0), "");
  assert.match(avisoDataPassada(1), /^1 item importado ficou com data anterior a hoje/);
  assert.match(avisoDataPassada(7), /^7 itens importados ficaram com data anterior a hoje/);
});
