# Corrigir campos de data na Distribuição TST

## Objetivo

Garantir que os campos **Data inicial** e **Data final** exibam a data completa, inclusive o ano, em diferentes níveis de zoom e larguras de tela.

## Alteração

- Ajustar a área dos dois campos para que ela não seja comprimida abaixo da largura necessária pelo seletor de data do navegador.
- Fazer os campos quebrarem para uma disposição mais confortável quando faltar espaço, sem alterar os demais filtros.
- Manter os filtros, valores e funcionamento atuais; a mudança será somente visual.

## Validação

- Conferir a tela Distribuição TST em largura reduzida e com zoom ampliado.
- Confirmar que dia, mês e ano ficam totalmente visíveis nos dois campos, sem sobreposição ou corte.
- Verificar o resultado da compilação após o ajuste.

## Detalhes técnicos

O período está hoje dentro de uma única coluna da grade de filtros, subdividida em duas colunas. Em áreas estreitas, cada `input type="date"` é comprimido pelo contêiner. A correção dará largura adequada ao bloco do período e permitirá uma reorganização responsiva dos dois campos.