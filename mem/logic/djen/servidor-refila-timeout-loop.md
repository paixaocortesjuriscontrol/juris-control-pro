---
name: DJEN Servidor — laço de refila por timeout
description: Lentidão do DJEN Termos Servidor vem do refila de unidades estouradas, não do número de termos; medir cards por rodada em execucoes_servidor
type: feature
---
A duração da rodada do DJEN Termos Servidor cresce junto com o número de cards
(`progresso->>'totalItens'`), que é inflado pelo refila de `execucoes_servidor_falhas`.

Referência medida em 18/08/2026:
- 05/08: 283 cards, ~14 min, 219 falhas (27 timeouts)
- 13/08: 541-606 cards, ~55 min
- 17/08: 873 cards, 87-106 min, 1498 falhas (678 timeouts de orçamento)

Os timeouts se distribuem por TODOS os tribunais de forma parecida (TST, TRT1..TRT24),
logo é pressão sistêmica de concorrência/rate limit, não tribunal lento específico.
O laço se autoalimenta: timeout → refila → mais unidades → mais concorrência → mais timeout.

Diagnóstico: o resumo agregado da rodada é gravado em
`execucoes_servidor.progresso->'diagnostico'` (429, 5xx, timeouts, segundos dormidos,
top tribunais, shards, unidades estouradas). Se a mensagem de falha ainda for
"Orçamento de Xs excedido (Falha ao consultar VPS DJEN)", o daemon da Hostinger está
com código ANTIGO — a partir da Fase 4 o texto é "Tempo limite da unidade excedido".
