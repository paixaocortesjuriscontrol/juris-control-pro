# Marcar cópias antigas mantidas por segurança

## Objetivo
Identificar as 1.404 cópias antigas (anteriores a 25/11) que ficaram porque a equipe tinha alterado, comentado ou anexado algo nelas. A tarefa mantém a situação atual e continua aparecendo na agenda e nas contagens.

## O que muda para a equipe
- Uma etiqueta **DUPLICADA – MANTIDA POR SEGURANÇA**, em cor de alerta, aparece em cada uma dessas cópias antigas.
- Um aviso entra no fim das observações da tarefa, sem apagar o texto que já está lá:
  "Tarefa duplicada na migração Projuris. Não foi apagada por segurança porque a equipe fez alterações nela. A cópia de 25/11 é a tarefa [título] com vencimento em DD/MM/AAAA."
- A cópia de 25/11 não recebe nenhuma marca e não é alterada.

## Passos
1. Antes de mexer, conferir de novo a lista das 1.404 cópias antigas com os mesmos critérios do relatório e gravar um backup das observações atuais.
2. Criar a etiqueta em cada coordenação que tem essas cópias (hoje, Santander Cível). Ela vale só para tarefas.
3. Colocar a etiqueta nas 1.404 cópias antigas.
4. Acrescentar o aviso às observações, sem enviar notificação para ninguém.
5. Conferir no fim: 1.404 tarefas marcadas, nenhuma de 25/11 marcada, situações e datas iguais às de antes. Gerar um Excel com a lista das tarefas marcadas.

## Detalhes técnicos
- Tabelas: `etiquetas` (nome, cor, coordenacao_id, modulos = tarefas) e `etiquetas_itens` (entidade = 'tarefa', entidade_id).
- Backup em `backup_obs_copias_mantidas_20261127` (id, observacoes) com RLS só para admin.
- A atualização das observações roda sem acionar a fila de notificações: o trigger de envio é suspenso só durante a sessão, do mesmo jeito que nas restaurações anteriores.
- Nenhuma mudança no código, nas telas ou na lista de situações.
