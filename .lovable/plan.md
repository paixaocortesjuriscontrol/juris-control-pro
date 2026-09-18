# Atraso no ranking: não contar itens importados

## Situação atual (verificada)

- Katarine tem **19 atrasos** no período 01/01/2026 a 18/09/2026. Destes, **16 vieram da importação Astrea** e 3 nasceram no sistema.
- A regra atual conta atraso sempre que a data de conclusão é posterior ao prazo (data fatal > vencimento > prevista), sem olhar a origem da ficha. Para itens importados, a conclusão usada é a data original registrada na importação.
- 11 dos 19 casos têm apenas 1 dia de diferença, quase todos de fichas importadas cujo prazo veio da planilha.

## O que será feito

Itens cuja origem é uma importação (astrea, projuris, importacao, import, planilha, migracao, carga, benner) deixam de contar como **atraso** no ranking — para todos os profissionais, coordenações e períodos. A mesma exclusão já vale hoje para "prazos perdidos".

Consequências:
- Katarine passa de 19 para **3** atrasos; os outros profissionais também caem.
- "No prazo" e "% no prazo" passam a considerar apenas conclusões nascidas no sistema, ficando coerentes com a coluna de atraso.
- "Concluídos" continua igual (todas as conclusões do período).
- Nenhum dado histórico é alterado: datas e situações das fichas permanecem como estão.
- Ao clicar no número de atrasos, a lista do Painel de Controle mostra exatamente os mesmos itens do ranking.

## Detalhes técnicos

- `get_ranking_atendimento_geral`: no CTE `concl`, acrescentar `AND NOT importada` nos contadores `c_aval`, `c_prazo` e `c_atraso` (a flag `importada` já existe no CTE `tar`). `c_total` permanece sem filtro.
- `src/utils/rankingDrilldown.ts`: em `passaMetricaRanking`, retornar `false` para as métricas `atraso` e `no_prazo` quando `itemImportado(item)` for verdadeiro (função já existente).
- Texto explicativo do card "Ranking de pontualidade" (`src/pages/RankingAtendimento.tsx`): informar que conclusões vindas de importações não entram no cálculo.
- Sem mudança de schema; apenas `CREATE OR REPLACE` da função via migração.
