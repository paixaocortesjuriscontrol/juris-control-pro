import { test } from "node:test";
import assert from "node:assert/strict";
import { labelCampo, labelAcao, labelOrigem, formatValor } from "./auditoriaCampos";

/** Normaliza espaços especiais que o Intl pode usar entre data e hora. */
const esp = (s: string) => s.replace(/\s+/g, " ");

test("data_vencimento aparece como 'Data limite', como na tela de prazo", () => {
  assert.equal(labelCampo("data_vencimento"), "Data limite");
  assert.equal(labelCampo("data_fatal"), "Data fatal");
});

test("campo sem rótulo conhecido mostra o nome legível", () => {
  assert.equal(labelCampo("data_inexistente"), "data inexistente");
});

test("datas aparecem em dd/mm/aaaa", () => {
  assert.equal(formatValor("2026-11-11"), "11/11/2026");
  assert.equal(formatValor("2026-11-12"), "12/11/2026");
});

test("data e hora aparecem em horário de Brasília", () => {
  // 21:16 UTC = 18:16 BRT (UTC-3)
  assert.equal(esp(formatValor("2026-11-11T21:16:45Z")), "11/11/2026 18:16");
});

test("valores vazios, booleanos e textos longos", () => {
  assert.equal(formatValor(null), "—");
  assert.equal(formatValor(undefined), "—");
  assert.equal(formatValor(""), "—");
  assert.equal(formatValor(true), "Sim");
  assert.equal(formatValor(false), "Não");
  assert.equal(formatValor("x".repeat(200)), `${"x".repeat(120)}…`);
});

test("ação aparece em texto lido na frase do histórico", () => {
  assert.equal(labelAcao("atualizar"), "Alterou");
  assert.equal(labelAcao("criar"), "Criou");
  assert.equal(labelAcao("deletar"), "Excluiu");
});

test("origem vinda do banco é traduzida", () => {
  assert.equal(labelOrigem("db_trigger:tarefas"), "Tarefas/Prazos (sistema)");
  assert.equal(labelOrigem("db_trigger:eventos_agenda"), "Agenda (sistema)");
  assert.equal(labelOrigem(""), "");
});
