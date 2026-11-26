import { test } from "node:test";
import assert from "node:assert/strict";
import { coletarIdsAuditoria, formatValorAuditoria, type ReferenciasAuditoria } from "./auditoriaReferencias";

const ANA = "11111111-1111-4111-8111-111111111111";
const BRUNA = "22222222-2222-4222-8222-222222222222";
const PROCESSO = "33333333-3333-4333-8333-333333333333";
const refs: ReferenciasAuditoria = {
  usuarios: { [ANA]: "Ana Souza", [BRUNA]: "Bruna Lima" },
  processos: { [PROCESSO]: "4001012-49.2026.8.26.0008" },
  coordenacoes: {},
  clientes: {},
  modelos: {},
  todos: { [ANA]: "Ana Souza", [BRUNA]: "Bruna Lima", [PROCESSO]: "4001012-49.2026.8.26.0008" },
};

test("responsável anterior e novo aparecem pelos nomes, nunca pelos IDs", () => {
  assert.equal(formatValorAuditoria("responsavel_id", ANA, refs), "Ana Souza");
  assert.equal(formatValorAuditoria("responsavel_id", BRUNA, refs), "Bruna Lima");
});

test("processo vinculado aparece pelo número", () => {
  assert.equal(formatValorAuditoria("processo_id", PROCESSO, refs), "4001012-49.2026.8.26.0008");
});

test("listas de responsáveis e envolvidos viram nomes separados", () => {
  assert.equal(formatValorAuditoria("responsaveis", [ANA, BRUNA], refs), "Ana Souza, Bruna Lima");
  assert.equal(formatValorAuditoria("envolvidos", [BRUNA], refs), "Bruna Lima");
});

test("ID sem cadastro legível não é despejado na tela ou no relatório", () => {
  assert.equal(formatValorAuditoria("responsavel_id", "99999999-9999-4999-8999-999999999999", refs), "Registro não identificado");
});

test("coleta IDs dos valores e dos vínculos do processo para uma única resolução", () => {
  const ids = coletarIdsAuditoria([
    { campo: "responsavel_id", de: ANA, para: BRUNA },
    { campo: "processo_id", de: PROCESSO, para: PROCESSO },
  ]);
  assert.deepEqual(Array.from(ids.usuarios).sort(), [ANA, BRUNA].sort());
  assert.deepEqual(Array.from(ids.processos), [PROCESSO]);
});
