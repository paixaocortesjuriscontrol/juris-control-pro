# Disparar workflow automaticamente pelo título do item

## O que a Jessica relatou

Ela criou um fluxo chamado "ACÓRDÃO - EDS" esperando que, ao existir um item (prazo/tarefa) com esse título, o sistema criasse sozinho o outro prazo da tabela. Isso não aconteceu — e procede: hoje **não existe** disparo automático por título.

Verificado no código:

- O fluxo só nasce por ação manual, pelo `IniciarWorkflowDialog` (botão "Iniciar fluxo" na tela Workflow e no painel lateral do processo).
- A tabela `workflows` não tem nenhum campo de gatilho; o nome do fluxo é só rótulo.
- O encadeamento automático existente é apenas **entre etapas**: quando um item de etapa é concluído com sucesso, a etapa seguinte é materializada (`sincronizarWorkflowPorItem`).

Ou seja: criar um prazo chamado "ACÓRDÃO - EDS" na tela de Análise DJEN não tem, hoje, nenhuma ligação com o fluxo de mesmo nome.

## O que vou construir

Um **gatilho por título** no fluxo:

1. No cabeçalho do fluxo, novo bloco **Disparo automático**:
   - chave liga/desliga;
   - lista de títulos que disparam o fluxo (um ou vários, ex.: "ACÓRDÃO - EDS");
   - forma de comparação: "título igual" ou "título contém";
   - tipos de item que podem disparar (Prazo, Tarefa, Audiência, Evento) — por padrão todos.
2. Quando alguém cria um prazo/tarefa/audiência/evento (em qualquer tela: DJEN, painel de controle, processo, importação), o sistema procura um fluxo ativo da mesma coordenação com gatilho compatível com o título e, se achar:
   - inicia a execução do fluxo no processo do item, com data de início = a data prevista do item que disparou;
   - cria as etapas com condição "Ao iniciar o fluxo" (o prazo da tabela nasce aí);
   - o item que disparou continua existindo normalmente, agora marcado como origem do fluxo.
3. Proteção contra repetição: o mesmo item nunca dispara duas vezes, e o mesmo fluxo não é iniciado de novo no mesmo processo enquanto houver execução em andamento (opção para permitir, se ela quiser).
4. Na aba **Execuções** aparece de onde veio ("disparado automaticamente pelo título X").
5. Nada muda para os fluxos atuais: sem gatilho configurado, continuam apenas manuais.

## Detalhes técnicos

- Migração: colunas em `public.workflows` — `gatilho_ativo boolean default false`, `gatilho_titulos text[] default '{}'`, `gatilho_modo text default 'igual'` (`igual|contem`), `gatilho_tipos text[] default '{}'` (vazio = todos), `gatilho_permite_repetir boolean default false`; e em `workflow_execucoes` — `disparado_por_item_id uuid`, `disparado_por_titulo text`, com índice único parcial em `(workflow_id, disparado_por_item_id)` para impedir duplo disparo.
- Novo `src/lib/workflowTrigger.ts` com `dispararWorkflowsPorTitulo({ titulo, tipo, itemId, processoId, processoNumero, coordenacaoId, dataPrevista, responsavelId })`: normaliza o título (trim, maiúsculas, espaços colapsados), busca fluxos ativos com gatilho da coordenação, aplica modo/tipos, checa execução existente e chama o mesmo caminho de criação já usado por `useIniciarWorkflow` (extraído para uma função reutilizável em `src/hooks/useWorkflows.ts` / `workflowExecutor.ts`).
- Chamar `dispararWorkflowsPorTitulo` após a criação bem-sucedida do item nos pontos de criação existentes: `usePrazos`, `useEventosAgenda`, `NovaTarefaDialog`, criação de itens da Análise DJEN e criação de audiência. Falha no disparo não derruba a criação do item (log + toast informativo).
- `WorkflowEditor.tsx`: bloco "Disparo automático" no cartão do fluxo, salvando pelas mutações de workflow já existentes; `WorkflowExecucoesList.tsx` exibe o selo de origem.
- Cache: `await invalidateQueries` das chaves de agenda/prazos e de `workflow-execucoes` antes de fechar painéis, para o prazo criado aparecer na hora.
