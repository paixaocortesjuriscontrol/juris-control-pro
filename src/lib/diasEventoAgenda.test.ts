import { test } from "node:test";
import { strict as assert } from "node:assert";
import { diasEventoAgenda } from "./diasEventoAgenda";
import { diaBrt } from "../utils/date";

test("evento de dia inteiro em 30/11 não aparece em 01/12", () => {
  assert.deepEqual(
    diasEventoAgenda("2026-11-30T00:00:00-03:00", "2026-11-30T23:59:59-03:00"),
    ["2026-11-30"],
  );
});

test("converte o fim devolvido pelo banco em UTC para o dia em Brasília", () => {
  assert.equal(diaBrt("2026-12-01 02:59:59+00"), "2026-11-30");
  assert.deepEqual(
    diasEventoAgenda("2026-11-30 03:00:00+00", "2026-12-01 02:59:59+00"),
    ["2026-11-30"],
  );
});

test("evento que realmente dura dois dias continua nos dois dias", () => {
  assert.deepEqual(
    diasEventoAgenda("2026-11-30T00:00:00-03:00", "2026-12-01T23:59:59-03:00"),
    ["2026-11-30", "2026-12-01"],
  );
});
