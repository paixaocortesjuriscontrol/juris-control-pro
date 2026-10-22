import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { criarGravadorLotes, executarFila, percentualAnexos } from "./projurisImportQueue";

describe("fila de anexos Projuris", () => {
  test("processa cada anexo uma vez com paralelismo limitado", async () => {
    let active = 0; let peak = 0;
    const seen: number[] = [];
    await executarFila(Array.from({ length: 20 }, (_, i) => i), async item => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      seen.push(item); active--;
    }, 4);
    assert.equal(peak, 4);
    assert.equal(new Set(seen).size, 20);
    assert.equal(seen.length, 20);
  });
  test("aguarda os arquivos em andamento antes de propagar falha", async () => {
    let finished = false;
    await assert.rejects(executarFila([0, 1, 2], async item => {
      if (item === 0) throw new Error("falha");
      await new Promise(resolve => setTimeout(resolve, 5)); finished = true;
    }, 2), /falha/);
    assert.equal(finished, true);
  });
  test("grava auditoria em lotes, sem perder o último lote", async () => {
    const writes: number[][] = [];
    const writer = criarGravadorLotes<number>(async batch => { writes.push(batch); }, 5);
    await executarFila(Array.from({ length: 12 }, (_, i) => i), async item => writer.add(item));
    await writer.flush();
    assert.deepEqual(writes.map(batch => batch.length), [5, 5, 2]);
    assert.equal(new Set(writes.flat()).size, 12);
  });
  test("falha de auditoria interrompe o lote e não permite sucesso falso", async () => {
    const writer = criarGravadorLotes<number>(async () => { throw new Error("auditoria recusada"); }, 1);
    await assert.rejects(writer.add(1), /auditoria recusada/);
    await assert.rejects(writer.flush(), /auditoria recusada/);
    await assert.rejects(writer.add(2), /auditoria recusada/);
  });
  test("progresso inclui transferência parcial, mas só conclui após cadastrar todos", () => {
    assert.equal(percentualAnexos(0, 2, [0.5]), 25);
    assert.equal(percentualAnexos(1, 2, [1]), 97.5);
    assert.equal(percentualAnexos(2, 2, []), 100);
    assert.equal(percentualAnexos(0, 0, []), 0);
  });
});