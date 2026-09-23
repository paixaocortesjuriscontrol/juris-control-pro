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
  "itens-com-cobrancas",

];

/**
 * Invalida todas as listas de itens.
 *
 * Importante para performance: usamos refetchType "active" — as listas que o
 * usuário está vendo recarregam na hora; as que estão fora da tela ficam
 * marcadas como obsoletas e recarregam sozinhas quando forem abertas.
 * Usar "all" aqui disparava dezenas de consultas simultâneas a cada salvamento
 * (deixava o salvar da Análise DJEN muito lento).
 */
export async function invalidarItensAgenda(
  queryClient: QueryClient,
  chavesExtras: unknown[][] = [],
): Promise<void> {
  await Promise.all([
    ...CHAVES_ITENS_AGENDA.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" }),
    ),
    ...chavesExtras
      .filter((k) => Array.isArray(k) && k.length > 0)
      .map((k) => queryClient.invalidateQueries({ queryKey: k, refetchType: "active" })),
  ]);
}

