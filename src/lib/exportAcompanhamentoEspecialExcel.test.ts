import { test } from "node:test";
import assert from "node:assert/strict";
import { montarLinhaAcompanhamento, type ExtrasAcompanhamento } from "./exportAcompanhamentoEspecialExcel";

const vazio: ExtrasAcompanhamento = {
  clientes: new Map(),
  responsaveis: new Map(),
  etiquetas: new Map(),
  novidades: new Map(),
};

const processo = {
  id: "p1",
  numero: "0001234-56.2026.8.26.0003",
  polo_ativo: "Banco Santander",
  polo_passivo: "João da Silva",
  tribunal: "TJ-SP",
  vara: "3ª Vara Cível",
  comarca: "São Paulo",
  uf: "SP",
  justica: "Estadual",
  status: "ativo",
  situacao_original: null,
  data_distribuicao: "2026-03-05",
  cliente_id: "c1",
  advogado_responsavel_id: "u1",
  coordenacao: { nome: "Coordenação Santander Cível" },
};

test("linha traz número, partes, tribunal e coordenação", () => {
  const linha = montarLinhaAcompanhamento(processo, vazio);
  assert.equal(linha[0], "0001234-56.2026.8.26.0003");
  assert.equal(linha[1], "Banco Santander");
  assert.equal(linha[2], "João da Silva");
  assert.equal(linha[3], "TJ-SP");
  assert.equal(linha[11], "Coordenação Santander Cível");
});

test("situação ativa vira rótulo legível e distribuição sai em dd/mm/aaaa", () => {
  const linha = montarLinhaAcompanhamento(processo, vazio);
  assert.equal(linha[8], "Ativo");
  assert.equal(linha[15], "05/03/2026");
});

test("cliente, responsável e etiquetas vêm dos mapas complementares", () => {
  const extras: ExtrasAcompanhamento = {
    clientes: new Map([["c1", "Santander Brasil"]]),
    responsaveis: new Map([["u1", "Isabela Constantino"]]),
    etiquetas: new Map([["p1", ["CAPTURA", "Alta relevância"]]]),
    novidades: new Map(),
  };
  const linha = montarLinhaAcompanhamento(processo, extras);
  assert.equal(linha[9], "Santander Brasil");
  assert.equal(linha[10], "Isabela Constantino");
  assert.equal(linha[12], "CAPTURA, Alta relevância");
});

test("sem cliente, responsável ou etiqueta a célula fica vazia", () => {
  const linha = montarLinhaAcompanhamento(
    { ...processo, cliente_id: null, advogado_responsavel_id: null },
    vazio
  );
  assert.equal(linha[9], "");
  assert.equal(linha[10], "");
  assert.equal(linha[12], "");
});

test("novidades somam o total e mostram a data mais recente", () => {
  const extras: ExtrasAcompanhamento = {
    ...vazio,
    novidades: new Map([["p1", { total: 7, ultima: "2026-11-10" }]]),
  };
  const linha = montarLinhaAcompanhamento(processo, extras);
  assert.equal(linha[13], 7);
  assert.equal(linha[14], "10/11/2026");
});

test("processo sem novidade conta zero e deixa a data em branco", () => {
  const linha = montarLinhaAcompanhamento(processo, vazio);
  assert.equal(linha[13], 0);
  assert.equal(linha[14], "");
});
