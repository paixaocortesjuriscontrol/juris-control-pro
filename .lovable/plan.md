# Envolvida marcada na permissão pode concluir

## O que encontrei (procede)
- Antes de olhar a tela "Quem pode mudar cada situação", o sistema confere se a pessoa é responsável, corresponsável ou coordenadora. Quem é só envolvida para nessa conferência, mesmo que esteja marcada na tela.
- Na Coordenação Dra. Janaina Catunda, Júlia Rocha é envolvida em 289 pendências em aberto e Bruna Ferreira em 150. As duas recebem "Somente o responsável pode alterar a situação deste item".

## O que será feito
1. Se a pessoa for **envolvida** no item e estiver **marcada pelo nome** em "Pessoas específicas" para uma situação, ela pode aplicar essa situação. Exemplo: Júlia marcada em "Concluído com sucesso" da Audiência conclui a audiência em que está envolvida.
2. Ela só pode usar as situações em que está marcada. Nas outras, o item continua bloqueado para ela.
3. Envolvidas que não estão marcadas continuam sem poder mudar a situação. Nada muda para quem já podia mudar.
4. Vale para prazo, tarefa, audiência e parcelamento, em qualquer coordenação.
5. Conferência: com a Júlia marcada em "Concluído com sucesso" de Audiência, a regra libera uma audiência em que ela é só envolvida e bloqueia "Cancelado".

## Detalhes técnicos
- Migração: nova versão `pode_alterar_situacao_item(_user, _tarefa, _status)`. Ela mantém as regras atuais. Também libera o caso em que `_user` está em `tarefa_envolvidos` e em `permissoes_situacao_tipo_tarefa.usuarios` (ativa, mesma coordenação, mesmo tipo do item, `situacao=_status`). A versão de dois parâmetros continua igual. O gatilho de UPDATE em `tarefas` passa a chamar a versão com `NEW.status`.
- Tela: `usePodeAlterarItem` libera o seletor para a envolvida que tiver ao menos uma situação marcada para o seu nome. O seletor só mostra as situações permitidas, pela regra que já existe em `usePermissoesSituacao`. `useAgendaUnificada` e `BaixaOcorrenciaBar` passam o status escolhido para a função.
