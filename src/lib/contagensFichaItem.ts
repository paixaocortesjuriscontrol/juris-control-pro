/**
 * Regras de contagem mostradas ao lado das abas da ficha de atividade
 * (Minhas Responsabilidades). Mantidas separadas das consultas para poder
 * conferir as regras sem depender do banco.
 */

/**
 * Total de publicações da aba: as do processo somadas às ligadas diretamente
 * à atividade. A mesclagem da aba (mesclarPublicacoesItem) guarda cada
 * publicação do processo com a chave "processo:<id>" e cada publicação ligada
 * à atividade com a chave "termo:<id>", então as duas origens somam sem
 * cancelar repetições entre si.
 */
export function totalPublicacoesFicha(
  totalPublicacoesProcesso: number,
  totalPublicacoesAtividade: number,
): number {
  const doProcesso = Number(totalPublicacoesProcesso);
  const daAtividade = Number(totalPublicacoesAtividade);
  const seguro = (valor: number) => (Number.isFinite(valor) && valor > 0 ? Math.trunc(valor) : 0);
  return seguro(doProcesso) + seguro(daAtividade);
}

/** Rótulo do indicador de uma aba: vazio quando não há nada para contar. */
export function rotuloContagemAba(valor: number | null | undefined): string {
  const total = Number(valor);
  if (!Number.isFinite(total) || total <= 0) return "";
  return String(Math.trunc(total));
}

/** Rótulo "feitos/total" (ex.: 2/5). Vazio quando não há itens. */
export function rotuloParcialAba(feitos: number | null | undefined, total: number | null | undefined): string {
  const t = Number(total);
  if (!Number.isFinite(t) || t <= 0) return "";
  const f = Number(feitos);
  const feitosSeguros = Number.isFinite(f) && f > 0 ? Math.trunc(f) : 0;
  return `${Math.min(feitosSeguros, Math.trunc(t))}/${Math.trunc(t)}`;
}
