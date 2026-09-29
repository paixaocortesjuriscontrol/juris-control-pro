import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

export type LinhaUso = {
  id: string; nome: string | null; email: string | null; ativo: boolean;
  logins: number; dias_login: number; dias_acao: number; ultimo_acesso: string | null;
  acoes_itens: number; criados: number; atualizados: number; excluidos: number; erros: number;
  acoes_tst: number; consultas_judit: number; usos_ia: number; dias_uteis?: number; criado_em?: string | null;
};
export type DadosUso = {
  usuarios: LinhaUso[];
  por_dia: { dia: string; usuarios: number; logins: number; acoes: number }[];
  por_hora: { hora: number; logins: number }[];
  por_tipo: { tipo: string; qtd: number }[];
};

export const totalAcoes = (l: LinhaUso) => l.acoes_itens + l.acoes_tst + l.consultas_judit + l.usos_ia;
export const nivelUso = (l: LinhaUso, diasUteis: number) => {
  const d = Math.max(l.dias_login, l.dias_acao);
  if (d === 0 && totalAcoes(l) === 0) return "Sem uso";
  const du = l.dias_uteis ?? diasUteis;
  const pct = du ? Math.min(1, d / du) : (d > 0 ? 1 : 0);
  if (pct >= 0.6) return "Alto";
  if (pct >= 0.25) return "Médio";
  return "Baixo";
};
export const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
const dBr = (s: string) => s.split("-").reverse().join("/");

interface Params { dados: DadosUso; inicio: string; fim: string; coordenacao: string; diasUteis: number }

const cabecalho = ["Usuário", "Nível", "Dias ativos", "Acessos", "Último acesso", "Ações em itens", "Criados", "Alterados", "Excluídos", "Distribuição TST", "Judit", "IA", "Total"];
const linha = (l: LinhaUso, du: number) => [
  l.nome || l.email || "—", nivelUso(l, du), Math.max(l.dias_login, l.dias_acao), l.logins, dataHora(l.ultimo_acesso),
  l.acoes_itens, l.criados, l.atualizados, l.excluidos, l.acoes_tst, l.consultas_judit, l.usos_ia, totalAcoes(l),
];

export function resumo(d: DadosUso, du: number) {
  const u = d.usuarios;
  const ativos = u.filter((l) => nivelUso(l, du) !== "Sem uso").length;
  return {
    total: u.length, ativos, semUso: u.length - ativos,
    adocao: u.length ? Math.round((ativos / u.length) * 100) : 0,
    acessos: u.reduce((s, l) => s + l.logins, 0),
    acoes: u.reduce((s, l) => s + totalAcoes(l), 0),
    mediaDiaria: d.por_dia.length ? Math.round(d.por_dia.reduce((s, x) => s + x.usuarios, 0) / d.por_dia.length) : 0,
    horaPico: [...d.por_hora].sort((a, b) => b.logins - a.logins)[0]?.hora,
  };
}

type Serie = { rotulo: string; valores: number[]; cor: [number, number, number] };
function grafico(doc: jsPDF, x: number, y: number, w: number, h: number, titulo: string, sub: string, labels: string[], series: Serie[]) {
  doc.setDrawColor(220); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 2, 2, "S");
  doc.setTextColor(30); doc.setFontSize(10); doc.text(titulo, x + 4, y + 6);
  doc.setFontSize(7); doc.setTextColor(120); doc.text(sub, x + 4, y + 10);
  const px = x + 10, py = y + 14, pw = w - 14, ph = h - 24;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  doc.setDrawColor(235); doc.setFontSize(6);
  for (let i = 0; i <= 4; i++) {
    const yy = py + ph - (ph * i) / 4; doc.line(px, yy, px + pw, yy);
    doc.text(String(Math.round((max * i) / 4)), px - 1, yy + 1, { align: "right" });
  }
  const n = labels.length || 1, gw = pw / n, bw = Math.max(0.4, (gw * 0.8) / series.length);
  series.forEach((s, si) => {
    doc.setFillColor(...s.cor);
    s.valores.forEach((v, i) => { const bh = (ph * v) / max; if (bh > 0) doc.rect(px + i * gw + gw * 0.1 + si * bw, py + ph - bh, bw, bh, "F"); });
  });
  const passo = Math.ceil(n / 16);
  labels.forEach((l, i) => { if (i % passo === 0) doc.text(l, px + i * gw + gw / 2, py + ph + 4, { align: "center" }); });
  let lx = x + w - 4;
  [...series].reverse().forEach((s) => {
    const tw = doc.getTextWidth(s.rotulo); lx -= tw + 6;
    doc.setFillColor(...s.cor); doc.rect(lx, y + 3.5, 3, 3, "F"); doc.setTextColor(80); doc.text(s.rotulo, lx + 4, y + 6);
  });
}

export function exportarPdf({ dados, inicio, fim, coordenacao, diasUteis }: Params) {
  const doc = new jsPDF({ orientation: "landscape" });
  const r = resumo(dados, diasUteis);
  doc.setFillColor(22, 34, 68); doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255); doc.setFontSize(16); doc.text("Relatório de Usabilidade do Sistema", 14, 12);
  doc.setFontSize(9); doc.text(`Juris Control · Paixão Cortes Advogados · Período ${dBr(inicio)} a ${dBr(fim)} · ${coordenacao}`, 14, 19);
  const cards: [string, string][] = [["Usuários", String(r.total)], ["Com uso", String(r.ativos)], ["Sem uso", String(r.semUso)],
    ["Adoção", `${r.adocao}%`], ["Acessos", r.acessos.toLocaleString("pt-BR")], ["Ações", r.acoes.toLocaleString("pt-BR")]];
  const cw = (269 - 5 * 4) / 6;
  cards.forEach(([l, v], i) => {
    const cx = 14 + i * (cw + 4);
    doc.setDrawColor(220); doc.roundedRect(cx, 30, cw, 20, 2, 2, "S");
    doc.setFillColor(201, 154, 38); doc.rect(cx, 30, 1.5, 20, "F");
    doc.setFontSize(8); doc.setTextColor(120); doc.text(l, cx + 5, 36);
    doc.setFontSize(16); doc.setTextColor(22, 34, 68); doc.text(v, cx + 5, 46);
  });
  const labelsDia = dados.por_dia.map((d) => d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7));
  grafico(doc, 14, 56, 175, 80, "Uso diário", `Pessoas com uso e ações em itens por dia (BRT) · média de ${r.mediaDiaria} pessoa(s) por dia`, labelsDia, [
    { rotulo: "Pessoas", valores: dados.por_dia.map((d) => d.usuarios), cor: [22, 34, 68] },
    { rotulo: "Ações em itens", valores: dados.por_dia.map((d) => d.acoes), cor: [201, 154, 38] },
  ]);
  const horas = Array.from({ length: 24 }, (_, h) => dados.por_hora.find((x) => x.hora === h)?.logins || 0);
  grafico(doc, 193, 56, 90, 80, "Horários de uso", r.horaPico != null ? `Pico às ${r.horaPico}h (BRT)` : "Por hora (BRT)",
    horas.map((_, h) => `${h}h`), [{ rotulo: "Uso", valores: horas, cor: [22, 34, 68] }]);
  if (dados.por_tipo.length) autoTable(doc, {
    startY: 142, margin: { left: 14 }, theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [22, 34, 68] },
    head: [["Tipo de item", "Ações"]], body: dados.por_tipo.map((t) => [t.tipo, t.qtd]), tableWidth: 90,
  });
  doc.addPage();
  autoTable(doc, {
    startY: 14, theme: "striped", styles: { fontSize: 7.5 },
    headStyles: { fillColor: [22, 34, 68] }, head: [cabecalho], body: dados.usuarios.map((l) => linha(l, diasUteis)),
  });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${dataHora(new Date().toISOString())} (BRT) · Página ${i} de ${n}`, 14, 204);
  }
  doc.save(`usabilidade_${inicio}_${fim}.pdf`);
}

export async function exportarExcel({ dados, inicio, fim, coordenacao, diasUteis }: Params) {
  const wb = new ExcelJS.Workbook();
  const head = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF162244" } };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const r = resumo(dados, diasUteis);
  const s = wb.addWorksheet("Resumo");
  s.addRows([["Indicador", "Valor"], ["Período", `${dBr(inicio)} a ${dBr(fim)}`], ["Coordenação", coordenacao],
    ["Usuários", r.total], ["Com uso", r.ativos], ["Sem uso", r.semUso], ["Adoção", r.adocao / 100],
    ["Acessos", r.acessos], ["Ações", r.acoes], ["Média diária de usuários", r.mediaDiaria],
    ["Horário de pico", r.horaPico != null ? `${r.horaPico}h` : "—"]]);
  s.getCell("B7").numFmt = "0%"; s.columns = [{ width: 28 }, { width: 28 }]; head(s);
  const u = wb.addWorksheet("Usuários");
  u.addRow([...cabecalho, "E-mail"]);
  dados.usuarios.forEach((l) => u.addRow([...linha(l, diasUteis), l.email || ""]));
  u.columns.forEach((c, i) => (c.width = i === 0 || i === 13 ? 32 : 14)); head(u);
  u.autoFilter = { from: "A1", to: "N1" };
  const d = wb.addWorksheet("Por dia");
  d.addRow(["Data", "Usuários", "Acessos", "Ações em itens"]);
  dados.por_dia.forEach((x) => d.addRow([dBr(x.dia), x.usuarios, x.logins, x.acoes]));
  d.columns.forEach((c) => (c.width = 16)); head(d);
  const h = wb.addWorksheet("Por horário");
  h.addRow(["Hora (BRT)", "Acessos"]); dados.por_hora.forEach((x) => h.addRow([`${x.hora}h`, x.logins]));
  h.columns.forEach((c) => (c.width = 14)); head(h);
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `usabilidade_${inicio}_${fim}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
}
