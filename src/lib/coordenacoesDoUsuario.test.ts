import { test } from "node:test";
import { strict as assert } from "node:assert";
import { carregarCoordenacoesDoUsuario } from "./coordenacoesDoUsuario";

const SANTANDER = "968631d0-6659-46f1-b45d-899892cb0121";
const LIS = "9f54546b-b2bb-46f1-a302-8f1f60641b27";

function clienteFalso(respostas: Record<string, { data: any; error?: any }>) {
  return {
    from(tabela: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve: any, reject: any) => Promise.resolve(respostas[tabela]).then(resolve, reject),
      };
      return chain;
    },
  };
}

test("Lis, advogada e coordenadora local, recebe a Santander Cível mesmo sem coordenação padrão", async () => {
  const resultado = await carregarCoordenacoesDoUsuario(clienteFalso({
    user_roles: { data: [{ role: "advogado" }] },
    membros_coordenacao: { data: [{ coordenacao_id: SANTANDER, cargo: "coordenador" }] },
    coordenacoes: { data: [{ id: SANTANDER, nome: "Coordenação Santander Cível", area: "civil" }] },
  }), LIS);

  assert.equal(resultado.isAdmin, false);
  assert.equal(resultado.podeDelegar, true);
  assert.deepEqual(resultado.idsProprias, [SANTANDER]);
  assert.equal(resultado.coordenacoes[0]?.id, SANTANDER);
});

test("falha ao ler a coordenação é propagada em vez de virar lista vazia", async () => {
  await assert.rejects(() => carregarCoordenacoesDoUsuario(clienteFalso({
    user_roles: { data: [{ role: "advogado" }] },
    membros_coordenacao: { data: [{ coordenacao_id: SANTANDER, cargo: "coordenador" }] },
    coordenacoes: { data: null, error: new Error("conexão temporariamente indisponível") },
  }), LIS), /conexão temporariamente indisponível/);
});

test("falha ao ler os cargos também não produz coordenação vazia", async () => {
  await assert.rejects(() => carregarCoordenacoesDoUsuario(clienteFalso({
    user_roles: { data: [{ role: "advogado" }] },
    membros_coordenacao: { data: null, error: new Error("falha de rede") },
    coordenacoes: { data: [] },
  }), LIS), /falha de rede/);
});
