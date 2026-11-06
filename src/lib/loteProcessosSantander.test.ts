import { test } from "node:test";
import assert from "node:assert/strict";
import { coordenacaoPermiteLote, lerLinhasLote } from "./loteProcessosSantander";

const cab = ["Tipo", "Número do processo", "Responsável", "Coordenção Responsável", "Rito processual", "Valor da causa"];

test("só Santander Cível e Trabalhista permitem lote", () => {
  assert.equal(coordenacaoPermiteLote("Coordenação Santander Cível"), true);
  assert.equal(coordenacaoPermiteLote("Coordenação Santander Trabalhista"), true);
  assert.equal(coordenacaoPermiteLote("Coordenação GOL"), false);
});

test("mapeia colunas do modelo", () => {
  const [l] = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "ISABELA", "Coordenação Santander Cível", "Juizado Especial Civel", 15000]], "Coordenação Santander Cível");
  assert.equal(l.erro, undefined);
  assert.equal(l.campos.numero, "0803543-57.2025.8.19.0014");
  assert.equal(l.campos.rito_processual, "Juizado Especial Cível");
  assert.equal(l.campos.valor_causa, 15000);
});

test("rejeita outra coordenação e número inválido", () => {
  const r = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "X", "Coordenação GOL"], [null, "123"]], "Coordenação Santander Cível");
  assert.match(r[0].erro!, /Coordenação diferente/);
  assert.match(r[1].erro!, /inválido/);
});

test("aceita 'Coodernação' escrito errado na planilha", () => {
  const [ok] = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "ISABELA", "Coodernação Santander Cível"]], "Coordenação Santander Cível");
  assert.equal(ok.erro, undefined);
  const [outra] = lerLinhasLote([cab, [null, "0803543-57.2025.8.19.0014", "ISABELA", "Coordenação GOL"]], "Coordenação Santander Cível");
  assert.match(outra.erro ?? "", /Coordenação diferente/);
});

import { lerLinhasLote as ler2 } from "./loteProcessosSantander";
describe("modelo novo de importação", () => {
  it("lê as colunas novas", () => {
    const cab = ["Tipo de Processo","Número do Processo","Objeto da Ação (assunto)","Sistema Judicial","Etiquetas","Polo Ativo (Reclamante / Autor)","Polo Passivo (Reclamado / Réu)","Processos Relacionados","Descrição","Órgao Julgador"];
    const [l] = ler2([cab, ["RT","00000011220265100811","Horas extras","PJE","A; B","Fulano","Banco","123","texto","1ª Vara"]], "Santander Cível");
    expect(l.erro).toBeUndefined();
    expect(l.campos).toMatchObject({ tipo_processo: "RT", assunto: "Horas extras", sistema: "PJE", _etiquetas: "A; B", polo_ativo: "Fulano", polo_passivo: "Banco", processos_relacionados: "123", descricao: "texto", orgao_julgador: "1ª Vara" });
  });
});
