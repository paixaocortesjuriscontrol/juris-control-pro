import { test } from "node:test";
import { strict as assert } from "node:assert";
import { somenteCamposAlterados } from "./somenteCamposAlterados";
test("mudança só de situação envia só a situação", () => {
  const orig = { status: "pendente", titulo: "X", link_local: null, hora_fatal: "14:00:00", data_fatal: "2026-11-17", processo_id: "p1" };
  const r = somenteCamposAlterados({ status: "revisao", titulo: "X", link_local: "", hora_fatal: "14:00", data_fatal: "2026-11-17", processo_id: "p1" }, orig);
  assert.deepEqual(r, { status: "revisao" });
});
test("data alterada continua sendo enviada", () => {
  assert.deepEqual(somenteCamposAlterados({ data_fatal: "2026-11-18" }, { data_fatal: "2026-11-17" }), { data_fatal: "2026-11-18" });
});
test("mesmo horário em fusos diferentes não conta como mudança", () => {
  assert.deepEqual(somenteCamposAlterados({ data_audiencia: "2026-11-20T14:00:00-03:00", status: "tratado" }, { data_audiencia: "2026-11-20T17:00:00+00:00", status: "pendente" }), { status: "tratado" });
});
