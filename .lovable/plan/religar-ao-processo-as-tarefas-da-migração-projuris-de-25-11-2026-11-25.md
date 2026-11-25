# Religar ao processo as tarefas da migração Projuris de 25/11/2026

## O que aconteceu (conferido no banco)
- As **98.605** tarefas importadas hoje entraram **todas sem processo** ("Sem processo vinculado no Relatório de Atividades").
- Não é falha do backup: a ligação tarefa → processo vem de tabelas do backup (tarefavinculomodulo e processonumero) que, na rodada de hoje, não chegaram ao cruzamento. Por isso nenhuma tarefa achou o número do processo.
- O sistema já guarda de uma migração anterior a lista "tarefa do Projuris → número do processo" (91.421 ligações). Cruzando com as tarefas de hoje:
  - **86.228** acham o processo na mesma coordenação (Santander Cível);
  - 43 acham o processo só em outra coordenação (ficam como estão, não mexo em outra coordenação);
  - 1.415 têm número, mas o processo não está cadastrado;
  - 10.919 não têm número de processo em nenhuma fonte.

## O que vou fazer
1. Guardar cópia de segurança das tarefas antes da mudança (id + processo vazio).
2. Preencher o processo nas **86.228** tarefas, só nas de hoje e só na mesma coordenação, sem avisar a equipe e sem mexer em datas, situação ou responsáveis.
3. Tirar das observações dessas tarefas a frase "Sem processo vinculado no Relatório de Atividades".
4. Gerar um Excel com as ~12.377 que continuarão sem processo (código Projuris, título, data, número achado ou vazio, motivo), para o Dr. Jhonatan conferir.
5. Corrigir a tela de migração para que, se faltarem os arquivos de ligação no backup, ela **avise e bloqueie** antes de importar tarefas sem processo, e use também essa lista já guardada como fonte de ligação.

## Detalhes técnicos
- Atualização via run_sql em lotes: `tarefas.processo_id` a partir de `projuris_vinculo_stage (tipo='tarefa_cnj', chave = migracoes_projuris_itens.chave_externa)` → `processos` por dígitos do número, filtrando `coordenacao_id` igual e `migracoes_projuris_itens.created_at >= 2026-11-25 10:00 UTC`, `processo_id is null`. Backup em tabela `backup_tarefas_sem_processo_20261125`. Sessão sem usuário, então a fila de avisos não dispara.
- Em `BackupCompletoProjuris.tsx`: alerta na conferência quando 0 tarefas têm `procDig` e confirmação obrigatória para seguir.
