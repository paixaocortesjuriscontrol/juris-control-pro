import { test } from "node:test";
import assert from "node:assert/strict";
import { preservarDataAudiencia } from "./preservarDataAudiencia";
import { somenteCamposAlterados } from "./somenteCamposAlterados";

test("mudar só a situação de audiência às 17h00 UTC envia só a situação", () => {
  const orig = { data_audiencia: "2026-11-25T17:00:00+00:00", status: "pendente", hora: null, hora_brasilia: null };
  const data = preservarDataAudiencia("2026-11-25T12:00:00.000Z", orig);
  assert.deepEqual(somenteCamposAlterados({ data_audiencia: data, status: "cumprido" }, orig), { status: "cumprido" });
});
test("dia alterado é enviado", () => {
  assert.equal(preservarDataAudiencia("2026-11-26T12:00:00.000Z", { data_audiencia: "2026-11-25T17:00:00+00:00" }), "2026-11-26T12:00:00.000Z");
});
test("hora alterada é enviada", () => {
  const n = "2026-11-25T15:00:00-03:00";
  assert.equal(preservarDataAudiencia(n, { data_audiencia: "2026-11-25T17:00:00+00:00", hora_brasilia: "14:00:00" }, "15:00"), n);
});
