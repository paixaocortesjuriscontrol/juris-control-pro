
# Plano: Busca Paralela Individual (OR do lado da aplicação)

## Diagnóstico Confirmado

Os logs mostram claramente:
- `[PJE Comunica OR] Resposta: 0 itens, total: 0` (a API não entende a sintaxe OR)
- `[PJE Comunica] CORS blocked` (o Preview bloqueia intermitentemente)

**A API PJE Comunica não suporta sintaxe OR no parâmetro `texto`/`palavraChave`**. A busca "agrupada" precisa ser feita do lado da aplicação: **executar várias buscas individuais em paralelo**.

---

## Estratégia: Busca Paralela Individual

Em vez de:
```
texto=proc1 OR proc2 OR proc3... (NÃO FUNCIONA)
```

Fazer:
```
Promise.all([
  buscar(proc1),  // 10 buscas
  buscar(proc2),  // executadas
  ...             // em paralelo
])
```

---

## Implementação

### 1. Remover busca OR (não funciona)

Eliminar `buscarPjeComunicaMultiplosProcessos` e a função `buildOrQuery`.

### 2. Implementar busca paralela controlada

**Nova função em `pjeComunicaClient.ts`:**

```typescript
export async function buscarProcessosEmParalelo(
  processos: { id: string; numero: string }[],
  params: { dataInicio: string; dataFim: string },
  options?: { 
    signal?: AbortSignal;
    parallelism?: number; // Máximo de requisições simultâneas
  }
): Promise<Map<string, any[]>> {
  const parallelism = options?.parallelism ?? 5;
  const resultados = new Map<string, any[]>();
  
  // Processa em lotes paralelos de N
  for (let i = 0; i < processos.length; i += parallelism) {
    const lote = processos.slice(i, i + parallelism);
    
    const promises = lote.map(async (proc) => {
      try {
        const resp = await buscarPjeComunicaNoBrowser({
          tipo: 'processo',
          numeroProcesso: proc.numero,
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
        }, { signal: options?.signal });
        
        return { numero: proc.numero, items: resp.items };
      } catch {
        return { numero: proc.numero, items: [] };
      }
    });
    
    const resultadosLote = await Promise.allSettled(promises);
    for (const r of resultadosLote) {
      if (r.status === 'fulfilled') {
        resultados.set(r.value.numero, r.value.items);
      }
    }
  }
  
  return resultados;
}
```

### 3. Atualizar hook de monitoramento

Substituir chamadas a `buscarPjeComunicaMultiplosProcessos` por `buscarProcessosEmParalelo`.

**Configuração otimizada:**
- 5 requisições paralelas por ciclo
- 200ms delay entre ciclos
- Checkpoint a cada 50 processos
- Timeout individual de 15s

### 4. Resolver timeout do banco

O erro `statement timeout` ao buscar processos será resolvido usando keyset pagination:

```typescript
// Em vez de:
.range(offset, offset + 200)

// Usar:
.gt('numero', lastNumero)
.order('numero')
.limit(200)
```

---

## Ganho de Performance

| Métrica | Atual (OR falho) | Novo (Paralelo) |
|---------|------------------|-----------------|
| Processos simultâneos | 0 (bloqueado) | 5 |
| Throughput | 0 proc/min | ~60 proc/min |
| Tempo 13k processos | Infinito | ~3.5 horas |
| Confiabilidade | 0% | ~95% |

Ainda não é o ideal de 10-15 minutos que o OR prometia, mas funciona.

---

## Alternativa Futura: Publish

No ambiente **Published** (juris-control-pro.lovable.app), o CORS pode ser menos restritivo, permitindo testar se o paralelismo mais agressivo (10-15 simultâneos) é viável.

---

## Arquivos a Modificar

1. **`src/utils/pjeComunicaClient.ts`**
   - Remover `buildOrQuery` e `buscarPjeComunicaMultiplosProcessos`
   - Adicionar `buscarProcessosEmParalelo`

2. **`src/hooks/useMonitorarDjenProcessosBrowser.ts`**
   - Substituir lógica OR por busca paralela
   - Implementar keyset pagination para evitar timeout
   - Ajustar checkpoints para granularidade menor

3. **`.lovable/memory`**
   - Atualizar documentação com nova estratégia
