# Remover o deduplicador de tarefas do Painel de Controle

## Objetivo

Duas tarefas iguais criadas pelo usuário no mesmo dia devem aparecer as duas no calendário/lista. O que não pode voltar a acontecer é o sistema gravar o mesmo registro duas vezes sozinho (bug antigo de duplicação no salvamento).

## O que muda

Hoje o Painel de Controle esconde itens que tenham a mesma "chave de negócio" (título + data + processo + responsável + tipo), colapsando também tarefas legítimas criadas de propósito pelo usuário. Também há regras extras para audiências (mesmo processo + dia + hora) e para itens importados do Projuris.

Passa a valer:

- O painel deixa de esconder itens por título/data/responsável. Cada registro do banco aparece uma vez.
- Continua havendo proteção apenas contra o mesmo registro aparecer repetido na tela (mesma origem + mesmo id), que acontece na junção das páginas carregadas — isso não esconde nenhum item real.
- Nenhuma alteração no banco de dados e nenhum item existente é apagado.

## Efeito colateral esperado

Registros duplicados que já estão gravados no banco (de importações antigas ou do bug anterior) passam a aparecer os dois no painel, pois não haverá mais o mascaramento visual. A limpeza desses casos continua disponível pela ferramenta Relatório de Duplicados.

## Proteção contra duplicação pelo sistema (mantida)

- A trava de envio duplo no diálogo de nova tarefa (`submitInFlightRef`) permanece: um clique duplo não grava dois registros.
- Os itens materializados por Workflow continuam sendo criados uma única vez por etapa/execução.

## Detalhes técnicos

Arquivo: `src/hooks/useAgendaUnificada.ts`

- Simplificar `getAgendaDedupKey` para retornar sempre `${item.origem}:${item.id}`, removendo os ramos de tarefa (chave por título/data/responsável), de audiência (processo+dia+hora), o ramo `identificador_projuris` e o caso especial de workflow (que deixa de ser necessário).
- Os dois pontos de uso (loop em `fetchAgendaPage` e o filtro em `useAgendaUnificada`) permanecem como estão, agora funcionando apenas como proteção de identidade.
- Sem mudanças em componentes de UI, hooks de criação ou banco.
