# Excluir os itens de workflow sem processo da Coordenação Dra. Beatriz Costa

## O que conferi
- A planilha tem 95 itens: 91 da Coordenação Dra. Beatriz Costa, 3 da Santander Trabalhista e 1 da Santander Cível.
- Os 91 itens da Dra. Beatriz (65 prazos e 26 tarefas) existem no sistema, estão sem processo e são dessa coordenação.

## O que será feito
- Excluir só esses 91 itens, usando a coluna "ID do item" da planilha.
- Os 4 itens das coordenações Santander ficam como estão.
- Nada fora da lista é apagado. A exclusão só acontece se o item continuar sem processo e na coordenação da Dra. Beatriz.
- Antes de excluir, guardo uma cópia de segurança dos 91 itens, para poder restaurar se for preciso.
- Também saem os vínculos de cada item: responsáveis, envolvidos, comentários, publicações e a ligação com a etapa do workflow.
- No fim, confiro se sobraram 0 desses itens e se as outras tarefas continuam intactas.

## Detalhes técnicos
- Lista fixa com os 91 UUIDs, filtrada por `processo_id IS NULL AND coordenacao_id = 'd997ca10-0012-4a0e-8856-664812366fec'`.
- Backup em `tarefas_duplicadas_backup` (ou tabela de backup equivalente), feito antes do DELETE.
- Limpeza de `tarefa_responsaveis`, `tarefa_envolvidos`, `comentarios_tarefas`, `tarefas_publicacoes*`, `tarefas_relacionadas`; `workflow_execucao_etapas.item_id` passa a nulo (91 referências) e depois `DELETE FROM tarefas WHERE id IN (...)` com o mesmo filtro.
- Sem mudança de código.
