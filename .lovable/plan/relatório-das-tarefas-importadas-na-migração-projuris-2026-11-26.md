# Relatório das tarefas importadas na migração Projuris

## O que será entregue
1. **Resumo no chat**: quantidade de tarefas importadas pela migração Projuris, por tipo (tipo/modelo da tarefa), com total geral.
2. **Excel** em Arquivos (`tarefas_migracao_projuris.xlsx`):
   - Aba **Resumo**: tipo, quantidade, separando por coordenação e por situação (Pendente, Cumprido, Cancelado etc.).
   - Aba **Tarefas**: uma linha por tarefa: coordenação, processo (número CNJ), tipo, título, situação, data de vencimento, prazo fatal, responsáveis, envolvidos, código Projuris (TAR.), data da importação (BRT) e lote da migração.

## Critério
- Entram as tarefas que ainda existem no sistema e estão registradas como importadas pela migração Projuris (histórico de itens da migração), de todas as coordenações e lotes.
- Datas no formato DD/MM/AAAA, horário de Brasília.
- Somente leitura: nada é alterado no sistema.

## Detalhes técnicos
- Fonte: `tarefas` com `origem='projuris'` unidas a `migracoes_projuris_itens` (tipo tarefa) e `migracoes_projuris` (lote/data); nomes via `profiles`, coordenação via `coordenacoes`, processo via `processos.numero_processo`; pessoas de `tarefa_responsaveis`/`tarefa_envolvidos`.
- Exportação por consulta paginada em CSV, montagem do Excel com openpyxl (Arial, cabeçalho fixo, filtro) e conferência visual antes de entregar.
