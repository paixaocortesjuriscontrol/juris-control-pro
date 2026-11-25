import { test } from "node:test";
import assert from "node:assert/strict";
import { comentarioDentroDoCorte } from "./dataCorteProjuris";
test("aceita comentário do próprio dia 13/11/2026", () => assert.equal(comentarioDentroDoCorte("2026-11-13 23:10:00", "2026-11-13"), true));
test("recusa comentário de 14/11/2026", () => assert.equal(comentarioDentroDoCorte("2026-11-14 08:00:00", "2026-11-13"), false));
