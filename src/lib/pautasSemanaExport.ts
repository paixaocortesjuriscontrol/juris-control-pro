import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { PautaTst } from "@/hooks/usePautasTst";
import { baixarXlsxTst } from "@/lib/estiloPlanilhaTst";
import { normalizarEquipeTst, normalizarReclamada, relatorSoNome, horarioPadrao, MAIUSCULAS, CAMPOS_A_PREENCHER } from "@/lib/pautaPadrao";

export const COLUNAS_PAUTA: [string, string][] = [
  ["EQUIPE", "equipe"],
  ["ADVOGADO INTERNO", "advogado_interno"],
  ["DOSSIÊ", "dossie"],
  ["NUMERO DO PROCESSO", "processo_numero"],
  ["RECLAMANTE", "reclamante"],
  ["RECLAMADA", "reclamada"],
  ["PARTE RECORRENTE", "parte_recorrente"],
  ["TIPO DE RECURSO", "tipo_recurso"],
  ["DATA DO JULGAMENTO", "data_julgamento"],
  ["HORARIO", "horario"],
  ["MODALIDADE", "modalidade"],
  ["LINK DE ACESSO", "link_acesso"],
  ["ORGÃO", "orgao"],
  ["RELATOR", "relator"],
  ["MATERIA - RECURSO DO RECLAMANTE", "materia_recurso_reclamante"],
  ["RECURSO DO RECLAMANTE - APARELHAMENTO", "aparelhamento_reclamante"],
  ["RECURSO RECLAMANTE - CHANCE EXITO", "chance_exito_reclamante"],
  ["MATERIA - RECURSO DO BANCO", "materia_recurso_banco"],
  ["RECURSO DO BANCO - APARELHAMENTO", "aparelhamento_banco"],
  ["RECURSO DO BANCO - CHANCE EXITO", "chance_exito_banco"],
  ["HONRA", "honra"],
  ["DECISÃO", "decisao"],
  ["SUSTENTAÇÃO ORAL", "sustentacao_oral"],
  ["DESISTENCIA DO RECURSO", "desistencia_recurso"],
  ["MÍDIA NEGATIVA", "midia_negativa"],
  ["ENTREGA DE MEMORIAS", "entrega_memoriais"],
  ["SOLICITAÇÃO DE PROVIDENCIAS BANCO", "solicitacao_providencias_banco"],
  ["SOLICITAÇÃO - ROSA OLIVEIRA", "solicitacao_rosa_oliveira"],
  ["COMENTARIOS ADVOGADO INTERNO RESPONSAVEL", "comentarios_advogado"],
  ["RETORNO\\ESCLARECIMENTOS CENTRALIZADOS", "retorno_esclarecimentos"],
  ["RESULTADO\\PROXIMA SESSÃO", "resultado_proxima_sessao"],
];

const br = (iso?: string | null) => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Segunda-feira (YYYY-MM-DD) da semana de uma data. */
export function segundaDaSemana(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function nomeAbaSemana(segunda: string, indice: number): string {
  const ini = new Date(segunda + "T12:00:00");
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 4);
  const f = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${indice}. ${f(ini)} a ${f(fim)}`.slice(0, 31);
}

/** Valor da célula no padrão da pauta (maiúsculas, opções fixas, "A PREENCHER"). */
export function valorPadraoPauta(p: any, k: string): string {
  const v = p[k];
  switch (k) {
    case "data_julgamento": return br(v);
    case "equipe": return normalizarEquipeTst(v) ?? "";
    case "advogado_interno": return MAIUSCULAS(v) || "A PREENCHER";
    case "modalidade": case "decisao": case "sustentacao_oral":
    case "desistencia_recurso": case "midia_negativa": return MAIUSCULAS(v) ?? "";
    case "reclamada": return normalizarReclamada(v) ?? "";
    case "relator": return relatorSoNome(v) ?? "";
    case "horario": return horarioPadrao(v);
    case "link_acesso": return v ?? "";
  }
  if ((CAMPOS_A_PREENCHER.includes(k) || k === "comentarios_advogado" || k === "parte_recorrente" || k === "advogado_interno") && !String(v ?? "").trim()) return "A PREENCHER";
  if (CAMPOS_A_PREENCHER.includes(k) && !String(v ?? "").trim()) return "A PREENCHER";
  return v ?? "";
}

export async function exportarPautas(
  grupos: { aba: string; pautas: PautaTst[] }[],
  arquivo: string,
) {
  const wb = XLSX.utils.book_new();
  for (const g of grupos) {
    const linhas = g.pautas
      .slice()
      .sort((a, b) => (a.data_julgamento || "").localeCompare(b.data_julgamento || "") || (a.horario || "").localeCompare(b.horario || ""))
      .map((p) => COLUNAS_PAUTA.map(([, k]) => valorPadraoPauta(p, k)));
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS_PAUTA.map(([h]) => h), ...linhas]);
    ws["!cols"] = COLUNAS_PAUTA.map(([h]) => ({ wch: Math.min(Math.max(h.length, 16), 40) }));
    XLSX.utils.book_append_sheet(wb, ws, g.aba);
  }
  await baixarXlsxTst(await colorirCabecalhoModelo(XLSX.write(wb, { type: "array", bookType: "xlsx" })), arquivo);
}

/** Cor do cabeçalho por coluna, igual ao modelo PAUTA DE JULGAMENTO (A-V cinza, W-Z laranja, AA-AC vermelho, AD-AE cinza-rosado). */
export function corCabecalhoModelo(indice: number): string {
  if (indice <= 21) return "FFD9D9D9";
  if (indice <= 25) return "FFF9CB9C";
  if (indice <= 28) return "FFC00000";
  return "FFD0CECE";
}

const colIndex = (l: string) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export async function colorirCabecalhoModelo(buf: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buf);
  let styles = await zip.file("xl/styles.xml")!.async("string");
  const cores = ["FFD9D9D9", "FFF9CB9C", "FFC00000", "FFD0CECE"];
  const nFills = Number(styles.match(/<fills count="(\d+)"/)?.[1] ?? 0);
  styles = styles.replace(/<fills count="\d+">([\s\S]*?)<\/fills>/, (_m, corpo) =>
    `<fills count="${nFills + 4}">${corpo}${cores.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills>`);
  const nFonts = Number(styles.match(/<fonts count="(\d+)"/)?.[1] ?? 0);
  styles = styles.replace(/<fonts count="\d+">([\s\S]*?)<\/fonts>/, (_m, corpo) =>
    `<fonts count="${nFonts + 1}">${corpo}<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font></fonts>`);
  const nXfs = Number(styles.match(/<cellXfs count="(\d+)"/)?.[1] ?? 0);
  styles = styles.replace(/<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/, (_m, corpo) =>
    `<cellXfs count="${nXfs + 4}">${corpo}${cores.map((_, i) => `<xf numFmtId="0" fontId="${nFonts}" fillId="${nFills + i}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`).join("")}</cellXfs>`);
  zip.file("xl/styles.xml", styles);
  for (const nome of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const xml = await zip.file(nome)!.async("string");
    zip.file(nome, xml.replace(/<c r="([A-Z]+)1"(?![0-9])([^>]*?)(\/?)>/g, (_m, col, attrs, fecha) => {
      const cor = corCabecalhoModelo(colIndex(col));
      const s = nXfs + cores.indexOf(cor);
      return `<c r="${col}1"${attrs.replace(/\ss="\d+"/, "")} s="${s}"${fecha}>`;
    }));
  }
  return zip.generateAsync({ type: "uint8array" });
}

/** Relatório "PAUTA DE JULGAMENTO - dados faltantes" (sem dossiê, equipe ou advogado interno). */
export async function exportarPautasFaltantes(pautas: (PautaTst & { centralizador?: string | null })[], arquivo: string): Promise<number> {
  const linhas = pautas
    .map((p: any) => {
      const falta = [!p.dossie && "Dossiê", !p.equipe && "Equipe", !p.advogado_interno && "Advogado Interno"].filter(Boolean).join(", ");
      return { p, falta };
    })
    .filter((x) => x.falta)
    .sort((a, b) => (a.p.data_julgamento || "").localeCompare(b.p.data_julgamento || ""))
    .map(({ p, falta }) => [br(p.data_julgamento), p.processo_numero ?? "", p.reclamante ?? "", p.dossie ?? "",
      normalizarEquipeTst(p.equipe) ?? "", MAIUSCULAS(p.advogado_interno) ?? "", p.centralizador ?? "", falta]);
  if (!linhas.length) return 0;
  const cab = ["DATA DO JULGAMENTO", "NUMERO DO PROCESSO", "RECLAMANTE", "DOSSIÊ", "EQUIPE", "ADVOGADO INTERNO", "CENTRALIZADOR", "FALTA"];
  const ws = XLSX.utils.aoa_to_sheet([["PAUTA DE JULGAMENTO - dados faltantes"], cab, ...linhas]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cab.length - 1 } }];
  ws["!cols"] = [14, 28, 34, 26, 40, 30, 40, 30].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados faltantes");
  await baixarXlsxTst(XLSX.write(wb, { type: "array", bookType: "xlsx" }), arquivo);
  return linhas.length;
}
