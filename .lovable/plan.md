# Paralelismo de páginas por termo (opt-in)

## Ideia

Adicionar um **checkbox por termo** no formulário de criação/edição do monitoramento DJEN:

> ☐ **Paralelizar páginas entre VPSs** (avançado — só para termos com muitas páginas, ex.: SANTANDER no TST)

- **Default: desligado** (`false`) → comportamento atual, 1 VPS percorre páginas 1,2,3,... (igual hoje).
- **Ligado** (`true`) → na Banda 0 (TST), N workers rodam o mesmo termo em paralelo com páginas intercaladas (offset/step), cada um fixado numa VPS diferente. Cooldown 429 afeta só aquela VPS.

Tudo o que está fora desse flag continua **idêntico** ao funcionamento atual.

## Mudanças

### 1. Banco — nova coluna booleana

`monitoramentos_djen.paginacao_paralela boolean NOT NULL DEFAULT false`

Migration simples, sem mexer em RLS existente.

### 2. UI — formulário de monitoramento

No componente onde se cria/edita o termo (modal/form em `MonitoramentoDjen.tsx` / componentes filhos), adicionar um `<Switch>` ou `<Checkbox>`:

- Label: **"Paralelizar páginas entre VPSs"**
- Descrição: *"Use para termos amplos com muitas páginas (ex.: nome de banco). Consome mais VPSs simultaneamente."*
- Default: `false`.

Persistir via `criarMonitoramento` / `atualizarMonitoramento` em `useMonitoramentosDjen.ts` (já fazem spread de campos — basta incluir `paginacao_paralela` no tipo `MonitoramentoDjen`).

### 3. Engine — `useDjenTermosParalelaEngine.ts`

Na Banda 0 (TST), antes de enfileirar a unidade `(termo, dia)`:

```text
se termo.paginacao_paralela === true e viasProxy.length > 1:
   roda fase intercalada:
     para cada VPS i de 0..N-1:
        loop: página = i+1, i+1+N, i+1+2N, ...
              até resp.items.length < pageSize
     merge dedup por id_djen → consolidarResultadosTermo() 1x
senão:
   comportamento atual (fila normal, 1 worker por unidade)
```

Nenhuma mudança nas bandas 1/2/3, nenhum cursor compartilhado, nenhuma race condition.

### 4. Client — `pjeComunicaClient.ts`

Adicionar um wrapper fino `buscarPjeComunicaPagina(params, page, { forceVia, signal, ... })` que faz **uma** requisição (reusando `fetchWithRetry`). Não mexe em `buscarPjeComunicaPaginado`.

## Kill-switch

Mesmo com o flag ligado por termo, manter constante `TST_PAGE_PARALLEL_ENABLED = true` no engine. Se algum dia der problema, basta virar `false` e tudo volta ao default sem migration.

## Fora de escopo

- Bandas 1/2/3, STF/STJ, demais tribunais.
- UI de pool de proxy, infra GCP, edge functions.
- Mudar qualquer comportamento default.
