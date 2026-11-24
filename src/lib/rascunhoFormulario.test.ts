import { test } from "node:test";
import assert from "node:assert/strict";
import { lerRascunho, gravarRascunho, apagarRascunho, RASCUNHO_VALIDADE_MS } from "./rascunhoFormulario";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

test("grava e restaura o rascunho", () => {
  const s = mem(); gravarRascunho("k", { titulo: "A" }, 1000, s);
  assert.deepEqual(lerRascunho("k", 2000, s)?.valores, { titulo: "A" });
});
test("rascunho expira após 7 dias", () => {
  const s = mem(); gravarRascunho("k", { titulo: "A" }, 0, s);
  assert.equal(lerRascunho("k", RASCUNHO_VALIDADE_MS + 1, s), null);
});
test("limpar apaga o rascunho", () => {
  const s = mem(); gravarRascunho("k", { titulo: "A" }, 0, s); apagarRascunho("k", s);
  assert.equal(lerRascunho("k", 1, s), null);
});
