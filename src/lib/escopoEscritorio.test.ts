import { test } from "node:test";
import { strict as assert } from "node:assert";
import { escopoEscritorio } from "./escopoEscritorio";

const base = { coordLoading: false, coordEscolhida: "todas" };

test("assistente com duas coordenações recebe as duas, sem lista de pessoas", () => {
  const r = escopoEscritorio({ ...base, verTodas: false, coordenacoesUsuario: ["civel", "trabalhista"] });
  assert.deepEqual(r, { fetchAll: false, coordenacaoIds: ["civel", "trabalhista"], strictCoordenacaoIsolation: true });
  assert.equal((r as any).responsavelIds, undefined);
});

test("assistente jurídico geral sem coordenação vê todas", () => {
  assert.deepEqual(escopoEscritorio({ ...base, verTodas: true, coordenacoesUsuario: [] }), { fetchAll: true });
});

test("coordenação escolhida mostra só ela", () => {
  const r = escopoEscritorio({ ...base, verTodas: false, coordEscolhida: "civel", coordenacoesUsuario: ["civel", "trabalhista"] });
  assert.deepEqual(r, { fetchAll: false, coordenacaoIds: ["civel"], strictCoordenacaoIsolation: true });
});

test("coordenação escolhida fora do acesso do usuário não é usada", () => {
  const r = escopoEscritorio({ ...base, verTodas: false, coordEscolhida: "gol", coordenacoesUsuario: ["civel"] });
  assert.deepEqual(r, { fetchAll: false, coordenacaoIds: ["civel"], strictCoordenacaoIsolation: true });
});

test("coordenação com visão de todos desligada: membro comum vê só os próprios itens", () => {
  const r = escopoEscritorio({ ...base, verTodas: false, coordenacoesUsuario: ["civel"], coordRestritas: ["civel"], userId: "u1" });
  assert.deepEqual(r, { fetchAll: false, coordenacaoIds: ["civel"], strictCoordenacaoIsolation: false, responsavelIds: ["u1"] });
});

test("coordenador (sem restrição repassada) continua vendo todos da coordenação", () => {
  const r = escopoEscritorio({ ...base, verTodas: false, coordenacoesUsuario: ["civel"], coordRestritas: [], userId: "u1" });
  assert.deepEqual(r, { fetchAll: false, coordenacaoIds: ["civel"], strictCoordenacaoIsolation: true });
});
