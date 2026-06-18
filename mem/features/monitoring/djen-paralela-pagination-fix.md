---
name: djen-paralela-pagination-fix
description: Paralela engine pagination must honor continueUntilEmpty
type: feature
---
The DJEN Paralela engine (`useDjenTermosParalelaEngine.ts`) calls `buscarPjeComunicaPaginado` (both `src/utils/pjeComunicaClient.ts` and `pjeComunicaClientFlash.ts`) with `continueUntilEmpty: true`. The PJE Comunica API frequently lies: it returns `hasMore=false` mid-stream AND returns SHORT pages (< pageSize) in the middle of a long stream, on broad searches like "SANTANDER" at TST (60+ páginas) ou "OSMAR MENDES PAIXÃO CÔRTES"/"CARLOS JOSÉ ELIAS JÚNIOR" em TRT10/TRT3..TRT22.

Quando `continueUntilEmpty=true`, o cliente NÃO pode quebrar em página curta nem em `hasMore=false` — só para quando a página vier 100% vazia OU quando `addedOnPage===0` (anti-loop). Isso espelha o motor `monitor-servidor/engines/paralela.js`.

Bugs históricos:
- Regular client quebrava em `!resp.hasMore` → SANTANDER capturava 31/101 (2026-04-29).
- Ambos os clients quebravam em `resp.items.length < pageSize` mesmo com `continueUntilEmpty=true` → comparador acusava 109 publicações `so_servidor` para "Coordenação Bruna Sousa Paiva GOL" em 2026-06-18 (server=251 vs browser=142 advogado).
