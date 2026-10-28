import { test } from "node:test";
import { strict as assert } from "node:assert";
import { leiturasAgendaEmParalelo } from "./agendaConcorrencia";

test("carrega duas fontes ao mesmo tempo, sem exceder o limite e preservando a ordem", async () => {
  let ativas = 0;
  let maximo = 0;
  const resultado = await leiturasAgendaEmParalelo([30, 5, 10, 1].map((espera, id) => async () => {
    ativas++;
    maximo = Math.max(maximo, ativas);
    await new Promise((resolve) => setTimeout(resolve, espera));
    ativas--;
    return id;
  }));
  assert.equal(maximo, 2);
  assert.deepEqual(resultado, [0, 1, 2, 3]);
});

test("rejeita página quando uma fonte falha, sem entregar total incompleto", async () => {
  await assert.rejects(leiturasAgendaEmParalelo([
    async () => ["tarefa"],
    async () => { throw new Error("Falha nas audiências"); },
  ]), /Falha nas audiências/);
});