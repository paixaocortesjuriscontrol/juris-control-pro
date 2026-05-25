## Causa raiz

No `src/hooks/useDjenTermosParalelaEngine.ts` (linhas 1697-1699), quando o pool de VPS está ativo, o código continua adicionando o slot `DIRECT_SLOT_ID` ("Direto (browser)") à lista de vias:

```ts
const vias: ViaSpec[] = viasProxy.length > 0
  ? [...viasProxy, { id: DIRECT_SLOT_ID, label: 'Direto (browser)' }]   // adiciona browser indevidamente
  : [{ id: DIRECT_SLOT_ID, label: 'Direto (browser)' }];
```

Isso contraria o comentário que está logo acima ("Se houver VPS habilitada no pool, a Paralela NÃO usa o browser como via") e gera 1 worker preso no IP do navegador. Como cada worker fica responsável por uma fila estável de tribunais (round-robin de pop), o TST hoje caiu nesse worker e o IP do browser está sendo bloqueado/instável pelo CloudFront do PJE Comunica → `Failed to fetch` → retries de 12s, 26s, 50s → ~90s por termo.

## Correção (sem pular termos)

### Fix único: tirar o browser quando houver VPS

Em `src/hooks/useDjenTermosParalelaEngine.ts`, trocar o bloco para:

```ts
const vias: ViaSpec[] =
  viasProxy.length > 0
    ? viasProxy                                       // só VPS, browser fica fora
    : [{ id: DIRECT_SLOT_ID, label: 'Direto (browser)' }]; // fallback se não houver pool
const usandoPoolVps = viasProxy.length > 0;
```

Comportamento após o fix:

- Se o pool está ligado com 1+ VPS habilitada → a Paralela usa **apenas** as VPS (sem browser).
- Se o pool está desligado ou sem VPS → comportamento atual (browser direto).
- Nenhum termo é pulado. O retry/backoff existente continua para 429/504; a única diferença é que o IP do navegador deixa de ser usado, eliminando o `Failed to fetch` que aparece nos logs.
- Concorrência efetiva passa a ser `min(nº de VPS, nº tribunais)` em vez de `min(nº VPS + 1, nº tribunais)`.

### Observação importante sobre cobertura

A função `processarTribunalTrack` (linhas 980-1045) já é robusta: ela varre **todos os dias × todos os termos × todos os tribunais** sem skip. Se uma busca falhar após os retries, ela registra `ultimoErro`, soma 0 em "novas" e segue para o próximo termo — mas o termo permanece marcado como processado naquele dia. Isso é o comportamento atual e **não vai mudar**. Para garantir que nenhuma busca falhe silenciosamente quando a VPS estiver instável, recomendo aceitar também este segundo ajuste opcional:

### Fix complementar opcional (se quiser zero falha silenciosa)

Em `src/utils/pjeComunicaClient.ts` (`fetchWithRetry`), tratar `Failed to fetch` / `TypeError` com o mesmo backoff que 504 (jitter de ~3s, sem multiplicação exponencial cara) e manter as 5 tentativas. Isso reduz o tempo perdido em erros de rede de ~90s para ~15s sem pular nada.

Esse fix é independente e pode ser aplicado junto ou depois. Não altera Pro / Flash / STF / Processos — só o caminho de retry compartilhado.

## Arquivos tocados

- `src/hooks/useDjenTermosParalelaEngine.ts` — Fix principal (~3 linhas).
- (opcional) `src/utils/pjeComunicaClient.ts` — Fix complementar.

Nada de migrations, nada em edge functions, nada de UI.
