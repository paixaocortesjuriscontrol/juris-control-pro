---
name: DJEN 403 upstream vs 403 do proxy
description: 403 com HTML nginx vem do WAF do comunicaapi (bloqueio temporário do IP da VPS); só 403/401 em JSON do nosso proxy é erro de token
type: feature
---
O proxy DJEN embrulha a resposta do upstream (`{status, body}`). Portanto:

- **403 com corpo HTML/nginx** (`<html>...403 Forbidden...nginx`) = WAF do `comunicaapi.pje.jus.br` bloqueando o IP daquela VPS. É **temporário**, primo do 429: cooldown curto na via, repetir a mesma janela e fazer failover para outra VPS.
- **401/403 com JSON** (`{"error":"unauthorized"}` / `host_not_allowed`) = problema do NOSSO proxy (token/host). Aí sim é erro de configuração, sem degradação nem retry.

Implementado em `monitor-servidor/proxyPool.js` (`isUpstreamBlockBody`, flag `out.upstreamBlocked`), `monitor-servidor/engines/paralela.js` (`kind: "bloqueio"` compartilha o caminho do 429) e `src/utils/djenProxyPool.ts` (paridade Browser). Tratar upstream-403 como `auth` fazia termos inteiros ficarem "sem coleta".
