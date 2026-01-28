
# Plano: Otimização de Parâmetros - DJEN Processos (13k+)

## Objetivo

Aplicar parâmetros de alto volume **apenas** na Edge Function `monitorar-djen-processos`, ignorando completamente a tabela compartilhada `parametros_monitoramento_djen` (que continuará sendo usada pelo DJEN por Termos).

## Diagnóstico

O código atual tenta carregar parâmetros da tabela compartilhada e aplica clamps, mas:
- A tabela está configurada para o DJEN por Termos (poucos monitoramentos)
- Os clamps atuais ainda são conservadores demais para 13k processos

| Cenário | max_paralelo | batch | delay | Tempo (13k) |
|---------|--------------|-------|-------|-------------|
| Atual (após clamp) | 3 | 60 | 2500ms | ~45 min |
| **Proposta** | 5 | 100 | 1200ms | ~12-15 min |

---

## Implementação

### Alteração: `supabase/functions/monitorar-djen-processos/index.ts`

**Remover** a leitura da tabela `parametros_monitoramento_djen` e usar parâmetros **hardcoded otimizados** para alto volume.

```text
ANTES (linhas 41-50):
let CONFIG = {
  max_paralelo: 3,
  batch_size: 20,
  delay_entre_lotes: 2500,
  ...
};

DEPOIS:
// PARÂMETROS OTIMIZADOS PARA 13k+ PROCESSOS
// Independente da tabela parametros_monitoramento_djen (usada pelo DJEN Termos)
const CONFIG = {
  max_paralelo: 5,               // 5 requisições simultâneas
  batch_size: 100,               // 100 processos por lote
  delay_entre_lotes: 1200,       // 1.2s entre lotes
  delay_entre_paginas: 150,      // 150ms entre páginas da API
  soft_timeout_ms: 55000,        // 55s soft timeout
  finalization_buffer_ms: 5000,  // 5s buffer
  max_retries: 4,                // 4 tentativas com backoff
  retry_base_delay_ms: 2000,
};
```

**Remover** a função `loadConfigFromDatabase` e sua chamada (linhas 74-138).

**Atualizar** constantes derivadas (linhas 53-58):

```text
const BATCH_SIZE = CONFIG.batch_size;           // 100
const CONCURRENT_REQUESTS = CONFIG.max_paralelo; // 5
const PAGE_SIZE = 100;
const MAX_PAGES = 2;
const BASE_DELAY = CONFIG.delay_entre_lotes;    // 1200
const STAGGER_DELAY = 150;                      // delay entre requisições paralelas
```

---

## Cálculo de Throughput Esperado

```text
Processos por minuto = (paralelo × batch_size) / ((delay_lote + tempo_api) / 1000)
                     = (5 × 100) / ((1200 + 800) / 1000)
                     = 500 / 2
                     = ~250 processos/min
```

**Tempo total estimado para 13k processos: ~52 minutos** (considerando retries e variações de rede).

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/monitorar-djen-processos/index.ts` | Parâmetros hardcoded otimizados, remoção de `loadConfigFromDatabase` |

**Não serão alterados:**
- `parametros_monitoramento_djen` (tabela)
- `ParametrosDjenCard.tsx` (interface)
- `monitorar-djen/index.ts` (DJEN por Termos)

---

## Seção Técnica

### Parâmetros Finais

| Parâmetro | Valor | Justificativa |
|-----------|-------|---------------|
| `max_paralelo` | 5 | Bom throughput sem rate limit |
| `batch_size` | 100 | Lotes grandes para menos overhead |
| `delay_entre_lotes` | 1200ms | Respiro entre lotes |
| `STAGGER_DELAY` | 150ms | Espaçamento entre requisições paralelas |
| `max_retries` | 4 | Resiliência a erros 429/timeout |
| `retry_base_delay_ms` | 2000ms | Backoff exponencial (2s, 4s, 8s, 16s) |

### Mitigação de Rate Limit

- Backoff exponencial em caso de 429
- Fallback para Jina proxy se disponível
- Soft timeout de 55s para auto-continuação segura

