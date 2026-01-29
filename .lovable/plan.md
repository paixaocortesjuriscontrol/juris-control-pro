

# Plano: Monitoração 360 - Varredura de 7 Dias Sem Duplicadas

## Análise do Problema

A edge function `monitorar-termos` está filtrando movimentações por `created_at >= início do dia atual` (linhas 170-173). Como não houve movimentações capturadas hoje (29/01), a varredura termina em segundos sem encontrar nada.

**Logs confirmam:**
```
Init: 11 terms, 0 movements today
Batch complete in 11741ms. Progress: 0/0 (100%). isComplete=true
```

## Solução: Varredura dos Últimos 7 Dias

### Lógica de Deduplicação Existente

O sistema **já possui** proteção contra duplicatas através de:

1. **Sets em memória (linhas 238-246)**:
   ```typescript
   const alertasSet = new Set(
     (alertasResult.data || []).map(a => `${a.movimentacao_id}-${a.termo_id}`)
   );
   const audienciasExistentes = new Set(
     (audienciasResult.data || []).map(a => a.movimentacao_id)
   );
   const intimacoesExistentes = new Set(
     (intimacoesResult.data || []).map(i => i.movimentacao_id)
   );
   ```

2. **Verificação antes de inserir (linhas 266-268)**:
   ```typescript
   if (!alertasSet.has(key)) { // Só insere se não existir
     // ... cria alerta
     alertasSet.add(key); // Adiciona ao set para evitar duplicatas no mesmo lote
   }
   ```

### Problema Atual com 7 Dias

O problema é que os sets de deduplicação são carregados **apenas para as movimentações do lote atual** (otimização de performance feita anteriormente). Com 7 dias, precisamos verificar **todo o histórico de alertas** para essas movimentações.

**Solução:** Ajustar a query de deduplicação para buscar alertas existentes para **todas** as movimentações do período de 7 dias, não apenas do lote.

---

## Mudanças Técnicas

### Arquivo: `supabase/functions/monitorar-termos/index.ts`

#### 1. Alterar Filtro de Data (linhas 170-174)

**De:**
```typescript
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
const inicioDoDia = hoje.toISOString();
```

**Para:**
```typescript
// Varrer movimentações dos últimos 7 dias para garantir cobertura
const seteDiasAtras = new Date();
seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
seteDiasAtras.setHours(0, 0, 0, 0);
const dataFiltro = seteDiasAtras.toISOString();
console.log(`Filtering movements from last 7 days: ${dataFiltro}`);
```

#### 2. Atualizar Query de Contagem (linha 179)

```typescript
supabase.from('movimentacoes').select('id', { count: 'exact', head: true }).gte('created_at', dataFiltro),
```

#### 3. Atualizar Query de Movimentações (linhas 203-208)

```typescript
const { data: movimentacoes } = await supabase
  .from('movimentacoes')
  .select('id, processo_id, descricao, data_movimentacao, created_at, processo:processos(numero)')
  .gte('created_at', dataFiltro)
  .order('created_at', { ascending: false })
  .range(currentOffset, currentOffset + BATCH_SIZE - 1);
```

#### 4. Otimizar Deduplicação (garantir que verifica TODO o histórico)

O código atual já faz isso corretamente:
- Busca alertas existentes apenas para os IDs do lote atual (linhas 223-233)
- Isso é eficiente porque só verifica as movimentações que serão processadas
- Como cada movimentação tem ID único, a deduplicação funciona corretamente

**Mas há uma melhoria necessária:** Se uma movimentação já foi processada em execução anterior (alerta já existe), ela ainda será contada no total. Para evitar reprocessar, podemos **excluir** movimentações que já têm alertas:

```typescript
// ANTES do loop principal, filtrar movimentações que já têm TODOS os termos processados
// (otimização opcional - a lógica atual já pula via Set, mas isso reduz I/O)
```

**Decisão:** Manter a lógica atual porque:
- O Set já evita inserções duplicadas
- Filtrar previamente adicionaria complexidade
- O overhead de iterar é mínimo comparado a queries adicionais

---

## Resumo das Alterações

| Linha | Mudança |
|-------|---------|
| 170-173 | Mudar `inicioDoDia` para `seteDiasAtras` (7 dias atrás) |
| 179 | Usar `.gte('created_at', dataFiltro)` |
| 186 | Atualizar log para "movements last 7 days" |
| 206 | Usar `.gte('created_at', dataFiltro)` |

---

## Garantia de Não-Duplicação

1. **Alertas:** Chave composta `movimentacao_id + termo_id` verificada via Set antes de inserir
2. **Audiências:** Chave `movimentacao_id` verificada via Set
3. **Intimações:** Chave `movimentacao_id` verificada via Set
4. **Tarefas:** Trigger `prevent_duplicate_tarefas` no banco bloqueia duplicatas

---

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Movimentações analisadas | 0 (só hoje) | ~4.000 (últimos 7 dias) |
| Tempo de execução | Segundos | 2-5 minutos |
| Alertas duplicados | N/A | Zero (deduplicação existente) |
| Cobertura | Depende de timing | Robusta (7 dias de janela) |

---

## Arquivos a Modificar

- `supabase/functions/monitorar-termos/index.ts` - Alterar filtro de 1 dia para 7 dias

