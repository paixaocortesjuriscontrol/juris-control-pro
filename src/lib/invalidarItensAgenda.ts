import type { QueryClient } from "@tanstack/react-query";

/**
 * Chaves de cache de TODAS as listas que exibem itens do botão Adicionar
 * (tarefas, prazos, eventos, audiências, parcelamentos).
 *
 * Sempre invalidar todas após criar/editar/alterar situação de um item,
 * para que Lista, Agenda, Kanban e Equipe atualizem imediatamente.
 */
export const CHAVES_ITENS_AGENDA: string[] = [
  "agenda-unificada",
  "agenda-unificada-infinite-v1",
  "lista-atividades",
  "tarefas",
  "tarefas-paginated",
  "tarefas-stats",
  "tarefas-processo",
  "atividades-delegacao",
  "eventos-agenda",
  "eventos-agenda-processo",
  "eventos-stats",
  "parcelas-evento",
  "audiencias-detectadas",
  "audiencias-processo",
  "audiencias-stats",
  "painel-controle-audiencias-det-stats",
  "painel-controle-resumo-stats",
  "prazos-tst",
  "kanban-itens-agenda",
  "subatividades-item",
  "painel-subatividades-calendario",
  "item-historico",
];

/**
 * Invalida (e refetcha, inclusive queries inativas) todas as listas de itens.
 * Aguarde o retorno antes de fechar o formulário / exibir sucesso.
 */
export async function invalidarItensAgenda(
  queryClient: QueryClient,
  chavesExtras: unknown[][] = [],
): Promise<void> {
  await Promise.all([
    ...CHAVES_ITENS_AGENDA.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key], refetchType: "all" }),
    ),
    ...chavesExtras
      .filter((k) => Array.isArray(k) && k.length > 0)
      .map((k) => queryClient.invalidateQueries({ queryKey: k, refetchType: "all" })),
  ]);
}
