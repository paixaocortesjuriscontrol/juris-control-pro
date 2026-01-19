# Memory: features/process-status-redesign-v1
Updated: 2026-01-19

O campo 'status' dos processos foi atualizado para suportar novas situações:
- **ativo**: Processo em andamento normal
- **arquivado_definitivamente**: Processo arquivado sem possibilidade de reabertura
- **arquivado_provisoriamente**: Processo arquivado temporariamente
- **suspenso**: Processo suspenso aguardando alguma condição

A situação pode ser alterada diretamente no detalhe do processo sem clicar em "Editar", através de um Select inline na seção de Resumo. O monitoramento pode continuar ativo mesmo com o processo arquivado ou suspenso.

Filtros de situação e instância foram adicionados à listagem de processos. A RPC 'get_processos_paginados' foi atualizada para suportar ambos os filtros.

## Campos de Cobrança
Novos campos foram adicionados à tabela 'processos':
- **data_encerramento_cobranca**: Data que o advogado quer encerrar a cobrança do cliente
- **observacao_cobranca**: Observações sobre cobrança do processo

Uma nova aba "Cobrança" foi adicionada ao menu lateral do detalhe do processo, abaixo de "Detalhes".

## Tratamentos
As tarefas agora são chamadas de "Tratamentos" na interface. Dois novos tipos foram adicionados: "TAREFA" e "PRAZO", além dos tipos existentes.
