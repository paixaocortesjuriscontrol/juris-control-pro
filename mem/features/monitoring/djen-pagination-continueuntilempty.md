---
name: DJEN engines must use continueUntilEmpty
description: All buscarPjeComunicaPaginado calls in DJEN engines must set continueUntilEmpty true
type: constraint
---
A API PJE Comunica frequentemente retorna `hasMore: false` indevidamente em buscas amplas (ex.: SANTANDER por parte no TST, 100+ páginas). Todos os motores que chamam `buscarPjeComunicaPaginado` em `src/utils/pjeComunicaClient.ts` precisam passar `continueUntilEmpty: true` para varrer até a página vir vazia ou com menos itens que o `pageSize`.

Engines obrigados:
- `useDjenTermosEngine.ts` (busca advogado/parte e busca por texto)
- `useDjenTermosParalelaEngine.ts`
- `useBuscaDjenDireta.ts`

Sem isso, monitoramentos amplos perdem dezenas de publicações por dia.
