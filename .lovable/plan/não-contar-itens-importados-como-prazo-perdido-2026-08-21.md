# Não contar itens importados como "prazo perdido"

## Situação atual (verificada)

- Katarine Dias tem **58 itens** contados como prazo perdido no ranking. Todos já estão **concluídos** (status `cumprido`), com data de cumprimento posterior ao prazo — **57 deles vieram da importação Astrea** e 1 foi criado no sistema.
- A regra atual do ranking (`get_ranking_atendimento_geral`) conta como perdido qualquer item com prazo no período que: (a) foi concluído depois do prazo, ou (b) segue aberto com prazo passado — **sem olhar a origem** do item.
- Efeito firme-wide: dos itens com prazo em 2026 hoje contados como perdidos, **4.163 são importados** (Astrea/Projuris etc.) e apenas **159 nasceram no sistema**.

## O que será feito

Itens cuja origem é uma **importação** (`astrea`, `projuris`, `importacao`, `import`, `planilha`, `migracao`, `carga`, `benner`) deixam de contar como prazo perdido — para **todos os usuários e todas as coordenações**, em qualquer período.

Consequências:
- Katarine passa de 58 para **1** prazo perdido (o único item criado dentro do sistema).
- Os demais indicadores continuam iguais: "criados", "concluídos", "no prazo" e "com atraso" não mudam — a exclusão vale só para a métrica de prazo perdido.
- Nenhum dado histórico é alterado: nada de mudar datas de cumprimento ou situações das tarefas.
- Ao clicar no número de prazos perdidos no ranking, a lista do Painel de Controle passa a mostrar exatamente os mesmos itens do card (sem os importados).

## Detalhes técnicos

- `get_ranking_atendimento_geral`: adicionar `AND NOT importada` no CTE `perdidos` (a flag `importada` já existe no CTE `tar`). Nenhum outro CTE é alterado.
- `src/utils/rankingDrilldown.ts`: em `passaMetricaRanking`, para a métrica `perdidos`, retornar `false` quando o item tiver origem de importação. Reaproveitar a mesma lista de origens da RPC, exposta como constante no arquivo; o Painel de Controle já carrega esse campo (`origem_importacao` em `useAgendaUnificada`).
- `get_ranking_atendimento_tst` não possui métrica de prazos perdidos — sem mudanças.
- Sem mudança de schema; apenas substituição da função via migração (`CREATE OR REPLACE`).
