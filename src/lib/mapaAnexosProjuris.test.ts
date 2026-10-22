import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { montarMapaBackup, indexarAnexosZip, motivoModuloAnexo } from "./mapaAnexosProjuris";

describe("montarMapaBackup", () => {
  test("anexo ligado a processo e tarefa vira uma linha só, preferindo a tarefa", () => {
    const info = new Map([["10", { caminho: "a/b/x.pdf", nome: "x.pdf" }]]);
    const m = montarMapaBackup(info, [
      { cd: "10", modulo: "3", entidade: "P1" },
      { cd: "10", modulo: "4", entidade: "T1" },
    ]);
    assert.deepEqual(m, [{ cd: "10", modulo: "4", entidade: "T1", caminho: "a/b/x.pdf", nome: "x.pdf" }]);
  });
  test("ignora ligação sem arquivo cadastrado", () => {
    assert.deepEqual(montarMapaBackup(new Map(), [{ cd: "1", modulo: "3", entidade: "P" }]), []);
  });
  test("reconhece caminho Windows em zip com pastas Unix", () => {
    const entry = { filename: "backup/anexos/123.PDF" };
    assert.equal(indexarAnexosZip([entry])({ caminho: "C:\\projuris\\123.pdf", nome: "Petição.pdf" }).entry, entry);
  });
  test("reconhece nome original único quando o zip não usa o nome interno", () => {
    const entry = { filename: "Anexos/Petição.pdf" };
    assert.equal(indexarAnexosZip([entry])({ caminho: "/interno/abc.pdf", nome: "Petição.pdf" }).entry, entry);
  });
  test("não escolhe arquivo arbitrário quando há nomes repetidos", () => {
    const find = indexarAnexosZip([{ filename: "a/doc.pdf" }, { filename: "b/doc.pdf" }]);
    assert.deepEqual(find({ caminho: "/interno/doc.pdf", nome: "doc.pdf" }), { ambiguous: true });
    assert.equal(find({ caminho: "a/doc.pdf", nome: "doc.pdf" }).entry?.filename, "a/doc.pdf");
  });
  test("reconhece nmarquivofinal com espaços substituídos pelo Projuris", () => {
    const entry = { filename: "anexos/Captura_de_tela.jpg" };
    assert.equal(indexarAnexosZip([entry])({ caminho: "73807/processo-arquivo/123.jpg", nome: "Captura de tela.jpg", nomeFinal: "Captura_de_tela.jpg" }).entry, entry);
  });
  test("classifica relatórios e planilhas separadamente dos anexos de caso", () => {
    assert.equal(motivoModuloAnexo("52"), "Relatório gerado pelo Projuris (não é anexo de caso)");
    assert.equal(motivoModuloAnexo("85"), "Planilha de importação do Projuris (não é anexo de caso)");
    assert.equal(motivoModuloAnexo("3"), null);
    assert.equal(motivoModuloAnexo("4"), null);
  });
});
