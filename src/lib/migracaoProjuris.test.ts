import { test } from "node:test";
import { strict as assert } from "node:assert";
import { classificarTipo } from "./migracaoProjuris";

test("audiência exige a palavra no título, não basta tipo de origem", () => {
  for (const titulo of ["Inicial Telepresencial", "SESSÃO DE JULGAMENTO", "Pauta concentrada", "Verificar julgamento"]) {
    assert.notEqual(classificarTipo(titulo, "AUDIÊNCIA"), "AUDIÊNCIA");
  }
  assert.equal(classificarTipo("Apresentar defesa até julgamento", "AUDIÊNCIA"), "DEFESA");
});

test("aceita audiência no título com acento, sem acento, maiúsculas e plural", () => {
  for (const titulo of ["Audiência inicial", "AUDIENCIA DE INSTRUÇÃO", "Audiências presenciais"]) {
    assert.equal(classificarTipo(titulo, "TAREFA"), "AUDIÊNCIA");
  }
});

test("preparação continua sendo tarefa e não audiência", () => {
  assert.equal(classificarTipo("Preparação para audiência", "AUDIÊNCIA"), "PREPARAÇÃO AUDIÊNCIA");
  assert.notEqual(classificarTipo("Preparar documentos", "PREPARAÇÃO AUDIÊNCIA"), "AUDIÊNCIA");
});
test("título da tarefa Projuris vem do tipo e a descrição vai para a descrição", async () => {
  const { tituloTarefaProjuris } = await import("./migracaoProjuris");
  assert.deepEqual(tituloTarefaProjuris("Contestação", "", "Elaborar defesa do banco"), { titulo: "Contestação", descricao: "Elaborar defesa do banco" });
  assert.deepEqual(tituloTarefaProjuris("", "Recurso", "Texto"), { titulo: "Recurso", descricao: "Texto" });
  assert.deepEqual(tituloTarefaProjuris("", "", "Só descrição"), { titulo: "Só descrição", descricao: null });
});
