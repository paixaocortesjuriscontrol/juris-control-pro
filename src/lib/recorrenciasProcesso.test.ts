import { test } from "node:test";
import { strict as assert } from "node:assert";
import { QueryClient } from "@tanstack/react-query";
import { agruparSerieRecorrente } from "../utils/recorrencia";
import { invalidarItensAgenda } from "./invalidarItensAgenda";

test("a mesma tarefa recebida 3 vezes como ocorrência expande o pai somente uma vez", () => {
  const inicio = new Date();
  inicio.setDate(25);
  inicio.setHours(12, 0, 0, 0);
  const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 8, 25, 12);
  const pai = {
    id: "6daabedb-397f-448a-a755-fe72d0fe60e9",
    data_vencimento: inicio.toISOString(),
    recorrencia_tipo: "monthly",
    recorrencia_fim: fim.toISOString(),
  };
  const clones = [0, 1, 2].map((n) => ({
    ...pai,
    id: `${pai.id}::clone-${n}`,
    _registro_pai: pai,
  }));
  const linhas = agruparSerieRecorrente<any>(clones, {
    dataBase: (t) => t.data_vencimento,
    regra: (t) => ({ tipo: t.recorrencia_tipo, fim: t.recorrencia_fim }),
    aplicarData: (t, d) => ({ ...t, id: `${t.id}::${d.toISOString().slice(0, 10)}` }),
  });
  assert.equal(linhas.length, 1);
  const ocorrencias = [linhas[0].principal, ...linhas[0].repeticoes];
  assert.equal(ocorrencias.length, 9);
  assert.equal(new Set(ocorrencias.map((t) => t.id)).size, 9);
});

test("a baixa invalida também a situação das ocorrências na ficha e na lista lateral", async () => {
  const client = new QueryClient();
  const ficha = ["baixas-recorrentes-processo", "processo-janaina"];
  const lateral = ["processo-itens-lateral-v3", "processo-janaina"];
  client.setQueryData(ficha, [{ data_ocorrencia: "2026-10-25", status: "pendente" }]);
  client.setQueryData(lateral, [{ status: "pendente" }]);
  assert.equal(client.getQueryState(ficha)?.isInvalidated, false);
  await invalidarItensAgenda(client);
  assert.equal(client.getQueryState(ficha)?.isInvalidated, true);
  assert.equal(client.getQueryState(lateral)?.isInvalidated, true);
  client.clear();
});