# Memory: constraints/report-dashboard-data-consistency
Updated: now

PDF reports and dashboard screens MUST use identical data sources to ensure totalizers match exactly. The `GerarRelatorioPdfDialog` component now uses the same `useNotificacoesCountsByCoordenacao` hook (which calls the RPC `get_notificacoes_counts_by_coordenacao`) as the Central de Notificações. This guarantees:

1. **Same deduplication logic** for DJEN (coordenacao + processo_digits + date + content hash)
2. **Same filtering logic** (date range, status, search query)
3. **Same 9 categories** displayed: DJEN, Distribuições, Alertas 360°, Redistribuições, Prazos, Tarefas, Audiências, Intimações, Andamentos

Detail sections in the PDF still use direct queries with limits for rendering tables, but the **counts** in the summary and coordination table come from the centralized RPC.
