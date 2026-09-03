export type TipoSituacaoItem = "tarefa" | "prazo" | "evento" | "parcelamento" | "audiencia";

/**
 * Situação especial: cancela a atividade E a esconde da agenda/calendário,
 * sem apagar o registro (o histórico continua no banco).
 */
export const STATUS_CANCELADO_OCULTO = "cancelado_oculto";

export interface SituacaoOption {
  value: string;
  label: string;
  /** Somente admin, coordenador ou assistente coordenador podem selecionar */
  restrita?: boolean;
}

/** Valor gravado como "Concluído com sucesso" por tipo de item */
export function valorConcluidoSucesso(tipo: TipoSituacaoItem): string {
  return tipo === "tarefa" || tipo === "prazo" ? "cumprido" : "concluido";
}

const EXTRAS_AUDIENCIA: SituacaoOption[] = [
  { value: "confirmado", label: "✅ Confirmado" },
  { value: "reagendado", label: "🔄 Reagendado" },
  { value: "tratado", label: "✔️ Tratado" },
  { value: "ignorado", label: "🚫 Ignorado" },
];

/** Legendas de cumprimento de prazos/tarefas (coordenação Dra. Beatriz Costa) */
const EXTRAS_PRAZO_TAREFA: SituacaoOption[] = [
  { value: "minutado_revisao", label: "📝 Minutado - Revisão" },
  { value: "protocolado", label: "📤 Protocolado" },
  { value: "baixado", label: "📥 Baixado" },
  { value: "reagendado", label: "🔄 Reagendado" },
  { value: "tratado", label: "✔️ Tratado" },
];

/**
 * Comentário na mudança de situação é SEMPRE opcional.
 * Nenhuma situação (de tarefa, prazo, evento, audiência ou parcelamento)
 * pode exigir comentário para salvar. Mantido apenas por compatibilidade.
 */
export function situacaoExigeComentario(_valor?: string | null): boolean {
  return false;
}

export function situacoesBase(tipo: TipoSituacaoItem): SituacaoOption[] {
  const sucesso = valorConcluidoSucesso(tipo);
  const lista: SituacaoOption[] = [
    { value: "a_confirmar", label: "⏱️ A confirmar" },
    { value: "pendente", label: "⏳ Pendente" },
    { value: "em_execucao", label: "▶️ Em execução" },
    { value: "revisao", label: "🔍 Revisão" },
    { value: "verificado", label: "🔎 Verificado" },
    { value: sucesso, label: "✔️ Concluído com sucesso", restrita: true },
    { value: "concluido_sem_sucesso", label: "⚠️ Concluído sem sucesso", restrita: true },
    { value: "cancelado", label: "❌ Cancelado", restrita: true },
    { value: STATUS_CANCELADO_OCULTO, label: "🙈 Cancelar e ocultar da agenda", restrita: true },
  ];
  if (tipo === "audiencia") lista.push(...EXTRAS_AUDIENCIA);
  if (tipo === "tarefa" || tipo === "prazo") lista.push(...EXTRAS_PRAZO_TAREFA);
  return lista;
}

/**
 * Opções visíveis no seletor de situação.
 * Concluir (com/sem sucesso) e cancelar são restritos a admin/coordenador/assistente coordenador.
 * A situação atual do item é sempre exibida (mesmo que restrita) para não quebrar a leitura.
 */
export function situacoesDisponiveis(
  tipo: TipoSituacaoItem,
  opts: { podeGerenciar: boolean; atual?: string | null }
): SituacaoOption[] {
  return situacoesBase(tipo).filter(
    (s) => !s.restrita || opts.podeGerenciar || s.value === opts.atual
  );
}
