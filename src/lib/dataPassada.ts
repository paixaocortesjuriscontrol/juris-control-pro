import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/** Data de hoje (yyyy-MM-dd) no horário de Brasília. */
export function hojeBRT(): string {
  return format(toZonedTime(new Date(), "America/Sao_Paulo"), "yyyy-MM-dd");
}

/** True quando a data informada é anterior a hoje (BRT). Aceita "yyyy-MM-dd", ISO ou Date. */
export function ehDataPassada(valor: string | Date | null | undefined, hoje = hojeBRT()): boolean {
  if (!valor) return false;
  const dia = valor instanceof Date ? format(valor, "yyyy-MM-dd") : String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  return dia < hoje;
}

export const MSG_DATA_PASSADA = "Não é permitido criar atividade com data anterior a hoje. Confira a data escolhida.";

const fmtBr = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = v instanceof Date ? format(v, "yyyy-MM-dd") : String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : "—";
};

/** Resumo exibido na mensagem "Confirme as datas" antes de salvar. */
export function resumoDatas(base: string | Date | null | undefined, prevista: string | Date | null | undefined, fatal: string | Date | null | undefined) {
  const linhas = [`Data base: ${fmtBr(base)}`, `Data prevista: ${fmtBr(prevista)}`, `Data fatal: ${fmtBr(fatal)}`];
  return { chave: linhas.join("|"), texto: linhas.join("\n") };
}
