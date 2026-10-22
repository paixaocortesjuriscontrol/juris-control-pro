import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { montarMapaBackup } from "./mapaAnexosProjuris";

describe("montarMapaBackup", () => {
  test("anexo ligado a processo e tarefa vira uma linha só, preferindo a tarefa", () => {
    const info = new Map([["10", { caminho: "a/b/x.pdf", nome: "x.pdf" }]]);
    const m = montarMapaBackup(info, [
      { cd: "10", modulo: "3", entidade: "P1" },
      { cd: "10", modulo: "4", entidade: "T1" },
    ]);
    assert.deepEqual(m, [{ cd: "10", modulo: "4", entidade: "T1", caminho: "a/b/x.pdf", nome: "x.pdf" }]);
  });
  test("ignora ligação sem arquivo cadastrado", () => {
    assert.deepEqual(montarMapaBackup(new Map(), [{ cd: "1", modulo: "3", entidade: "P" }]), []);
  });
});
