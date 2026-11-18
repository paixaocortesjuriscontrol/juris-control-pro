import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDataPrevistaISO, fatalAcompanhando } from "./datasBase";

test("modelo 4du/4du: base 18/11/2026 dá limite e fatal 24/11/2026", () => {
  const limite = calcularDataPrevistaISO("2026-11-18", 4, "uteis", null);
  assert.equal(limite, "2026-11-24");
  assert.equal(fatalAcompanhando("", "", limite), "2026-11-24");
});

test("mudar para 5 dias leva a fatal junto (25/11/2026)", () => {
  const novo = calcularDataPrevistaISO("2026-11-18", 5, "uteis", null);
  assert.equal(fatalAcompanhando("2026-11-24", "2026-11-24", novo), "2026-11-25");
});

test("fatal diferente escolhida (margem da equipe) é mantida", () => {
  assert.equal(fatalAcompanhando("2026-11-24", "2026-11-27", "2026-11-25"), "2026-11-27");
});
