import { test } from "node:test";
import { strict as assert } from "node:assert";
import { limiteIdsVinculadosAgenda } from "./agendaLimiteUrl";

const UUID_CODIFICADO = 39; // 36 caracteres + vírgula codificada (%2C)
const LIMITE_URL = 16_000;
const SELECT_E_FILTROS = 2_500;

test("com 41 pessoas (duas coordenações da Altina) o endereço fica abaixo de 16 KB", () => {
  const pessoas = 41;
  const ids = limiteIdsVinculadosAgenda(pessoas);
  const tamanho = SELECT_E_FILTROS + (2 * pessoas + ids) * UUID_CODIFICADO;
  assert.ok(tamanho < LIMITE_URL, `tamanho ${tamanho}`);
});

test("uma pessoa ainda inclui tarefas em que ela é co-responsável", () => {
  assert.equal(limiteIdsVinculadosAgenda(1), 258);
});

test("muitas pessoas não geram limite negativo", () => {
  assert.equal(limiteIdsVinculadosAgenda(500), 0);
});
