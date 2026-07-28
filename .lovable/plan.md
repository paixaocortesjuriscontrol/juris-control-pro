# Fechar os apontamentos restantes da Dra. Janaina (sem mexer no Kurier)

Motor DJEN/Kurier fica de fora, conforme combinado.

## 1. "Concluí a tarefa e continua pendente" — não é bug de status (confirmado)

Consultei os dados: **zero** tarefas com `status = 'pendente'` e `data_cumprimento` preenchida, e **zero** eventos pendentes com `concluido_em`. Ou seja, a conclusão está gravando certo. O que confunde é que existem processos diferentes com **títulos de tarefa idênticos**, e o card de pendências não mostra de qual pasta/processo é o item.

Correção proposta (UX, não dados):
- Em `PendenciasProcessoCard.tsx`, exibir o **número do processo (CNJ)** abaixo do título de cada pendência, junto com a data de criação. Assim fica claro quando a pendência é de outra pasta homônima.
- Reforçar a filtragem: além de `status = 'pendente'`, ocultar qualquer item que já tenha `data_cumprimento` (tarefas) ou `concluido_em` (eventos), mesmo que o `status` tenha ficado desatualizado — igual à regra já usada nos cards do Painel de Controle. Hoje o card olha só o `status`.

## 2. Prazo aparecendo em dois dias diferentes (04/08 x 05/08) — causa confirmada

Achei a inconsistência: em `ProcessoExpandableRow.tsx` as datas de prazo são formatadas com `new Date(tarefa.prazo_fatal)` direto. Como o valor vem como `"2025-08-05"` (data pura), o JS interpreta como UTC 00:00 e, em BRT, exibe **04/08** — um dia a menos. Já o card da pasta usa parse seguro e mostra 05/08. Daí a divergência entre as telas.

Correção:
- Aplicar o mesmo `parseDateSafe` (já existente em `PendenciasProcessoCard.tsx`) em todos os pontos que formatam data pura sem proteção de fuso, começando por `ProcessoExpandableRow.tsx` (prazo fatal, data limite, data da intimação).
- Estender a mesma correção às demais telas que formatam esses campos com `new Date(...)` cru: `UpcomingDeadlines.tsx`, `TarefaPublicacaoView.tsx`, `NovaTarefa.tsx`, `Notificacoes.tsx` e `CoordenacaoDetalhesView.tsx`.
- Centralizar a função num utilitário compartilhado (`src/utils/date.ts` → `parseDateSafe`) para não repetir a lógica.

## 3. Padronização de rótulos

Manter em todas as telas os mesmos rótulos já adotados no card: **Limite** (`data_vencimento`) e **Fatal** (`data_fatal`), eliminando o "Prazo:" genérico da linha expandida de processos, que hoje ora aponta para um campo, ora para o outro.

## Fora deste plano
- Motor Kurier / escopo de tribunais (adiado a seu pedido).
- Itens já corrigidos anteriormente: data da publicação (28/07), audiência sem publicação vinculada e publicação sumindo da Análise DJEN após salvar.

## Arquivos alterados
- `src/utils/date.ts` (novo utilitário)
- `src/components/processos/PendenciasProcessoCard.tsx`
- `src/components/processos/ProcessoExpandableRow.tsx`
- `src/components/processos/TarefaPublicacaoView.tsx`
- `src/components/dashboard/UpcomingDeadlines.tsx`
- `src/pages/NovaTarefa.tsx`, `src/pages/Notificacoes.tsx`
- `src/components/notificacoes/CoordenacaoDetalhesView.tsx`
