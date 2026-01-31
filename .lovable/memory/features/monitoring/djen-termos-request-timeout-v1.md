# Memory: features/monitoring/djen-termos-request-timeout-v1
Updated: now

O cliente PJE Comunica (`src/utils/pjeComunicaClient.ts`) agora implementa **timeout de 30 segundos por requisição** para evitar travamentos indefinidos quando a API do PJE está lenta ou instável.

## Implementação
- Cada requisição `fetch` usa um `AbortController` com timeout de 30s
- Combina o sinal de timeout com o sinal de cancelamento externo via `AbortSignal.any()`
- O timeout é limpo automaticamente após sucesso ou erro (`clearTimeout`)

## Comportamento
- Se a requisição demorar mais de 30s, é abortada automaticamente
- O sistema de retry (backoff exponencial: 2s, 4s, 8s) tenta novamente
- Após 3 tentativas falhas, o erro é propagado e o monitoramento pula para o próximo tribunal

## Benefício
Evita que uma única requisição travada bloqueie todo o processo de monitoramento DJEN Termos.
