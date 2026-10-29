import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolverModoBuscaAgenda } from "./agendaModoBusca";

const USER = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const COORD = "33333333-3333-4333-8333-333333333333";
const COORD2 = "44444444-4444-4444-8444-444444444444";
const inicio = new Date(2026, 9, 1);
const fim = new Date(2026, 9, 31, 23, 59, 59);

const periodo = { dataInicio: inicio, dataFim: fim };

test("escritório usa a busca por coordenação quando há coordenações e nenhuma pessoa", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ ...periodo, coordenacaoIds: [COORD, COORD2] }, USER), {
    modo: "escritorio",
    coordenacoes: [COORD, COORD2],
  });
});

test("escritório vale também quando a lista traz uma única coordenação", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ ...periodo, coordenacaoIds: [COORD] }, USER), {
    modo: "escritorio",
    coordenacoes: [COORD],
  });
});

test("pessoal usa a pessoa escolhida na tela", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ ...periodo, responsavelIds: [OUTRA] }, USER), {
    modo: "pessoal",
    usuario: OUTRA,
  });
});

test("pessoal usa o próprio usuário quando não há filtro de pessoa nem coordenação", () => {
  assert.deepEqual(resolverModoBuscaAgenda(periodo, USER), { modo: "pessoal", usuario: USER });
});

test("filtro de processo mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda({ ...periodo, coordenacaoIds: [COORD], processoIds: ["p1"] }, USER),
    { modo: "legado" },
  );
});

test("filtro por número de processo mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda(
      { ...periodo, coordenacaoIds: [COORD], processoNumeroDigits: "123456" },
      USER,
    ),
    { modo: "legado" },
  );
});

test("filtro por cliente mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda({ ...periodo, coordenacaoIds: [COORD], clienteId: "c1" }, USER),
    { modo: "legado" },
  );
});

test("filtro por origem das publicações mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda({ ...periodo, coordenacaoIds: [COORD], origens: ["Kurier"] }, USER),
    { modo: "legado" },
  );
});

test("coordenação escolhida como filtro único mantém a consulta antiga", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ ...periodo, coordenacaoId: COORD }, USER), {
    modo: "legado",
  });
});

test("visão 'todas as coordenações' de admin ou assistente geral mantém a consulta antiga", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ ...periodo, fetchAll: true }, USER), {
    modo: "legado",
  });
});

test("período incompleto mantém a consulta antiga", () => {
  assert.deepEqual(resolverModoBuscaAgenda({ dataFim: fim, coordenacaoIds: [COORD] }, USER), {
    modo: "legado",
  });
  assert.deepEqual(resolverModoBuscaAgenda({ dataInicio: inicio, coordenacaoIds: [COORD] }, USER), {
    modo: "legado",
  });
});

test("coordenação somada a uma pessoa mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda(
      { ...periodo, coordenacaoIds: [COORD], responsavelIds: [OUTRA] },
      USER,
    ),
    { modo: "legado" },
  );
});

test("mais de uma pessoa selecionada mantém a consulta antiga", () => {
  assert.deepEqual(
    resolverModoBuscaAgenda({ ...periodo, responsavelIds: [USER, OUTRA] }, USER),
    { modo: "legado" },
  );
});

test("sem usuário identificável mantém a consulta antiga", () => {
  assert.deepEqual(resolverModoBuscaAgenda(periodo, undefined), { modo: "legado" });
});
