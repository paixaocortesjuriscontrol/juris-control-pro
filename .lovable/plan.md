# Histórico de alterações visível para todos

## O que muda
Hoje o histórico de alterações de uma atividade só aparece para estas pessoas:
- admins;
- quem tem o perfil geral de Coordenador ou de Assistente de coordenação;
- quem fez a própria alteração.

Por isso, a equipe da Santander Cível não conseguia ver quem tirou a Renata e a Ívina.

Com a mudança, **todos que conseguem abrir a atividade passam a ver o histórico completo dela**: quem incluiu ou retirou pessoas, quem trocou datas, situação e assim por diante. A permissão é só para ver; ninguém passa a poder alterar o histórico.

## Fora do escopo
- Os responsáveis duplicados da Santander Cível continuam como estão.
- As regras de situação não mudam.

## Detalhes técnicos
- Migração: nova política SELECT em `auditoria_tarefas` para `authenticated`. Ela libera a leitura quando `EXISTS (SELECT 1 FROM tarefas t WHERE t.id = auditoria_tarefas.tarefa_id)`, ou seja, segue o RLS que já existe em `tarefas`.
- Para histórico de eventos e audiências que fica nessa mesma tabela, vale a mesma regra pelo `tipo_item`: `eventos_agenda` e `audiencias_detectadas` também pelo próprio RLS de cada uma.
- As políticas atuais continuam como estão.
