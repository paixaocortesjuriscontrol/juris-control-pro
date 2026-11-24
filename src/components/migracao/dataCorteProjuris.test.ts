import { test } from "node:test";
import assert from "node:assert/strict";
import { passaDoCorte, aplicarCorte } from "./dataCorteProjuris";

test("o próprio dia do corte entra", () => assert.equal(passaDoCorte({ data_fatal: "2026-11-13" }, "2026-11-13"), false));
test("o dia seguinte fica de fora", () => assert.equal(passaDoCorte({ data_fatal: "2026-11-14" }, "2026-11-13"), true));
test("atividade sem data entra", () => assert.equal(passaDoCorte({}, "2026-11-13"), false));
test("data fatal tem prioridade sobre a prevista", () => assert.equal(passaDoCorte({ data_fatal: "2026-11-20", data_prevista: "2026-11-10" }, "2026-11-13"), true));
test("audiência às 23h de 13/11 BRT entra", () => assert.equal(passaDoCorte({ data_audiencia: "2026-11-14T02:00:00Z" }, "2026-11-13"), false));
test("aceita DD/MM/YYYY", () => assert.equal(passaDoCorte({ inicio: "14/11/2026" }, "2026-11-13"), true));
test("sem corte nada sai", () => assert.equal(aplicarCorte([{ data: "2030-01-01" }], (l) => l, "").fora.length, 0));
