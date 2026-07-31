# Corrigir divergência: card "Pronto sem pendência" x Gerar Carga Benner

## O problema (confirmado no código)

A tela usa dois conjuntos de filtros diferentes:

- A **lista e os cards** usam `listFilters`, que além dos filtros normais aplica as restrições calculadas no cliente: os IDs "pronto para enviar **sem pendência**" (`prontoSemPendenciaIds`), o filtro "mais de um responsável" e, para não-admin, o vínculo ao usuário logado no card "A fazer".
- O botão **Gerar Carga Benner** (`handleGerarCarga`) busca os IDs com `debouncedFilters`, que **não** contém nenhuma dessas restrições.

Resultado: ao clicar no card "Pronto sem pendência" (542) e depois em Gerar Carga Benner, o sistema carrega um conjunto maior (649 no seu exemplo) e, por isso, aparecem as 190 rejeições/pendências que o card justamente havia excluído.

## Correção

1. Em `src/pages/DistribuicaoTst.tsx`, `handleGerarCarga` passa a buscar os IDs com `listFilters` (o mesmo objeto usado pela listagem), garantindo paridade exata com o card ativo e com o contador exibido.
2. Bloquear a geração enquanto o cálculo de "sem pendência" ainda está em andamento (`prontoSemPendenciaLoading`), evitando abrir a carga com lista incompleta; o botão exibe estado de carregamento.
3. Passar também os mesmos filtros efetivos para o componente `CargaBennerFromDb` (prop `filters`), que hoje recebe apenas um subconjunto (aba, processo, dossiê, datas etc.) — os IDs continuam sendo a fonte principal, mas os filtros ficam coerentes.
4. Mostrar no cabeçalho da tela Carga Benner a quantidade de registros recebidos da lista, para conferência imediata contra o card clicado.

## Detalhes técnicos

- `handleGerarCarga`: trocar `fetchAllDistribuicaoTstIds(debouncedFilters)` por `fetchAllDistribuicaoTstIds(listFilters)`; manter a prioridade da seleção manual (`selectedIds`).
- Guarda: se `filtroSemPendencia && prontoSemPendenciaLoading`, exibir aviso ("aguarde o cálculo de pendências") e não abrir a carga.
- Nenhuma mudança de regra de pendência (`getPendencias`) nem no layout/rejeições da carga — apenas o conjunto de entrada passa a ser o correto.
