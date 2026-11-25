# Deixar o Painel de Controle mais rápido depois da migração

## O que achei
Os índices por mês e coordenação nas tarefas já existem (coordenação + vencimento, coordenação + situação + vencimento). A lentidão vem de duas buscas que o Painel faz depois de carregar a agenda:

1. **Marcas de comentário e cobrança ("C") no calendário**: é a busca que mais pesa no banco, com 6.157 chamadas e cerca de 0,6 s cada. O Painel pede os comentários em lotes de 100 tarefas, então com 5.000 itens no mês são cerca de 50 pedidos. Para cada comentário, o banco confere de novo se a pessoa pode ver a tarefa. A migração trouxe cerca de 69 mil comentários, e isso multiplicou o trabalho.
2. **Nome e cor do modelo de tarefa**: essa busca lê as tarefas com modelo do mês inteiro, de todas as coordenações, e não só das que estão na tela. Com as 98 mil tarefas migradas, ela leva até 7 s.

## O que vou fazer
- **Comentários**: uma busca pronta no banco recebe a lista de itens, confere o acesso uma vez por tarefa (e não por comentário) e já devolve o resumo de cada uma: último comentário, se é meu ou de outros, se é cobrança e o dia. Assim, vários pedidos pesados viram poucos pedidos leves. As regras de quem vê o quê continuam as mesmas.
- **Modelos**: a busca passa a ler só as coordenações que estão no filtro do Painel. Também vou criar um índice próprio para "tarefas com modelo por vencimento".
- No fim, vou conferir os tempos antes e depois no banco.

## Detalhes técnicos
- Nova RPC `resumo_comentarios_itens(_tipo text, _ids uuid[])`, SECURITY DEFINER, `search_path=public`. Ela filtra os IDs distintos com `can_comment_tarefa(auth.uid(), id)` e as funções equivalentes de eventos e audiências, e agrega por (ref, dia) os valores `max(created_at)`, `bool_or(autor_id=auth.uid())`, `bool_or(autor_id<>auth.uid())` e `bool_or(is_cobranca)`. A execução fica liberada só para `authenticated`.
- `useItensComComentarios.ts`: trocar o `.from(tabela).select(...).in(fk, chunk)` pela RPC, com lotes de 500, mantendo o cache e as chaves de invalidação atuais.
- `useModeloTarefaItens(inicio, fim, coordenacaoIds)`: acrescentar `.in("coordenacao_id", ...)` quando o escopo for conhecido e incluir o escopo na queryKey. A chamada em `PainelControle.tsx` passa o escopo `escopoEscritorio`.
- Migration: `CREATE INDEX idx_tarefas_modelo_venc ON tarefas (data_vencimento) WHERE modelo_tarefa_id IS NOT NULL`.
- Medir com EXPLAIN ANALYZE e `slow_queries` depois da mudança.
