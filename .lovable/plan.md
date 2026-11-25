# Devolver a tarefa DEFESA do processo 4032835-05.2026.8.26.0602

## O que aconteceu (confirmado)
- A tarefa "DEFESA", com vencimento em 25/11/2026 e situação Pendente, existia na ficha do processo.
- Ela veio da migração Projuris de 13/11/2026 (criada no Projuris em 28/10/2026).
- Foi apagada hoje, 25/11/2026 às 13:47 (BRT), na limpeza das 3.301 tarefas com data depois de 13/11.
- Antes disso, pessoas da equipe já tinham trabalhado nela (alterações em 23/11 e 24/11, troca de participantes). Ou seja, era uma tarefa em uso.
- A cópia de segurança dela está guardada, com responsáveis, envolvidos, comentários e anexos.

## O que vou fazer
1. Devolver essa tarefa exatamente como estava (mesmo código, título, data, situação, responsáveis, envolvidos, comentários e anexos ligados).
2. Sem gerar avisos para a equipe.
3. Conferir que ela voltou na ficha do processo e no Painel.

## Ponto importante
Outras tarefas das 3.301 podem ter o mesmo problema: tarefas que a equipe já estava usando. Depois de devolver esta, levanto quantas das 3.301 tinham sido alteradas por pessoas antes de serem apagadas e trago a lista para você decidir se devolvo também.

## Detalhes técnicos
- Reinserir a partir de `bkp_tarefas_pos_corte_20261125` (id 58dfaaa0-...) e das tabelas `_resp`, `_env`, `_com`, `_doc` correspondentes, com `app.sem_notificacao='1'`.
- Reverter `migracoes_projuris_itens` desse item para `criado`.
