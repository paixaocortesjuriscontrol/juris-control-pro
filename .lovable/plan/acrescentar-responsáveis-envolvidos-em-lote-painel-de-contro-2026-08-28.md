# Acrescentar responsáveis/envolvidos em lote (Painel de Controle)

Nova ação no Painel de Controle para adicionar pessoas em vários itens de uma vez, sem nunca remover quem já está vinculado.

## Fluxo

1. Botão "Pessoas em lote" na barra de ações do Painel de Controle (visível apenas para admin e coordenadores).
2. Diálogo em 3 passos:
   - **Filtros**: período (data inicial/final, obrigatório), tipos (tarefa, prazo, audiência, evento, parcelamento), coordenação, responsável atual, situação e busca por título — o mesmo conjunto de filtros já usado no painel.
   - **Lista**: mostra os itens encontrados com tipo, título, data, processo e responsáveis atuais. Checkbox por linha + "selecionar todos" e contador. Cada item traz suas atividades vinculadas, também selecionáveis.
   - **Pessoas**: dois seletores (Responsáveis a acrescentar / Envolvidos a acrescentar) usando o seletor de pessoas já existente do sistema.
3. Confirmação com resumo ("X itens e Y atividades receberão N pessoas") e barra de progresso durante a aplicação, em lotes, com contagem de sucesso/erro no final.

## Regras

- Operação é **somente aditiva**: nenhum vínculo existente é apagado em nenhuma hipótese.
- Pessoas já vinculadas são ignoradas (sem duplicar).
- Atividades: se a atividade estiver sem responsável, recebe a primeira pessoa escolhida; se já tiver responsável, ele é preservado e as pessoas escolhidas são acrescentadas como envolvidos do item pai (a tabela de atividades suporta apenas um responsável).
- Só aparecem itens das coordenações que o usuário logado pode ver; admin vê todas.
- Registro em auditoria por item alterado, com quem executou.

## Detalhes técnicos

- Novo componente `src/components/painel/PessoasEmLoteDialog.tsx`, montado em `src/pages/PainelControle.tsx` (mesmo padrão do `ExportarAtividadesDialog`).
- Novo hook `src/hooks/usePessoasEmLote.ts`: busca dos itens por período/tipo reaproveitando os filtros de `useAgendaUnificada`, e mutação de aplicação em lotes (chunks de 200 inserts).
- Inserções por tipo, sempre com `upsert`/`onConflict` ignorando duplicados:
  - tarefas/prazos: `tarefa_responsaveis`, `tarefa_envolvidos`
  - eventos/parcelamentos: `evento_responsaveis`, `evento_envolvidos`
  - audiências: `audiencias_advogados`, `audiencia_envolvidos`
  - atividades: `subatividades_item.responsavel_id` apenas quando nulo
- Gate de permissão via `useUserRole` (admin) + verificação de coordenador em `coordenacoes`/`membros_coordenacao`.
- Ao concluir, `await queryClient.invalidateQueries` das chaves de agenda/painel antes de fechar o diálogo.
- Pode ser necessária uma migração apenas para índices únicos nas tabelas de vínculo, caso ainda não existam, garantindo o comportamento "ignorar duplicados".
