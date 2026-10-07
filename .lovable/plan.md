# Envolvidos podem dar baixa nas pendências

## O que encontrei (procede)
- A regra que decide quem pode mudar a situação de um prazo/tarefa aceita: admin, responsável principal, corresponsáveis, coordenador e pessoas liberadas em "alteração de itens de terceiros". **Envolvidos não estão na lista.**
- Na Coordenação Dra. Janaina Catunda não há nenhuma liberação configurada para terceiros.
- Júlia Rocha (assistente) é envolvida em 289 pendências em aberto e Bruna Ferreira (estagiária) em 150, e as duas recebem "Somente o responsável pode alterar a situação deste item".

## O que será feito
1. Quem estiver como **envolvido** em um prazo/tarefa passa a poder mudar a situação (dar baixa), como os corresponsáveis.
2. Vale para todas as coordenações. Nada muda para quem já podia dar baixa.
3. Conferir depois com a Júlia e a Bruna: a regra deve permitir em itens em que elas são só envolvidas.

## Detalhes técnicos
- Migração: na função `pode_alterar_situacao_item`, acrescentar `IF EXISTS (SELECT 1 FROM tarefa_envolvidos WHERE tarefa_id=_tarefa AND usuario_id=_user) THEN RETURN true;`, logo após a checagem de `tarefa_responsaveis`. Sem mudanças no código da tela.
