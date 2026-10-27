import { test } from "node:test";
import { strict as assert } from "node:assert";
import { complementosProjuris, fontesComplementosUnicas, selecionarComplementos } from "./projurisComplementos";

test("recuperação preserva informações já preenchidas", () => {
  const r = selecionarComplementos({ descricao: "Informação atual", assunto: "", valor_causa: 0 }, { descricao: "Texto Projuris", assunto: "Indenização", valor_causa: 20 });
  assert.deepEqual(r.preencher, { assunto: "Indenização" });
  assert.deepEqual(r.conflitos, { descricao: "Texto Projuris", valor_causa: 20 });
});
test("descrição original é recuperada integralmente, sem cortar em 4000", () => {
  const s = "a".repeat(6000);
  assert.equal(complementosProjuris({ descricao: s }).descricao, s);
  assert.equal(complementosProjuris({ descricao: s }).observacoes_processo, s);
});
test("recuperação aceita datas e números válidos e rejeita datas inexistentes", () => {
  assert.deepEqual(complementosProjuris({ dtcitacao: "2026-10-27", dtrecebimento: "2026-02-30", vlacao: "20000.000", vlcondenacao: "inválido" }), { data_citacao: "2026-10-27", valor_causa: 20000 });
});
test("não recupera por CNJ ambíguo nem por processo inativo", () => {
  const rows = [{ cdprocesso: "1", flativo: "S", descricao: "A" }, { cdprocesso: "2", flativo: "S", descricao: "B" }, { cdprocesso: "3", flativo: "N", descricao: "C" }];
  const nums = rows.map(r => ({ cdprocesso: r.cdprocesso, flativo: "S", denumeroprocesso: "00002104320248160146" }));
  const out = fontesComplementosUnicas(rows, nums);
  assert.deepEqual(out.fontes, []);
  assert.equal(out.ambiguos, 1);
});
test("duas versões idênticas do backup não tornam a origem ambígua", () => {
  const row = { cdprocesso: "1", flativo: "S", descricao: "A" };
  const n = { cdprocesso: "1", flativo: "S", denumeroprocesso: "00002104320248160146" };
  assert.equal(fontesComplementosUnicas([row, row], [n, n]).fontes.length, 1);
});
test("sigilo e instância respeitam valores explícitos do Projuris e falso não é vazio", () => {
  assert.deepEqual(complementosProjuris({ flsegredojustica: "S", flprocessoinstancia: "SEGUNDA_INSTANCIA" }), { instancia: "Segunda instância", segredo_justica: true });
  assert.deepEqual(selecionarComplementos({ segredo_justica: false }, { segredo_justica: true }).preencher, {});
  assert.equal(complementosProjuris({ flsegredojustica: "desconhecido" }).segredo_justica, undefined);
});