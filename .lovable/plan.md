# Motor STF Servidor — mesmas 13 VPS + regras do DJEN Termos

## Contexto (fonte)
STF **não** publica no DJEN/PJe Comunica. Publica só no DJE-STF (`digital.stf.jus.br`). Por isso o motor DJEN Termos Servidor nunca retorna STF — é limitação da fonte, não bug.

Já existe:
- `supabase/functions/stf-proxy` — proxy TLS ICP-Brasil + CORS
- `src/utils/stfDigitalClient.ts` — `buscarPublicacoesStf`, `buscarTodasPaginasStf`
- Tabela `publicacoes_stf` (17 colunas, com `monitoramento_id`, `coordenacao_id`, `stf_id`, `hash_conteudo`, `fonte`, `lida`)
- Pool de 13 VPS em `djen_proxy_pool` e daemon `monitor-servidor/`

## Paridade obrigatória com DJEN Termos Servidor

Espelha `monitor-servidor/engines/paralela.js` (Termos) e `buscaProcessos.js` (padrão de workers por VPS):

1. **Nas 13 VPS**: novo engine `monitor-servidor/engines/stf.js`, rodando dentro do mesmo daemon. Round-robin de monitoramentos entre as VPS via `loadPool(sb)` (mesmo pool usado por Termos). Não usa `djenFetchSlot` — usa cliente HTTP direto para `https://digital.stf.jus.br/decisoes-publicacoes/api/public/publicacoes` (o cert ICP-Brasil já está resolvido pelo Node nas VPS; nenhuma rota nova precisa ser adicionada no `djen-proxy/server.js`).
2. **Data**: `dataInicio = dataFim = hoje BRT (YYYY-MM-DD)` — mesma janela diária do DJEN Termos Servidor.
3. **Paginação `continueUntilEmpty`**: mesma lógica de Termos — 2 páginas vazias consecutivas OU `added===0` por 3 páginas encerra. `pageSize=50`, `maxPages=30`, delay entre páginas configurável (`STF_PAGE_DELAY_MS`, default 800ms).
4. **Termos**:
   - `palavra-chave`: expressão inteira normalizada (sem fatiar — regra `djen-keyword-no-slicing`).
   - `parte`: nome no campo `termo` (STF público não tem filtro de parte). Validação local exige match em `poloAtivo/poloPassivo/partes` OU no `texto_limpo`.
   - `advogado`: nome no `termo` (STF público não tem OAB). Variantes de nome conforme `djen-search-variants-logic-v4`.
   - `processo`: só dígitos no campo `processo`.
5. **Validação estrita** com `contemFraseExata` (`src/utils/djenTermoMatch.ts`), aplicando também `termos_or`, `exclusoes` e `condicao_concomitante` — idêntico a Termos Servidor.
6. **Dedup**: `stf_id` (primário) + `hash_conteudo = sha256(processo|texto_limpo.slice(0,4000))`.
7. **Persistência**:
   - Aprovadas → `publicacoes_stf` (upsert por `(coordenacao_id, stf_id, fonte)`, `ignoreDuplicates=true`).
   - Rejeitadas → `publicacoes_djen_descartadas` com `fonte='stf'` + `motivo_descarte` (mesma tela de descartadas usada hoje).
8. **Execução registrada** em `execucoes_agendadas` com `tipo='stf_servidor'` (novo valor no CHECK) — aparece no `RelatorioExecucoes.tsx`.

## Opt-in por monitoramento (idêntico ao DJEN Termos)

- Nova coluna `monitoramentos_djen.busca_stf_ativa boolean DEFAULT false`.
- Motor STF só processa monitoramentos com `ativo=true AND arquivado=false AND busca_stf_ativa=true`.
- Compatível com todos os tipos de monitoramento existentes (palavra-chave, parte, advogado, processo).

## Configuração de horários (igual DJEN Termos Servidor)

- Nova tabela `configuracoes_monitoramento_stf` (espelho de `configuracoes_monitoramento_servidor`):
  colunas: `id`, `coordenacao_id`, `ativo`, `horarios` (jsonb array de "HH:MM"), `dias_semana` (jsonb), `criado_por`, timestamps.
  RLS: leitura/escrita por membros da coordenação; `service_role` full.
- `pg_cron` a cada 15min chama `monitorar-stf-servidor` (edge function despachante), que:
  - Lê `configuracoes_monitoramento_stf`, decide quais coordenações estão dentro do horário/dia da semana configurado.
  - Enfileira job em `execucoes_servidor` com `tipo='stf_servidor'` (o daemon do `monitor-servidor` já processa fila; basta registrar o novo engine em `monitor-servidor/index.js`).
- Fallback: também pode ser disparado manualmente pela UI (botão "Executar agora").

## Alterações

### 1. Migração (`supabase--migration`)
- `ALTER TABLE monitoramentos_djen ADD COLUMN busca_stf_ativa boolean NOT NULL DEFAULT false;`
- CREATE TABLE `configuracoes_monitoramento_stf` (+ GRANTs + RLS + policies + trigger `updated_at`).
- Expandir CHECK de `execucoes_agendadas.tipo` para incluir `'stf_servidor'`.
- Expandir CHECK de `execucoes_servidor.tipo` (se existir) para `'stf_servidor'`.
- Índice único em `publicacoes_stf(coordenacao_id, stf_id, fonte)` se ainda não existir.
- Expandir CHECK de `publicacoes_djen_descartadas.fonte` para aceitar `'stf'` (se restrito).

### 2. Daemon VPS (`monitor-servidor/`)
- Novo arquivo `monitor-servidor/engines/stf.js`: `run({ sb, payload, log, job })` com `TIPO_ENGINE='stf_servidor'`. Workers em paralelo (um por slot da pool), payload `{ monitoramento_ids: [...] }`. Faz fetch direto a `digital.stf.jus.br`.
- Registrar engine em `monitor-servidor/index.js` (mesmo mecanismo de `buscaProcessos.js`/`paralela.js`/`pautas.js`).
- Reload das 13 VPS (`pm2 restart monitor-servidor`).

### 3. Edge Function `monitorar-stf-servidor` (despachante)
- Lê `configuracoes_monitoramento_stf`, decide se está no horário.
- Para cada coordenação elegível, agrupa `monitoramentos_djen` com `busca_stf_ativa=true` e insere um job em `execucoes_servidor` (`tipo='stf_servidor'`, `payload.monitoramento_ids`).
- Daemon pega o job e roda o engine STF.

### 4. `pg_cron` (via `supabase--insert`, não migração — contém URL/anon key)
- Cron `*/15 * * * *` → `net.http_post` para `monitorar-stf-servidor`.

### 5. Frontend
- `src/hooks/useMonitoramentosDjen.ts`: adicionar `busca_stf_ativa` ao tipo, aos `insert` e `update`.
- `src/pages/MonitoramentoDjen.tsx`: checkbox "Também buscar no STF" no form de criar/editar (default: desligado).
- Nova aba/página `MonitoramentoStfServidor.tsx` (espelho da tela de config do DJEN Termos Servidor): edita `configuracoes_monitoramento_stf` (ativo, horários, dias) + botão "Executar agora" que invoca `monitorar-stf-servidor` forçando execução imediata.
- Hook `usePublicacoesStf.ts` (lista, marcar como lida) — mesmo padrão de `useMonitoramentosDjen`.
- `RelatorioExecucoes.tsx`: label "STF Servidor" para `tipo='stf_servidor'`.
- Feed DJEN: badge "STF" nas linhas oriundas de `publicacoes_stf`.

## Fluxo

```text
cron */15min ─► monitorar-stf-servidor (edge)
                     │ verifica horário/dia em configuracoes_monitoramento_stf
                     │ agrupa monitoramentos com busca_stf_ativa=true
                     ▼
              execucoes_servidor (tipo='stf_servidor')
                     │
                     ▼
      monitor-servidor daemon (13 VPS, round-robin)
                     │  engines/stf.js — paginação continueUntilEmpty
                     │  fetch digital.stf.jus.br (data=hoje BRT)
                     │  validação contemFraseExata + exclusões + concomitante
                     ▼
      publicacoes_stf (aprovadas)  +  publicacoes_djen_descartadas (fonte='stf')
                     +
              execucoes_agendadas (tipo='stf_servidor')
```

## Fora de escopo agora
- Alertas por e-mail STF (estrutura `alertas_coordenacao_djen` aponta hoje para `publicacoes_djen` — pode ser evolução).
- Match por OAB estrito no STF (API pública não expõe filtro OAB).
