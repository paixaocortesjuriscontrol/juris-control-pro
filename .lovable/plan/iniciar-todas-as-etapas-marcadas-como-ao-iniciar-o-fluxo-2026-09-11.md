# Iniciar todas as etapas marcadas como "Ao iniciar o fluxo"

## Problema

No workflow "ACÓRDÃO - EDS OU RR?" as duas etapas estão configuradas com condição de início **Ao iniciar o fluxo**, mas ao iniciar pelo Painel de Controle ou pela Análise DJEN o sistema cria apenas a primeira demanda ("ACÓRDÃO - EDS"). A segunda fica esperando a conclusão da primeira.

Causa confirmada no código: ao iniciar, o sistema cria o item apenas da etapa de ordem 1 e marca todas as outras como pendentes, ignorando a condição de cada etapa.

## Como vai funcionar

- Ao iniciar um workflow, todas as etapas com condição **Ao iniciar o fluxo** passam a ser criadas de uma vez, cada uma com seu prazo, prioridade, responsáveis e atividades já configurados.
- Etapas com condição **Depende do sucesso da etapa anterior** continuam esperando a conclusão da etapa referenciada, como hoje.
- A primeira etapa sempre é criada, mesmo que esteja configurada como dependente (evita fluxo que nunca começa).
- Vale para os dois caminhos de início: botão Adicionar do Painel de Controle e botão Adicionar da Análise DJEN (e também para o início manual na tela de Workflows).
- Processo, coordenação e publicação de origem continuam sendo herdados por todas as demandas criadas.
- O aviso de sucesso passa a informar quantas demandas foram criadas.

## Detalhes técnicos

- `src/hooks/useWorkflows.ts` (`useIniciarWorkflow`): substituir a criação única de `etapas[0]` por um laço sobre as etapas cuja `condicao` seja `sempre` (mais a de ordem 1 como garantia), chamando `criarItemWorkflow` para cada uma e calculando `data_prevista_calculada` / `data_fatal_calculada` por etapa a partir da mesma `dataReferencia`.
- Montar `workflow_execucao_etapas` marcando `materializada` + `item_id`/`item_tipo` para cada etapa criada e `pendente` para as demais.
- Retornar a lista de itens criados (mantendo `item` como o primeiro) para que a Análise DJEN continue exibindo os itens no quadro "Itens criados a partir desta publicação".
- `src/lib/workflowExecutor.ts` (`avancarExecucaoWorkflow`): ao concluir uma etapa, materializar todas as próximas elegíveis com condição `sempre` de uma vez, em vez de apenas a primeira, mantendo a regra atual de cancelamento quando `sucesso_anterior` não é atendido.
- Nenhuma alteração de banco.
