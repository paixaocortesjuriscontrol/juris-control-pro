
# Plano: Otimização de Performance da Busca DJEN Termos

## Diagnóstico do Problema

A versão atual está **significativamente mais lenta** que a versão do dia 27 devido a várias ineficiências introduzidas:

### Problemas Identificados

| Aspecto | Versão Rápida (dia 27) | Versão Lenta (atual) |
|---------|----------------------|---------------------|
| **Delay entre tribunais** | 150ms | 250ms |
| **Delay entre variantes** | 100ms | 150ms |
| **Delay entre monitoramentos** | ❌ Não existe | 1500ms (!) |
| **Verificação BD a cada item** | ❌ Não | ✅ Sim (query a cada loop) |
| **Timeout por requisição** | ❌ Não | 60 segundos (bloqueia) |
| **Loops aninhados** | Tribunal → Variante | UF → Variante → Tribunal (3 níveis) |

### Causa Principal do Timeout
O delay de **1500ms entre monitoramentos** + verificação de cancelamento no banco a cada iteração cria um overhead massivo. Com 50 monitoramentos, são 75 segundos só de delays!

---

## Solução: Restaurar Performance da Versão Rápida

### 1. Reduzir Delays Drasticamente

```typescript
const CONFIG = {
  delay_between_batches: 0,      // ELIMINAR delay entre monitoramentos
  delay_between_tribunals: 100,  // Reduzir de 250ms para 100ms
  delay_between_variants: 50,    // Reduzir de 150ms para 50ms
  delay_on_rate_limit: 5000,     // Reduzir de 10s para 5s (já tem retry interno)
};
```

### 2. Simplificar Loop de Busca

Remover o loop extra por UF e o timeout de 60s que trava requisições:

```typescript
// ANTES (3 níveis + timeout)
for (const ufAtual of ufsLoop) {
  for (const variante of variantesLoop) {
    for (const trib of tribunais) {
      const timeoutId = setTimeout(() => reqController.abort(), 60_000);
      // ... busca
    }
  }
}

// DEPOIS (2 níveis, sem timeout artificial)
for (const tribunal of tribunais) {
  for (const variante of variantes) {
    // Busca direta sem timeout extra
    const resp = await buscarPjeComunicaPaginado(...);
  }
}
```

### 3. Remover Verificação de Cancelamento no Banco

A verificação `cancel_requested` no banco a cada iteração adiciona latência. Manter apenas via `cancelarRef.current`:

```typescript
// ANTES
for (let i = 0; i < total; i++) {
  // Query no banco para verificar cancelamento (LENTO!)
  const { data } = await supabase.from('configuracoes_monitoramento')...
  if ((data?.metadata)?.cancel_requested) break;
  
  // ...
}

// DEPOIS
for (let i = 0; i < total; i++) {
  if (cancelarRef.current) break; // Apenas checagem local (RÁPIDO)
  // ...
}
```

### 4. Reduzir Frequência de Updates no Banco

Atualizar metadata apenas a cada 10 monitoramentos (não a cada 1):

```typescript
// Atualizar execução no banco apenas a cada 10 itens
if ((i + 1) % 10 === 0) {
  await registrarExecucao('executando', {...});
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useBuscaDjenDireta.ts` | Otimizar delays, simplificar loops, remover verificações excessivas |
| `src/constants/version.ts` | Atualizar para 1.0.5 |

---

## Comparação de Performance Esperada

| Cenário (50 monitoramentos) | Versão Atual | Versão Otimizada |
|----------------------------|-------------|-----------------|
| Delays entre monitoramentos | 75s | 0s |
| Delays entre tribunais (×27) | 337s | 135s |
| Verificações no banco | 50 queries | 5 queries |
| **Tempo Total Estimado** | 8-10min | 3-4min |

---

## Seção Técnica

### Configuração Otimizada
```typescript
const CONFIG = {
  concurrent_limit: 2,
  delay_between_batches: 0,       // Sem delay entre monitoramentos
  delay_between_tribunals: 100,   // 100ms entre tribunais
  delay_between_variants: 50,     // 50ms entre variantes  
  delay_on_rate_limit: 5000,      // 5s em caso de 429
};
```

### Loop Simplificado
```typescript
const buscarMonitoramento = async (mon: MonitoramentoDjen) => {
  const tribunais = expandirTribunais(mon.tribunais) || [undefined];
  const variantes = gerarVariantes(mon.termo_busca);
  const acumulado: any[] = [];
  const seen = new Set<string>();

  for (const trib of tribunais) {
    if (cancelarRef.current) break;

    for (const variante of variantes) {
      if (cancelarRef.current) break;

      try {
        const resp = await buscarPjeComunicaPaginado({
          tipo: mon.tipo === 'advogado' ? 'advogado' : 'palavra-chave',
          palavraChave: mon.tipo !== 'advogado' ? variante : undefined,
          oab: mon.tipo === 'advogado' ? mon.oab : undefined,
          uf: mon.tipo === 'advogado' ? mon.uf : undefined,
          siglaTribunal: trib,
          dataInicio: dataInicioYmd,
          dataFim: dataFimYmd,
        }, { maxPages: 10, delayMs: 150 });

        for (const item of resp.items) {
          const key = item?.id || JSON.stringify(item).slice(0,200);
          if (!seen.has(key)) {
            seen.add(key);
            acumulado.push(item);
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') break;
        console.warn(`Erro ${trib}: ${e?.message}`);
      }

      await delay(CONFIG.delay_between_variants);
    }
    await delay(CONFIG.delay_between_tribunals);
  }

  return acumulado;
};
```

### Loop Principal Enxuto
```typescript
for (let i = indiceInicial; i < total; i++) {
  if (cancelarRef.current) break;

  const mon = monitoramentos[i];
  
  setProgresso(prev => ({
    ...prev,
    monitoramentoAtual: i + 1,
    termoAtual: mon.termo_busca,
  }));

  const result = await processarMonitoramento(mon);
  
  // Acumular estatísticas
  totalNovas += result.novas;
  totalDuplicadas += result.duplicadas;

  // Update UI
  setProgresso(prev => ({
    ...prev,
    publicacoesNovas: totalNovas,
    publicacoesDuplicadas: totalDuplicadas,
  }));

  // Atualizar banco apenas a cada 10 itens
  if ((i + 1) % 10 === 0) {
    await registrarExecucao('executando', { processados: i + 1, total });
  }
  
  // SEM delay entre monitoramentos!
}
```
