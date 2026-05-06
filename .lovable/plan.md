## Objetivo
Garantir que o **DJET Pautas Paralela** rode todo dia no horário configurado, mesmo sem nenhuma aba aberta, via `pg_cron` + edge function, mantendo o scheduler client-side existente em paralelo (com trava para não rodar em duplicidade).

## Arquitetura

```text
pg_cron (a cada 5min)
   └─► net.http_post → edge function "executar-djet-pautas-agendado"
                            │
                            ├─ lê configuracoes_monitoramento (tipo='djet_pautas')
                            │  → ativo? horário casa com agora (BRT, ±5min)?
                            │  → trava do dia já existe em execucoes_agendadas?
                            │
                            ├─ cria registro em execucoes_agendadas (tipo='djet_pautas', status='executando')
                            │
                            ├─ carrega monitoramentos ativos (mesma query do engine)
                            │
                            ├─ loop tribunal × dia (hoje BRT)
                            │     └─ chama buscar-dejt-pautas (já existe)
                            │     └─ insere matches em publicacoes_djen (tipo='pauta', fonte='dejt-pdf')
                            │
                            └─ finaliza execucoes_agendadas (status='concluido', finalizado_em=now())
```

O scheduler client-side (`useDjetPautasParalelaScheduler`) já consulta `execucoes_agendadas` antes de disparar — bastará garantir que ele respeite uma execução `'djet_pautas'` em andamento/concluída no dia (trava compartilhada).

## Mudanças

### 1. Banco (migration)
- Garantir que o CHECK de `execucoes_agendadas.tipo` aceite `'djet_pautas'` (verificar; se não aceitar, expandir).
- Índice/uniqueness lógica: usaremos consulta `WHERE tipo='djet_pautas' AND date(criado_em AT TIME ZONE 'America/Sao_Paulo') = current_date_brt` para a trava (nada novo precisa ser criado se já existir índice por tipo+criado_em).

### 2. Nova edge function `executar-djet-pautas-agendado`
- `verify_jwt = false` (chamada por pg_cron com apikey).
- Lógica:
  1. Lê `configuracoes_monitoramento` (`tipo='djet_pautas'`). Se `ativo=false`, sai.
  2. Compara `horarios_execucao[0]` com hora atual BRT — só prossegue se `agora ∈ [target, target+10min]`.
  3. Verifica trava do dia em `execucoes_agendadas` (tipo `djet_pautas`). Se já existe execução do dia (qualquer status), sai.
  4. Insere registro `executando`.
  5. Carrega `monitoramentos_djen` (ativos) — mesma query do engine.
  6. Para cada tribunal (TST + TRT1..TRT24) chama `buscar-dejt-pautas` (interno) com `dataDDMMYYYY` = hoje BRT.
  7. Para cada match retornado, faz upsert em `publicacoes_djen` (mesma forma do engine: `tipo_publicacao='pauta'`, `fonte='dejt-pdf'`, hash).
  8. Atualiza `execucoes_agendadas` com `status='concluido'`, contadores e `ultima_execucao` em `configuracoes_monitoramento`.
  9. Em erro, marca `status='erro'` com `erro_mensagem`.
- Timeout/sequencial: processa tribunais em série (concorrência = 1, igual à UI) com pequeno delay entre dias para não estourar o limite de execução; retorna 202 imediatamente após criar o lock e roda o loop em `EdgeRuntime.waitUntil(...)` (background task) para não exceder o timeout do pg_cron.

### 3. Agendamento (`pg_cron` + `pg_net`)
- Habilitar extensões `pg_cron` e `pg_net`.
- Job rodando a cada 5 minutos:
  ```sql
  select cron.schedule(
    'djet-pautas-trigger-5min',
    '*/5 * * * *',
    $$ select net.http_post(
         url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-djet-pautas-agendado',
         headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
         body:='{}'::jsonb
       ); $$
  );
  ```
- Como o cron roda a cada 5min e a edge function só executa se a hora atual BRT casar com `horarios_execucao[0]` (janela de 10min) **e** não houver lock do dia, isso permite que o usuário mude o horário pela UI sem mexer no cron.

### 4. Scheduler client-side (mínimo ajuste)
- `useDjetPautasParalelaScheduler.checkAndRun` já consulta `isDjetPautasParalelaRunning()`; adicionar checagem em `execucoes_agendadas` (tipo `djet_pautas`, status `executando` OU `concluido` no dia BRT) para evitar disparo duplicado quando o servidor já rodou.

### 5. Manter intacto
- Edge function `buscar-dejt-pautas`: nenhuma mudança.
- UI do DJET Pautas Paralela: nenhuma mudança — continua salvando horário em `configuracoes_monitoramento`.
- `useDjetPautasParalelaEngine`: nenhuma mudança.

## Resultado
- Com a aba fechada: pg_cron dispara a edge function a cada 5min; quando bate o horário configurado, ela executa no servidor e grava em `publicacoes_djen`.
- Com a aba aberta: o client-side vê o lock em `execucoes_agendadas` e não duplica.
- Mudar o horário pela UI continua sendo a única ação necessária do usuário.

## Pontos a confirmar antes de implementar
- `execucoes_agendadas.tipo` aceita `'djet_pautas'`? (vou verificar e estender a CHECK constraint via migration se necessário).
- A inserção em `publicacoes_djen` exige algum campo extra além dos usados pelo engine atual (vou espelhar 1:1).