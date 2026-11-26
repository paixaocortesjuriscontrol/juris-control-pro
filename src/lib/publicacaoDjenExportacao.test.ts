import { test } from "node:test";
import { strict as assert } from "node:assert";
import { dataPublicacaoDjenExportacao } from "./publicacaoDjenExportacao";

test("relatório mostra a data DJEN da tarefa em DD/MM/AAAA", () => {
  const datas = new Map([["tarefa-1", "2026-11-13T12:00:00+00:00"]]);
  assert.equal(
    dataPublicacaoDjenExportacao(datas, { id: "tarefa-1::2026-11-30", origem: "tarefa" }),
    "13/11/2026",
  );
});

test("relatório encontra a publicação da audiência pelo ID sem prefixo", () => {
  const datas = new Map([["audiencia-1", "2026-10-31"]]);
  assert.equal(
    dataPublicacaoDjenExportacao(datas, { id: "audiencia-det-audiencia-1" }),
    "31/10/2026",
  );
});

test("atividade sem publicação fica com a célula vazia", () => {
  assert.equal(dataPublicacaoDjenExportacao(new Map(), { id: "tarefa-2", origem: "tarefa" }), "");
});
