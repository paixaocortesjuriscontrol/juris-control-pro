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

export const MSG_DATA_PASSADA = "Atenção: a data escolhida já venceu. A atividade foi salva mesmo assim.";

/** Aviso (sem bloquear) quando alguma das datas é anterior a hoje (BRT). Vazio quando nenhuma venceu. */
export function avisoSeDataPassada(datas: Array<string | Date | null | undefined>, hoje = hojeBRT()): string {
  const vencidas = datas.filter((d) => ehDataPassada(d, hoje)).map((d) => fmtBr(d));
  if (!vencidas.length) return "";
  return `Atenção: data já vencida (${Array.from(new Set(vencidas)).join(", ")}). A atividade será salva mesmo assim.`;
}

/**
 * Itens cuja data é anterior a hoje (BRT). Usado no fim das importações: a
 * importação não bloqueia, mas quem importou precisa saber o que chegou atrasado.
 */
export function itensComDataPassada<T>(
  itens: T[],
  dataDe: (item: T) => string | Date | null | undefined,
  hoje = hojeBRT(),
): T[] {
  return itens.filter((i) => ehDataPassada(dataDe(i), hoje));
}

/** Frase de aviso para o fim de uma importação. Vazia quando nada chegou atrasado. */
export function avisoDataPassada(quantos: number): string {
  if (!quantos) return "";
  const hoje = fmtBr(hojeBRT());
  return `${quantos} ${quantos === 1 ? "item importado ficou" : "itens importados ficaram"} com data anterior a hoje (${hoje}).`;
}

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
