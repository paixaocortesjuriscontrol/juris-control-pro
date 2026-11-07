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

test("relatório identifica a origem exata de cada título", async () => {
  const { fonteTituloTarefaProjuris } = await import("./migracaoProjuris");
  assert.equal(fonteTituloTarefaProjuris("Defesa", "Título", "Descrição"), "tipo");
  assert.equal(fonteTituloTarefaProjuris("", "Título", "Descrição"), "titulo");
  assert.equal(fonteTituloTarefaProjuris("", "  ", "Descrição"), "descricao");
  assert.equal(fonteTituloTarefaProjuris("", "", "  "), "vazio");
});

test("cria modelos apenas para títulos novos do tipo ou título original, sem duplicar", async () => {
  const { planejarNovosModelosTitulosProjuris } = await import("./migracaoProjuris");
  const existentes = [{ nome: "Defesa", titulo: "Defesa", padroes: { projuris_cd: "1" } }];
  const linhas = [
    { cdTipo: "1", titulo: "Defesa", tipo: "DEFESA", motivo: null },
    { cdTipo: "2", titulo: "Manifestação", tipo: "MANIFESTAÇÃO", motivo: "Já migrada antes" },
    { cdTipo: "2", titulo: "Manifestação", tipo: "MANIFESTAÇÃO", motivo: null },
    { cdTipo: "3", titulo: "Audiência inicial", tipo: "AUDIÊNCIA", motivo: null },
    { cdTipo: "4", titulo: "Excluída", tipo: "PRAZO", motivo: "Excluída no Projuris" },
  ];
  const novos = planejarNovosModelosTitulosProjuris(linhas, existentes);
  assert.deepEqual(novos.map((m) => m.nome), ["Manifestação", "Audiência inicial"]);
  assert.equal(novos.filter((m) => m.nome === "Manifestação").length, 1);
  assert.equal(novos.find((m) => m.nome === "Audiência inicial")?.tipo, "evento");
});

test("títulos preenchidos pela descrição não criam modelos novos", async () => {
  const { planejarNovosModelosTitulosProjuris, fonteTituloTarefaProjuris } = await import("./migracaoProjuris");
  const fonteTitulo = fonteTituloTarefaProjuris("", "", "Providência da descrição");
  const novos = planejarNovosModelosTitulosProjuris([
    { cdTipo: "", titulo: "Providência da descrição", fonteTitulo },
    { cdTipo: "99", titulo: "Outra descrição", fonteTitulo, motivo: "Já migrada antes" },
    { cdTipo: "2", titulo: "Manifestação", fonteTitulo: "tipo" },
    { cdTipo: "", titulo: "Recurso", fonteTitulo: "titulo" },
  ], []);
  assert.deepEqual(novos.map((m) => m.nome), ["Manifestação", "Recurso"]);
});
