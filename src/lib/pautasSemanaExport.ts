import * as XLSX from "xlsx";
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
  ["COMENTARIOS ADVOGADO INTERNO RESPONSAVEL DO BANCO", "comentarios_advogado_banco"],
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
    case "advogado_interno": case "modalidade": case "decisao": case "sustentacao_oral":
    case "desistencia_recurso": case "midia_negativa": return MAIUSCULAS(v) ?? "";
    case "reclamada": return normalizarReclamada(v) ?? "";
    case "relator": return relatorSoNome(v) ?? "";
    case "horario": return horarioPadrao(v);
    case "link_acesso": return v ?? "";
  }
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
  await baixarXlsxTst(XLSX.write(wb, { type: "array", bookType: "xlsx" }), arquivo);
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
