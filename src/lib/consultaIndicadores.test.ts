import { test } from "node:test";
import { strict as assert } from "node:assert";
import { QueryClient } from "@tanstack/react-query";
import { consultarIndicadoresEmLotes } from "./consultaIndicadores";

test("mais páginas reutilizam lotes completos dos indicadores sem omitir os novos", async () => {
  const client = new QueryClient();
  const chamadas: string[][] = [];
  const consultar = async (ids: string[]) => { chamadas.push(ids); return ids; };
  try {
    await consultarIndicadoresEmLotes(client, "indicadores", ["usuario-a"], ["a", "b"], 2, 60_000, consultar);
    const resultado = await consultarIndicadoresEmLotes(client, "indicadores", ["usuario-a"], ["a", "b", "c"], 2, 60_000, consultar);
    assert.deepEqual(chamadas, [["a", "b"], ["c"]]);
    assert.deepEqual(resultado, ["a", "b", "c"]);
  } finally { client.clear(); }
});

test("escopos distintos não compartilham resultados e invalidação atualiza os lotes", async () => {
  const client = new QueryClient();
  let chamadas = 0;
  const consultar = async (ids: string[]) => { chamadas++; return ids; };
  const buscar = (usuario: string) => consultarIndicadoresEmLotes(client, "indicadores", [usuario], ["a"], 2, 60_000, consultar);
  try {
    await buscar("usuario-a");
    await buscar("usuario-b");
    assert.equal(chamadas, 2);
    await client.invalidateQueries({ queryKey: ["indicadores"] });
    await buscar("usuario-a");
    assert.equal(chamadas, 3);
  } finally { client.clear(); }
});

test("falhas de um lote rejeitam o resultado em vez de ocultar indicadores", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await assert.rejects(consultarIndicadoresEmLotes(client, "indicadores", [], ["a"], 2, 60_000, async () => { throw new Error("consulta falhou"); }), /consulta falhou/);
  } finally { client.clear(); }
});