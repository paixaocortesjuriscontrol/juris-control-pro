

# Plano: Estratégia Híbrida por Tribunal para DJEN Processos

## Diagnóstico do Problema

### Situação Atual
O monitoramento está buscando **processo por processo** de forma sequencial:
- 13.210 processos monitorados
- Delay de 2s entre cada processo
- Tempo estimado: **7+ horas** (13.210 × 2s = 26.420s ≈ 7.3 horas)

### Estratégia Proposta
Inverter a lógica para **busca por tribunal**:
- Buscar todas as publicações de cada tribunal do dia
- Filtrar localmente: "essa publicação é de algum dos nossos processos?"
- ~50 tribunais × ~10 páginas = **~500 requisições** (vs 13.000)
- Tempo estimado: **10-20 minutos**

---

## Estratégia v5: Busca por Tribunal + Filtro Local

### Fluxo de Execução

```text
1. Carregar todos os processos monitorados → criar Set<numero_normalizado>
2. Para cada tribunal (TRT1, TRT2, ..., TJSP, etc.):
   a. Buscar página 0 de publicações do tribunal no período
   b. Para cada publicação:
      - Se numeroProcesso está no nosso Set → SALVAR
   c. Se hasMore → buscar próxima página
   d. Delay entre páginas (configurável)
3. Salvar checkpoint a cada tribunal concluído
4. Continuar até todos os tribunais processados
```

### Lista de Tribunais (54 total)
```text
Trabalhistas (25): TST, TRT1-TRT24
Federais (6): TRF1-TRF6
Estaduais (27): TJAC, TJAL, ..., TJSP, TJTO
Superiores (2): STJ, STF
```

---

## Arquivos a Modificar

### 1. `src/hooks/useMonitorarDjenProcessosBrowser.ts`

Reescrever a lógica principal:

```typescript
// CONSTANTES
const TRIBUNAIS_DJEN = [
  // Trabalhistas (maioria dos processos)
  'TST','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9',
  'TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18',
  'TRT19','TRT20','TRT21','TRT22','TRT23','TRT24',
  // Federais
  'TRF1','TRF2','TRF3','TRF4','TRF5','TRF6',
  // Estaduais (principais)
  'TJSP','TJRJ','TJMG','TJRS','TJPR','TJSC','TJBA','TJPE','TJCE',
  'TJGO','TJDF','TJMT','TJMS','TJPA','TJAM','TJES','TJMA','TJPB',
  'TJRN','TJAL','TJSE','TJPI','TJTO','TJRO','TJAC','TJAP','TJRR',
  // Superiores
  'STJ','STF'
];

// LÓGICA PRINCIPAL
async function executarPorTribunal(params) {
  // 1. Criar índice de processos
  const { data: processos } = await supabase
    .from('processos')
    .select('id, numero')
    .eq('monitorar_djen', true);
  
  const processosMap = new Map(
    processos.map(p => [normalizeNumero(p.numero), p])
  );
  
  // 2. Iterar por tribunais
  for (let t = 0; t < TRIBUNAIS_DJEN.length; t++) {
    const tribunal = TRIBUNAIS_DJEN[t];
    let page = 0;
    let hasMore = true;
    
    updateProgress({
      currentTribunal: t + 1,
      totalTribunais: TRIBUNAIS_DJEN.length,
      tribunalAtual: tribunal,
    });
    
    while (hasMore && !cancelado) {
      const resp = await buscarPjeComunicaNoBrowser({
        tipo: 'palavra-chave',
        siglaTribunal: tribunal,
        dataInicio,
        dataFim,
        page,
        pageSize: 50,
      });
      
      // 3. Filtrar localmente
      for (const pub of resp.items) {
        const numero = normalizeNumero(pub.numeroProcesso);
        if (processosMap.has(numero)) {
          await salvarPublicacao(pub, processosMap.get(numero)!);
          novas++;
        }
      }
      
      hasMore = resp.hasMore;
      page++;
      
      await sleep(params.delay_entre_paginas);
    }
    
    await sleep(params.delay_entre_tribunais);
    await saveCheckpoint({ tribunal: t, page, novas });
  }
}
```

### 2. `src/utils/pjeComunicaClient.ts`

A função `buscarPjeComunicaNoBrowser` já suporta o parâmetro `siglaTribunal`. Apenas garantir que:
- Quando `palavraChave` é vazio/`*`, não enviar o parâmetro `texto`
- Já está implementado no código atual (linhas 136-143)

### 3. `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx`

Atualizar a UI para mostrar progresso por tribunal:
- Mostrar "Tribunal 5/54: TRT10"
- Manter o contador de tempo decorrido
- Badge com tribunais concluídos

---

## Parâmetros da Tabela (já existentes)

Usar os parâmetros que você configurou na tela "Parâmetros DJEN":

| Parâmetro | Uso |
|-----------|-----|
| `delay_entre_paginas` | Delay entre páginas do mesmo tribunal |
| `delay_entre_tribunais` | Delay ao trocar de tribunal |
| `max_retries` | Tentativas em caso de erro 429/5xx |
| `retry_base_delay_ms` | Base para backoff exponencial |

---

## Comparação de Performance

| Métrica | Sequencial (atual) | Por Tribunal (proposto) |
|---------|-------------------|------------------------|
| Requisições | ~13.000 | ~500-800 |
| Tempo estimado | 7+ horas | 10-20 minutos |
| Risco de 429 | Muito alto | Baixo |
| Checkpoints | A cada 10 processos | A cada tribunal |
| Cobertura | 100% dos processos | 100% dos processos |

---

## Tratamento de Edge Cases

### Tribunal retorna muitas páginas
- Limitar a 20 páginas por tribunal (1000 publicações)
- Se `hasMore` ainda for true, logar e continuar

### Tribunal retorna 404/erro
- Logar e pular para o próximo tribunal
- Não interromper a execução

### Nenhuma publicação do nosso processo
- Normal: a maioria das publicações não será nossa
- Contabilizar apenas as que matcham

---

## Fluxo de Progresso na UI

```text
[====--------------------] 8%
Tribunal 5/54: TRT10 | Página 3
⏱ 2:45 | 12 novas | 340 analisadas
```

---

## Detalhes Técnicos

### Normalização de Número do Processo

```typescript
function normalizeNumero(numero: string): string {
  // Remover tudo que não é dígito
  return numero.replace(/\D/g, '');
}
```

### Mapeamento Processo → ID

```typescript
// Pré-carregar para evitar queries dentro do loop
const processosMap = new Map<string, { id: string; numero: string }>();
processos.forEach(p => {
  processosMap.set(normalizeNumero(p.numero), p);
});
```

### Checkpoint Persistente

Salvar após cada tribunal concluído:
```typescript
await supabase
  .from('configuracoes_monitoramento')
  .update({
    metadata: {
      ...metadata,
      tribunal_atual: t,
      total_tribunais: TRIBUNAIS_DJEN.length,
      novas,
      status: 'em_andamento',
    }
  })
  .eq('tipo', 'djen_processos');
```

