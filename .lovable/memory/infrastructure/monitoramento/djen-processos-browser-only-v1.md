# Memory: infrastructure/monitoramento/djen-processos-browser-only-v1
Updated: 2026-02-03

O monitoramento DJEN Processos foi convertido para execução **100% browser-only** para resolver definitivamente os erros WORKER_LIMIT (546) que ocorriam quando a Edge Function tentava processar 13k+ processos.

## Alterações realizadas:
1. **DashboardMonitoramentos.tsx**: `djen_processos` mapeado para `null` no objeto FUNCOES
2. **useMonitoringDashboard.ts**: `djen_processos.funcao` definido como `null`
3. **executar-monitoramento/index.ts**: retorna mensagem informativa se tipo for `djen_processos` ou `djen`
4. **useAuditoriaDjenProcessos.ts**: mutations de reprocessar/retomar/reiniciar não invocam mais Edge Function
5. **MonitoramentoDjenProcessosCard.tsx**: usa o hook `useMonitorarDjenProcessosBrowser` para execução local

## Script SQL para desativar cron jobs:
Executar `public/scripts/desativar-cron-djen-processos.sql` no SQL Editor do Supabase.

## Comportamento esperado:
- Execução manual: apenas via card dedicado no painel de Configurações (roda no navegador do usuário)
- Execução automática: não disponível (cron jobs devem ser desativados)
- Checkpoint/retomada: funcionam normalmente via hook de browser
