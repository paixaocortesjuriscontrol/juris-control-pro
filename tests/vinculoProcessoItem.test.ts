import { describe, expect, test } from "bun:test";
import { destinoVinculoProcesso, desvincularProcessoComConfirmacao } from "../src/lib/vinculoProcessoItem";

describe("vínculo do processo na ficha da atividade", () => {
  test("tarefa recorrente atualiza somente o cadastro original", () => {
    expect(destinoVinculoProcesso({ id: "abc::2026-11-18", tipo: "tarefa" })).toEqual({ tabela: "tarefas", id: "abc" });
    expect(destinoVinculoProcesso({ id: "abc", tipo: "prazo" })).toEqual({ tabela: "tarefas", id: "abc" });
  });

  test("evento usa seu próprio cadastro", () => {
    expect(destinoVinculoProcesso({ id: "evento-1", tipo: "evento" })).toEqual({ tabela: "eventos_agenda", id: "evento-1" });
  });

  test("prazo fatal TST e parcelamento não permitem desvinculação avulsa", () => {
    expect(destinoVinculoProcesso({ id: "prazo-tst-processo-1", tipo: "prazo" })).toBeNull();
    expect(destinoVinculoProcesso({ id: "evento-1", tipo: "parcelamento" })).toBeNull();
  });

  test("sem confirmação a desvinculação não executa", async () => {
    let chamadas = 0;
    const executada = await desvincularProcessoComConfirmacao(false, async () => { chamadas += 1; });
    expect(executada).toBe(false);
    expect(chamadas).toBe(0);
  });

  test("após confirmar a desvinculação executa uma vez", async () => {
    let chamadas = 0;
    const executada = await desvincularProcessoComConfirmacao(true, async () => { chamadas += 1; });
    expect(executada).toBe(true);
    expect(chamadas).toBe(1);
  });
});
