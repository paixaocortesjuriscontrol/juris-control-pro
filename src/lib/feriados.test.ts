import { test, mock } from "node:test";
import { strict as assert } from "node:assert";
import { feriadosNacionais, pascoa } from "./feriados.ts";

void mock;

test("Carnaval e Sexta-feira Santa de 2026", () => {
  const d = feriadosNacionais(2026).map((f) => f.data);
  assert.ok(d.includes("2026-02-17"));
  assert.ok(d.includes("2026-04-03"));
  assert.equal(pascoa(2026).getDate(), 5);
});
