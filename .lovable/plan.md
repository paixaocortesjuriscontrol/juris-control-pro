# Painel de Controle lento (Dr. Jhonatan)

## O que foi encontrado
- A tela dele abriu, mas o banco mostra que, no modo **Pessoal**, o Painel busca as cores/nomes dos modelos de **todas as tarefas do mês do escritório inteiro** (sem filtro de coordenação), conferindo permissão tarefa por tarefa: média 0,8 s e picos de 7,7 s por página, várias páginas seguidas.
- A busca antiga de comentários (tabela direta, média 0,5 s, picos de 3 s) ainda aparece com muitas chamadas. A versão nova já usa o resumo pronto; isso indica que o endereço oficial ainda roda a versão sem a correção.

## O que vou fazer
1. Criar no banco uma busca pronta "modelos das tarefas do período", que já usa a mesma regra de visibilidade da agenda (rápida) e devolve só id da tarefa, nome e cor do modelo, filtrando por coordenação quando houver.
2. Trocar no Painel a leitura atual (páginas de 1.000 tarefas + modelos + workflows) por essa busca única; nada muda na aparência nem nas cores.
3. Medir antes/depois com um usuário real no modo Pessoal e Escritório.
4. Lembrar de publicar, para que a correção dos comentários e esta valham no juriscontrol.adv.br.

## Detalhes técnicos
- RPC `modelos_tarefas_periodo(_de date, _ate date, _coords uuid[] default null)` STABLE, SECURITY INVOKER, apoiada em `_agenda_tarefas_visiveis`; join com `modelos_titulo_coordenacao` e cor do workflow (`workflow_execucao_etapas`) com prioridade.
- `useModeloTarefaItens` passa a chamar a RPC; audiências/eventos continuam como estão.
- Índice parcial existente em `tarefas(data_vencimento) WHERE modelo_tarefa_id IS NOT NULL` é reaproveitado.
