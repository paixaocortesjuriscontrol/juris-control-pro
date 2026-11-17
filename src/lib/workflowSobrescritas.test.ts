import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  mesclarEtapa,
  sobrescritaDaEtapa,
  envolvidosDaEtapa,
  type WorkflowEtapa,
} from "@/lib/workflowExecutor";

const etapaBase: WorkflowEtapa = {
  id: "e1",
  workflow_id: "w1",
  ordem: 1,
  titulo: "Responder contestação",
  tipo_item: "TAREFA",
  tipo_prazo: "dias_corridos",
  dias_previsto: 5,
  dias_fatal: 8,
  prioridade: "media",
  descricao: "Modelo",
  exibir_kanban: false,
  regra_responsavel: "predefinido",
  condicao: "sempre",
};

test("sobrescrita vazia mantém a etapa do modelo", () => {
  assert.deepEqual(mesclarEtapa(etapaBase, null), etapaBase);
  assert.deepEqual(mesclarEtapa(etapaBase, {}), etapaBase);
});

test("título em branco não apaga o título do modelo", () => {
  const r = mesclarEtapa(etapaBase, { titulo: "   " });
  assert.equal(r.titulo, "Responder contestação");
});

test("alteração vale só para esta execução e não toca o modelo", () => {
  const r = mesclarEtapa(etapaBase, {
    titulo: "Contrarrazões",
    tipo_item: "PRAZO",
    prioridade: "urgente",
    dias_previsto: 2,
    dias_fatal: null,
    tipo_prazo: "dias_uteis",
    descricao: "Novo texto",
  });
  assert.equal(r.titulo, "Contrarrazões");
  assert.equal(r.tipo_item, "PRAZO");
  assert.equal(r.prioridade, "urgente");
  assert.equal(r.dias_previsto, 2);
  assert.equal(r.dias_fatal, null);
  assert.equal(r.tipo_prazo, "dias_uteis");
  assert.equal(r.descricao, "Novo texto");
  // o modelo continua intacto
  assert.equal(etapaBase.titulo, "Responder contestação");
  assert.equal(etapaBase.tipo_item, "TAREFA");
  assert.equal(etapaBase.dias_fatal, 8);
  assert.equal(etapaBase.descricao, "Modelo");
});

test("dias_fatal não enviado preserva o do modelo; enviado vazio limpa", () => {
  assert.equal(mesclarEtapa(etapaBase, { dias_fatal: undefined }).dias_fatal, 8);
  assert.equal(mesclarEtapa(etapaBase, { dias_fatal: null }).dias_fatal, null);
});

test("leitura da sobrescrita tolera execução sem o campo", () => {
  assert.equal(sobrescritaDaEtapa({} as any, "e1"), null);
  assert.equal(sobrescritaDaEtapa({ sobrescritas_etapas: null } as any, "e1"), null);
  assert.deepEqual(
    sobrescritaDaEtapa({ sobrescritas_etapas: { e1: { titulo: "X" } } } as any, "e1"),
    { titulo: "X" }
  );
  assert.equal(sobrescritaDaEtapa({ sobrescritas_etapas: { e1: { titulo: "X" } } } as any, "e2"), null);
});

test("envolvidos só existem quando houve escolha explícita", () => {
  assert.deepEqual(envolvidosDaEtapa(undefined), []);
  assert.deepEqual(envolvidosDaEtapa({}), []);
  assert.deepEqual(envolvidosDaEtapa({ envolvidos: ["u1", "", "u2"] }), ["u1", "u2"]);
  assert.deepEqual(envolvidosDaEtapa({ envolvidos: [] }), []);
});
