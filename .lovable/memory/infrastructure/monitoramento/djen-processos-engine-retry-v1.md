# Memory: infrastructure/monitoramento/djen-processos-engine-retry-v1
Updated: 2026-02-06

## DJEN Processos: Engine com Retry Automático

O monitoramento DJEN Processos foi atualizado para usar o engine singleton moderno (`useDjenProcessosEngine.ts`) que implementa retry automático igual aos outros monitoramentos.

### Alterações realizadas:

1. **DashboardMonitoramentos.tsx**: Migrado de `useMonitorarDjenProcessosBrowser` para `useDjenProcessosEngine`
   - Importa funções: `executarDjenProcessos`, `cancelarDjenProcessos`, `isDjenProcessosRunning`, `subscribeDjenProcessos`
   - Usa pattern de subscriber para acompanhar estado em tempo real

### Sistema de Retry do Engine:

```typescript
// Configuração em useDjenProcessosEngine.ts
const DEFAULT_PARAMS = {
  max_retries: 4,                // 4 tentativas antes de desistir
  retry_base_delay_ms: 8000,     // 8s base para backoff
};

// Backoff exponencial: 8s, 16s, 32s, 64s (max 30s cap)
const backoffMs = params.retry_base_delay_ms * Math.pow(2, retryCount - 1);
await delay(Math.min(backoffMs, 30000));
```

### Circuit Breaker:

- Após 3 bloqueios consecutivos (429/blocked), a execução é abortada automaticamente
- Previne loop infinito quando API está throttling pesado

### Comportamento:

- Retry automático com backoff exponencial (8s, 16s, 32s)
- Circuit breaker após 3 falhas consecutivas de bloqueio
- Checkpoint a cada 5 processos para retomada
- Persistência de progresso no localStorage e banco

### Hook antigo deprecado:

O arquivo `useMonitorarDjenProcessosBrowser.ts` ainda existe mas não é mais usado pelo dashboard principal. Considerar remover em limpeza futura.
