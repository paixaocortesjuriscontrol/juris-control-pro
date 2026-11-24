import { test } from "node:test";
import { strict as assert } from "node:assert";
import { podeCorrigirNumeroProcesso, cnjValido } from "./podeCorrigirNumeroProcesso";

test("advogado vê o lápis", () => assert.equal(podeCorrigirNumeroProcesso("advogado"), true));
test("cargo Advogada na coordenação vale", () => assert.equal(podeCorrigirNumeroProcesso("estagiario", ["Advogada"]), true));
test("estagiário não vê", () => assert.equal(podeCorrigirNumeroProcesso("estagiario", ["estagiario"]), false));
test("CNJ com dígito certo", () => assert.equal(cnjValido("0000264-09.2025.5.10.0011"), true));
test("CNJ com dígito errado", () => assert.equal(cnjValido("0000264-10.2025.5.10.0011"), false));
