# Concluir as tarefas abertas da migração Projuris

## O que será feito
Marcar como **Cumprido** todas as tarefas da migração de 25/11/2026 (Santander Cível) que ficaram abertas:
- 2.172 pendentes
- 86 em revisão
- 26 em execução
- 20 a confirmar

Total: **2.304 tarefas**.

## Cuidados
- Cópia de segurança da situação de cada tarefa antes da mudança, para poder voltar atrás.
- Ninguém da equipe recebe aviso.
- Responsáveis, datas, processos e comentários não mudam.
- Tarefas que alguém da equipe já alterou depois da migração ficam de fora.
- Tarefas canceladas ou já concluídas não mudam.
- A data de conclusão será a data da própria tarefa: data limite, data prevista ou data de início, nessa ordem.
- A regra da importação continua igual. Uma migração futura que traga tarefas abertas não as conclui sozinha.

## Entrega
Excel com as 2.304 tarefas concluídas: código Projuris, título, processo, situação anterior e data de conclusão gravada.

## Detalhes técnicos
- Uma migração cria `backup_tarefas_abertas_projuris_20261125` (id, status, data_cumprimento) e faz o UPDATE das tarefas com origem projuris ligadas às chaves de `migracoes_projuris_itens` do lote de 25/11, com status em pendente, revisao, em_execucao ou a_confirmar e `updated_at` igual ao da criação (tolerância de minutos).
- A migração desliga os avisos da mesma forma usada nas correções anteriores.
