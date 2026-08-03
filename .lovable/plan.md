# Corrigir contagem dos cards de data na Distribuição TST

## Diagnóstico (confirmado no banco)

Escopo dos cards (registros com aba de origem): **10.127**

| Card | Valor |
|---|---|
| Até 2025 | 3.584 |
| 2026 em diante | 1.549 |
| **Soma** | **5.133** |
| Faltando | **4.994** |

Causa: os dois cards só olham a coluna `data_distribuicao_real`. Existem 4.994 processos sem essa data — e **todos os 4.994 têm a data da planilha preenchida** (`data_distribuicao_planilha`). Como o card ignora essa segunda coluna, esses registros não entram em nenhuma das duas faixas.

Observação: não existe nenhuma outra faixa de data escondida (não há registros antes/depois desses dois intervalos); o buraco é exclusivamente a ausência da data real.

## Correção proposta

1. Passar a classificar por **data efetiva** = data real e, quando ela não existir, a data da planilha. Isso é exatamente o critério já usado no relatório Excel da Distribuição TST, então os números passam a bater entre tela e relatório.
2. Com a correção, Até 2025 + 2026 em diante voltam a somar 10.127.
3. Acrescentar um card **Sem data** (clicável como os outros) para qualquer resíduo futuro em que nenhuma das duas datas exista, garantindo que a soma sempre feche com o Total Geral.
4. Os filtros acionados ao clicar em "Até 2025" / "2026 em diante" / "Sem data" usarão o mesmo critério de data efetiva, para a lista exibida corresponder ao número do card.

## Detalhes técnicos

- `get_distribuicao_tst_stats` (RPC): trocar os dois `FILTER` de `data_distribuicao_real` por `COALESCE(data_distribuicao_real, data_distribuicao_planilha)` e adicionar `sem_data` (ambas nulas) ao retorno.
- Mesma mudança de critério no cálculo de fallback em `src/hooks/useDistribuicaoTstStats.ts` (`computeStatsForLargeIdFilter`), com o novo campo `semData`.
- `src/components/distribuicao-tst/DistribuicaoTstStatsCards.tsx`: novo card `semData` e tipo de chave.
- `src/pages/DistribuicaoTst.tsx` / `src/hooks/useDistribuicoesTst.ts`: alinhar os filtros de faixa de data ao critério de data efetiva e tratar a chave `semData`.
