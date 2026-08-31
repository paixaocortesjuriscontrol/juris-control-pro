// Drill-down do Ranking de Atendimento -> Painel de Controle (modo lista).
// Mantém as mesmas definições usadas nas RPCs de ranking, aplicadas no cliente.

export type RankingMetrica =
  | "criados"
  | "concluidos"
  | "no_prazo"
  | "atraso"
  | "perdidos";

export const RANKING_METRICA_LABELS: Record<RankingMetrica, string> = {
  criados: "Criados no período",
  concluidos: "Concluídos no período",
  no_prazo: "Concluídos no prazo",
  atraso: "Concluídos com atraso",
  perdidos: "Prazos perdidos",
};

export const isRankingMetrica = (v: string | null): v is RankingMetrica =>
  v === "criados" || v === "concluidos" || v === "no_prazo" || v === "atraso" || v === "perdidos";

const STATUS_CONCLUIDO = new Set([
  "cumprido",
  "concluido",
  "concluído",
  "tratado",
  "protocolado",
  "baixado",
  "verificado",
  "concluido_sem_sucesso",
]);

/** Origens de importação — itens importados não contam como prazo perdido. */
const ORIGENS_IMPORTACAO = new Set([
  "astrea",
  "projuris",
  "importacao",
  "import",
  "planilha",
  "migracao",
  "carga",
  "benner",
]);

export function itemImportado(item: any): boolean {
  const origem = norm(item?.origem_importacao ?? item?.origem);
  return ORIGENS_IMPORTACAO.has(origem);
}

const norm = (s?: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const dia = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

export interface RankingDrilldownParams {
  metrica: RankingMetrica;
  usuarioId: string;
  inicio: string;
  fim: string;
  /** classificações do painel: prazo | tarefa | audiencia | evento | parcelamento */
  classificacoes?: string[];
  coordenacaoId?: string | null;
}

export function buildRankingDrilldownUrl(p: RankingDrilldownParams): string {
  const sp = new URLSearchParams();
  sp.set("view", "lista");
  sp.set("metrica", p.metrica);
  sp.set("resp", p.usuarioId);
  sp.set("de", p.inicio);
  sp.set("ate", p.fim);
  if (p.classificacoes?.length) sp.set("class", p.classificacoes.join(","));
  if (p.coordenacaoId) sp.set("coord", p.coordenacaoId);
  return `/painel-controle?${sp.toString()}`;
}

/** Data-limite do item (fatal > prevista/vencimento). */
export function prazoDoItem(item: any): string {
  return dia(item?.data_fatal) || dia(item?.data_vencimento) || dia(item?.data_prevista) || "";
}

export function itemConcluido(item: any): boolean {
  return STATUS_CONCLUIDO.has(norm(item?.status));
}

export function dataConclusaoItem(item: any): string {
  return dia(item?.ranking_data_conclusao) || dia(item?.data_cumprimento) || dia(item?.concluido_em) || "";
}

/**
 * Aplica a métrica clicada no ranking sobre um item da agenda unificada.
 */
export function passaMetricaRanking(
  item: any,
  metrica: RankingMetrica,
  inicio: string,
  fim: string,
  hojeStr: string,
): boolean {
  const dentro = (d: string) => !!d && (!inicio || d >= inicio) && (!fim || d <= fim);
  const prazo = prazoDoItem(item);
  const concluido = itemConcluido(item);
  const concl = dataConclusaoItem(item);
  const cancelado = norm(item?.status).startsWith("cancelad");

  if (metrica === "criados") {
    const criado = dia(item?.created_at);
    return dentro(criado) || (!criado && dentro(prazo));
  }
  if (metrica === "concluidos") return concluido && dentro(concl || prazo);
  if (metrica === "no_prazo") return concluido && dentro(concl) && !!prazo && concl <= prazo;
  if (metrica === "atraso") return concluido && dentro(concl) && !!prazo && concl > prazo;
  if (metrica === "perdidos") {
    if (!dentro(prazo)) return false;
    if (cancelado) return false;
    // Itens vindos de importações não são contados como prazo perdido.
    if (itemImportado(item)) return false;
    // Concluído (mesmo com atraso) NÃO é prazo perdido — conta em "Atraso".
    if (concluido) return false;
    return prazo < hojeStr;
  }
  return true;
}

/** Explica, em texto, por que o item está contabilizado como prazo perdido. */
export function justificativaPrazoPerdido(item: any, hojeStr: string): string {
  const prazo = prazoDoItem(item);
  const campo = dia(item?.data_fatal)
    ? "data fatal"
    : dia(item?.data_vencimento)
      ? "data de vencimento"
      : "data prevista";
  const br = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
  const dias = prazo
    ? Math.max(
        0,
        Math.round((new Date(hojeStr + "T00:00:00").getTime() - new Date(prazo + "T00:00:00").getTime()) / 86400000),
      )
    : 0;
  return `Prazo em aberto: a ${campo} (${br(prazo)}) venceu há ${dias} dia(s) e a situação continua "${
    item?.status ?? "pendente"
  }" (sem cumprimento/tratamento registrado).`;
}

