# Memory: features/monitoring/djen-termos-request-timeout-v1
Updated: 05/02/2026

O cliente PJE Comunica (`src/utils/pjeComunicaClient.ts`) agora implementa **timeout de 90 segundos por requisição** para evitar travamentos indefinidos quando a API do PJE está lenta ou instável.

## Implementação
- Cada requisição `fetch` usa um `AbortController` com timeout de 90s
- Combina o sinal de timeout com o sinal de cancelamento externo via `AbortSignal.any()`
- O timeout é limpo automaticamente após sucesso ou erro (`clearTimeout`)

## Comportamento
- Se a requisição demorar mais de 90s, é abortada automaticamente
- O sistema de retry (backoff exponencial: 10s base, até 5 tentativas) tenta novamente
- Detecta automaticamente erros de timeout, rate limit (429), e rede
- Após 5 tentativas falhas, o erro é propagado e o monitoramento pula para o próximo tribunal

## Benefício
Evita que uma única requisição travada bloqueie todo o processo de monitoramento DJEN Termos.

## Configuração Atual (05/02/2026)
- REQUEST_TIMEOUT_MS: 90000 (90 segundos)
- maxRetries: 5 tentativas
- retryBaseDelay: 10000ms (10 segundos base)
- Backoff exponencial: 10s, 20s, 40s, 80s, 160s
