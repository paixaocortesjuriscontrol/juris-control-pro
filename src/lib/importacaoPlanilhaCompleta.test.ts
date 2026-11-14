import { test } from "node:test";
import { strict as assert } from "node:assert";
import { juntarRepetidos, nomeClienteSemPapel, separarEtiquetas, temEtiquetaCaptura, etiquetasParaVincular, tipoClientePorNome } from "./importacaoPlanilhaCompleta";

const l = (numero: string, etiquetas: string[], dados: Record<string, any> = {}) =>
  ({ numero, etiquetas, responsavel: null, cliente: null, linhaOriginal: 2, dados });

test("junta números repetidos e soma etiquetas", () => {
  const r = juntarRepetidos([l("0001-1.2024.8.26.0001", ["A"]), l("000112024826 0001", ["B", "A"], { assunto: "X" })]);
  assert.equal(r.unicos.length, 1);
  assert.equal(r.repetidas, 1);
  assert.deepEqual(r.unicos[0].etiquetas, ["A", "B"]);
  assert.equal(r.unicos[0].dados.assunto, "X");
});
test("tira o papel do nome do cliente", () => {
  assert.equal(nomeClienteSemPapel("BANCO SANTANDER (BRASIL) S/A (Requerido)"), "BANCO SANTANDER (BRASIL) S/A");
});
test("separa etiquetas", () => {
  assert.deepEqual(separarEtiquetas("OUTLIER; LGPD,OUTLIER"), ["OUTLIER", "LGPD"]);
});
test("CAPTURA liga o Acompanhamento Especial, inclusive em linha repetida", () => {
  const r = juntarRepetidos([l("0001-1.2024.8.26.0001", ["OUTLIER"]), l("0001120248260001", ["captura"])]);
  assert.equal(temEtiquetaCaptura(r.unicos[0].etiquetas), true);
  assert.equal(temEtiquetaCaptura(["OUTLIER"]), false);
});
import { vinculosFaltantes } from "./importacaoPlanilhaCompleta";
test("vírgula gera várias etiquetas", () => {
  assert.deepEqual(separarEtiquetas("CONTENCIOSO, OUTLIER, LGPD"), ["CONTENCIOSO", "OUTLIER", "LGPD"]);
});
test("reimportação só acrescenta etiquetas que faltam", () => {
  assert.deepEqual(vinculosFaltantes("p1", ["e1", "e2", "e2"], new Set(["p1|e1"])), ["e2"]);
  assert.deepEqual(vinculosFaltantes("p1", ["e1"], new Set(["p1|e1"])), []);
});
import { camposParaPreencher, traduzirErro } from "./importacaoPlanilhaCompleta";
test("só preenche campos vazios, nunca troca dado existente", () => {
  assert.deepEqual(camposParaPreencher({ comarca: "SP", uf: null, polo_ativo: "" }, { comarca: "RJ", uf: "SP", polo_ativo: "Fulano", vara: "" }), { uf: "SP", polo_ativo: "Fulano" });
});
test("traduz número duplicado", () => {
  assert.equal(traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "processos_numero_digits_uidx"' }), "Número já cadastrado no sistema.");
});
test("cliente combinado usa o primeiro nome", () => {
  assert.equal(nomeClienteSemPapel("BANCO SANTANDER (BRASIL) S/A (Requerido), OSMAR MENDES PAIXAO CORTES"), "BANCO SANTANDER (BRASIL) S/A");
});
test("CAPTURA nunca é inserida manualmente; as demais etiquetas são preservadas", () => {
  assert.deepEqual(etiquetasParaVincular(["CAPTURA", "OUTLIER", "captura", "LGPD"]), ["OUTLIER", "LGPD"]);
});
test("cliente novo usa pessoa jurídica para empresa e física para pessoa", () => {
  assert.equal(tipoClientePorNome("BANCO SANTANDER (BRASIL) S/A"), "pessoa_juridica");
  assert.equal(tipoClientePorNome("GOL LINHAS AEREAS S.A."), "pessoa_juridica");
  assert.equal(tipoClientePorNome("OSMAR MENDES PAIXAO CORTES"), "pessoa_fisica");
});
