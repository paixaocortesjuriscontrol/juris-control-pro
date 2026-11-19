# Erro "Sua coordenação só permite mudar a situação" na Santander Cível

## Por que acontece
Hoje, às 09h00 (horário de Brasília), a Santander Cível configurou em **Quem pode agendar** que advogados, advogados sênior, assistentes, estagiários e secretárias não podem alterar dados de tarefas, prazos e audiências. Algumas pessoas foram liberadas uma a uma. Quem está bloqueado só pode mudar a situação.

O erro aparece em atividades criadas como prazo que ficaram gravadas internamente como "tarefa". Ao marcar como cumprido, a tela corrige esse tipo interno para "prazo". O sistema entende isso como uma alteração de dados e bloqueia o salvamento, mesmo que a pessoa só tenha mudado a situação. No print, a Lídia tentou 5 vezes cumprir o prazo "PGTO/IMPUGNAÇÃO DE REMANESCENTE", das 10h21 às 10h24.

Há **1.175 prazos em aberto** com esse tipo interno errado, em todas as coordenações:
- 117 vieram de workflow;
- 296 vieram de planilhas;
- 34 vieram do Astrea;
- 728 foram criados manualmente.

Nas coordenações sem bloqueio, o problema não aparece.

## O que será feito
1. **Bloqueio:** a correção automática do tipo interno deixa de contar como alteração de dados. Quem só pode mudar a situação passa a conseguir cumprir esses prazos.
2. **Corrigir os prazos em aberto:** os 1.175 passam a ficar gravados como "prazo". Datas, pessoas e situação não mudam.
3. **Origem do problema:** os workflows passam a gravar prazos já com o tipo interno certo, para não criar novos casos.

A configuração de bloqueio da Santander Cível continua como está.

## Detalhes técnicos
- Migração: em `bloquear_configuracao_agendamento`, adicionar `tipo_registro` à lista de chaves ignoradas quando o novo valor só reflete o `tipo_tarefa` (PRAZO% → `prazo`, senão `tarefa`).
- Na mesma migração, `UPDATE tarefas SET tipo_registro = 'prazo' WHERE upper(tipo_tarefa) LIKE 'PRAZO%' AND tipo_registro = 'tarefa'` em status abertos. A migração roda sem `auth.uid()`, então o bloqueio não interfere.
- `src/lib/workflowExecutor.ts` (`criarItemWorkflow`): definir `tipo_registro` conforme `tipo_item`.
