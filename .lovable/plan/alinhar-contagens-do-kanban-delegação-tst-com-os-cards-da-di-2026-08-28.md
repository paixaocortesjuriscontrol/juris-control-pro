# Alinhar contagens do Kanban Delegação TST com os cards da Distribuição

## O que foi verificado

Selecionando Rayanna Prado, o Kanban mostra 498 delegados / 322 prontos / 70 sem pendência, enquanto a tela Distribuição TST mostra 322 prontos e 315 "Pronto sem pendência". Os prontos batem; o "S/pend" não.

Motivos confirmados no código:

1. **Colunas incompletas no Kanban.** `DistribuicaoTstKanban.tsx` busca apenas `COLUNAS_SELECT_PENDENCIAS` + colunas básicas. O card da Distribuição (`useProntoSemPendenciaCount.ts`) busca também `acordo`, `cejusc`, `processo_outro_escritorio`, `segredo_justica`, `transito_julgado`, `recurso_terceiro(s)`, `recorrente`, `midia_negativa`, `tem_data_julgamento`, `materias_analise_reclamante`, `materias_analise_banco`. Sem essas colunas, `getPendencias` acusa pendência onde não há — daí o número muito menor (70).
2. **Sem a regra "Não precisa fazer".** O card ignora registros com `processo_outro_escritorio`, `segredo_justica` ou `cejusc`; o Kanban não aplica essa exclusão.
3. **Teto de linhas.** O Kanban carrega no máximo 1000 linhas (2000 sem filtro), então "Delegada" e as colunas do quadro ficam truncadas quando o responsável tem mais processos, enquanto os cards da Distribuição contam a base inteira.
4. **Fontes mistas no resumo.** No resumo por responsável, `total` e `pronto` vêm de `useResponsaveisCounts` (base completa) e `semPend` vem só das linhas carregadas — combinação que garante divergência.

## Correção

1. Passar a buscar no Kanban exatamente o mesmo conjunto de colunas usado pelo card "Pronto sem pendência", extraindo essa lista para um único lugar compartilhado.
2. Aplicar no Kanban a mesma isenção "Não precisa fazer" (outro escritório, segredo de justiça, CEJUSC) antes de classificar como pronto sem pendência.
3. Calcular `semPend` por responsável sobre a base completa (paginação por lotes, como já é feito nos totalizadores), em vez de sobre as linhas visíveis, para o número casar com o card.
4. Paginar a carga do Kanban (lotes até esgotar) em vez do limite fixo de 1000/2000, mantendo os cartões visíveis por coluna com carregamento incremental para não travar a tela.

## Detalhes técnicos

- Extrair de `src/hooks/useProntoSemPendenciaCount.ts` a lista de colunas e o predicado `naoPrecisaFazer` para um helper em `src/utils/distribuicaoTstPendencias.ts` (ex.: `COLUNAS_SELECT_PRONTO_SEM_PENDENCIA` e `isNaoPrecisaFazer(row)`), usado pelo hook e pelo Kanban.
- `src/pages/DistribuicaoTstKanban.tsx`: usar o novo select, aplicar `isNaoPrecisaFazer` em `semPendencia`, trocar `.limit()` por paginação em `range()` e derivar `semPend` do mesmo conjunto completo.
- Nenhuma mudança nas regras de negócio de pendência em `getPendencias`.
