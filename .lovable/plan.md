# Acelerar o totalizador "Revisar Lista de matérias"

## Situação atual

Esse é o único card que ainda calcula tudo no navegador a cada carregamento da tela:
carrega o mapa completo de matérias por dossiê (~95 mil pedidos), lê todas as linhas
marcadas como prontas e reaplica a regra de "nenhuma matéria da lista do dossiê"
registro por registro. Daí a demora.

## O que vai mudar

Usar a mesma solução que já resolveu o card "Pronto sem pendência": gravar a marca
em cada registro e a tela só ler o número.

- Nova marca por registro: "precisa revisar a lista de matérias".
- A marca é gravada nos mesmos momentos em que já gravamos "sem pendência":
  ao salvar a ficha, ao salvar pela tela Dados Benner, no "Marcar Pronto" em lote,
  no botão "Verificar Pendências" e no preenchimento inicial automático.
- O card e os números por responsável passam a contar direto no banco,
  sem baixar a lista de matérias nem as linhas de prontos no navegador.
- Clicar no card continua filtrando a lista pelos mesmos processos.

Resultado: o card aparece instantaneamente, junto com os demais.

## Detalhes técnicos

Banco (migração):
- `dados_benner.revisar_lista_materias boolean` + índice parcial
  `idx_dados_benner_revisar_lista_materias` (apenas `true`).
- Gravada pelo cliente junto com `sem_pendencia` / `pendencias_verificado_em`
  (mesma passagem, sem custo extra de leitura).
- Ajustar as RPCs de contagem (`get_distribuicao_tst_stats`,
  `get_distribuicao_tst_responsaveis_counts`) para expor a contagem da coluna.

Front-end:
- `src/utils/distribuicaoTstSemPendencia.ts`: `calcularRevisarListaMaterias(row)`
  usando `precisaRevisarListaMaterias` já existente; incluir o campo nos updates de
  `recalcularSemPendencia`, `atualizarSemPendenciaRegistro` e
  `atualizarSemPendenciaLote`.
- `src/hooks/useDistribuicoesTst.ts`: filtro `revisarListaMaterias?: "todos" | "sim"`
  aplicado com `.eq("revisar_lista_materias", true)`, incluído em `hasActiveFilters`.
- `src/hooks/useSemMateriaDossiePorResponsavel.ts`: passa a somar por responsável a
  partir dos IDs devolvidos por `fetchAllDistribuicaoTstIds` com esse filtro
  (reaproveitando `fetchResponsaveisPorItemCached`), removendo
  `ensurePedidosPorDossie` e `fetchProntosRowsCached` do caminho de carregamento.
- `src/pages/DistribuicaoTst.tsx`: card usa a contagem do banco; o clique no card
  aplica `revisarListaMaterias: "sim"` nos filtros em vez de mandar a lista de IDs.
