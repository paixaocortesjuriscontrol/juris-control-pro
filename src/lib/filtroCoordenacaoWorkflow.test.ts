import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolverFiltroCoordenacaoWorkflow } from "./filtroCoordenacaoWorkflow";

const coordenacoes = [{ id: "santander-civel" }, { id: "gol" }];

test("inicia na coordenação padrão do usuário entre suas opções acessíveis", () => {
  assert.equal(resolverFiltroCoordenacaoWorkflow(undefined, coordenacoes, "gol"), "gol");
});

test("sem padrão acessível inicia em uma coordenação disponível, não em todas", () => {
  assert.equal(resolverFiltroCoordenacaoWorkflow(undefined, coordenacoes, "inacessivel"), "santander-civel");
});

test("permite escolher outra coordenação sem sobrescrever pela padrão", () => {
  assert.equal(resolverFiltroCoordenacaoWorkflow("santander-civel", coordenacoes, "gol"), "santander-civel");
});

test("mantém a escolha de todas mesmo com coordenação única", () => {
  assert.equal(resolverFiltroCoordenacaoWorkflow("todas", [{ id: "santander-civel" }], "santander-civel"), "todas");
});