

# DJEN Termos Flash — novo motor otimizado (sem alterar o Pro)

## Objetivo

Criar um motor independente **DJEN Termos Flash** que aplique todas as otimizações do plano anterior (paginação inteligente, busca global por UF=TODAS, complementar condicional, circuit breaker, validação por metadados, dedupe de termos_or), sem tocar no DJEN Termos Pro. Disponibilizar um card próprio na tela de Configurações, ao lado do card do Pro.

## Estratégia: duplicar tudo do Pro com sufixo `Flash`

Nenhum arquivo do Pro será alterado. Todos os artefatos abaixo são novos.

### Arquivos novos (duplicados do Pro)

```text
src/hooks/useDjenTermosFlashEngine.ts   ← cópia de useDjenTermosProEngine.ts
src/hooks/useDjenTermosFlash.ts         ← cópia de useDjenTermosPro.ts
src/components/configuracoes/MonitoramentoTermosFlashCard.tsx
                                        ← cópia de MonitoramentoTermosCard.tsx (versão Pro)
src/utils/pjeComunicaClientFlash.ts     ← cópia enxuta de pjeComunicaClient.ts (paginação inteligente)
```

Storage keys, nomes de singleton, channels do Supabase Realtime e identificadores de checkpoint serão renomeados para `*_flash` / `djen-termos-flash-*` para garantir que **Pro e Flash rodem em paralelo sem colidir**.

### Tabelas / configurações

- Reaproveitar a tabela `configuracoes_monitoramento` adicionando o tipo `'termos_flash'` (em paralelo a `'termos'`).
- Não alterar a constraint do CHECK de `execucoes_agendadas` (o Flash usa o mesmo `'termos'` no logging interno do Pro? Não — o Flash terá seu próprio bucket de log. Detalhes técnicos abaixo).

## Otimizações aplicadas no Flash (não no Pro)

1. **Paginação inteligente em `pjeComunicaClientFlash.buscarPjeComunicaPaginado`**
   - `continueUntilEmpty=false` por padrão.
   - Encerra após página 1 se `items.length < pageSize` E `totalExpected` foi satisfeito.
   - Mantém `maxPages: null` + `continueUntilEmpty=true` apenas como *fallback* quando `totalExpected` está ausente e a primeira página veio cheia (preserva o caso SANTANDER 62 páginas).
   - Loga `⚠️ TRUNCADO` se parar com `hasMore=true`.

2. **Advogado UF=TODAS: 1 chamada global**
   - Quando `mon.uf === 'TODAS'` e há lista de tribunais, busca **sem `siglaTribunal`** por `nomeAdvogado` (e por OAB se existir), depois filtra localmente pelos tribunais permitidos.
   - Retry por tribunal só dispara se a busca global vier vazia.

3. **Complementar `palavraChave` para `parte`: condicional por tribunal**
   - Roda apenas nos tribunais onde `nomeParte` retornou 0 resultados. Cobertura SANTANDER/TST mantida.

4. **Dedupe de termos_or**
   - Agrupa por OAB e por nome. Não busca OAB do mesmo advogado se o nome já trouxe resultado.
   - Para UF=TODAS, aplica regra global (item 2) também aos termos_or.

5. **Circuit breaker por termo**
   - Após 3 ocorrências de 429 no mesmo termo, pula tribunais restantes desse termo e marca como "parcial" em `ultimoErroBusca`.
   - Aumenta `globalCooldownUntil` para no mínimo 12s em 429 reincidente; respeita `retry-after`.

6. **Validação confiando em filtros nativos da API**
   - `parte`: aceita publicação trazida via `nomeParte=X` sem re-validar texto (mantém apenas filtros de exclusão e tribunal).
   - `advogado`: aceita via `numeroOab=X` sem exigir nome no texto.
   - Validação rigorosa por texto continua para `palavra-chave` e `palavraChave` complementar.

7. **Telemetria no resumo final**
   - Por termo: `chamadas_api`, `paginas_extras_evitadas`, `complementares_puladas`, `descartes_por_motivo`, `tribunais_pulados_429`.

## UI — Configurações

- Novo card `MonitoramentoTermosFlashCard` adicionado na mesma página onde o `MonitoramentoTermosCard` (Pro) já é renderizado.
- Mesma estética e mesmos controles do card Pro: switch ativo, frequência (diário/2x/semanal), horário agendado, última execução, painel ao vivo, botão Executar/Cancelar/Retomar, link "Ver alertas".
- Título: **"Monitoração 360º Flash"** com descrição "Versão otimizada e mais rápida da varredura de termos estratégicos".

## Detalhes técnicos

### Renomeações no Flash (engine + hook)

- Singleton: `djenTermosFlashState` (em vez de `djenTermosProState`).
- Storage keys: `djen-termos-flash-checkpoint`, `djen-termos-flash-progress`.
- Subscriber API: `subscribeDjenTermosFlash`, `executarDjenTermosFlash`, `cancelarDjenTermosFlash`, `getCheckpointFlash`, etc.
- React Query invalidations idênticas às do Pro (mesmas keys: `publicacoes-djen`, `publicacoes-unificadas`, `notificacoes-counts`).
- Toasts: prefixo "DJEN Flash:".

### Configuração no banco

- Em `configuracoes_monitoramento`, criar registro com `tipo='termos_flash'` por coordenação (lazy-create no primeiro acesso ao card, padrão do `useConfiguracoesMonitoramento`).
- Ajuste em `useConfiguracoesMonitoramento`: adicionar getter `configuracaoTermosFlash` análogo a `configuracaoTermos` (esta é uma alteração mínima e necessária — não é arquivo do Pro).
- `useExecutarMonitoramento({ tipo: 'termos_flash' })`: aceitar o novo tipo. Se a edge function de execução agendada não suportar, manter execução **somente manual** no Flash inicialmente (cron agendado fica como follow-up).

### Constraints e migrations

- `execucoes_agendadas.tipo` CHECK precisa aceitar `'termos_flash'` se o logging do Flash gravar nessa tabela. Migration: ampliar o CHECK para incluir o novo valor (sem remover os existentes).
- `configuracoes_monitoramento.tipo` recebe o novo valor `'termos_flash'` (verificar se há CHECK; se houver, ampliar).

### Não alterado

- `useDjenTermosProEngine.ts`, `useDjenTermosPro.ts`, `MonitoramentoTermosCard.tsx`, `pjeComunicaClient.ts` e qualquer ponto que o Pro use permanecem intactos.

## Critérios de aceitação

- Card "Monitoração 360º Flash" visível em Configurações ao lado do card Pro.
- Executar Flash não interrompe nem afeta o estado do Pro (e vice-versa) — checkpoints e progresso isolados.
- Para a coordenação Dr. Thomas, execução Flash conclui com **redução perceptível de tempo e de descartes** vs. Pro, com logs `[DJEN Flash]` no console mostrando `chamadas_api` e `complementares_puladas`.
- Caso SANTANDER/TST de 62+ páginas continua sendo capturado integralmente.

## Estimativa

- Duplicação dos arquivos + renomeações: rápido.
- Aplicar otimizações 1–7 no engine Flash + ajuste no `useConfiguracoesMonitoramento` + migration: trabalho focado em 4 arquivos novos e 1 ajuste pequeno.

