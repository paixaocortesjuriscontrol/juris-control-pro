# Retirar Emilly e Bruna como envolvidas nas tarefas da Beatriz Anjos (Coordenação GOL)

## Situação verificada
- Beatriz Anjos é responsável em 7.527 tarefas da GOL.
- Emilly Rodrigues e Bruna Sousa aparecem como envolvidas em todas essas 7.527.

## O que será feito
1. Retirar Emilly Rodrigues e Bruna Sousa da lista de envolvidas **somente** nas tarefas da GOL em que Beatriz Anjos é responsável.
2. Nada mais muda: responsáveis, situação, datas e comentários ficam como estão. Nas demais tarefas da GOL, Emilly e Bruna continuam envolvidas.
3. Conferir depois que nenhuma tarefa da Beatriz Anjos ainda tem as duas como envolvidas.

## Detalhes técnicos
- Exclusão em `tarefa_envolvidos` dos usuários Emilly Rodrigues e Bruna Sousa, apenas em tarefas com `coordenacao_id` da GOL que tenham Beatriz Anjos em `tarefa_responsaveis`.
- Só altera dados; nenhuma mudança no código.
