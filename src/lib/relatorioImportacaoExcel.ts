import ExcelJS from "exceljs";
import type { ResultadoCliente, ResultadoLinha } from "@/lib/importacaoPlanilhaCompleta";

export interface DadosRelatorioExcel {
  coordenacao: string; usuario: string; inicio: Date; fim: Date; situacao: string;
  totalLinhas: number; invalidas: { linha: number; numero: string; motivo: string }[];
  repetidas: number; resultados: ResultadoLinha[]; corrigidos: number; etiquetasAcrescentadas: number;
  errosEtiqueta: number; falhasEtiqueta: { numero: string; etiqueta: string; motivo: string }[];
  clientesNaoEncontrados: { nome: string; processos: number }[];
  clientesDetalhes: ResultadoCliente[]; clientesCriados: number; avisos: string[];
}

const AZUL = "FF1F3864", CINZA = "FFF2F2F2", BRANCO = "FFFFFFFF";
const COR: Record<string, string> = { importado: "FFE2EFDA", ja_existia: "FFDDEBF7", vinculado_outra: "FFFFF2CC", erro: "FFF8CBAD" };
const ROT: Record<string, string> = { importado: "Novo", ja_existia: "Já existia na coordenação", vinculado_outra: "Vinculado – existia em outra coordenação", erro: "Erro" };
const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const borda = { top: { style: "thin" as const, color: { argb: "FFBFBFBF" } }, bottom: { style: "thin" as const, color: { argb: "FFBFBFBF" } }, left: { style: "thin" as const, color: { argb: "FFBFBFBF" } }, right: { style: "thin" as const, color: { argb: "FFBFBFBF" } } };

function tabela(wb: ExcelJS.Workbook, nome: string, titulo: string, cols: { h: string; w: number }[], linhas: any[][], corLinha?: (i: number) => string | undefined) {
  const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = cols.map(c => ({ width: c.w }));
  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1); t.value = titulo; t.font = { name: "Arial", size: 14, bold: true, color: { argb: AZUL } };
  ws.getRow(1).height = 24;
  const h = ws.getRow(3); h.values = cols.map(c => c.h); h.height = 20;
  h.eachCell(c => { c.font = { name: "Arial", bold: true, color: { argb: BRANCO } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } }; c.alignment = { vertical: "middle" }; c.border = borda; });
  if (!linhas.length) { ws.getCell(4, 1).value = "Nenhum registro."; ws.getCell(4, 1).font = { name: "Arial", italic: true }; return ws; }
  linhas.forEach((l, i) => {
    const r = ws.addRow(l);
    const cor = corLinha?.(i) ?? (i % 2 ? CINZA : undefined);
    r.eachCell({ includeEmpty: true }, c => { c.font = { name: "Arial", size: 10 }; c.border = borda; c.alignment = { vertical: "top", wrapText: true }; if (cor) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } }; });
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + linhas.length, column: cols.length } };
  return ws;
}

export async function gerarRelatorioImportacaoExcel(d: DadosRelatorioExcel): Promise<Blob> {
  const wb = new ExcelJS.Workbook(); wb.creator = "Juris Control";
  const cnt = (s: string) => d.resultados.filter(r => r.status === s).length;
  const erros = d.resultados.filter(r => r.status === "erro");
  const vinc = d.resultados.filter(r => r.status === "vinculado_outra");

  const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 4 }, { width: 46 }, { width: 22 }];
  ws.mergeCells("B2:C2"); const t = ws.getCell("B2"); t.value = "Relatório de Importação de Processos";
  t.font = { name: "Arial", size: 18, bold: true, color: { argb: BRANCO } }; t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } }; t.alignment = { vertical: "middle", indent: 1 }; ws.getRow(2).height = 34;
  const info: [string, string][] = [["Coordenação", d.coordenacao], ["Importado por", d.usuario], ["Início (Brasília)", fmt(d.inicio)], ["Fim (Brasília)", fmt(d.fim)], ["Situação", d.situacao]];
  info.forEach(([k, v], i) => { const r = ws.getRow(4 + i); r.getCell(2).value = k; r.getCell(3).value = v; r.getCell(2).font = { name: "Arial", bold: true, color: { argb: "FF595959" } }; r.getCell(3).font = { name: "Arial", bold: k === "Situação" }; });
  const sit = ws.getCell(8, 3); sit.font = { name: "Arial", bold: true, color: { argb: d.situacao.includes("SEM") ? "FF375623" : "FFC00000" } };
  const tot: [string, number, string][] = [
    ["Linhas na planilha", d.totalLinhas, BRANCO], ["Linhas sem número (ignoradas)", d.invalidas.length, CINZA], ["Linhas repetidas juntadas", d.repetidas, CINZA],
    ["Processos novos cadastrados", cnt("importado"), COR.importado], ["Já existiam na coordenação", cnt("ja_existia"), COR.ja_existia],
    ["   dos quais corrigidos", d.corrigidos, COR.ja_existia], ["   etiquetas acrescentadas", d.etiquetasAcrescentadas, COR.ja_existia],
    ["Vinculados (existiam em outra coordenação)", vinc.length, COR.vinculado_outra], ["Processos com erro", erros.length, COR.erro],
    ["Etiquetas não aplicadas", d.errosEtiqueta, d.errosEtiqueta ? COR.erro : COR.importado],
    ["Clientes novos cadastrados e vinculados", d.clientesCriados, COR.importado],
    ["Clientes com pendência", d.clientesNaoEncontrados.length, d.clientesNaoEncontrados.length ? COR.erro : COR.importado],
  ];
  const h = ws.getRow(10); h.getCell(2).value = "Indicador"; h.getCell(3).value = "Quantidade";
  [2, 3].forEach(c => { const x = h.getCell(c); x.font = { name: "Arial", bold: true, color: { argb: BRANCO } }; x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } }; x.border = borda; });
  tot.forEach(([k, v, cor], i) => { const r = ws.getRow(11 + i); r.getCell(2).value = k; r.getCell(3).value = v; r.getCell(3).numFmt = "#,##0"; [2, 3].forEach(c => { const x = r.getCell(c); x.font = { name: "Arial", bold: !k.startsWith(" ") }; x.border = borda; x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cor } }; }); r.getCell(3).alignment = { horizontal: "right" }; });
  if (d.avisos.length) {
    const base = 13 + tot.length; ws.getCell(base, 2).value = "Observações"; ws.getCell(base, 2).font = { name: "Arial", bold: true, size: 12, color: { argb: AZUL } };
    d.avisos.forEach((a, i) => { ws.mergeCells(base + 1 + i, 2, base + 1 + i, 3); const c = ws.getCell(base + 1 + i, 2); c.value = `• ${a}`; c.font = { name: "Arial", size: 10 }; c.alignment = { wrapText: true }; });
  }

  const atencao = [
    ...erros.map(r => [r.linhaOriginal, r.numero, "Erro", r.mensagem ?? ""]),
    ...vinc.map(r => [r.linhaOriginal, r.numero, `Vinculado (${r.coordenacaoOutra ?? "outra coordenação"})`, r.mensagem ?? ""]),
    ...d.falhasEtiqueta.map(f => ["", f.numero, "Etiqueta não aplicada", `${f.etiqueta}: ${f.motivo}`]),
    ...d.clientesDetalhes.filter(c => c.status === "erro").map(c => ["", "", "Cliente com pendência", `${c.nome}: ${c.mensagem ?? "Não foi possível cadastrar ou vincular"}`]),
  ];
  tabela(wb, "Atenção", "Itens que precisam de atenção", [{ h: "Linha", w: 8 }, { h: "Número do Processo", w: 28 }, { h: "Tipo", w: 38 }, { h: "O que aconteceu", w: 90 }], atencao,
    i => atencao[i][2] === "Erro" ? COR.erro : String(atencao[i][2]).startsWith("Vinc") ? COR.vinculado_outra : "FFFCE4D6");
  tabela(wb, "Clientes", "Clientes usados na importação", [{ h: "Cliente (como está na planilha)", w: 70 }, { h: "Tipo", w: 20 }, { h: "Processos", w: 14 }, { h: "Resultado", w: 24 }, { h: "Detalhe", w: 65 }],
    d.clientesDetalhes.map(c => [c.nome, c.tipo === "pessoa_juridica" ? "Pessoa jurídica" : "Pessoa física", c.processos, c.status === "cadastrado" ? "Cadastrado e vinculado" : c.status === "ja_existia" ? "Já existia; vinculado" : "Pendência", c.mensagem ?? ""]),
    i => d.clientesDetalhes[i].status === "erro" ? COR.erro : d.clientesDetalhes[i].status === "cadastrado" ? COR.importado : undefined);
  const ord = [...d.resultados].sort((a, b) => a.linhaOriginal - b.linhaOriginal);
  tabela(wb, "Processos", "Resultado processo a processo", [{ h: "Linha", w: 8 }, { h: "Número do Processo", w: 28 }, { h: "Resultado", w: 38 }, { h: "Detalhe", w: 90 }],
    ord.map(r => [r.linhaOriginal, r.numero, ROT[r.status], r.mensagem ?? ""]), i => ord[i].status === "importado" || ord[i].status === "ja_existia" ? (i % 2 ? CINZA : undefined) : COR[ord[i].status]);
  tabela(wb, "Linhas ignoradas", "Linhas da planilha que não foram importadas", [{ h: "Linha", w: 8 }, { h: "Número do Processo", w: 28 }, { h: "Motivo", w: 60 }],
    d.invalidas.map(i => [i.linha, i.numero || "(em branco)", i.motivo.replace(/^Número do processo: Campo obrigatório$/, "Número do processo em branco")]));
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
