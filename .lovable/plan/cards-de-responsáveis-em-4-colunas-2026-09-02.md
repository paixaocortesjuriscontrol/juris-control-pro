# Cards de responsáveis em 4 colunas

## Objetivo
Alterar a grade dos cards de responsáveis (Distribuição TST) de 3 colunas para 4 colunas em telas grandes, melhorando o aproveitamento horizontal.

## Mudança
Arquivo: `src/pages/DistribuicaoTst.tsx` (linha ~1809)

- De: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5`
- Para: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5`

Mantém o comportamento responsivo: 1 coluna no mobile, 2 no tablet, 4 no desktop. Os demais grids da tela (linhas 2153 e 2190) já usam 4+ colunas e não serão tocados.

## Validação
- Build OK sem erros.
- Conferir no preview que os cards passam a ocupar 4 colunas em tela larga.
