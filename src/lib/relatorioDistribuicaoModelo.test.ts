import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  classificarOrgaoDistribuicao,
  formatarDataBr,
  formulaClassificacao,
  montarLinhaRelatorioDistribuicao,
  preencherModeloDistribuicao,
  tribunalOrigemPeloCnj,
  type LinhaRelatorioDistribuicao,
} from "./relatorioDistribuicaoModelo";

test("classificação usa exatamente os cinco termos do modelo", () => {
  for (const orgao of ["Presidência - Admissibilidade", "7ª Turma", "SETR2", "SBDI-II", "SDI-2"]) {
    assert.equal(classificarOrgaoDistribuicao(orgao), "DISTRIBUIÇÃO INICIAL");
  }
  assert.equal(classificarOrgaoDistribuicao("SBDI-1"), "TRÂMITE INTERNO");
  assert.equal(classificarOrgaoDistribuicao("CEJUSC-TST"), "TRÂMITE INTERNO");
});

test("tribunal de origem vem das posições 15 e 16 do CNJ", () => {
  assert.equal(tribunalOrigemPeloCnj("0001171-18.2025.5.13.0005"), "TRT da 13ª Região (PB)");
  assert.equal(tribunalOrigemPeloCnj("0010088-61.2014.5.15.0100"), "TRT da 15ª Região (Campinas)");
  assert.equal(tribunalOrigemPeloCnj("1000890-08.2022.5.02.0312"), "TRT da 2ª Região (SP)");
});

test("banco recorrente ocupa o polo ativo e datas ficam em DD/MM/AAAA", () => {
  const linha = montarLinhaRelatorioDistribuicao({
    id: "1",
    processo: "0001171-18.2025.5.13.0005",
    turma: "7ª Turma",
    relator: "Cláudio Mascarenhas Brandão",
    recorrente: "Reclamada",
    reclamante: "MARIA DA SILVA",
    reclamada: "BANCO SANTANDER (BRASIL) S.A.",
    tipo_recurso_banco: "Agravo de Instrumento",
    data_distribuicao_real: "2026-10-27",
    data_publicacao_djen: "2026-10-28",
  });
  assert.equal(linha.orgao, "7ª Turma - Gab. Cláudio Mascarenhas Brandão");
  assert.equal(linha.poloAtivo, "BANCO SANTANDER (BRASIL) S.A.");
  assert.equal(linha.poloPassivo, "MARIA DA SILVA");
  assert.equal(linha.classe, "AIRR");
  assert.equal(linha.dataDistribuicao, "27/10/2026");
  assert.equal(linha.dataDjen, "28/10/2026");
  assert.equal(formatarDataBr("2026-11-12T15:30:00Z"), "12/11/2026");
  assert.equal(formatarDataBr("2026-11-13T02:30:00Z"), "12/11/2026");
});

test("advogados reúnem OAB e não repetem nomes", () => {
  const linha = montarLinhaRelatorioDistribuicao(
    { id: "1", processo: "0001171-18.2025.5.13.0005", advogados_internos: ["CARLOS ALBERTO SILVA"] },
    [{ nome: "MARIA FERNANDA SANTOS", is_advogado: true }],
    { advogados_identificados: [{ nome: "CARLOS ALBERTO SILVA", oab: "SP 98765" }] },
  );
  assert.equal(linha.advogados, "CARLOS ALBERTO SILVA - OAB/SP 98765; MARIA FERNANDA SANTOS");
});

const linhaExemplo = (processo: string): LinhaRelatorioDistribuicao => ({
  processo,
  orgao: "Presidência - Admissibilidade",
  dataDistribuicao: "27/10/2026",
  dataDjen: "28/10/2026",
  poloAtivo: "BANCO SANTANDER",
  poloPassivo: "PARTE RECORRIDA",
  advogados: "ADVOGADO - OAB/SP 123456",
  classe: "AIRR",
  tribunal: "TRT da 13ª Região (PB)",
  classificacao: "DISTRIBUIÇÃO INICIAL",
  ordemData: "2026-10-27",
});

test("preenchimento remove exemplos, mantém as duas abas e grava fórmula por linha", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Modelo_Distribuicoes");
  ws.addRow(Array.from({ length: 10 }, (_, i) => `Coluna ${i + 1}`));
  for (let r = 2; r <= 7; r++) {
    const row = ws.addRow(["exemplo", "", "", "", "", "", "", "", "", ""]);
    row.getCell(1).font = { name: "Calibri", size: 10, color: { argb: r % 2 ? "FF000000" : "FF111111" } };
  }
  wb.addWorksheet("Instruções_de_Preenchimento").getCell("A1").value = "GUIA";

  const blob = await preencherModeloDistribuicao(wb, [linhaExemplo("0000001-00.2026.5.13.0001"), linhaExemplo("0000002-00.2026.5.13.0002")]);
  assert.ok(blob.size > 1000);

  const conferencia = new ExcelJS.Workbook();
  await conferencia.xlsx.load(await blob.arrayBuffer());
  const saida = conferencia.getWorksheet("Modelo_Distribuicoes")!;
  assert.equal(saida.rowCount, 3);
  assert.equal(saida.getCell("A2").value, "0000001-00.2026.5.13.0001");
  assert.equal(saida.getCell("A3").value, "0000002-00.2026.5.13.0002");
  assert.equal((saida.getCell("J2").value as { formula: string }).formula, formulaClassificacao(2));
  assert.equal((saida.getCell("J3").value as { formula: string }).formula, formulaClassificacao(3));
  assert.equal(conferencia.getWorksheet("Instruções_de_Preenchimento")?.getCell("A1").value, "GUIA");
});
