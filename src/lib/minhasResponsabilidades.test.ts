import { test } from "node:test";
import { strict as assert } from "node:assert";
import { estadoListaAoAbrirResumo, papelDoUsuario } from "./minhasResponsabilidades";

test("ser apenas o criador não coloca a atividade na agenda pessoal", () => {
  assert.equal(papelDoUsuario({ criado_por: "admin" }, "admin"), null);
});

test("responsável continua incluído na agenda pessoal", () => {
  assert.equal(papelDoUsuario({ criado_por: "importador", responsaveis: ["admin"] }, "admin"), "responsavel");
});

test("envolvido ou participante continua incluído na agenda pessoal", () => {
  assert.equal(papelDoUsuario({ criado_por: "importador", envolvidos: ["admin"] }, "admin"), "envolvido");
  assert.equal(papelDoUsuario({ criado_por: "importador", participantes: [{ usuario_id: "admin" }] }, "admin"), "envolvido");
});

test("abrir Hoje limpa situação, tipo, busca e atividade selecionada", () => {
  assert.deepEqual(estadoListaAoAbrirResumo(), {
    filtro: "todos",
    tipo: "todos",
    busca: "",
    atividadesSelecionadas: [],
  });
});

test("abrir um resumo de situação limpa os demais filtros sem perder a situação escolhida", () => {
  assert.deepEqual(estadoListaAoAbrirResumo("atrasadas"), {
    filtro: "atrasadas",
    tipo: "todos",
    busca: "",
    atividadesSelecionadas: [],
  });
});
