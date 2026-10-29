import { describe, expect, it } from "vitest";
import { resolverModoBuscaAgenda } from "./agendaModoBusca";

const USER = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const COORD = "33333333-3333-4333-8333-333333333333";
const COORD2 = "44444444-4444-4444-8444-444444444444";
const inicio = new Date(2026, 9, 1);
const fim = new Date(2026, 9, 31, 23, 59, 59);

describe("resolverModoBuscaAgenda", () => {
  it("usa a busca de escritório por coordenação quando há coordenações e nenhuma pessoa", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD, COORD2] },
        USER,
      ),
    ).toEqual({ modo: "escritorio", coordenacoes: [COORD, COORD2] });
  });

  it("usa a busca pessoal para uma pessoa escolhida na tela", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, responsavelIds: [OUTRA] },
        USER,
      ),
    ).toEqual({ modo: "pessoal", usuario: OUTRA });
  });

  it("usa a busca pessoal do próprio usuário quando não há filtro de pessoa nem coordenação", () => {
    expect(resolverModoBuscaAgenda({ dataInicio: inicio, dataFim: fim }, USER)).toEqual({
      modo: "pessoal",
      usuario: USER,
    });
  });

  it("usa a busca de escritório mesmo com lista de coordenações vinda de uma só coordenação", () => {
    expect(
      resolverModoBuscaAgenda({ dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD] }, USER),
    ).toEqual({ modo: "escritorio", coordenacoes: [COORD] });
  });

  it("mantém a consulta antiga quando há filtro de processo", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD], processoIds: ["p1"] },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando há filtro por número de processo", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD], processoNumeroDigits: "123456" },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando há filtro por cliente", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD], clienteId: "c1" },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando a coordenação escolhida é uma só (filtro singular)", () => {
    expect(
      resolverModoBuscaAgenda({ dataInicio: inicio, dataFim: fim, coordenacaoId: COORD }, USER),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga na visão 'todas as coordenações' de admin ou assistente geral", () => {
    expect(
      resolverModoBuscaAgenda({ dataInicio: inicio, dataFim: fim, fetchAll: true }, USER),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando o período está incompleto", () => {
    expect(resolverModoBuscaAgenda({ dataFim: fim, coordenacaoIds: [COORD] }, USER)).toEqual({
      modo: "legado",
    });
    expect(resolverModoBuscaAgenda({ dataInicio: inicio, coordenacaoIds: [COORD] }, USER)).toEqual({
      modo: "legado",
    });
  });

  it("mantém a consulta antiga quando a coordenação vem somada a uma pessoa", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD], responsavelIds: [OUTRA] },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando há mais de uma pessoa selecionada", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, responsavelIds: [USER, OUTRA] },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });

  it("mantém a consulta antiga quando não há usuário identificável para a busca pessoal", () => {
    expect(resolverModoBuscaAgenda({ dataInicio: inicio, dataFim: fim }, undefined)).toEqual({
      modo: "legado",
    });
  });

  it("mantém a consulta antiga quando há filtro de origem das publicações", () => {
    expect(
      resolverModoBuscaAgenda(
        { dataInicio: inicio, dataFim: fim, coordenacaoIds: [COORD], origens: ["Kurier"] },
        USER,
      ),
    ).toEqual({ modo: "legado" });
  });
});
