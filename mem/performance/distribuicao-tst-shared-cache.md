---
name: Distribuição TST — cache compartilhado dos totalizadores
description: Hooks de cards da Distribuição TST devem reutilizar distribuicaoTstCache (dedupe + TTL 30s) em vez de varrer dados_benner por conta própria
type: preference
---
A tela Distribuição TST (~26 mil linhas em `dados_benner`) tinha 4+ hooks
(`useDistribuicaoTstStats`, `useProntoSemPendenciaCount`,
`useProntoSemPendenciaPorResponsavel`, `useResponsaveisCounts`,
`useSemMateriaDossiePorResponsavel`) repetindo as MESMAS varreduras paginadas.

**Regra:** qualquer novo card/contador deve usar `src/utils/distribuicaoTstCache.ts`:
- `fetchAllDistribuicaoTstIds` já é cacheada (dedupe de promise em voo + TTL 30s por filtros).
- `fetchProntosRowsCached()` — linhas com status pronto_envio/planilhado/enviado, colunas unificadas em `COLUNAS_PRONTOS_COMPARTILHADAS`.
- `fetchResponsaveisPorItemCached()` — mapa `dados_benner_id -> usuario_id[]` da tabela inteira (evita lotes `.in()` de 500 UUIDs).
- Chamar `invalidateDistribuicaoTstCache()` em gravações e nos botões de atualizar.

**Por quê:** sem isso a abertura da tela disparava ~100 requisições PostgREST.
Índices no banco já existem (status, dados_benner_id) — o gargalo é o número de round trips no cliente.
