import { test } from "node:test";
import { strict as assert } from "node:assert";
import { papelDoUsuario } from "./minhasResponsabilidades";

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
