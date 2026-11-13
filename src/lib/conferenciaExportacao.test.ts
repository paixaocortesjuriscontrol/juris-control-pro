import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { compararExportacao, type FiltrosConferencia, type TarefaConferencia } from "./conferenciaExportacao";

const base: FiltrosConferencia = {
  inicio: "2026-11-01", fim: "2026-11-30", tipos: ["prazo"], situacoes: ["pendente"], coordIds: [],
  pessoaIds: ["leandro"], papeis: { responsavel: true, envolvido: false }, referencia: "vencimento",
};
const t = (o: Partial<TarefaConferencia>): TarefaConferencia => ({
  id: "1", tipo_tarefa: "PRAZO", status: "pendente", data_vencimento: "2026-11-10", data_fatal: null,
  responsaveis: ["leandro"], envolvidos: [], ...o,
});

describe("conferência da exportação", () => {
  it("detecta prazo que faltou na planilha", () => {
    const r = compararExportacao([t({ id: "a" }), t({ id: "b" })], ["a"], base);
    assert.equal(r.totalBanco, 2);
    assert.deepEqual(r.faltantes.map((x) => x.id), ["b"]);
  });
  it("aceita data fatal dentro do período mesmo com limite fora", () => {
    const r = compararExportacao([t({ data_vencimento: "2026-12-05", data_fatal: "2026-11-29" })], [], base);
    assert.equal(r.totalBanco, 1);
  });
  it("só responsável: envolvido não conta", () => {
    const r = compararExportacao([t({ responsaveis: [], envolvidos: ["leandro"] })], [], base);
    assert.equal(r.totalBanco, 0);
  });
  it("ocorrência recorrente na planilha conta para o item original", () => {
    const r = compararExportacao([t({ id: "x" })], ["x:2026-11-10"], base);
    assert.equal(r.faltantes.length, 0);
  });
  it("tarefa não entra quando só prazos foram escolhidos", () => {
    const r = compararExportacao([t({ tipo_tarefa: "Revisar" })], [], base);
    assert.equal(r.totalBanco, 0);
  });
});
