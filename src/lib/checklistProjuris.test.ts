import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lerCsvPontoVirgula, montarItensChecklist } from "./checklistProjuris";

describe("checklist Projuris", () => {
  it("lê campos com aspas e quebra de linha", () => {
    const r = lerCsvPontoVirgula('a;b\n1;"x;\ny"\n');
    assert.deepEqual(r, [{ a: "1", b: "x;\ny" }]);
  });
  it("mantém ordem e marcado S/N e liga à tarefa do módulo 4", () => {
    const { itens, semTarefa } = montarItensChecklist(
      [{ cdchecklist: "1", flativo: "S", nmchecklist: "SIMULADOR" }, { cdchecklist: "2", flativo: "S", nmchecklist: "X" }],
      [
        { cdchecklistitem: "10", flativo: "S", nmchecklistitem: " A ", nuordem: "3", cdchecklist: "1", flchecked: "S" },
        { cdchecklistitem: "11", flativo: "N", nmchecklistitem: "B", nuordem: "1", cdchecklist: "1", flchecked: "N" },
        { cdchecklistitem: "12", flativo: "S", nmchecklistitem: "C", nuordem: "1", cdchecklist: "2", flchecked: "N" },
      ],
      [{ cdchecklist: "1", cdmodulo: "4", cdregistrovinculo: "500" }, { cdchecklist: "2", cdmodulo: "39", cdregistrovinculo: "9" }],
    );
    assert.deepEqual(itens, [{ chave: "10", tarefaChave: "500", ordem: 3, marcado: true, titulo: "A", nomeChecklist: "SIMULADOR" }]);
    assert.equal(semTarefa, 1);
  });
});

import { chavesCandidatasTarefa } from "./checklistProjuris";
describe("chavesCandidatasTarefa", () => {
  it("usa código do backup e identificador TAR da planilha", () => {
    expect(chavesCandidatasTarefa("50636740", new Map([["50636740", "TAR.123"]]))).toEqual(["50636740", "TAR.123", "123"]);
  });
  it("sem identificador usa só o código", () => {
    expect(chavesCandidatasTarefa("1")).toEqual(["1"]);
  });
});
