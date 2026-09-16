# Pedidos por dossiê: nunca apagar e restaurar o que foi apagado

## O que aconteceu

A importação de "Pedidos por dossiê" hoje, 16/09/2026 às 12:27 (BRT), com o arquivo `pedidos_por_dossie_16_09_2026.xlsx`, trouxe 707 dossiês e 9.316 pedidos. A regra atual da importação **apaga todos os pedidos dos dossiês que aparecem na planilha e grava só os que vieram nela**. Então, para esses 707 dossiês, tudo que estava cadastrado antes e não veio no arquivo de hoje foi removido, sem cópia de segurança.

Cargas anteriores registradas: 04/09 18:32 (6.829 dossiês), 04/09 18:19 (787 dossiês), 02/09 18:06 (363 dossiês).

## Correção da regra (nunca apagar)

1. A importação passa a **somar**: acrescenta os pedidos que faltam no dossiê e **nunca remove** o que já está cadastrado.
2. Ao final, resumo mostrando por dossiê quantos pedidos foram acrescentados e quantos já existiam.
3. Toda carga passa a ficar registrada em um histórico (arquivo, data/hora BRT e quem importou), para conferência futura.
4. Caso algum dia seja preciso remover um pedido de um dossiê, isso será feito individualmente na tela, nunca por importação.

## Restaurar o que foi apagado

Como não havia histórico, o conteúdo antigo desses 707 dossiês só pode voltar a partir das planilhas usadas nas cargas anteriores:

- Você reenvia a planilha da carga anterior (a de 04/09, ou a base completa de pedidos por dossiê).
- Faço a carga já no modo "somar": os pedidos que faltam voltam, os de hoje continuam, nada é apagado nem duplicado (a comparação ignora acentos e maiúsculas/minúsculas).
- Entrego um resumo com quantos pedidos foram restaurados por dossiê.

Reforço honesto: pedidos que existiam **apenas** na carga de hoje e não estão em nenhuma planilha antiga não podem ser recuperados por mim — não há registro deles no sistema.

## Detalhes técnicos

- `src/components/distribuicao-tst/PedidosPorDossieDialog.tsx`: remover o `delete().in("dossie", part)`; buscar os pedidos já existentes dos dossiês da planilha (`select dossie, pedido_normalizado`) e inserir apenas os pares (dossie, pedido_normalizado) ausentes, em lotes de 500. Contadores de "acrescentados" e "já existentes" no resultado.
- Índice único em `pedidos_por_dossie (dossie, pedido_normalizado)` como rede de segurança contra duplicação, com insert usando `on conflict do nothing` (via `upsert` com `ignoreDuplicates`).
- Nova tabela `pedidos_por_dossie_cargas` (arquivo, dossies, pedidos_novos, pedidos_existentes, importado_por, importado_em) com RLS: leitura para autenticados, inserção pelo próprio usuário.
- Cache e queries seguem como estão (`resetPedidosPorDossie`, `ensurePedidosPorDossie`, invalidação de `pedidos-por-dossie`, `materias-pedidos-oficiais`, `materias-benner`).
- Texto de ajuda em `src/pages/admin-tst/PedidosPorDossie.tsx` atualizado: a importação passa a somar, sem substituir.
