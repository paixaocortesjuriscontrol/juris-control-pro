import { test } from "node:test";
import { strict as assert } from "node:assert";
import { situacaoEmAberto } from "./pendenciaEmAberto";

test("minutado_revisao continua pendência", () => assert.equal(situacaoEmAberto("minutado_revisao"), true));
test("cumprido não é pendência", () => assert.equal(situacaoEmAberto("cumprido"), false));
test("baixado não é pendência", () => assert.equal(situacaoEmAberto("baixado"), false));
