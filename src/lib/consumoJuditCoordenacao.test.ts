import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resumirConsultasPorCoordenacao, SEM_COORDENACAO_IDENTIFICADA } from "./consumoJuditCoordenacao";

test("totaliza consultas, cobradas e custo pela coordenação atual do processo", () => {
  const coordenacoes = new Map([
    ["0000001-00.2026.8.26.0000", "Santander Cível"],
    ["0000002-00.2026.5.02.0000", "Santander Trabalhista"],
  ]);

  const resultado = resumirConsultasPorCoordenacao([
    { processo_numero: "0000001-00.2026.8.26.0000", cobrado: true, custo: 0.25 },
    { processo_numero: "0000001-00.2026.8.26.0000", cobrado: false, custo: 0 },
    { processo_numero: "0000002-00.2026.5.02.0000", cobrado: true, custo: 3.75 },
  ], coordenacoes);

  assert.deepEqual(resultado, [
    { coordenacao: "Santander Cível", total: 2, cobradas: 1, custo: 0.25 },
    { coordenacao: "Santander Trabalhista", total: 1, cobradas: 1, custo: 3.75 },
  ]);
});

test("mantém consultas sem processo cadastrado em uma linha separada", () => {
  const resultado = resumirConsultasPorCoordenacao([
    { processo_numero: "9999999-99.2026.8.26.9999", cobrado: false, custo: 0 },
  ], new Map());

  assert.deepEqual(resultado, [
    { coordenacao: SEM_COORDENACAO_IDENTIFICADA, total: 1, cobradas: 0, custo: 0 },
  ]);
});
