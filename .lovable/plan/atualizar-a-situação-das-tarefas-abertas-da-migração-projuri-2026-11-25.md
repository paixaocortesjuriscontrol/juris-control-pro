# Atualizar a situação das tarefas abertas da migração Projuris (até 13/11/2026)

## O que muda
Comparei as 2.304 tarefas abertas da migração de 25/11/2026 com o arquivo novo do Projuris. Só entram mudanças feitas no Projuris até 13/11/2026 (horário de Brasília). Todas as diferenças encontradas são dessa data ou anteriores:

| Nova situação | Tarefas |
|---|---|
| Cumprido (Concluída com sucesso) | 926 |
| Concluído sem sucesso | 20 |
| Cancelado | 96 |
| Em execução | 19 |
| A confirmar | 8 |
| Revisão | 7 |
| Pendente | 56 |

Total: **1.132 tarefas** atualizadas. As outras 1.172 já estão com a mesma situação do Projuris e ficam como estão.

## Cuidados
- Cópia de segurança da situação anterior de cada tarefa.
- Nas concluídas, a data de conclusão é a do Projuris.
- Ninguém da equipe recebe aviso.
- Responsáveis, datas, processos e comentários não mudam.
- Ficam de fora as tarefas que alguém da equipe já alterou depois da migração.
- O que mudou no Projuris depois de 13/11/2026 é ignorado.

## Entrega
Excel com as 1.132 tarefas: código Projuris, título, processo, situação anterior, situação nova e data de conclusão.

## Detalhes técnicos
- Lista (chave_externa, status, data_cumprimento) gerada do `tarefaevento-7.csv` + `tarefaeventosituacao-3.csv`, filtrada por `coalesce(dtconclusao, dtultimaatualizacao) < 2026-11-14`.
- Migração: tabela `backup_status_tarefas_projuris_20261125` e UPDATE via join em `migracoes_projuris_itens` (tipo tarefa), só em tarefas com origem projuris ainda abertas e sem edição posterior à criação, com os avisos desligados durante a operação.
