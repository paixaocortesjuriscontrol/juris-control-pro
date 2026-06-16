---
name: DJEN Servidor pagination parity
description: monitor-servidor/engines/paralela.js must mirror browser continueUntilEmpty pagination
type: constraint
---
O motor `monitor-servidor/engines/paralela.js` precisa replicar o comportamento `continueUntilEmpty` do client browser (`src/utils/pjeComunicaClient.ts`). A API PJE Comunica frequentemente retorna páginas curtas (< 50) ou `hasMore=false` no meio do stream em buscas amplas (ex.: SANTANDER por parte no TST, 100+ páginas). `buscarPaginado` NÃO pode encerrar quando `items.length < 50`. Regras corretas:

- Só encerrar quando duas páginas consecutivas vierem com 0 itens, OU quando `added === 0` (todos duplicados via id_djen), OU quando `total` declarado for alcançado.
- Bug histórico: `if (items.length === 0 || items.length < 50 || added === 0) break;` causava perda massiva de publicações (ex.: 75 vs 4248 na coordenação Santander Civil).
- Memória relacionada do browser: `mem/features/monitoring/djen-paralela-pagination-fix.md` e `mem/features/monitoring/djen-pagination-continueuntilempty.md`.