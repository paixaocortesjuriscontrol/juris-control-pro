import { test } from "node:test";
import assert from "node:assert/strict";
import { diferencaParticipantes } from "./diferencaParticipantes";
test("mantém quem permanece e só mexe no que mudou", () => {
  const r = diferencaParticipantes(["leandro", "julia", "bruna"], ["leandro", "julia", "bruna"]);
  assert.deepEqual(r, { adicionar: [], remover: [] });
});
test("inclui e retira apenas os alterados", () => {
  const r = diferencaParticipantes(["leandro", "bruna"], ["leandro", "julia"]);
  assert.deepEqual(r, { adicionar: ["julia"], remover: ["bruna"] });
});
