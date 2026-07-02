## Objetivo
Na busca DJEN Termos Paralela (Browser e Servidor), o tribunal STF deve sempre ser processado por último, após todos os demais tribunais.

## Motivo
O STF usa um endpoint próprio (STF Digital) que é mais lento e instável. Executá-lo por último evita que ele atrase/trave o início das buscas nos demais tribunais (PJE Comunica).

## Mudanças

### 1. Browser — `src/hooks/useDjenTermosParalelaEngine.ts`
- Remover `'STF'` da 2ª posição do array `TRIBUNAL_PRIORITY_ORDER`.
- Inserir `'STF'` no final do array, após todos os TJs.
- Ajustar `tribunalPriorityRank` para retornar um rank alto para `'STF'` (ex.: `9998`, apenas acima do fallback `999`).
- Remover `'STF'` de `isTribunalPrioritario`.

### 2. Servidor — `monitor-servidor/engines/paralela.js`
- Remover `"STF"` do meio da constante `TODOS_TRIBUNAIS` (atualmente fica entre `TODOS_TRT` e `"STJ"`).
- Inserir `"STF"` no final de `TODOS_TRIBUNAIS`, após todos os TJs.
- Ajustar `tribunalPriorityRank` para retornar um rank alto para `"STF"` (ex.: `9998`).
- Remover `"STF"` de `isTribunalPrioritario`.

## Resultado esperado
A ordem de execução passa a ser: TST → STJ → TRFs → TRTs → TJs → **STF (último)**. A lógica de wave/sharding e prioridade de tipo (`parte` → `advogado` → `palavra-chave` → `processo`) permanece inalterada.