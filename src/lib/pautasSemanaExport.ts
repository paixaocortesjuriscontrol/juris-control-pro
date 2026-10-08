import * as XLSX from "xlsx";
import type { PautaTst } from "@/hooks/usePautasTst";

export const COLUNAS_PAUTA: [string, keyof PautaTst][] = [
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
  ["VIRTUAL \\TELEPRESENCIAL \\ HIBRIDO", "modalidade"],
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

export function exportarPautas(
  grupos: { aba: string; pautas: PautaTst[] }[],
  arquivo: string,
) {
  const wb = XLSX.utils.book_new();
  for (const g of grupos) {
    const linhas = g.pautas
      .slice()
      .sort((a, b) => (a.data_julgamento || "").localeCompare(b.data_julgamento || "") || (a.horario || "").localeCompare(b.horario || ""))
      .map((p) => COLUNAS_PAUTA.map(([, k]) => (k === "data_julgamento" ? br(p[k] as string) : (p[k] as string) ?? "")));
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS_PAUTA.map(([h]) => h), ...linhas]);
    ws["!cols"] = COLUNAS_PAUTA.map(([h]) => ({ wch: Math.min(Math.max(h.length, 14), 40) }));
    XLSX.utils.book_append_sheet(wb, ws, g.aba);
  }
  XLSX.writeFile(wb, arquivo);
}
