# Painel de Controle lento para a Geovana Farias

## O que já sei
- A melhoria de velocidade do Painel (comentários e modelos de tarefa) só foi publicada hoje às 14:52 (BRT). Antes disso, o endereço oficial ainda usava as buscas lentas: a busca de comentários levava ~0,5 s por bloco (até 3 s) e a de modelos levava até 7 s.
- A Geovana é da Santander Cível. Em novembro essa coordenação tem 5.655 tarefas, contando as 3.301 que voltaram hoje.
- A busca principal da agenda dessa coordenação no mês responde rápido (cerca de 8 ms medidos pelo servidor).
- Ainda não sei a causa exata para ela. Se a tela dela estava aberta antes de 14:52, ela continua rodando a versão antiga.

## O que vou fazer
1. Pedir para a Geovana recarregar a página (Ctrl+F5) e confirmar se no menu aparece v10.4.4.
2. Medir no banco, durante alguns minutos depois que ela recarregar, quais buscas o Painel dela faz e quanto cada uma demora.
3. Se alguma busca passar de 1 segundo, corrigir só ela, no mesmo padrão já usado para os comentários: resumo feito no servidor e filtro pela coordenação.
4. Conferir de novo o tempo de carregamento do Painel com o perfil dela.

## Detalhes técnicos
- Observar `pg_stat_activity` e `pg_stat_statements` (resetando a contagem antes, se possível) para `get_agenda_escritorio`, `resumo_comentarios_itens`, `useModeloTarefaItens` e `useHistoricoSituacaoItens`.
- Se ela estiver sem escopo de coordenação conhecido, a busca de modelos pode cair no caminho sem `.in("coordenacao_id")`. Nesse caso, passar o escopo dela.
