import type { TipoSituacaoItem } from "@/constants/situacoesItem";

/**
 * Descobre o tipo de item (para efeito de situações) a partir de um item da agenda
 * unificada. Necessário para aplicar as regras configuradas por coordenação
 * (restrição de situação e comentário obrigatório) no tipo correto.
 */
export function tipoSituacaoDoItemAgenda(item: {
  id?: string;
  tipo?: string | null;
  origem?: string | null;
  grupo_parcelas?: string | null;
}): TipoSituacaoItem {
  const tipo = (item?.tipo || "").toLowerCase();
  const id = String(item?.id ?? "");
  if (tipo === "audiencia" || id.includes("audiencia-det-")) return "audiencia";
  if (tipo === "parcelamento" || tipo === "prazo_parcela" || item?.grupo_parcelas) return "parcelamento";
  if (tipo === "prazo") return "prazo";
  return item?.origem === "tarefa" ? "tarefa" : "evento";
}

/** Nome do tipo usado nas permissões por coordenação (`permissoes_situacao_tipo_tarefa`). */
export function tipoTarefaPermissao(tipo: TipoSituacaoItem): string {
  switch (tipo) {
    case "audiencia":
      return "AUDIÊNCIA";
    case "parcelamento":
      return "PARCELAMENTO";
    case "prazo":
      return "PRAZO";
    case "evento":
      return "EVENTO";
    default:
      return "TAREFA";
  }
}
