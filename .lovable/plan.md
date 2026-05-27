# Serializar busca de "parte" por tribunal (exceto TST)

## Problema
Hoje, em `useDjenTermosParalelaEngine.ts`, o tipo `parte` gera **uma unidade por (tribunal × monitoramento de parte)**. Resultado: o mesmo tribunal (TJPI, TJSP, etc.) é chamado N vezes em concorrência pelas diferentes VPSs — gera ruído, 429 e a sensação de "monte de TJPI" na execução.

A regra correta (sem `OR` no `nomeParte`, conforme constraint `djen-paralela-parte-sem-palavra-chave`): para cada tribunal não-TST, as N partes devem ser consultadas **em série dentro do mesmo worker**. TST continua paralelo (1 unidade por parte) por ser o tribunal mais pesado e o que mais se beneficia de paralelismo.

## Mudanças (arquivo único)

`src/hooks/useDjenTermosParalelaEngine.ts`

1. **WorkUnit ganha lista de monitoramentos**
   - Trocar `WorkUnit = { tipo; tribunal; monId? }` por `{ tipo; tribunal; monIds?: string[] }`.

2. **Montagem da fila (`filasPorTipo`) para `tipo === 'parte'`**
   - Se `trib === 'TST'` → mantém o comportamento atual: 1 unidade por monitoramento (paralelo entre VPSs).
   - Se `trib !== 'TST'` → cria **1 única unidade** com `monIds = [todos os monitoramentos de parte daquele tribunal ainda não concluídos]`. Pula a unidade se a lista ficar vazia (todos já no checkpoint).

3. **Loop do worker (`worker(...)`)**
   - Após `pickNextUnit`, se `unit.monIds` tem múltiplos elementos, iterar serialmente:
     ```
     for (const monId of unit.monIds) {
       if (signal.aborted) break;
       await processarTribunalTrack(unit.tribunal, unit.tipo, monitoramentos, datas, signal, via.id, monId);
       unidadesConcluidasLista.push(trackKey(unit.tipo, unit.tribunal, monId));
       saveCheckpoint({...});
       syncExecutionProgress({}, true);
     }
     ```
   - Para `tipo !== 'parte'` (monIds vazio/undefined): chama uma única vez como hoje, com `monId = null`.

4. **Tracks (visualização) — sem alteração estrutural**
   - Continuam 1 track por `(tipo, trib, monId)` para que a UI mostre cada parte individualmente. O que muda é só **quem despacha**: um único worker percorre todas as tracks daquele tribunal em sequência, em vez de várias VPSs disputarem o mesmo CloudFront.

5. **Mensagem inicial / log de spawn**
   - Atualizar contagem de "unidades pendentes" considerando que partes não-TST viram 1 unidade agrupada (apenas para fins de mensagem; o total de tracks na UI permanece o mesmo, então a barra de progresso não muda de denominador).

6. **Checkpoint**
   - Continua usando `trackKey(tipo, trib, monId)` por parte individual — assim retomadas após queda só refazem as partes pendentes daquele tribunal, sem regredir as já concluídas dentro da mesma unidade serial.

## Fora de escopo
- Não mexer em `useDjenTermosParalela.ts` (hook React).
- Não tocar em `processarTribunalTrack` nem na lógica de busca (`nomeParte`, validação, dedupe).
- Não alterar TST (parte) — continua paralelo.
- Não alterar tipos `palavra-chave`, `advogado`, `processo`.

## Resultado esperado
- TJPI, TJSP, TRT2 etc. aparecem **1 vez** por execução, com a parte atual sendo atualizada serialmente (`termoAtual` da track ativa).
- TST permanece distribuído entre as VPSs do pool.
- Mantém constraint `djen-paralela-parte-sem-palavra-chave` (nada de `OR`, nada de `palavraChave` para `parte`).
