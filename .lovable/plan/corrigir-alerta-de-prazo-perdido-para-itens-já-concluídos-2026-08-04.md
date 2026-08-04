# Corrigir alerta de "prazo perdido" para itens já concluídos

## O que aconteceu

A audiência do processo 0000799-86.2026.5.10.0015 (03/08/2026) está no banco com situação **concluido**, atualizada em 03/08 às 19:08 (BRT). Mesmo assim o alerta de prazo perdido foi enviado.

Motivo: a rotina de alerta ignora apenas as situações `tratado`, `ignorado`, `cancelado` e `realizada`. As situações que o sistema realmente grava ao concluir (`concluido`, `concluido_sem_sucesso`, `reagendado`, `verificado`) não estão nessa lista — então a audiência concluída continuou sendo tratada como pendente.

O mesmo erro existe nas tarefas/prazos: a rotina ignora `concluida`, `cancelada`, `arquivada`, `tratada`, mas os valores gravados no banco são `cumprido`, `cancelado`, `concluido_sem_sucesso`, `verificado`. Hoje há 39.329 tarefas com `cumprido` que a rotina considera em aberto (só não dispararam ainda por causa dos filtros de data).

## Correção

Alinhar a rotina de alertas às situações reais do sistema (`src/constants/situacoesItem.ts`):

- Audiências: ignorar `tratado`, `ignorado`, `cancelado`, `realizada`, `concluido`, `concluido_sem_sucesso`, `reagendado`, `verificado`.
- Tarefas/prazos: ignorar `cumprido`, `cancelado`, `concluido_sem_sucesso`, `verificado`, `tratado`, `arquivada` (mantendo os nomes antigos por compatibilidade).
- Eventos: ignorar `concluido`, `concluido_sem_sucesso`, `cancelado`, `tratado`, `verificado`.
- Parcelas: aplicar a mesma lista ao evento-pai (hoje só checa `cancelado`/`concluido`/`tratado`).

Para não repetir o problema, criar uma única lista de situações "encerradas" compartilhada pela função, derivada das mesmas situações usadas na interface.

## Detalhes técnicos

- Arquivo: `supabase/functions/alertar-prazos-perdidos/index.ts` — trocar os filtros `.not("status","in",...)` pela lista unificada e aplicar também a checagem em memória para as parcelas.
- Novo módulo compartilhado: `supabase/functions/_shared/situacoes-encerradas.ts` com as constantes por tipo de item.
- Sem mudança de banco de dados e sem envio retroativo; o efeito é a partir da próxima execução do cron.
