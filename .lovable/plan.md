
# Plano: Busca Paralela Individual (OR do lado da aplicação)

## ✅ IMPLEMENTADO

A API PJE Comunica **NÃO suporta sintaxe OR** no parâmetro `texto`/`palavraChave`. A busca "agrupada" é feita do lado da aplicação: **várias buscas individuais em paralelo**.

---

## Estratégia Implementada

```typescript
// 5 buscas simultâneas por ciclo
Promise.allSettled([
  buscar(proc1),
  buscar(proc2),
  buscar(proc3),
  buscar(proc4),
  buscar(proc5),
])
```

---

## Configuração

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `parallelism` | 5 | Requisições simultâneas |
| `delayBetweenCycles` | 200ms | Pausa entre ciclos |
| `superBatchSize` | 100 | Processos por super-lote |
| `checkpointInterval` | 50 | Salvar progresso a cada N processos |

---

## Arquivos Modificados

1. **`src/utils/pjeComunicaClient.ts`**
   - Removido: `buildOrQuery`, `buscarPjeComunicaMultiplosProcessos`
   - Adicionado: `buscarProcessosEmParalelo`, `BUSCA_PARALELA_CONFIG`

2. **`src/hooks/useMonitorarDjenProcessosBrowser.ts`**
   - Substituída lógica OR por busca paralela
   - Implementado keyset pagination (evita timeout do banco)
   - Checkpoints mais frequentes

---

## Performance Esperada

| Métrica | Valor |
|---------|-------|
| Throughput | ~60 processos/min |
| Tempo 13k processos | ~3.5 horas |
| Confiabilidade | ~95% |

---

## Próximos Passos (Opcional)

- Testar no ambiente Published (menos restrições de CORS)
- Aumentar paralelismo para 10-15 se estável
