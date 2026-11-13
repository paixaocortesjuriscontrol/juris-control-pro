import { test } from "node:test";
import { strict as assert } from "node:assert";
import { juntarRepetidos, nomeClienteSemPapel, separarEtiquetas } from "./importacaoPlanilhaCompleta";

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
