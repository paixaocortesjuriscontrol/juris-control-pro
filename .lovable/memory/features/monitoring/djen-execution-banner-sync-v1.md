# Memory: features/monitoring/djen-execution-banner-sync-v1
Updated: 02/02/2026

A tela de Análise DJEN possui um banner de progresso em tempo real que consome dados exclusivamente da tabela 'execucoes_agendadas'. Ele utiliza uma estratégia de polling otimizada (5s-15s) e centraliza o cálculo via utilitário 'getDjenTermosExecutionProgress', garantindo que o percentual exibido na análise seja exatamente o mesmo do card de configurações, eliminando discrepâncias entre as telas.

## Correções de Estabilidade v2

### Problema
O percentual oscilava porque:
1. O metadata do backend ficava "preso" em `status=em_andamento` mesmo quando a auto-continuação falhava (next lote não enfileirado).
2. O `runId` era null em alguns snapshots, resetando o lock monotônico.
3. A execução 100% background preenchia `finalizado_em` mas mantinha `status=executando`, causando confusão na UI.

### Soluções Implementadas
1. **Validação de sinais**: O banner agora verifica se o metadata possui sinais reais de continuação (`has_more`, `djen_run`, `next_offset`, `current > 0`) antes de considerar "running". Sem esses sinais, o banner não exibe progresso fantasma.

2. **RunId resiliente**: Se o `runId` for null em um snapshot, o código usa o `lastRunIdRef.current` anterior em vez de "unknown", evitando o reset do lock monotônico.

3. **Backend timeout explícito**: A Edge Function `monitorar-djen` agora marca explicitamente `status=timeout` e preenche `finalizado_em` quando falha ao enfileirar o próximo lote, permitindo à UI destravar.

4. **Polling inteligente**: O intervalo de polling aumenta para 15s quando não há execução ativa real, reduzindo carga na tela /analise-djen.
