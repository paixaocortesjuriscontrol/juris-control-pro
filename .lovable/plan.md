# Devolver as tarefas apagadas que a equipe já tinha mexido

## O que foi confirmado
- O caso 4032835-05.2026.8.26.0602 procede: a tarefa "DEFESA" (vencimento 25/11/2026, Pendente) foi apagada hoje às 13:47 (BRT) na limpeza das 3.301 tarefas com data depois de 13/11.
- Das 3.301 apagadas, **2.144 tinham sido alteradas por pessoas da equipe** (30 usuários diferentes) entre 14/11 e hoje, antes da limpeza. A DEFESA é uma delas.
- Não conto como "alteração da equipe" a inclusão automática de participantes feita pela própria migração (usuário Admin. Paixão Cortes, 14/11).
- As outras 1.157 nunca foram tocadas por ninguém e continuam apagadas.

## O que vou fazer
1. Devolver as 2.144 tarefas exatamente como estavam antes de apagar: mesmo código, título, data, situação, responsáveis, envolvidos, comentários e anexos ligados.
2. Sem enviar avisos para ninguém.
3. Voltar o registro da migração dessas tarefas para "criado".
4. Conferir: 2.144 de volta, incluindo a DEFESA do processo acima aparecendo na ficha.
5. Gerar um Excel com a lista das 2.144 devolvidas (processo, título, data, situação, quem alterou).

## Detalhes técnicos
- Fonte: `bkp_tarefas_pos_corte_20261125` + `_resp`, `_env`, `_com`, `_doc`.
- Critério: tarefas do backup com registro em `auditoria_tarefas` (ação diferente de criar/deletar, usuário diferente de a318c5eb…, antes de 25/11 16:40 UTC).
- Migration com `app.sem_notificacao='1'` e `session_replication_role = replica` para não disparar travas de agendamento nem avisos; documentos voltam a ter `tarefa_id`.
