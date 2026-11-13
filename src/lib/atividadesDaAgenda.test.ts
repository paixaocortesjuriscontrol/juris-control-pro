import { test as it } from "node:test";
import { strict as assert } from "node:assert";
import { agruparAtividadesDaAgenda, filtrarPorAtividades, dataDoItemNaAgenda } from "./atividadesDaAgenda";

const itens = [
  { id: "1", origem: "tarefa", tipo: "tarefa", titulo: "x", data_vencimento: "2026-11-13" },
  { id: "2", origem: "tarefa", tipo: "prazo", titulo: "Defesa", data_vencimento: "2026-11-13" },
  { id: "3", origem: "tarefa", tipo: "prazo", titulo: "DEFESA ", data_vencimento: "2026-11-14" },
  { id: "4", origem: "audiencia", tipo: "audiencia", titulo: "UNA", data_inicio: "2026-11-13" },
];
const modelos = new Map([["1", { nome: "Simulador 1ª fase", cor: "#f00" }]]);

  it("lista só os nomes presentes, com quantidade, sem audiências", () => {
    const g = agruparAtividadesDaAgenda(itens, modelos);
    assert.deepEqual(g.map((a) => [a.nome, a.quantidade]), [["Defesa", 2], ["Simulador 1ª fase", 1]]);
  });
  it("filtra pela atividade escolhida", () => {
    assert.deepEqual(filtrarPorAtividades(itens, ["defesa"], modelos).map((i) => i.id), ["2", "3"]);
  });
  it("sem seleção devolve tudo", () => {
    assert.equal(filtrarPorAtividades(itens, [], modelos).length, 4);
  });
  it("data do item usa vencimento ou início", () => {
    assert.equal(dataDoItemNaAgenda(itens[2]), "2026-11-14");
    assert.equal(dataDoItemNaAgenda(itens[3]), "2026-11-13");
  });

