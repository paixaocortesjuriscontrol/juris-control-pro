import { useSyncExternalStore } from "react";

/** Data de corte (YYYY-MM-DD) escolhida na tela de Migração Projuris. Vazia = sem corte. */
let corteAtual = "";
const ouvintes = new Set<() => void>();

export function getDataCorte(): string { return corteAtual; }
export function setDataCorte(v: string) {
  corteAtual = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
  ouvintes.forEach((f) => f());
}
export function useDataCorte(): string {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, getDataCorte, getDataCorte);
}

/** Normaliza uma data (YYYY-MM-DD, ISO com hora, ou DD/MM/YYYY) para o dia em BRT. */
export function diaBRT(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    const d = new Date(s.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(" ", "T")}-03:00`);
    if (isNaN(d.getTime())) return s.slice(0, 10);
    return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }
  return null;
}

/** Data da atividade: fatal > limite/vencimento > prevista > início. */
export function dataAtividade(item: { fatal?: unknown; data_fatal?: unknown; limite?: unknown; data_vencimento?: unknown; prevista?: unknown; data_prevista?: unknown; inicio?: unknown; data_inicio?: unknown; data_audiencia?: unknown; data?: unknown }): string | null {
  for (const v of [item.fatal, item.data_fatal, item.limite, item.data_vencimento, item.prevista, item.data_prevista, item.inicio, item.data_inicio, item.data_audiencia, item.data]) {
    const d = diaBRT(v);
    if (d) return d;
  }
  return null;
}

/** true quando a atividade passa da data de corte (o próprio dia do corte entra). Sem data: não passa. */
export function passaDoCorte(item: Parameters<typeof dataAtividade>[0], corte: string = corteAtual): boolean {
  if (!corte) return false;
  const d = dataAtividade(item);
  return !!d && d > corte;
}

/** Separa as linhas em dentro/fora do corte. */
export function aplicarCorte<T>(linhas: T[], dataDe: (l: T) => Parameters<typeof dataAtividade>[0], corte: string = corteAtual): { dentro: T[]; fora: T[] } {
  if (!corte) return { dentro: linhas, fora: [] };
  const dentro: T[] = []; const fora: T[] = [];
  for (const l of linhas) (passaDoCorte(dataDe(l), corte) ? fora : dentro).push(l);
  return { dentro, fora };
}

/** Campos para gravar no mapeamento do lote (ativa as proteções do banco). */
export function mapeamentoCorte(): Record<string, string> {
  return corteAtual ? { data_corte: corteAtual } : {};
}
