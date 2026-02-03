
# Plano: Busca Agrupada com OR para Monitoramento DJEN Processos

## Resumo Executivo

Implementar busca agrupada de processos usando sintaxe "OR" no parâmetro `texto` da API PJE Comunica. Isso pode reduzir o tempo de execução de **~2 horas** para **~10-15 minutos** (ganho de 8-12x).

---

## Análise Técnica

### Situação Atual
- **13.000+ processos** monitorados individualmente
- Cada processo = 1 requisição HTTP + 500ms delay
- Tempo estimado: `13.000 × 0.5s = ~1h50min` (sem contar timeouts/retries)
- Alta exposição a rate limiting (429) por volume de requisições

### Proposta: Busca com OR
A API PJE Comunica usa Elasticsearch que suporta queries compostas:
```
texto=0001234-56.2024.5.10.0001 OR 0007890-12.2024.5.10.0002 OR ...
```

**Ganho potencial:**
- 10 processos por requisição = **1.300 requisições** (vs 13.000 atual)
- Tempo estimado: `1.300 × 0.5s = ~11 minutos`

---

## Implementação

### Fase 1: Novo Método no Cliente PJE Comunica

**Arquivo:** `src/utils/pjeComunicaClient.ts`

Criar função `buscarPjeComunicaMultiplosProcessos`:
```typescript
export async function buscarPjeComunicaMultiplosProcessos(
  numerosProcesso: string[],
  params: { dataInicio?: string; dataFim?: string },
  options?: { signal?: AbortSignal }
): Promise<PjeComunicaResponse>
```

**Lógica:**
1. Filtrar apenas processos com formato CNJ válido (20+ dígitos)
2. Agrupar em lotes de **10 processos** (limite seguro para URL ~2KB)
3. Construir query: `texto=proc1 OR proc2 OR proc3...`
4. Executar requisição única
5. Mapear resultados de volta para cada processo original

### Fase 2: Atualizar Hook de Monitoramento

**Arquivo:** `src/hooks/useMonitorarDjenProcessosBrowser.ts`

**Mudanças:**
1. Buscar processos em super-lotes de **200** (vs 20 atual)
2. Agrupar em chunks de **10** para requisição OR
3. Executar **3 requisições paralelas** (30 processos simultâneos)
4. Distribuir resultados para cada processo do grupo
5. Manter checkpoints por super-lote

### Fase 3: Fallback para Processos Legados

Processos com formato não-CNJ (ex: `NDFC. 20.209.805-2`) não funcionam bem com OR.

**Estratégia:**
1. Separar processos em 2 grupos no início
2. Grupo CNJ → busca agrupada com OR (maioria)
3. Grupo legado → busca individual (minoria, ~5%)
4. Processar grupo CNJ primeiro, depois legado

---

## Configuração Otimizada

| Parâmetro | Atual | Novo |
|-----------|-------|------|
| Processos por requisição | 1 | 10 |
| Requisições paralelas | 1 | 3 |
| Delay entre requisições | 500ms | 300ms |
| Super-lote (processos) | 20 | 200 |
| Delay entre super-lotes | 2000ms | 1500ms |

**Throughput estimado:**
- Atual: ~2 processos/segundo
- Novo: ~20-30 processos/segundo

---

## Tratamento de Resultados

Quando a API retorna publicações de uma busca OR, precisamos mapear cada resultado ao processo correto:

```typescript
for (const item of resp.items) {
  // A API retorna numeroProcesso em cada item
  const numProc = item.numeroProcesso;
  const processoOriginal = processosPorNumero.get(numProc);
  if (processoOriginal) {
    // Processar publicação para este processo
  }
}
```

---

## Tratamento de Erros

1. **Se busca OR falhar:** Retry com metade do grupo (5 processos)
2. **Se continuar falhando:** Fallback para busca individual
3. **Rate limit (429):** Backoff exponencial (já implementado)
4. **Processos sem match:** Registrar para auditoria

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| API não suporta OR | Teste inicial validando sintaxe antes de implementar |
| URL muito longa | Limite conservador de 10 processos (~2KB) |
| Resultados misturados | Usar `numeroProcesso` do item para mapear |
| Perda de publicações | Fallback individual se grupo retornar vazio suspeito |

---

## Arquivos a Modificar

1. `src/utils/pjeComunicaClient.ts`
   - Adicionar `buscarPjeComunicaMultiplosProcessos()`
   - Adicionar helper `buildOrQuery()`

2. `src/hooks/useMonitorarDjenProcessosBrowser.ts`
   - Refatorar loop principal para usar busca agrupada
   - Adicionar lógica de separação CNJ vs legado
   - Implementar paralelismo controlado

3. `src/components/configuracoes/MonitoringDashboard.tsx`
   - Ajustar mensagens de progresso (ex: "Lote 5/65 (200 processos)")

---

## Métricas de Sucesso

- Tempo total de execução: **< 20 minutos** (vs ~2h atual)
- Taxa de erro por timeout: **< 1%** (vs ~5% atual)
- Cobertura de publicações: **100%** (mesmo resultado que busca individual)

---

## Próximos Passos

1. Criar teste manual com 10 processos usando sintaxe OR
2. Implementar função `buscarPjeComunicaMultiplosProcessos`
3. Refatorar hook de monitoramento
4. Testar com amostra de 500 processos
5. Validar cobertura comparando com busca individual
6. Deploy gradual

