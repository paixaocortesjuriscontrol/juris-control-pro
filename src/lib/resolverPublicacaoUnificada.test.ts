import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverPublicacaoUnificada, type ClienteResolverPublicacao } from "./resolverPublicacaoUnificada";

test("publicação do DJEN Servidor é resolvida pela rotina que preserva a coordenação", async () => {
  const chamadas: string[] = [];
  const cliente: ClienteResolverPublicacao = {
    rpc: async (nome, args) => {
      chamadas.push(`${nome}:${args.p_servidor_id}`);
      return { data: "publicacao-da-mesma-coordenacao", error: null };
    },
  };

  const id = await resolverPublicacaoUnificada("publicacao-legada", cliente);

  assert.equal(id, "publicacao-da-mesma-coordenacao");
  assert.deepEqual(chamadas, ["garantir_publicacao_unificada:publicacao-legada"]);
});

test("falha na resolução não permite vincular um identificador alternativo", async () => {
  const cliente: ClienteResolverPublicacao = {
    rpc: async () => ({ data: null, error: new Error("Sem acesso à coordenação") }),
  };

  await assert.rejects(
    resolverPublicacaoUnificada("publicacao-legada", cliente),
    /Sem acesso à coordenação/,
  );
});
