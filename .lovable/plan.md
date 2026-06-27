## Problema

A execução `19ce68b8…` está marcada como **executando** desde 22:18 BRT, mas o **heartbeat parou há 12+ min** sem nenhuma falha registrada — o worker da VPS (PM2) morreu silenciosamente. Sem detecção, fica travado para sempre: `dedupe_key` ocupado, card preso em "Aguardando VPS…", impressão de lentidão.

Não vou tocar no motor de busca (`paralela.js`), nas regras de validação, deduplicação ou nos hooks do browser — só infra de monitoramento. Tudo barato em créditos.

## Mudanças

### 1. Watchdog de heartbeat (SQL + cron, 1 min)
- Função `public.reaper_execucoes_servidor_travadas()`:
  - Marca como `falhou` toda `execucoes_servidor` com `status='executando'` e (`heartbeat_at < now() - interval '3 minutes'` OU `heartbeat_at IS NULL AND iniciado_em < now() - interval '3 minutes'`).
  - Preenche `erro = 'Heartbeat parado há X min — worker/VPS derrubado. Execute novamente.'` e `finalizado_em = now()`.
- Cron `pg_cron` a cada 1 min chamando a função (via `cron.schedule`, não via `pg_net` — é SQL puro local).

### 2. Botão "Destravar execução" no card
- Em `src/components/djen/DjenServidorParalelaCard.tsx`, quando `status='executando'` E `now() - heartbeat_at > 2 min`:
  - Mostrar botão vermelho **"Destravar (worker travado)"** ao lado do "Cancelar".
  - Ao clicar: `update execucoes_servidor set status='falhou', erro='Destravado manualmente', finalizado_em=now() where id=...` (mesma RLS já existente).

### 3. Indicador visual de heartbeat
- No card, ao lado do título da execução em andamento, mostrar **"Última atividade: há Xs"**:
  - Verde `< 60s`
  - Âmbar `60–180s`
  - Vermelho `> 180s` (+ texto "worker provavelmente travado")
- Atualiza a cada 5s no client (já temos polling de 8s; só formata `heartbeat_at`).

## Fora de escopo (NÃO mexer)

- `monitor-servidor/engines/paralela.js`
- `useDjenTermosParalelaEngine.ts`, `useDjenServidor.ts`, sincronizações browser
- Regras de validação parte/advogado, dedupe, descarte
- RPC `descartar_duplicadas_coordenacao_servidor`

## Técnico

- 1 migração SQL: função reaper + grant execute para `service_role` + `cron.schedule` (id fixo, idempotente com `cron.unschedule` antes).
- 1 patch em `DjenServidorParalelaCard.tsx`: badge de heartbeat + botão destravar.
- Polling existente já busca `heartbeat_at`; se não, adicionar campo no SELECT (`useExecucoesServidor` ou similar).
