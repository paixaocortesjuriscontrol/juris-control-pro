import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirPipe, ehAudiencia, statusTarefa, statusAudiencia, tipoItem } from "./agendaFuturaProjuris";

test("só os 7 títulos do advogado viram audiência", () => {
  for (const t of ["AC", "ac presencial", "UNA", "UNA PRESENCIAL", "AIJ", "AIJ PRESENCIAL", "Sessão de julgamento", "SESSAO DE JULGAMENTO"]) assert.equal(ehAudiencia(t), true, t);
  for (const t of ["ACOMPANHAMENTO", "DEFESA", "AUDIÊNCIA DE CONCILIAÇÃO", "UNA TELEPRESENCIAL", "AC: NOVA"]) assert.equal(ehAudiencia(t), false, t);
  assert.equal(tipoItem("PREPARAR AUDIÊNCIA").audiencia, false);
  assert.notEqual(tipoItem("PREPARAR AUDIÊNCIA").tipo, "AUDIÊNCIA");
});
test("campos com | são divididos sem repetir", () => {
  assert.deepEqual(dividirPipe("a\nb | a\nb | c |  "), ["a\nb", "c"]);
  assert.deepEqual(dividirPipe("GIOVANNA CAMPANA | JHONATAN GONÇALVES"), ["GIOVANNA CAMPANA", "JHONATAN GONÇALVES"]);
  assert.deepEqual(dividirPipe(undefined), []);
});
test("situações do Projuris", () => {
  assert.equal(statusTarefa("Pendente"), "pendente");
  assert.equal(statusTarefa("Em execução"), "em_execucao");
  assert.equal(statusTarefa("Concluída com sucesso"), "cumprido");
  assert.equal(statusTarefa("Concluída sem sucesso"), "concluido_sem_sucesso");
  assert.equal(statusTarefa("A confirmar"), "a_confirmar");
  assert.equal(statusAudiencia("Concluída com sucesso"), "concluido");
  assert.equal(statusAudiencia("Cancelado"), "cancelado");
});
