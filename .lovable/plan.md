## Problema

No motor **Servidor** (`monitor-servidor/engines/paralela.js`), STF é classificado como prioritário junto com TST/STJ/TRTs (linha 66) e cai na `band0`. O `pickNext()` (linhas 1586-1598) não tem gate — qualquer worker livre puxa STF em paralelo com os outros tribunais. Por isso o STF continua rodando antes de tudo terminar.

A regra "STF por último" já existe no motor Browser (`useDjenTermosParalelaEngine.ts`, banda 3 com gate rígido); falta espelhar no Servidor.

## Correção

Criar **banda 3 exclusiva do STF** no Servidor, com gate rígido: só é servida quando bandas 0/1/2 estão vazias **e** sem nenhuma unit em voo.

### Alterações em `monitor-servidor/engines/paralela.js`

1. **`isTribunalPrioritario`** (linhas 64-67): remover STF — passa a valer só para TST/STJ/TRTs.

2. **Classificação em bandas** (linhas 1559-1573):
   - Adicionar `band3 = []`.
   - No loop: se `item.tribunal === 'STF'` e `MAIN_TIPOS.includes(item.tipo)`, vai para `band3`. Caso contrário mantém band0/band1/band2 atuais.
   - Incluir `band3` em `bands` e ordenar com `comparePriorityUnits`.

3. **Retry injetado** (linhas 1640-1642): mesma regra — STF cai em band3.

4. **`inBand`** (linha 1585): passar de `[0,0,0]` para `[0,0,0,0]`.

5. **`pickNext()`** (linhas 1586-1598): gate rígido para band3.
   ```js
   const pickNext = () => {
     for (let b = 0; b < 3; b++) {
       if (bands[b].length > 0) { bandAtual = b; return bands[b].shift(); }
     }
     // STF (band3) só libera quando 0/1/2 vazias E sem units em voo
     if (bands[3].length > 0 && inBand[0] + inBand[1] + inBand[2] === 0) {
       bandAtual = 3;
       return bands[3].shift();
     }
     return null;
   };
   ```

6. **Loop do worker** (linhas 1784-1789): aguardar quando ainda há STF pendente ou units em voo, em vez de encerrar.
   ```js
   if (!unit) {
     const emVoo = inBand[0] + inBand[1] + inBand[2] + inBand[3];
     const stfPendente = bands[3].length > 0;
     if (emVoo > 0 || stfPendente) { await delay(500); continue; }
     break;
   }
   ```

7. **Log inicial** (linha 1601): incluir `stf: band3.length` em `bandas` para visibilidade.

Nada muda em Browser, edge functions, banco ou UI.

## Detalhes técnicos

- `inBand` já é incrementado/decrementado no worker (linhas 1790-1792), então o gate funciona sem ajustes extras.
- Retries pendentes de STF também respeitam a nova classificação.
- Dentro da band3, `comparePriorityUnits` mantém a ordenação por shard já existente.
