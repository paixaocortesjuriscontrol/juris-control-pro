# Planilha Dossiês: excluir CEJUSC (e situações afins) dos filtros

## O que a Dra. Lienne relatou

Ao gerar a Planilha Dossiês do período anterior, aparecem processos de CEJUSC, mesmo depois de escolher a situação do processo. Ela entendeu que o botão não obedece o filtro.

## O que realmente está acontecendo

O botão obedece sim o filtro de situação — o problema é que as opções da lista "Situação processo" não são exclusivas entre si. CEJUSC é uma marcação à parte: um processo pode estar marcado como CEJUSC **e** continuar como "Ativo" ao mesmo tempo.

Conferido na base hoje: existem 59 processos marcados como CEJUSC, e 35 deles também se enquadram como "Ativo". Ou seja, ao filtrar "Ativo" (ou deixar "Todas"), esses 35 entram legitimamente na planilha.

O mesmo vale para Acordo, Segredo de Justiça, Outro escritório e Trânsito em Julgado.

## O que vou fazer

Adicionar, na mesma lista "Situação processo", um bloco de **exclusões** ("Não mostrar"), com as opções:

- Não mostrar CEJUSC
- Não mostrar Acordo
- Não mostrar Segredo de Justiça
- Não mostrar Outro escritório
- Não mostrar Trânsito em Julgado

Comportamento:

- As exclusões valem para a lista da tela, para as contagens e para tudo que é gerado a partir do filtro — inclusive o botão Planilha Dossiês, a Carga Benner e os relatórios.
- Podem ser combinadas com as opções normais (ex.: "Ativo" + "Não mostrar CEJUSC").
- O botão "Limpar" da lista zera também as exclusões, e o rótulo do campo mostra quantas opções estão ativas.

Assim, para o envio à Dra. Iara basta marcar "Não mostrar CEJUSC" antes de gerar a planilha.

## Detalhes técnicos

- `src/hooks/useDistribuicoesTst.ts`: novo campo `excluirSituacoes?: string[]` em `DistribuicaoTstFilters`; mapa `SITUACAO_PROCESSO_EXCLUSAO_COND` com a condição negada de cada flag (ex.: `or(cejusc.is.null,cejusc.eq.false)`); função `applyExclusaoSituacaoFilter` aplicada nos três pontos onde hoje se chama `applySituacaoProcessoFilter` (lista, `fetchAllDistribuicaoTstIds` e a query de contagens), cada exclusão como um `.or()` próprio para que somem em AND; incluir o campo em `hasActiveFilters`.
- `src/pages/DistribuicaoTst.tsx`: estado `filtroExcluirSituacoes: string[]`, itens de exclusão no popover de Situação processo (separador + rótulo "Não mostrar"), envio em `debouncedFilters`, inclusão na chave de dependências e no `limparFiltros`/badge de filtros ativos.
- Nenhuma mudança de banco de dados.
