import { test } from "node:test";
import { strict as assert } from "node:assert";
import { fonteAgendaCheia, proximaPaginaAgenda } from "./agendaPaginacao";

test("escritório continua após mesclar fontes com mais de mil itens, até alcançar as Atas", () => {
  const primeira = Object.assign(Array.from({ length: 1219 }, () => ({})), { __temMais: true });
  assert.equal(proximaPaginaAgenda(primeira, 1), 1);
  const ultima = Object.assign(Array.from({ length: 13 }, () => ({ tipo_tarefa: "ATA" })), { __temMais: false });
  assert.equal(proximaPaginaAgenda(ultima, 2), undefined);
});

test("página filtrada vazia continua quando a fonte ainda tem registros", () => {
  assert.equal(proximaPaginaAgenda(Object.assign([], { __temMais: true }), 2), 2);
});

test("mil ocorrências não criam página extra se todas as fontes terminaram", () => {
  assert.equal(proximaPaginaAgenda(Object.assign(Array.from({ length: 1000 }, () => ({})), { __temMais: false }), 1), undefined);
});

test("consulta alternativa cheia continua mesmo após falha da consulta principal", () => {
  const principal = null;
  const alternativa = Array.from({ length: 1000 }, (_, id) => ({ id }));
  assert.equal(fonteAgendaCheia(principal, 1000), false);
  assert.equal(fonteAgendaCheia(alternativa, 1000), true);
  const pagina = Object.assign(alternativa, { __temMais: fonteAgendaCheia(alternativa, 1000) });
  assert.equal(proximaPaginaAgenda(pagina, 1), 1);
});

test("consulta alternativa de coordenação continua com 500 registros", () => {
  assert.equal(fonteAgendaCheia(Array.from({ length: 500 }, () => ({})), 500), true);
  assert.equal(fonteAgendaCheia(Array.from({ length: 499 }, () => ({})), 500), false);
});