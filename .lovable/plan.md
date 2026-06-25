
# Acelerar consulta Judit (`buscar-judit`)

Hoje toda consulta Judit espera o crawler async terminar (8–60s), mesmo quando já existe cache fresco. A advogada está vendo "Aguardando 63s" porque o frontend bloqueia até o crawler completar. As otimizações abaixo eliminam o bloqueio quando há cache utilizável.

## Mudanças

### 1. Modo "cache first, crawler em background" (default sem anexos)
Em `supabase/functions/buscar-judit/index.ts`:

- Se o lookup de cache da Judit retorna `response_data` válido (com `parties`/`steps`/`courts`) **e** o `tribunal_acronym` é compatível com o `tribunal_hint` (ou contém indício TST quando hint=TST), responder imediatamente com o resultado derivado do cache.
- Disparar o crawler async (POST `/requests`) **sem aguardar** o polling — apenas registrar o `request_id` para auditoria. Próxima consulta no dia seguinte já pega o cache atualizado.
- Quando o cache não tem instância TST e o hint pede TST, mantém o fluxo atual (espera crawler).

Resultado esperado: consultas repetidas no mesmo processo passam de 8–60s para <2s.

### 2. Aumentar TTL do cache Judit
- `CACHE_TTL_DAYS_DEFAULT`: 1 → 3 dias para consultas normais (sem anexos).
- Anexos e `force_refresh` continuam com TTL=0 (recrawl obrigatório).

### 3. Polling mais agressivo no início
Quando precisar de fato esperar o crawler:
- Primeiros 5 polls a cada 400ms (a Judit costuma responder em 2–4s quando o processo já está em cache interno deles).
- Depois mantém 1s até o `POLL_TIMEOUT_MS`.

### 4. Botão "Forçar atualização" no UI
Hoje o usuário só consegue forçar recrawl marcando "Com anexos". Em `src/components/processos/ProcessoVisaoGeralForm.tsx` (e no card mostrado no print) trocar/adicionar um pequeno link **"Forçar atualização"** que chama `buscar-judit` com `force_refresh: true`. Assim o caminho rápido vira o padrão e o usuário só paga o custo do crawler quando realmente quer dados frescos.

### 5. Feedback de progresso mais honesto
Em `ProcessoVisaoGeralForm.tsx` e `DistribuicaoTstDetail.tsx`, quando a resposta vem do cache (novo campo `_judit_meta.fonte = "cache_instant"`), mostrar toast "Judit (cache) — atualização em segundo plano" em vez do contador. Quando precisar mesmo aguardar, manter o contador atual mas com texto "Crawler Judit pode levar até 60s…".

## Detalhes técnicos

### Resposta cache-only (novo branch antes do `juditCriarRequestComOpcoes`)
```ts
// Pseudocódigo
const cached = await juditCache(apiKey, cnj);
const cacheUsavel =
  cached &&
  !comAnexos &&
  !forceRefresh &&
  (!tribunalHint || tribunalHint !== "TST" || isTstRd(cached));

if (cacheUsavel) {
  // dispara crawler em background, ignora resultado
  juditCriarRequestComOpcoes(apiKey, cnj, false, CACHE_TTL_DAYS_DEFAULT).catch(() => {});
  rdSelecionada = cached;
  foiTst = isTstRd(cached);
  // pula direto para a extração + retorno (resto do handler inalterado)
}
```

`isTstRd` reaproveita a heurística já existente em `selecionarTst` (source_name TST, Gabinete do Ministro, classe RR/AIRR/etc).

### Memória
Atualizar `mem://features/dados-benner/judit-multi-instance-fetch.md` registrando o novo modo cache-first + TTL=3d para evitar regressão.

## Fora de escopo
- Não mexer em `consultar-processo-judit` (worker noturno) — esse pode continuar sempre forçando crawler.
- Não mexer no fluxo "Com anexos" — continua síncrono porque o usuário pediu explicitamente.
- Não mexer no `baixar-autos-judit` (download de PDFs).
