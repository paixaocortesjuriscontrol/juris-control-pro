# Duplicados em destaque na Distribuição TST

Objetivo: enxergar na hora que um processo está repetido, comparar as fichas repetidas lado a lado e ter um totalizador de duplicados que respeite os filtros da tela.

## 1. Processo em vermelho na lista

- Linhas cujo processo aparece mais de uma vez na base ativa ficam com o número do processo em vermelho e uma marca vermelha na lateral esquerda da linha.
- A marcação usa a contagem real de repetições (mesmo número de processo), não o antigo selo automático, que pode estar desatualizado.
- O selo "Dup." atual continua, agora com a contagem: "Dup. 2", "Dup. 3".

## 2. Botão de comparação nas Ações

- Nova ação na coluna Ações (ícone de cópia), visível apenas quando a ficha tem repetidas.
- Ao clicar, abre uma janela lateral direita sobreposta com as fichas repetidas daquele processo em colunas, uma ao lado da outra.
- A janela mostra, por ficha: dossiê, aba de origem, responsáveis, situação/status, TAGs, Judit, Benner, matérias, datas (criação e última alteração em horário de Brasília).
- Campos com valores diferentes entre as fichas ficam destacados, para a advogada ver na hora onde está a divergência.
- Cada coluna tem botões "Abrir esta ficha" e, para admin/coordenador, "Arquivar esta" (arquivamento normal, nada é excluído). Fichas prontas/planilhadas/enviadas recebem aviso de que não devem ser descartadas.

## 3. Card de duplicados respeitando os filtros

- Novo card "Duplicados" no painel de totalizadores, em vermelho.
- Conta somente as fichas repetidas que estão dentro dos filtros ativos da tela (responsável, período, TAGs, situação etc.).
- Clicar no card liga o filtro "Apenas duplicados"; clicar de novo desliga, igual aos outros cards.

## 4. Aviso no formulário de preenchimento

- Abaixo do botão Salvar, na lateral do formulário, aparece um aviso vermelho quando o processo em edição tem ficha repetida: "Processo duplicado — existem N fichas com este número".
- O aviso tem um botão que abre a mesma janela lateral de comparação.

## Detalhes técnicos

- Novo hook `src/hooks/useDuplicadosTst.ts`: carrega uma vez (com cache) o mapa `chave do processo -> ids ativos` reaproveitando a lógica de `fetchDuplicateGroups` de `useDistribuicoesTst.ts` (dígitos do processo, somente registros com `aba_origem`), e expõe `isDuplicado(processo)`, `idsDoGrupo(processo)` e `totalNoFiltro(idsFiltrados)`.
- Contagem do card: interseção do conjunto global de ids duplicados com `fetchAllDistribuicaoTstIds(filters)` — mesma fonte usada hoje pelas estatísticas, garantindo respeito aos filtros. Resultado memoizado pela chave dos filtros.
- Novo componente `src/components/distribuicao-tst/DuplicadosCompararSheet.tsx` usando `Sheet` (side="right"), buscando as fichas do grupo em `dados_benner` + responsáveis + TAGs; comparação campo a campo com marcação de divergência.
- `DistribuicaoTst.tsx`: marcação vermelha da linha, nova ação, novo card (nova `StatsCardKey` "duplicados" em `DistribuicaoTstStatsCards.tsx`) ligado a `filtroDuplicado`.
- `DistribuicaoTstDetail.tsx`: aviso abaixo do botão Salvar, reaproveitando o hook e a sheet de comparação.
- Sem alteração de banco de dados e sem arquivamento automático.
