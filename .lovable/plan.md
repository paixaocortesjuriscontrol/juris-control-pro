# Tarefas concluídas no Projuris que entraram como pendentes

## O que encontrei
Na migração de 25/11/2026 entraram 98.605 tarefas: 83.111 cumpridas, 2.258 concluídas sem sucesso, 10.932 canceladas e **2.172 pendentes** (mais 86 em revisão, 26 em execução e 20 a confirmar).

A provável causa: quando a tarefa tem uma situação com nome próprio no Projuris (ex.: "Aguardando", "Protocolar"), o sistema usa só esse nome e ignora a marca de "concluída" e a data de conclusão que o Projuris também guarda. Assim, uma tarefa concluída com situação de nome diferente vira "pendente". Ainda não confirmei isso com o backup.

## O que vou fazer
1. **Confirmar com o backup** (arquivo de tarefas e de situações): contar quantas das 2.304 tarefas não concluídas aqui estavam marcadas como concluídas ou com data de conclusão no Projuris.
2. **Corrigir a regra**: se o Projuris diz que a tarefa foi concluída, ela entra como "Cumprido" (ou "Concluído sem sucesso", quando for o caso), com a data de conclusão do Projuris. Canceladas continuam canceladas. Teste automático para essa regra.
3. **Corrigir as tarefas já importadas**: atualizar só as tarefas da Santander Cível dessa migração confirmadas no passo 1, com cópia de segurança antes, sem avisos à equipe e sem mexer em responsáveis, datas ou processos.
4. Excel com as tarefas corrigidas (código Projuris, título, processo, situação antiga e nova).

## Preciso de você
O backup novo do Projuris (pelo menos `tarefaevento.csv` e `tarefaeventosituacao.csv`), caso ele não esteja mais disponível aqui. Se puder, um exemplo de tarefa citada pelo Dr. Jhonatan.

## Detalhes técnicos
- `statusTarefaProjuris` (`src/lib/migracaoProjuris.ts`): hoje retorna "pendente" quando há situação sem nome reconhecido, mesmo com `flconcluido='s'`/`dtconclusao`. Ajuste: depois de cancelado/sem sucesso, `concluido` passa a resultar em "cumprido".
- Correção de dados via update por `chave_externa` em `migracoes_projuris_itens`, com tabela de backup.
