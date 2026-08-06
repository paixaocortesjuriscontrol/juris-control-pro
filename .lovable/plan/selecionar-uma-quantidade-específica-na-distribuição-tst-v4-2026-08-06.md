# Selecionar uma quantidade específica na Distribuição TST + v4.4.0

## 1) Seleção parcial dos filtrados

Hoje o cabeçalho da lista só permite marcar **tudo** o que está filtrado (checkbox do topo) ou limpar a seleção. Será acrescentado, ao lado de "X registros encontrados", um controle de quantidade:

- Campo numérico (1 até o total filtrado), pré-preenchido com o total.
- Botão "Selecionar" que marca os N primeiros registros na ordem atualmente exibida na tela (respeitando a ordenação e todos os filtros ativos: TAGs, responsáveis, datas, "pronto sem pendência" etc.).
- Número maior que o total é limitado ao total; menor que 1 vira 1.
- Confirmação: "N processo(s) selecionado(s) de M filtrados".
- Estado de carregamento enquanto os IDs são buscados; o botão "limpar" continua como hoje.

Assim, todas as ações que já usam a seleção (Distribuir selecionados, Delegar, Carga Benner, Relatórios, TAGs, Arquivar) passam a operar exatamente sobre a quantidade escolhida.

## 2) Versão

O menu passa a exibir **v4.4.0**, com nota de release sobre a seleção por quantidade.

## Detalhes técnicos

- `src/pages/DistribuicaoTst.tsx`: novos estados `qtdSelecionar` e `selecionarQtdLoading`; handler que chama `fetchAllDistribuicaoTstIds(listFilters)` (mesmo objeto de filtros usado pela listagem, garantindo paridade com o contador exibido) e aplica `.slice(0, N)` antes de `setSelectedIds`. UI inserida no bloco de "registros encontrados" (~linhas 2345-2352), com `Input type="number"` e `Button` compactos.
- Ordenação: os IDs devem vir na mesma ordem da lista; se `fetchAllDistribuicaoTstIds` não aplicar o `sortBy/sortDir` atual, a ordenação será repassada para que "os N primeiros" correspondam ao que a tela mostra.
- `src/constants/version.ts`: `APP_VERSION = "4.4.0"` e nova entrada em `VERSION_HISTORY`.
- Sem alterações de banco de dados.