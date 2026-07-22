
## Diagnóstico (confirmado)

O banco está correto. Consultei `eventos_agenda` e existe apenas 1 registro com `tipo = 'evento'` — nenhuma audiência gravada como evento.

O problema é no hook `src/hooks/useAgendaUnificada.ts`, que unifica várias fontes num único array. Nesse hook, o campo `origem` foi usado como rótulo interno com apenas dois valores possíveis: `"tarefa"` (veio da tabela `tarefas`) ou `"evento"` (veio de qualquer outra origem). Por isso hoje:

- Audiências (tabela `audiencias_detectadas`) são mapeadas com `origem: "evento"` (linha 972)
- Prazos derivados de parcelas são mapeados com `origem: "evento"` (linha 1117)
- Parcelamentos também recebem `origem: "evento"` (linha 1090)

O tipo real do item vai no campo `tipo` (`"audiencia"`, `"prazo"`, `"parcelamento"`, `"evento"`, `"prazo_parcela"`).

O filtro do Painel de Controle estava tratando `origem === "evento"` como "é um evento", o que arrastava audiências, prazos e parcelamentos para o balde de Eventos. Era isso que eu tinha descrito de forma confusa — a culpa não é do banco, é do rótulo mal escolhido no hook.

## O que fazer

Simplificar a regra em `src/pages/PainelControle.tsx` para não olhar mais para `origem`. Um item é Evento **somente** quando `tipo === "evento"` (ou, em tarefas, `tipo_tarefa === "EVENTO"`). Aplica-se ao filtro `itensPainelFiltrados`, ao classificador `classificarItem` e às contagens dos cards.

### Regra final, sem ambiguidade

- **Audiência**: `tipo === "audiencia"` OU `tipo_tarefa` = "AUDIÊNCIA/AUDIENCIA"
- **Prazo**: `tipo` ∈ {`"prazo"`, `"prazo_parcela"`}
- **Parcelamento**: `tipo === "parcelamento"`
- **Evento**: `tipo === "evento"` OU `tipo_tarefa === "EVENTO"`
- **Tarefa**: tudo o mais

Nada de `item.origem === "evento"` como critério de tipo. Assim, Evento é evento e pronto — em Agenda, Lista e Kanban.

Sem mudanças de banco de dados.
