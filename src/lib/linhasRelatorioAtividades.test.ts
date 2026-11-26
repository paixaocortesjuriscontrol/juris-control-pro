import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  COLUNA_DATA_PUBLICACAO_DJEN,
  montarLinhasRelatorioAtividades,
} from "./linhasRelatorioAtividades";

const linhaBase = {
  Classificação: "Tarefa",
  Título: "DEFESA",
  Status: "Pendente",
  "Data prevista": "25/11/2026",
  "Data fatal": "25/11/2026",
  [COLUNA_DATA_PUBLICACAO_DJEN]: "13/11/2026",
  "Aviso de datas": "",
  Processo: "4001012-49.2026.8.26.0008",
  Coordenação: "Coordenação Santander Cível",
};

test("data da publicação DJEN é a primeira coluna do relatório", () => {
  const linhas = montarLinhasRelatorioAtividades([linhaBase], () => ({
    Tipo: "Tarefa",
    Subtipo: "Defesa",
  }));
  assert.equal(Object.keys(linhas[0])[0], COLUNA_DATA_PUBLICACAO_DJEN);
  assert.equal(linhas[0][COLUNA_DATA_PUBLICACAO_DJEN], "13/11/2026");
});

test("demais colunas mantêm a ordem e a coluna DJEN não se repete", () => {
  const linhas = montarLinhasRelatorioAtividades([linhaBase], () => ({
    Tipo: "Tarefa",
    Subtipo: "Defesa",
  }));
  const chaves = Object.keys(linhas[0]);
  assert.deepEqual(chaves.slice(0, 4), [
    COLUNA_DATA_PUBLICACAO_DJEN,
    "Tipo",
    "Subtipo",
    "Situação",
  ]);
  assert.equal(chaves.filter((k) => k === COLUNA_DATA_PUBLICACAO_DJEN).length, 1);
  assert.deepEqual(chaves.slice(4), [
    "Título",
    "Data prevista",
    "Data fatal",
    "Aviso de datas",
    "Processo",
    "Coordenação",
  ]);
});

test("linha sem publicação DJEN abre com a célula vazia", () => {
  const semData = { ...linhaBase, [COLUNA_DATA_PUBLICACAO_DJEN]: "" };
  const linhas = montarLinhasRelatorioAtividades([semData], () => ({ Tipo: "Tarefa" }));
  assert.equal(linhas[0][COLUNA_DATA_PUBLICACAO_DJEN], "");
  assert.equal(linhas[0]["Situação"], "Pendente");
});

test("tipo resolvido pela tela tem prioridade sobre a classificação", () => {
  const linhas = montarLinhasRelatorioAtividades([linhaBase], (i) =>
    i === 0 ? { Tipo: "Prazo", Subtipo: "" } : undefined,
  );
  assert.equal(linhas[0]["Tipo"], "Prazo");
  assert.equal(linhas[0]["Subtipo"], "");
});
