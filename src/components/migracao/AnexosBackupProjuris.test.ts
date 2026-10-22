import { describe, it, expect } from "vitest";
import { montarMapaBackup } from "./AnexosBackupProjuris";

describe("montarMapaBackup", () => {
  it("anexo ligado a processo e tarefa vira uma linha só, preferindo a tarefa", () => {
    const info = new Map([["10", { caminho: "a/b/x.pdf", nome: "x.pdf" }]]);
    const m = montarMapaBackup(info, [
      { cd: "10", modulo: "3", entidade: "P1" },
      { cd: "10", modulo: "4", entidade: "T1" },
    ]);
    expect(m).toEqual([{ cd: "10", modulo: "4", entidade: "T1", caminho: "a/b/x.pdf", nome: "x.pdf" }]);
  });
  it("ignora ligação sem arquivo cadastrado", () => {
    expect(montarMapaBackup(new Map(), [{ cd: "1", modulo: "3", entidade: "P" }])).toEqual([]);
  });
});
