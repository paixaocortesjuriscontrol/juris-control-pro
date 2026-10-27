import { test } from "node:test";
import { strict as assert } from "node:assert";
import { proximaPaginaAgenda } from "./agendaPaginacao";

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