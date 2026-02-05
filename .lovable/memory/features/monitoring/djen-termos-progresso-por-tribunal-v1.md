 # Memory: features/monitoring/djen-termos-progresso-por-tribunal-v1
 Updated: 05/02/2026
 
 ## Progresso Granular por Tribunal no DJEN Termos
 
 ### Problema Anterior
 Quando havia apenas 1 termo com 1 dia, o cálculo de progresso usava:
 - `globalTotal = totalDias × totalTermos = 1 × 1 = 1`
 - Percentual ia para 100% instantaneamente enquanto ainda processava 27 tribunais
 
 ### Solução Implementada
 
 #### 1. Cálculo Ponderado por Tribunais
 ```typescript
 const termoPesos = termos.map((t) => {
   const tribs = expandirTribunais(t.tribunais);
   return Math.max(1, tribs.length);
 });
 const totalPesoTermos = termoPesos.reduce((a, b) => a + b, 0);
 const globalTotal = totalDias * totalPesoTermos;
 ```
 
 #### 2. Callback `onTribunalProgress`
 - Adicionado novo parâmetro opcional em `processarTermo()`
 - Chamado após cada tribunal ser processado
 - Permite atualização granular do progresso
 
 #### 3. Limitação de Percentual
 - Percentual limitado a 99% durante execução
 - 100% só aparece quando `status === 'concluido'`
 - Evita "flash" de 100% antes de terminar
 
 ### Resultado
 - **Antes:** 1 termo, 27 tribunais → 100% instantâneo, mensagem mudando
 - **Depois:** 1 termo, 27 tribunais → 0%→99% gradual (ex: 4%, 7%, 11%...), 100% só ao concluir
 
 ### Compatibilidade
 - Checkpoint preservado com novo cálculo
 - Banner e Card sincronizam via `detalhes.progress`
 - Retomada funciona com peso recalculado