# DJEN Servidor — Daemon (Hostinger)

Daemon Node.js que replica o paralelismo do browser (Paralela / Kurier / Pautas) rodando 24/7 na VPS.

## Topologia

- 1 processo PM2: `jc-monitor-servidor`
- 3 engines rodando em paralelo no mesmo processo
- Cada engine reutiliza a tabela `djen_proxy_pool` (mesmo round-robin / cooldown 429 do browser)
- O slot local `http://127.0.0.1:8089` (djen-proxy) é injetado em memória no pool (não polui a tabela do browser)
- Persistência: tabelas `*_servidor` no Supabase (isoladas do fluxo atual)

## Instalar

```bash
cd ~ && git clone <repo> juriscontrol && cd juriscontrol/monitor-servidor
cp .env.example .env
# edite .env com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOCAL_PROXY_TOKEN
chmod 600 .env
npm install
bash setup.sh
```

## .env

```
SUPABASE_URL=https://bfxahrrvoqxcdmfsvnrk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
WORKER_ID_BASE=hostinger-01
POLL_INTERVAL_MS=5000
HEARTBEAT_MS=30000
CONCURRENCY_PARALELA=5
CONCURRENCY_KURIER=3
CONCURRENCY_PAUTAS=3
INCLUDE_LOCAL_PROXY=true
LOCAL_PROXY_URL=http://127.0.0.1:8089
LOCAL_PROXY_TOKEN=...
```

## Operar

```bash
pm2 logs jc-monitor-servidor
pm2 restart jc-monitor-servidor
pm2 stop jc-monitor-servidor
```

## Rollback total

1. `pm2 stop jc-monitor-servidor`
2. No app: desligar toggles em DJEN Servidor -> Visao geral
3. `SELECT cron.unschedule('dispatcher-servidor-tick')` no SQL editor