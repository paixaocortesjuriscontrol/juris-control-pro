import { test } from "node:test";
import { strict as assert } from "node:assert";
import { listarAtividadesLote, passaFiltroAtividade } from "./tipoAtividadeLote";
test("filtra só a atividade escolhida, ignorando maiúsculas e espaços", () => {
  assert.equal(passaFiltroAtividade(" rrap ", "RRAP"), true);
  assert.equal(passaFiltroAtividade("CONTESTAÇÃO", "RRAP"), false);
});
test("sem escolha mostra tudo", () => {
  assert.equal(passaFiltroAtividade("CONTESTAÇÃO", ""), true);
});
test("lista sem repetir", () => {
  assert.deepEqual(listarAtividadesLote([{ titulo: "RRAP" }, { titulo: "rrap" }, { titulo: "AIRR" }]), ["AIRR", "RRAP"]);
});
