import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { compararExportacao, chaveItemExportado, type FiltrosConferencia, type ItemConferencia } from "./conferenciaExportacao";

const base: FiltrosConferencia = {
  inicio: "2026-11-01", fim: "2026-11-30", tipos: ["prazo"], situacoes: ["pendente"], coordIds: [],
  pessoaIds: ["leandro"], papeis: { responsavel: true, envolvido: false }, referencia: "vencimento",
};
const t = (o: Partial<ItemConferencia>): ItemConferencia => ({
  chave: "t:1", tipo: "prazo", status: "pendente", data_vencimento: "2026-11-10", data_fatal: null,
  responsaveis: ["leandro"], envolvidos: [], ...o,
});

describe("conferência da exportação", () => {
  it("detecta prazo que faltou na planilha", () => {
    const r = compararExportacao([t({ chave: "t:a" }), t({ chave: "t:b" })], ["t:a"], base);
    assert.equal(r.totalBanco, 2);
    assert.deepEqual(r.faltantes.map((x) => x.chave), ["t:b"]);
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
    const k = chaveItemExportado({ id: "x:2026-11-10", origem: "tarefa" })!;
    const r = compararExportacao([t({ chave: "t:x" })], [k], base);
    assert.equal(r.faltantes.length, 0);
  });
  it("tarefa não entra quando só prazos foram escolhidos", () => {
    const r = compararExportacao([t({ tipo: "tarefa" })], [], base);
    assert.equal(r.totalBanco, 0);
  });
  it("audiência: advogado é o responsável", () => {
    const f = { ...base, tipos: ["audiencia"] };
    const aud = t({ chave: "a:9", tipo: "audiencia", responsaveis: ["leandro"] });
    assert.equal(compararExportacao([aud], [chaveItemExportado({ id: "audiencia-det-9" })!], f).faltantes.length, 0);
    assert.equal(compararExportacao([aud], [], f).porTipo[0].faltando, 1);
  });
  it("evento recorrente conta uma vez", () => {
    const f = { ...base, tipos: ["evento"] };
    const ev = t({ chave: "e:5", tipo: "evento" });
    const r = compararExportacao([ev, ev], [chaveItemExportado({ id: "5::2026-11-12", origem: "evento" })!], f);
    assert.equal(r.totalBanco, 1);
    assert.equal(r.faltantes.length, 0);
  });
});
