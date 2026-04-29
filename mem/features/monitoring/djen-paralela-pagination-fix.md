---
name: djen-paralela-pagination-fix
description: Paralela engine pagination must honor continueUntilEmpty
type: feature
---
The DJEN Paralela engine (`useDjenTermosParalelaEngine.ts`) calls `buscarPjeComunicaPaginado` from `src/utils/pjeComunicaClient.ts` with `continueUntilEmpty: true` because the PJE Comunica API frequently lies about `hasMore`, returning `false` mid-stream on broad searches like "SANTANDER" at the TST (which has 60+ pages). The client MUST honor that flag: stop only when the page returns 0 NEW items or fewer than `pageSize`. The Flash client already does this; the regular client previously broke early on `!resp.hasMore`, causing massive truncation (e.g. only 31 of 101 SANTANDER processes captured for 2026-04-29).
