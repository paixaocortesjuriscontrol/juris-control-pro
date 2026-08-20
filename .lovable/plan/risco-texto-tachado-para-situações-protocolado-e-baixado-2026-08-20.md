# Risco (texto tachado) para situações PROTOCOLADO e BAIXADO

Hoje o texto do item só aparece riscado quando ele é considerado tratado/concluído (ou cancelado). As situações **Protocolado** e **Baixado** não entram nessa regra, então o título fica sem risco.

## O que muda

- Tarefas/prazos com situação `protocolado` ou `baixado` passam a exibir o **título riscado**.
- **Nada muda em cores, ícones, badges ou contagens**: o item continua com a cor do seu tipo, sem o V verde de concluído e sem alterar painéis, ranking ou filtros.

## Onde aparece

- Calendário do Painel de Controle (itens dos dias)
- Lista lateral do dia (agenda do Painel de Controle)
- Minha Agenda
- Aba Agenda do processo

## Detalhes técnicos

- Em `src/components/shared/TratadoCheck.tsx`, adicionar helper `isItemRiscado(item)`: retorna `true` quando `isItemTratado(item)` ou quando o status/situação normalizado for `protocolado` ou `baixado`. `isItemTratado` permanece intacto (para não afetar cor, check verde e métricas).
- Trocar apenas a condição do `line-through` por `isItemRiscado(item) || cancelado` em:
  - `src/pages/PainelControle.tsx` (~linha 2516)
  - `src/components/painel/DiaAgendaLateral.tsx` (~linha 157) — sem aplicar `text-muted-foreground` quando o risco vier de protocolado/baixado, para preservar a cor
  - `src/pages/MinhaAgenda.tsx` (~linha 752)
  - `src/components/processos/ProcessoAgendaTab.tsx` (~linha 254)
- Nenhuma alteração de banco, RLS ou Edge Function.
