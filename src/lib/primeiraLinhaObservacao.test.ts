import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { primeiraLinhaObservacao } from "./primeiraLinhaObservacao";

describe("primeira linha da observação", () => {
  it("mostra somente a primeira linha", () => {
    assert.equal(
      primeiraLinhaObservacao("Pode reagendar se houver audiência urgente\nNão concluir sem conferir"),
      "Pode reagendar se houver audiência urgente",
    );
  });

  it("aceita quebras de linha do Windows e normaliza espaços", () => {
    assert.equal(primeiraLinhaObservacao("  Prazo   ficto  \r\nDetalhe interno"), "Prazo ficto");
  });

  it("ignora linhas vazias no início", () => {
    assert.equal(primeiraLinhaObservacao("\n  \nVerificar necessidade\nOutra linha"), "Verificar necessidade");
  });

  it("retorna vazio quando não há observação", () => {
    assert.equal(primeiraLinhaObservacao(null), "");
    assert.equal(primeiraLinhaObservacao("   "), "");
  });
});
