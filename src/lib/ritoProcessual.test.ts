import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizarRitoProcessual } from "./ritoProcessual";

test("JEC vira Juizado Especial Cível", () => assert.equal(normalizarRitoProcessual("JEC"), "Juizado Especial Cível"));
test("vc vira Vara Cível", () => assert.equal(normalizarRitoProcessual("vc"), "Vara Cível"));
test("vara civel sem acento vira Vara Cível", () => assert.equal(normalizarRitoProcessual("vara civel"), "Vara Cível"));
test("vazio vira null", () => assert.equal(normalizarRitoProcessual("  "), null));
test("rito novo é mantido", () => assert.equal(normalizarRitoProcessual("Rito Sumário"), "Rito Sumário"));
