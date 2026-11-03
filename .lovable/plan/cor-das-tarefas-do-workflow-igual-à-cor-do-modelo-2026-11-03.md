# Cor das tarefas do workflow igual à cor do modelo

## Situação atual
Tarefas criadas por workflow não guardam de qual modelo de tarefa vieram, por isso aparecem sem a cor do modelo (ex.: Encerramento marrom, Comprovação verde). As tarefas criadas manualmente pelo diálogo já guardam o modelo e mostram a cor.

## O que muda
1. Ao criar uma tarefa por workflow, o sistema identifica o modelo de tarefa da coordenação cujo nome corresponde ao título da etapa (ex.: "COMPROVAÇÃO DE PGTO") e grava o vínculo. A agenda passa a mostrar a cor desse modelo, como já faz com as tarefas manuais.
2. Correção das tarefas de workflow já existentes: vincular ao modelo pelo mesmo critério (título igual ao nome do modelo na mesma coordenação, só onde ainda não há modelo), para que as atuais também fiquem coloridas.
3. Se a etapa não corresponder a nenhum modelo, a tarefa continua com a cor padrão.

## Detalhes técnicos
- `src/lib/workflowExecutor.ts`: na criação de tarefa, buscar em `modelos_titulo_coordenacao` (coordenação do workflow) por nome/título normalizado (sem acento, maiúsculas, espaços) e preencher `tarefas.modelo_tarefa_id`.
- Migração SQL única de backfill em tarefas com `workflow_execucao_id` (ou origem workflow) e `modelo_tarefa_id` nulo, com `app.sem_notificacao` ligado para não disparar e-mails.
- Sem mudanças de RLS; leitura de cor no Painel já usa `modelo_tarefa_id`.
