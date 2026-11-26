# "Limpar filtros" também apagar a pesquisa

## Por que a mensagem aparece
O aviso "Esta pesquisa encontrou 458 ocorrências fora deste mês" vem da palavra **"cumprimento"** que continua escrita na caixa de pesquisa da agenda. O botão **Limpar filtros** hoje zera filtros, situação, "Somente hoje" e Protocolados/Baixados, mas não apaga o texto da pesquisa. Por isso o aviso continua.

## O que muda
- **Limpar filtros** passa a apagar também o texto da caixa de pesquisa da agenda. Com isso o aviso amarelo some na hora.
- O resto continua como está: o botão "x" da caixa de pesquisa segue funcionando, e o mês e o modo de visão ficam como estavam.

## Detalhes técnicos
- `src/pages/PainelControle.tsx`, `limparFiltrosPainel`: incluir `setBuscaProcesso("")`.
