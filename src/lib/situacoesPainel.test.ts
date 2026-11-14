import { test } from "node:test";
import { strict as assert } from "node:assert";
import { contarItensPorSituacao, montarOpcoesSituacoes } from "./situacoesPainel";

test("situação habilitada em uma coordenação do escopo permanece disponível", () => {
  const opcoes = montarOpcoesSituacoes([
    { coordenacao_id: "a", tipo_tarefa: "TAREFA", situacao: "pendente", ativa: true },
    { coordenacao_id: "b", tipo_tarefa: "PRAZO", situacao: "pendente", ativa: false },
  ], ["a", "b"]);

  assert.equal(opcoes.some((o) => o.valores.includes("pendente")), true);
});

test("situação desativada em todos os tipos configurados fica oculta", () => {
  const opcoes = montarOpcoesSituacoes([
    { coordenacao_id: "a", tipo_tarefa: "TAREFA", situacao: "pendente", ativa: false },
    { coordenacao_id: "a", tipo_tarefa: "PRAZO", situacao: "pendente", ativa: false },
    { coordenacao_id: "a", tipo_tarefa: "AUDIENCIA", situacao: "pendente", ativa: false },
    { coordenacao_id: "a", tipo_tarefa: "EVENTO", situacao: "pendente", ativa: false },
    { coordenacao_id: "a", tipo_tarefa: "PARCELAMENTO RECORRENTE", situacao: "pendente", ativa: false },
  ], ["a"]);

  assert.equal(opcoes.some((o) => o.valores.includes("pendente")), false);
});

test("concluído com sucesso reúne os valores de tarefa e evento", () => {
  const opcoes = montarOpcoesSituacoes([]);
  const concluido = opcoes.find((o) => o.label.includes("Concluído com sucesso"));

  assert.ok(concluido);
  assert.deepEqual(new Set(concluido.valores), new Set(["cumprido", "concluido"]));
});

test("totalizadores contam somente os itens da base filtrada em cada situação", () => {
  const opcoes = montarOpcoesSituacoes([]);
  const totais = contarItensPorSituacao(
    [{ status: "pendente" }, { status: "cumprido" }, { status: "concluido" }, { status: "pendente" }],
    opcoes,
  );
  const pendente = opcoes.find((o) => o.valores.includes("pendente"))!;
  const concluido = opcoes.find((o) => o.label.includes("Concluído com sucesso"))!;

  assert.equal(totais[pendente.value], 2);
  assert.equal(totais[concluido.value], 2);
});
