## Objetivo

Reduzir o tempo percebido das buscas Judit em **Distribuição TST**, atacando os dois lados:
1. **Repetições no mesmo processo** ficam quase instantâneas (cache).
2. **Primeira busca** continua existindo, mas com **feedback visual claro de progresso** e sem voltar vazia por timeout curto.

Sem mexer na UI fora do botão Judit (filtros, lista, formulários permanecem iguais).

---

## Mudanças

### 1. Cache controlado da Judit (backend)

Arquivo: `supabase/functions/buscar-judit/index.ts`

- Subir `CACHE_TTL_DAYS` de **0 → 1** (busca repetida no mesmo dia volta do cache da Judit em ~1–2s).
- Aceitar parâmetro novo `force_refresh: boolean` no body. Quando `true`, envia `cache_ttl_in_days: 0` (comportamento atual). Quando ausente/false, usa `1`.
- Garantir que `cache_ttl_in_days` é enviado **também** quando `with_attachments=true` (hoje só está no caminho sem anexos).

### 2. Timeout maior + feedback de etapas (backend)

Mesmo arquivo:
- `POLL_TIMEOUT_MS`: **20s → 60s** (Judit costuma completar em 8–25s; 20s estava cortando antes).
- `POLL_INTERVAL_MS`: manter 1000ms.
- Retornar campo extra `_meta.elapsed_ms` na resposta para diagnóstico.
- Em 429 (rate limit), backoff exponencial 3s/6s/12s com no máx. 3 tentativas (hoje só dorme 3s e continua).

### 3. Botão Judit com indicador de progresso (frontend)

Arquivo: `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`

- Substituir o estado `buscandoJudit` (boolean) por estado com **fases visíveis no botão**:
  - "Consultando Judit…" (0–3s)
  - "Aguardando crawler… (Xs)" (contador ao vivo a cada 1s)
  - "Processando resposta…" (após receber)
- Adicionar **botão secundário "Forçar atualização"** ao lado do Judit (envia `force_refresh: true`). O botão Judit padrão usa cache.
- Mensagem de erro específica para timeout: "A Judit demorou mais que o normal. Tente novamente em alguns segundos — o resultado pode já estar em cache."

### 4. Não bloquear gravação do log em caso de timeout

Hoje, se a função volta vazia, o frontend grava log como "sucesso". Ajustar para classificar como `timeout` quando a resposta vier sem `request_status=completed`, para não poluir métricas.

---

## Detalhes técnicos

| Constante | Antes | Depois |
|---|---|---|
| `CACHE_TTL_DAYS` (default) | 0 | 1 |
| `CACHE_TTL_DAYS` (force_refresh=true) | — | 0 |
| `POLL_TIMEOUT_MS` | 20 000 | 60 000 |
| Retry em 429 | 1× / 3s | 3× / 3s, 6s, 12s |

Payload novo do `invoke("buscar-judit")`:
```json
{ "numero_processo": "...", "tribunal": "TST", "com_anexos": false, "force_refresh": false }
```

Estados do botão Judit (frontend):
```
ocioso → "consultando" → "aguardando_crawler" (com contador) → "processando" → ocioso
```

---

## O que NÃO muda

- Lista, filtros, paginação, sticky highlight (já implementado).
- Comportamento da aba "Anexos" e do download.
- RLS, schema do banco, edge functions de download/sincronização.
- `consultar-processo-judit` (usado em outros fluxos) fica intocada.

---

## Ganho esperado

- 2ª busca em diante no mesmo processo/dia: **~1–3s** (vs. 15–25s hoje).
- 1ª busca: tempo igual ao atual, mas o usuário vê progresso e o sistema não erra por timeout curto.
- Botão "Forçar atualização" disponível quando a advogada precisa ignorar cache (raro).