import { test } from "node:test";
import assert from "node:assert/strict";
import { trechosObservacao, textoObservacaoSemTags } from "./primeiraLinhaObservacao.ts";

test("<destaque> vira trecho destacado e as tags somem do texto", () => {
  const t = trechosObservacao("Processo: <destaque>123</destaque> fim");
  assert.deepEqual(t.filter((x) => x.destaque).map((x) => x.texto), ["123"]);
  assert.equal(textoObservacaoSemTags("Processo: <destaque>123</destaque> fim"), "Processo: 123 fim");
});
