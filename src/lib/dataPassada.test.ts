import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ehDataPassada } from "./dataPassada";
test("bloqueia dia anterior", () => assert.equal(ehDataPassada("2026-11-15", "2026-11-16"), true));
test("permite hoje", () => assert.equal(ehDataPassada("2026-11-16T10:00", "2026-11-16"), false));
test("permite futuro", () => assert.equal(ehDataPassada("2026-11-17", "2026-11-16"), false));
