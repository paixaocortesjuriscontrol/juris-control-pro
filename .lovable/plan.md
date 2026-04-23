

# Reduzir 429 no DJEN Termos Pro

## Diagnóstico

Logs reais (execução agora) mostram **32 hits 429 em ~10 min, parado no termo 109/236**. Causa raiz:

1. **Delays muito agressivos para a API atual**: `delay_between_terms = 1200ms` e `delay_between_pages = 1000ms`. Como cada termo dispara 1-N tribunais × 1-N páginas, isso gera ~50 requisições/minuto contra a API PJE Comunica de um único IP (browser do usuário).
2. **Backoff não "respeita" Retry-After do servidor**: o cliente lê `retry-after` em alguns pontos mas o engine Pro usa apenas backoff exponencial fixo (8s, 16s, 32s) — frequentemente **menor** que o cooldown real exigido.
3. **Cooldown global não bloqueia o próximo termo**: quando uma página recebe 429, `setGlobalCooldown` é chamado, mas o loop principal de termos **não chama `awaitGlobalCooldown`** antes de iniciar o próximo termo. Resultado: o próximo termo bate a API ainda quente e dispara novo 429 em cascata.
4. **Sem adaptação de ritmo**: quando 429 acontece, o sistema mantém a mesma cadência. Não há "slow-down" automático.

## Solução em 4 camadas

### 1. Honrar Retry-After do servidor (fonte da verdade)
No retry de 429 dentro de `pjeComunicaClient.ts`, ler o header `Retry-After` da resposta 429 e usá-lo como **piso mínimo** do tempo de espera (já existe a função `parseRetryAfterMs`, basta plumá-la até o catch do `fetchWithRetry` paginado). Se o servidor pede 30s, esperar 30s — não 8s.

### 2. Cooldown global respeitado entre termos
No engine Pro (`useDjenTermosProEngine.ts`), antes de iniciar cada termo no loop principal, fazer `await awaitGlobalCooldown()`. Isso impede que termo N+1 dispare requisições enquanto a API ainda está em janela de bloqueio causada pelo termo N. Expor a função do client (já existe internamente — só precisa ser exportada).

### 3. Delay adaptativo (auto slow-down)
Manter um contador de 429 dos últimos 60s. Multiplicar `delay_between_terms`, `delay_between_pages` e `delay_between_tribunais` dinamicamente:

```text
hits_60s = 0     → multiplier = 1.0  (1200ms / 1000ms / 1200ms)
hits_60s = 3-5   → multiplier = 1.8  (~2160 / 1800 / 2160 ms)
hits_60s = 6-10  → multiplier = 3.0  (~3600 / 3000 / 3600 ms)
hits_60s > 10    → multiplier = 5.0  (~6000 / 5000 / 6000 ms)
```

Quando a janela limpa (sem 429 nos últimos 60s), multiplier volta gradualmente para 1.0. Isso elimina cascatas sem nunca pular termos.

### 4. Defaults mais conservadores na configuração base
Subir os valores padrão do `CONFIG` no engine Pro para o nível que comprovadamente passou em janeiro (era ~1500/1500/1500ms antes das otimizações). Novos defaults:

- `delay_between_terms: 1500` (era 1200)
- `delay_between_pages: 1200` (era 1000)
- `delay_between_tribunais: 1500` (era 1200)
- `retry_base_delay: 12000` (era 8000) — alinhado ao que o servidor PJE costuma exigir

Em condição normal o impacto no tempo total é pequeno (+15-20%), mas elimina o "ponto de virada" onde a API começa a bloquear em massa e o sistema fica preso 1h no mesmo termo.

## Arquivos afetados

- `src/utils/pjeComunicaClient.ts` — usar `Retry-After` no retry; exportar `awaitGlobalCooldown`
- `src/utils/pjeComunicaClientFlash.ts` — mesma mudança (mantém paridade Flash/Pro)
- `src/hooks/useDjenTermosProEngine.ts` — `awaitGlobalCooldown` antes de cada termo + delay adaptativo + novos defaults do `CONFIG`

## Pontos técnicos

- **Nenhum termo é pulado** em nenhuma camada — apenas espera mais quando a API pede.
- **UI continua mostrando o motivo**: a mensagem "Rate limit aguardando Xs" e o `diagnostico.rateLimitHits` que já aparecem no card permanecem; passamos a exibir também o multiplier ativo (ex.: "ritmo reduzido a 33% por pressão da API").
- **Reversível**: o multiplier é puramente em memória; reiniciar o engine reseta para o ritmo padrão.
- **Não toca em `monitorar-djen` (Edge Function)** — esta é exclusivamente uma melhoria do engine cliente que roda no browser.

## Resultado esperado

Na execução atual (236 termos, 1 dia), com a API em estado de pressão observado nos logs, o tempo total deve cair de "indeterminado / travado em 46%" para ~25-35 min, mantendo 100% de cobertura.

