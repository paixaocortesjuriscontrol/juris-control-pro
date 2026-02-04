
# Plano: Correção do DJEN Processos - Estabilidade e Timer

## Diagnóstico Raiz

### 1. PageSize Hardcoded na Edge Function (Bug Crítico)
A Edge Function `buscar-djen` tem `pageSize` limitado a **10** (linha 303):
```typescript
const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);
```
Mesmo pedindo `pageSize: 50`, a função ignora e retorna apenas 10 itens.

### 2. Group Size de 50 é Muito Agressivo
- 50 processos = query OR com ~1100 caracteres
- API retorna no máximo 10 itens, então a chance de achar publicações de 50 processos específicos em 10 resultados é baixíssima

### 3. Timer Travado
- O timer usa `startTimeRef` que só reseta quando `isExecutando` muda para `true`
- Se o hook encerra por erro, o timer congela no último valor
- O valor "10m 2s" é residual de execução anterior

### 4. Heartbeat/Checkpoint Espaçado
- Checkpoint salvo apenas a cada 10 grupos
- Com delay de 3s entre grupos + paginação, pode demorar 30-60s para atualizar
- O detector de timeout considera "stale" após 2 minutos sem heartbeat

---

## Alterações Necessárias

### 1. Edge Function: Aumentar PageSize para 50

**Arquivo:** `supabase/functions/buscar-djen/index.ts`
**Linha ~303:**
```typescript
// ANTES:
const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 10);

// DEPOIS: Permitir até 50 para buscas OR de DJEN Processos
const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 50);
```

### 2. Hook: Reduzir Group Size para 10

**Arquivo:** `src/hooks/useMonitorarDjenProcessosBrowser.ts`
**Linha ~19:** Alterar `GROUP_SIZE = 10` (já é 10, mas o banco sobrescreve)
**Linha ~311:** Usar o menor entre config e 10:
```typescript
const groupSize = Math.min(params.group_search_size || GROUP_SIZE, 10);
```

### 3. Timer: Reset Correto ao Iniciar

**Arquivo:** `src/hooks/useMonitorarDjenProcessosBrowser.ts`
**Na função `executar`:** Resetar o timer corretamente no início:
```typescript
// Resetar estado do timer ao iniciar nova execução
startTimeRef.current = Date.now();
lastElapsedRef.current = 0;
setProgresso(prev => ({ ...prev, elapsedSeconds: 0 }));
```

### 4. Checkpoint Mais Frequente

**Arquivo:** `src/hooks/useMonitorarDjenProcessosBrowser.ts`
**Linha ~498:** Salvar checkpoint a cada 5 grupos (era 10):
```typescript
// Salvar checkpoint a cada 5 grupos para heartbeat mais frequente
if ((g + 1) % 5 === 0 || g === grupos.length - 1) {
```

---

## Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| PageSize Edge Function | 10 (hardcoded) | 50 (dinâmico) |
| Group Size | 50 (do banco) | 10 (forçado no código) |
| Checkpoint interval | 10 grupos | 5 grupos |
| Timer reset | Condicional | Explícito ao iniciar |
| Grupos totais (13k processos) | ~264 | ~1321 |
| Tempo estimado | Travava | ~40-60 min |

---

## Detalhes Técnicos

### Por que 10 processos por grupo é melhor
- Query OR menor (~250 chars vs 1100)
- PageSize 50 = maior chance de encontrar match
- API responde mais rápido com queries menores
- Menos risco de timeout da API

### Por que checkpoint a cada 5 grupos
- Heartbeat atualizado a cada ~15-20s
- Detector de stale usa 2 minutos
- Margem de segurança de 6x

### Implantação
1. Atualizar código do hook e Edge Function
2. Deploy da Edge Function
3. Usuário faz refresh (Ctrl+F5)
4. Executar DJEN Processos
