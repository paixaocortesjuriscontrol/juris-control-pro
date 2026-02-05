

# Plano: Corrigir Progresso DJEN Termos para Refletir Tribunais

## Problema Identificado

Quando a busca é executada com **1 termo** e **1 dia**, o cálculo de percentual usa:
- `globalTotal = totalDias × totalTermos = 1 × 1 = 1`
- Assim que o loop interno inicia, `globalCurrent = 1` e `percentage = 100%`

Porém, o termo ainda está processando **N tribunais** (ex: 27). A barra fica em 100% enquanto as requisições continuam.

## Solução

Refinar o cálculo de progresso para considerar os **tribunais dentro de cada termo**, não apenas o número de termos.

## Alterações Técnicas

### 1. Refatorar cálculo de `globalTotal` (`src/hooks/useDjenTermosEngine.ts`)

**Antes:**
```typescript
const globalTotal = totalDias * totalTermos;
```

**Depois:**
Calcular um peso aproximado por termo baseado no número de tribunais:

```typescript
// Calcular total ponderado: cada termo contribui com (1 + número de tribunais)
const termoPesos = termos.map((t) => {
  const tribs = expandirTribunais(t.tribunais);
  // Mínimo 1 (mesmo sem tribunal), máximo útil para progresso fluido
  return Math.max(1, tribs.length);
});
const totalPesoTermos = termoPesos.reduce((a, b) => a + b, 0);
const globalTotal = totalDias * totalPesoTermos;
```

### 2. Atualizar cálculo de `globalCurrent` dentro do loop

**Antes (linha ~1201):**
```typescript
const globalCurrent = (diaIdx * totalTermos) + termoIdx + 1;
```

**Depois:**
Usar o peso acumulado até o termo atual + progresso interno do tribunal:

```typescript
// Peso acumulado dos termos anteriores
const pesoAnterior = termoPesos.slice(0, termoIdx).reduce((a, b) => a + b, 0);
// Peso do dia inteiro (soma de todos termos)
const pesoDiaCompleto = diaIdx * totalPesoTermos;
// Progresso atual = dias completos + termos anteriores + tribunal atual
const globalCurrent = pesoDiaCompleto + pesoAnterior + tribunalProgress;
```

### 3. Atualizar `updateProgress` no loop de tribunal

Adicionar chamada a `updateProgress` dentro do loop de tribunal (linha ~841) para atualizar o percentual a cada tribunal processado:

```typescript
for (const trib of tribLoop) {
  // ... código existente ...
  
  // Atualizar progresso por tribunal
  tribunalProgress++;
  const globalCurrent = pesoDiaCompleto + pesoAnterior + tribunalProgress;
  const percentage = Math.round((globalCurrent / globalTotal) * 100);
  updateProgress({ globalCurrent, percentage });
  
  await delay(dynamicTribunalDelay);
}
```

### 4. Passar `termoPesos` para função `processarTermo`

Adicionar parâmetro para que a função possa reportar progresso granular:

```typescript
async function processarTermo(
  mon: Monitoramento,
  diaYmd: string,
  signal: AbortSignal,
  runtimeConfig: RuntimeConfig,
  onRateLimit?: (waitMs: number) => void,
  onTribunalProgress?: (current: number, total: number) => void // NOVO
): Promise<...>
```

### 5. Atualizar checkpoint e metadata com novo cálculo

Garantir que o checkpoint e metadata usem o mesmo cálculo ponderado para consistência na retomada.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDjenTermosEngine.ts` | Refatorar cálculo de progresso para ponderar por tribunais |

## Resultado Esperado

**Antes:** 1 termo com 27 tribunais → barra em 100% instantaneamente enquanto processa

**Depois:** 1 termo com 27 tribunais → barra progride de 0% a 100% conforme cada tribunal é processado

## Compatibilidade

- Retomada de checkpoint: será compatível (o peso é recalculado ao carregar termos)
- Execução com múltiplos termos: cada termo ainda contribuirá proporcionalmente
- Banner de Análise: usará o mesmo `detalhes.progress` sincronizado

