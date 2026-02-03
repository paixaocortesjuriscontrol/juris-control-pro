

# Plano: Busca por Página + Comparação Local (OR do lado da aplicação)

## Diagnóstico

### Problemas Atuais

1. **Tempo não atualiza na UI**: O componente `MonitoramentoDjenProcessosCard` não exibe o tempo decorrido, diferente do componente de Termos que tem um contador visual
2. **HTTP 429 - Too Many Attempts**: A API PJE Comunica está bloqueando as 5 requisições paralelas por processo
3. **Ineficiência**: Para 13k processos, estamos fazendo 13k requisições individuais - isso nunca vai escalar

### Sua Sugestão (Correta!)

Inverter a lógica:

```text
ATUAL (lento, bloqueado):
- Para cada processo → buscar no DJEN → 13.000 requisições

NOVO (rápido, eficiente):
- Buscar páginas do DJEN do dia → comparar com nossos processos localmente
```

---

## Estratégia v4: Busca por Página + Filtro Local

### Como Funciona

1. **Buscar publicações do DJEN por DATA** (não por processo)
   - Usar a API para buscar todas as publicações de um período
   - Paginar até não haver mais resultados

2. **Criar índice local dos nossos processos**
   - Set com todos os números de processo monitorados
   - Lookup O(1) para verificar se uma publicação é nossa

3. **Para cada publicação retornada pela API**
   - Extrair número do processo
   - Se está no nosso Set → salvar como nova publicação

### Vantagens

| Métrica | Paralelo Individual | Busca por Página |
|---------|---------------------|------------------|
| Requisições/dia | ~13.000 | ~50-100 páginas |
| Tempo estimado | 3.5 horas | 5-10 minutos |
| Risco de 429 | Alto | Baixo |
| Publicações capturadas | Apenas nossos processos | Apenas nossos processos |

---

## Implementação Técnica

### 1. Criar índice de processos monitorados

```typescript
// Buscar todos os números de processo de uma vez
const { data: processos } = await supabase
  .from('processos')
  .select('numero')
  .eq('monitorar_djen', true);

// Criar Set para lookup rápido (O(1))
const processosSet = new Set(processos.map(p => normalizeNumero(p.numero)));
```

### 2. Buscar páginas do DJEN

```typescript
async function buscarPaginaDjen(page: number, params: { dataInicio, dataFim }) {
  // Buscar SEM filtro de processo - pegar todas as publicações do dia
  return buscarPjeComunicaNoBrowser({
    tipo: 'palavra-chave',    // Busca geral
    palavraChave: '*',        // Todas publicações
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    page,
    pageSize: 50,
  });
}
```

### 3. Comparar localmente (OR do lado da aplicação)

```typescript
for (const pub of paginaAtual.items) {
  const numeroPub = normalizeNumero(pub.numeroProcesso);
  
  // OR local: está em algum dos nossos processos?
  if (processosSet.has(numeroPub)) {
    // Salvar publicação
    await salvarPublicacao(pub);
    novas++;
  }
}
```

### 4. Loop principal com progresso

```typescript
let page = 0;
let hasMore = true;

while (hasMore && !cancelado) {
  const resp = await buscarPaginaDjen(page, params);
  
  // Filtrar publicações que são dos nossos processos
  const nossas = resp.items.filter(pub => processosSet.has(normalizeNumero(pub.numeroProcesso)));
  
  for (const pub of nossas) {
    await salvarPublicacao(pub);
  }
  
  // Atualizar progresso (páginas processadas, não processos)
  updateProgress({
    current: page + 1,
    total: Math.ceil(resp.totalElements / 50), // Estimativa de páginas
    novas: novasTotal,
  });
  
  hasMore = resp.hasMore;
  page++;
  
  // Delay entre páginas (500ms)
  await delay(500);
}
```

---

## Arquivos a Modificar

### 1. `src/hooks/useMonitorarDjenProcessosBrowser.ts`
- Reescrever lógica principal
- Implementar busca por página em vez de por processo
- Adicionar contador de tempo decorrido (como o Termos)

### 2. `src/utils/pjeComunicaClient.ts`
- Adicionar função `buscarPaginaDjenGeral` para buscar todas publicações de um período
- Remover código de busca paralela por processo (obsoleto)

### 3. `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx`
- Adicionar exibição do tempo decorrido (ícone Clock + contador)
- Ajustar progresso para mostrar páginas em vez de processos

### 4. `.lovable/memory`
- Atualizar documentação com estratégia v4

---

## Considerações Técnicas

### Problema Potencial: API pode não aceitar busca geral

A API PJE Comunica pode exigir um parâmetro de busca. Se `palavraChave: '*'` não funcionar, alternativas:

1. **Buscar por tribunal**: Iterar pelos tribunais principais (TRT, TRF, TJSP, etc.)
2. **Buscar por advogado**: Se temos advogados cadastrados, buscar por OAB
3. **Buscar por termo amplo**: Usar termo genérico como "processo" ou "intimação"

### Tratamento de Rate Limit

Mesmo com menos requisições, manter:
- Delay de 500-1000ms entre páginas
- Backoff exponencial se receber 429
- Checkpoint a cada 10 páginas

---

## Resultado Esperado

- **Tempo de execução**: 5-10 minutos (vs 3.5 horas)
- **Requisições**: ~100 (vs 13.000)
- **Confiabilidade**: Alta (menos chance de 429)
- **UI**: Contador de tempo visível e atualizado

